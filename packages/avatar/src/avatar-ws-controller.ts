import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { ConversationTurn, PlaybackItem, VisemeFrame } from './types.js';

export interface AvatarWsHost extends ReactiveControllerHost {
  turns: ConversationTurn[];
  avatarAudioQueue: PlaybackItem[];
  connectionState: 'connecting' | 'connected' | 'disconnected';
}

export class AvatarWsController implements ReactiveController {
  private _host: AvatarWsHost;
  private _wsUrl: string;
  private _reconnectMs: number;
  private _ws: WebSocket | null = null;
  private _shouldReconnect = true;
  private _pendingVisemes: VisemeFrame[] | null = null;
  private _audioCtx: AudioContext | null = null;

  constructor(host: AvatarWsHost, config: { wsUrl: string; reconnectMs?: number }) {
    this._host = host;
    this._wsUrl = config.wsUrl;
    this._reconnectMs = config.reconnectMs ?? 2000;
    host.addController(this);
  }

  hostConnected() { this._connect(); }

  hostDisconnected() {
    this._shouldReconnect = false;
    this._ws?.close();
    this._ws = null;
  }

  private _connect() {
    const proto = globalThis.location?.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = globalThis.location?.host ?? 'localhost';
    const url = this._wsUrl.startsWith('ws') ? this._wsUrl : `${proto}//${host}${this._wsUrl}`;
    this._ws = new WebSocket(url);
    this._host.connectionState = 'connecting';
    this._host.requestUpdate();

    this._ws.onopen = () => {
      this._host.connectionState = 'connected';
      this._host.requestUpdate();
    };

    this._ws.onmessage = (evt: MessageEvent) => {
      if (typeof evt.data === 'string') {
        this._handleTextMessage(JSON.parse(evt.data));
      } else {
        this._handleBinaryMessage(evt.data as Blob);
      }
    };

    this._ws.onclose = () => {
      this._host.connectionState = 'disconnected';
      this._host.requestUpdate();
      if (this._shouldReconnect) {
        setTimeout(() => this._connect(), this._reconnectMs);
      }
    };

    this._ws.onerror = () => {
      this._host.connectionState = 'disconnected';
      this._host.requestUpdate();
    };
  }

  private _handleTextMessage(msg: { type: string; [key: string]: unknown }) {
    switch (msg.type) {
      case 'partial': {
        const last = this._host.turns[this._host.turns.length - 1];
        if (last && last.role === 'user' && last.status === 'partial') {
          this._host.turns = [...this._host.turns.slice(0, -1), { role: 'user', text: msg.text as string, status: 'partial' }];
        } else {
          this._host.turns = [...this._host.turns, { role: 'user', text: msg.text as string, status: 'partial' }];
        }
        this._host.requestUpdate();
        break;
      }
      case 'transcript': {
        const last = this._host.turns[this._host.turns.length - 1];
        if (last && last.role === 'user' && last.status === 'partial') {
          this._host.turns = [...this._host.turns.slice(0, -1), { role: 'user', text: msg.text as string, status: 'final' }];
        } else {
          this._host.turns = [...this._host.turns, { role: 'user', text: msg.text as string, status: 'final' }];
        }
        this._host.requestUpdate();
        break;
      }
      case 'response':
        this._host.turns = [...this._host.turns, { role: 'avatar', text: msg.text as string, status: 'final' }];
        this._host.requestUpdate();
        break;
      case 'phonemes':
        this._pendingVisemes = (msg.data as VisemeFrame[]) ?? null;
        break;
      case 'timing':
        if (this._host instanceof EventTarget) {
          this._host.dispatchEvent(new CustomEvent('avatar:timing', { detail: msg, bubbles: true, composed: true }));
        }
        break;
      case 'error':
        if (this._host instanceof EventTarget) {
          this._host.dispatchEvent(new CustomEvent('avatar:error', { detail: { message: msg.message }, bubbles: true, composed: true }));
        }
        break;
    }
  }

  private async _handleBinaryMessage(data: Blob | ArrayBuffer) {
    // Capture visemes SYNCHRONOUSLY before any yield point (await).
    // Prevents interleaving from overwriting pendingVisemes while
    // we're decoding the audio blob. Matches original (lines 228-235).
    const myVisemes = this._pendingVisemes;
    this._pendingVisemes = null;

    if (!this._audioCtx) this._audioCtx = new AudioContext();
    try {
      const arrayBuf = data instanceof Blob ? await data.arrayBuffer() : data;
      const audioBuf = await this._audioCtx.decodeAudioData(arrayBuf.slice(0));
      const item = this._buildPlaybackItem(audioBuf, myVisemes);
      this._host.avatarAudioQueue = [...this._host.avatarAudioQueue, item];
      this._host.requestUpdate();
    } catch (e) {
      console.error('[AvatarWsController] audio decode error:', e);
    }
  }

  private _buildPlaybackItem(audio: AudioBuffer, frames: VisemeFrame[] | null): PlaybackItem {
    if (!frames || frames.length === 0) {
      return { audio, visemes: ['sil'], vtimes: [0], vdurations: [audio.duration] };
    }
    const visemes: string[] = [];
    const vtimes: number[] = [];
    const vdurations: number[] = [];
    for (const f of frames) {
      visemes.push(f.viseme);
      vtimes.push(f.startMs / 1000);
      vdurations.push((f.endMs - f.startMs) / 1000);
    }
    return { audio, visemes, vtimes, vdurations };
  }

  sendStart(opts: { sampleRate: number; llmModel?: string | undefined; ttsModel?: string | undefined }) {
    this._send(JSON.stringify({ type: 'start', ...opts }));
  }

  sendStop() {
    this._send(JSON.stringify({ type: 'stop' }));
  }

  sendText(text: string, opts?: { llmModel?: string; ttsModel?: string }) {
    this._send(JSON.stringify({ type: 'text', text, ...opts }));
  }

  sendAudio(buffer: ArrayBuffer) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(buffer);
    }
  }

  private _send(data: string) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(data);
    }
  }
}
