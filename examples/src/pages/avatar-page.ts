import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { ConversationTurn } from '../../../packages/avatar/src/types.js';
import '../../../packages/avatar/src/casehub-transcript.js';
import '../../../packages/avatar/src/casehub-speech.js';

@customElement('blocks-example-avatar')
export class AvatarPage extends LitElement {
  @state() private _turns: ConversationTurn[] = [
    { role: 'user', text: 'Hello, can you hear me?', status: 'final' },
    { role: 'avatar', text: 'Yes! I can hear you perfectly.', status: 'final' },
    { role: 'user', text: 'That sounds gre', status: 'partial' },
  ];

  @state() private _eventLog: string[] = [];

  static override styles = css`
    :host { display: flex; flex-direction: column; padding: 24px; height: 100%; box-sizing: border-box; }
    h2 { margin: 0 0 8px; font-size: 20px; font-weight: 600; }
    p { margin: 0 0 16px; font-size: 13px; color: var(--pages-neutral-9, #6b7280); }
    .demo-area { flex: 1; display: flex; gap: 24px; min-height: 0; }
    .transcript-panel { flex: 1; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 6px;
      background: var(--pages-surface, #1a1a2e); overflow: hidden; display: flex; flex-direction: column; }
    .speech-panel { flex: 0 0 200px; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 6px;
      padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .controls { margin-top: 12px; display: flex; gap: 8px; flex-shrink: 0; }
    button { padding: 6px 12px; border-radius: 4px; border: 1px solid #ccc; background: #fff; cursor: pointer; font-size: 13px; }
    button:hover { background: #f0f0f0; }
    .event-log { flex-shrink: 0; margin-top: 12px; padding: 8px 12px; background: var(--pages-neutral-2, #f5f5f5);
      border-radius: 4px; max-height: 80px; overflow-y: auto; font-size: 12px; font-family: monospace; }
  `;

  private _addUserTurn() {
    this._turns = [...this._turns, { role: 'user', text: 'This is a test message from the user.', status: 'final' }];
  }

  private _addAvatarTurn() {
    this._turns = [...this._turns, { role: 'avatar', text: 'That sounds interesting. Tell me more about it.', status: 'final' }];
  }

  private _addPartial() {
    this._turns = [...this._turns, { role: 'user', text: 'I was thinking about', status: 'partial' }];
  }

  private _finalizePartial() {
    const last = this._turns[this._turns.length - 1];
    if (last && last.status === 'partial') {
      this._turns = [...this._turns.slice(0, -1), { ...last, text: 'I was thinking about the project timeline.', status: 'final' }];
    }
  }

  private _clearTurns() {
    this._turns = [];
  }

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener('speech:start', (e: Event) => {
      this._eventLog = [`[${new Date().toLocaleTimeString()}] speech:start sampleRate=${(e as CustomEvent).detail.sampleRate}`, ...this._eventLog.slice(0, 9)];
    });
    this.addEventListener('speech:stop', () => {
      this._eventLog = [`[${new Date().toLocaleTimeString()}] speech:stop`, ...this._eventLog.slice(0, 9)];
    });
    this.addEventListener('speech:audio', () => {
      this._eventLog = [`[${new Date().toLocaleTimeString()}] speech:audio (chunk)`, ...this._eventLog.slice(0, 9)];
    });
  }

  override render() {
    return html`
      <h2>Avatar Components</h2>
      <p>Transcript with partial→final replacement, speech capture with push-to-talk.
        The 3D avatar (TalkingHead/Three.js) requires a GLB model and is not shown in this showcase —
        use the full avatar-demo Quarkus app for the complete pipeline.</p>

      <div class="controls">
        <button @click=${this._addUserTurn}>+ User turn</button>
        <button @click=${this._addAvatarTurn}>+ Avatar turn</button>
        <button @click=${this._addPartial}>+ Partial</button>
        <button @click=${this._finalizePartial}>Finalize partial</button>
        <button @click=${this._clearTurns}>Clear</button>
      </div>

      <div class="demo-area">
        <div class="transcript-panel">
          <casehub-transcript .turns=${this._turns}></casehub-transcript>
        </div>
        <div class="speech-panel">
          <h3 style="font-size:14px;margin:0">Speech Capture</h3>
          <casehub-speech></casehub-speech>
          <p style="font-size:11px;text-align:center">Click Mic to test capture.<br>Requires microphone permission.</p>
        </div>
      </div>

      ${this._eventLog.length > 0 ? html`
        <div class="event-log">
          ${this._eventLog.map(e => html`<div>${e}</div>`)}
        </div>
      ` : ''}
    `;
  }
}
