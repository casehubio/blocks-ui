import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PlaybackItem } from './types.js';

@customElement('casehub-avatar')
export class CasehubAvatar extends LitElement {
  @property({ type: String, attribute: 'avatar-url' }) avatarUrl = '';
  @property({ type: String }) body: 'M' | 'F' = 'F';
  @property({ type: String }) mood = 'neutral';
  @property({ type: String, attribute: 'camera-view' }) cameraView: 'head' | 'upper' | 'full' = 'head';
  @property({ type: Boolean, attribute: 'camera-rotate' }) cameraRotate = true;
  @property({ type: Boolean, attribute: 'camera-zoom' }) cameraZoom = true;
  @property({ type: Boolean, attribute: 'camera-pan' }) cameraPan = true;
  @property({ type: String, attribute: 'lipsync-lang' }) lipsyncLang = 'en';
  @property({ type: Array }) audioQueue: PlaybackItem[] = [];

  @state() private _loading = true;
  @state() private _speaking = false;

  private _head: any = null;
  private _processingQueue = false;

  get loading() { return this._loading; }
  get speaking() { return this._speaking; }

  static override readonly styles = css`
    :host {
      display: block;
      position: relative;
      background: var(--pages-surface, #111);
    }
    .avatar-container {
      width: 100%;
      height: 100%;
      min-height: 200px;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'img');
    this.setAttribute('aria-label', '3D avatar');
    this.setAttribute('aria-busy', 'true');
    this._initTalkingHead();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._head = null;
  }

  protected override updated(changed: Map<string, unknown>) {
    if (changed.has('audioQueue') && this.audioQueue.length > 0 && !this._processingQueue) {
      this._processQueue();
    }
  }

  private async _initTalkingHead() {
    try {
      const { TalkingHead } = await import('talkinghead');
      const container = this.shadowRoot!.querySelector('.avatar-container');
      if (!container) return;
      this._head = new TalkingHead(container, {
        ttsEndpoint: null,
        lipsyncModules: [this.lipsyncLang],
        cameraView: this.cameraView,
        cameraRotateEnable: this.cameraRotate,
        cameraZoomEnable: this.cameraZoom,
        cameraPanEnable: this.cameraPan,
      });
      await this._head.showAvatar({
        url: this.avatarUrl,
        body: this.body,
        avatarMood: this.mood,
        lipsyncLang: this.lipsyncLang,
      });
      this._loading = false;
      this.setAttribute('aria-busy', 'false');
    } catch (e) {
      console.error('[casehub-avatar] init error:', e);
      this._loading = false;
      this.setAttribute('aria-busy', 'false');
    }
  }

  // Matches original: if head is null, play audio without lip-sync via raw AudioContext.
  // Original (line 265-267): if no meshes, source.onended = playNextQueued; return;
  private async _processQueue() {
    if (this._processingQueue) return;
    this._processingQueue = true;
    while (this.audioQueue.length > 0) {
      const item = this.audioQueue[0]!;
      this._speaking = true;
      if (this._head) {
        // GE-20260827-a19839: speakAudio silently fails from microtask context
        await new Promise<void>((resolve) => {
          setTimeout(async () => {
            try {
              await this._head.speakAudio({
                audio: item.audio,
                visemes: item.visemes,
                vtimes: item.vtimes,
                vdurations: item.vdurations,
              });
            } catch (e) {
              console.error('[casehub-avatar] speakAudio error:', e);
            }
            const waitForDone = () => {
              if (this._head?.isSpeaking) {
                requestAnimationFrame(waitForDone);
              } else {
                resolve();
              }
            };
            waitForDone();
          }, 0);
        });
      } else {
        // Fallback: play audio without lip-sync via raw AudioContext
        await this._playAudioRaw(item.audio);
      }
      this.audioQueue = this.audioQueue.slice(1);
    }
    this._speaking = false;
    this._processingQueue = false;
  }

  private _playAudioRaw(audio: AudioBuffer): Promise<void> {
    return new Promise((resolve) => {
      const ctx = new AudioContext();
      const source = ctx.createBufferSource();
      source.buffer = audio;
      source.connect(ctx.destination);
      source.onended = () => resolve();
      source.start();
    });
  }

  protected override render() {
    return html`<div class="avatar-container"></div>`;
  }
}
