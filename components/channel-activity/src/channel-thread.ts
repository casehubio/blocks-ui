import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { QhorusMessage, CommitmentState, Reaction } from './types.js';
import { commitmentStateCategory } from './types.js';
import './channel-message.js';

@customElement('channel-thread')
export class ChannelThreadElement extends LitElement {
  @property({ type: Object }) rootMessage!: QhorusMessage;
  @property({ type: Array }) replies: QhorusMessage[] = [];
  @property({ type: Array }) reactions: Reaction[] = [];
  @property({ type: Boolean }) collapsed = true;
  @property({ type: String }) commitmentState?: CommitmentState;

  static override readonly styles = css`
    :host {
      display: block;
      border-left: 2px solid var(--pages-neutral-5, #d4d4d4);
      margin: var(--pages-space-2, 8px) 0;
      border-radius: var(--pages-radius-sm, 4px);
    }
    .thread-header {
      display: flex;
      align-items: center;
      gap: var(--pages-space-2, 8px);
      padding: var(--pages-space-1, 4px) var(--pages-space-2, 8px);
    }
    .thread-toggle {
      font-size: var(--pages-font-size-xs, 11px);
      color: var(--pages-accent-9, #6366f1);
      cursor: pointer;
      background: none;
      border: none;
      padding: 2px 6px;
      border-radius: var(--pages-radius-sm, 4px);
    }
    .thread-toggle:hover { background: var(--pages-neutral-3, #e5e5e5); }
    .thread-commitment {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: var(--pages-radius-sm, 4px);
    }
    .commitment-active { background: var(--pages-accent-3, #e0e7ff); color: var(--pages-accent-11, #3730a3); }
    .commitment-info { background: var(--pages-info-3, #dbeafe); color: var(--pages-info-11, #1e40af); }
    .commitment-success { background: var(--pages-success-3, #d1fae5); color: var(--pages-success-11, #065f46); }
    .commitment-danger { background: var(--pages-danger-3, #fee2e2); color: var(--pages-danger-11, #991b1b); }
    .commitment-neutral { background: var(--pages-neutral-3, #e5e5e5); color: var(--pages-neutral-9, #737373); }
    .commitment-transfer { background: var(--pages-info-3, #dbeafe); color: var(--pages-info-11, #1e40af); }
    .commitment-warning { background: var(--pages-warning-3, #fef3c7); color: var(--pages-warning-11, #92400e); }
    .reply { padding-left: var(--pages-space-4, 16px); }
  `;

  private _toggle() {
    this.collapsed = !this.collapsed;
  }

  private _summary(): string {
    const count = this.replies.length;
    if (count === 0) return 'no replies';
    return `${count} ${count === 1 ? 'reply' : 'replies'}`;
  }

  override render() {
    if (!this.rootMessage) return nothing;

    return html`
      <channel-message .message=${this.rootMessage}
                      .reactions=${this.reactions}
                      .commitmentState=${this.commitmentState}></channel-message>
      ${this.replies.length > 0 ? html`
        <div class="thread-header">
          <button class="thread-toggle"
                  @click=${this._toggle}
                  aria-expanded=${!this.collapsed}>
            ${this.collapsed ? '▶' : '▼'} ${this._summary()}
          </button>
          ${this.commitmentState ? html`
            <span class="thread-commitment commitment-${commitmentStateCategory(this.commitmentState)}">
              ${this.commitmentState}
            </span>
          ` : nothing}
        </div>
        ${!this.collapsed ? html`
          ${this.replies.map(r => html`
            <div class="reply">
              <channel-message .message=${r}></channel-message>
            </div>
          `)}
        ` : nothing}
      ` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'channel-thread': ChannelThreadElement;
  }
}
