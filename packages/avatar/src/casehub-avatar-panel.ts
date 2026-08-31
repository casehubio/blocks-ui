import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { AvatarWsController } from './avatar-ws-controller.js';
import type { AvatarWsHost } from './avatar-ws-controller.js';
import type { ConversationTurn, PlaybackItem } from './types.js';
import './casehub-avatar.js';
import './casehub-transcript.js';
import './casehub-speech.js';

@customElement('casehub-avatar-panel')
export class CasehubAvatarPanel extends LitElement implements AvatarWsHost {
  @property({ type: String, attribute: 'ws-url' }) wsUrl = '/ws/avatar';
  @property({ type: String, attribute: 'avatar-url' }) avatarUrl = '';
  @property({ type: String }) body: 'M' | 'F' = 'F';
  @property({ type: String }) mood = 'neutral';
  @property({ type: String, attribute: 'llm-model' }) llmModel = 'claude-haiku-4-5@20251001';
  @property({ type: String, attribute: 'tts-model' }) ttsModel = 'lessac-medium';

  @state() turns: ConversationTurn[] = [];
  @state() avatarAudioQueue: PlaybackItem[] = [];
  @state() connectionState: 'connecting' | 'connected' | 'disconnected' = 'disconnected';
  @state() private _statusText = 'Connecting...';

  private _controller!: AvatarWsController;

  static override readonly styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--pages-surface, #1a1a2e);
      color: var(--pages-on-surface, #e0e0e0);
    }
    casehub-avatar {
      flex: 0 0 300px;
      border-bottom: 1px solid var(--pages-neutral-5, #333);
    }
    .status {
      padding: var(--pages-space-1, 4px) var(--pages-space-4, 16px);
      font-size: 0.75rem;
      color: var(--pages-neutral-7, #666);
      text-align: center;
    }
    casehub-transcript {
      flex: 1;
      overflow-y: auto;
    }
    .input-bar {
      display: flex;
      gap: var(--pages-space-2, 8px);
      padding: var(--pages-space-4, 16px);
      border-top: 1px solid var(--pages-neutral-5, #333);
    }
    .input-bar input {
      flex: 1;
      padding: var(--pages-space-3, 12px);
      border-radius: 8px;
      border: 1px solid var(--pages-neutral-5, #555);
      background: var(--pages-surface-variant, #2a2a3e);
      color: var(--pages-on-surface, #e0e0e0);
      font-size: 1rem;
    }
    .input-bar input:focus { outline: none; border-color: var(--pages-primary, #2d5aa0); }
    .input-bar button {
      padding: var(--pages-space-3, 12px) var(--pages-space-6, 24px);
      border-radius: 8px;
      border: none;
      background: var(--pages-primary, #2d5aa0);
      color: var(--pages-on-primary, white);
      font-size: 1rem;
      cursor: pointer;
    }
    .input-bar button:disabled { opacity: 0.5; cursor: default; }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', 'Avatar conversation');
    this._controller = new AvatarWsController(this, { wsUrl: this.wsUrl });
  }

  protected override updated(changed: Map<string, unknown>) {
    if (changed.has('connectionState')) {
      switch (this.connectionState) {
        case 'connecting': this._statusText = 'Connecting...'; break;
        case 'connected':
          this._statusText = 'Connected';
          break;
        case 'disconnected':
          this._statusText = 'Disconnected — reconnecting...';
          break;
      }
    }
  }

  private _onSpeechStart(e: CustomEvent) {
    this._controller.sendStart({
      sampleRate: e.detail.sampleRate,
      llmModel: this.llmModel,
      ttsModel: this.ttsModel,
    });
    this._statusText = 'Listening...';
  }

  private _onSpeechAudio(e: CustomEvent) {
    this._controller.sendAudio(e.detail.buffer);
  }

  private _onSpeechStop() {
    this._controller.sendStop();
    this._statusText = 'Processing speech...';
  }

  // Matches original sendText (line 193-201)
  private _onSendText() {
    const input = this.shadowRoot!.querySelector<HTMLInputElement>('#msg');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    this._controller.sendText(text, { llmModel: this.llmModel, ttsModel: this.ttsModel });
    input.value = '';
    this._statusText = 'Processing...';
  }

  private _onInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') this._onSendText();
  }

  protected override render() {
    const connected = this.connectionState === 'connected';
    return html`
      <casehub-avatar
        avatar-url=${this.avatarUrl}
        body=${this.body}
        mood=${this.mood}
        .audioQueue=${this.avatarAudioQueue}>
      </casehub-avatar>
      <div class="status">${this._statusText}</div>
      <casehub-transcript .turns=${this.turns}></casehub-transcript>
      <div class="input-bar">
        <casehub-speech
          ?disabled=${!connected}
          @speech:start=${this._onSpeechStart}
          @speech:audio=${this._onSpeechAudio}
          @speech:stop=${this._onSpeechStop}>
        </casehub-speech>
        <input id="msg" type="text" placeholder="Type a message..."
          autocomplete="off" ?disabled=${!connected}
          @keydown=${this._onInputKeydown}>
        <button ?disabled=${!connected} @click=${this._onSendText}>Send</button>
      </div>
    `;
  }
}
