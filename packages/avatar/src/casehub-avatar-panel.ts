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
    .controls {
      border-top: 1px solid var(--pages-neutral-5, #333);
      padding: var(--pages-space-4, 16px);
      display: flex;
      justify-content: center;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', 'Avatar conversation');
    this._controller = new AvatarWsController(this, { wsUrl: this.wsUrl });
  }

  private _onSpeechStart(e: CustomEvent) {
    this._controller.sendStart({
      sampleRate: e.detail.sampleRate,
      llmModel: this.llmModel,
      ttsModel: this.ttsModel,
    });
  }

  private _onSpeechAudio(e: CustomEvent) {
    this._controller.sendAudio(e.detail.buffer);
  }

  private _onSpeechStop() {
    this._controller.sendStop();
  }

  private get _statusText(): string {
    switch (this.connectionState) {
      case 'connecting': return 'Connecting...';
      case 'connected': return 'Connected';
      case 'disconnected': return 'Disconnected';
    }
  }

  protected override render() {
    return html`
      <casehub-avatar
        avatar-url=${this.avatarUrl}
        body=${this.body}
        mood=${this.mood}
        .audioQueue=${this.avatarAudioQueue}>
      </casehub-avatar>
      <div class="status">${this._statusText}</div>
      <casehub-transcript .turns=${this.turns}></casehub-transcript>
      <div class="controls">
        <casehub-speech
          ?disabled=${this.connectionState !== 'connected'}
          @speech:start=${this._onSpeechStart}
          @speech:audio=${this._onSpeechAudio}
          @speech:stop=${this._onSpeechStop}>
        </casehub-speech>
      </div>
    `;
  }
}
