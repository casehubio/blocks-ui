import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { emitPagesEvent } from '@casehubio/blocks-ui-core';
import { ChannelEventTopics } from './events.js';
import { MESSAGE_TYPES, type MessageType } from './types.js';

@customElement('channel-input')
export class ChannelInputElement extends LitElement {
  @property({ type: String }) channelId = '';
  @property({ type: Object }) replyTo?: { messageId: string; senderName: string } | undefined;
  @property({ type: Boolean }) showTypeSelector = false;
  @property({ attribute: false }) messageTypes: MessageType[] = [...MESSAGE_TYPES];
  @property({ attribute: false }) allowedTypes?: MessageType[];
  @property({ attribute: false }) deniedTypes?: MessageType[];
  @property({ attribute: false }) renderError?: (error: string) => TemplateResult;

  @state() private _text = '';
  @state() private _error = '';
  @state() private _selectedType: MessageType = 'COMMAND';

  @query('textarea') private _textarea!: HTMLTextAreaElement;

  static override readonly styles = css`
    :host {
      display: block;
      padding: var(--pages-space-2, 8px) var(--pages-space-4, 16px);
      border-top: 1px solid var(--pages-neutral-4, #e5e5e5);
    }
    .reply-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--pages-space-1, 4px) var(--pages-space-2, 8px);
      background: var(--pages-accent-2, #eef2ff);
      border-radius: var(--pages-radius-sm, 4px);
      margin-bottom: var(--pages-space-2, 8px);
      font-size: var(--pages-font-size-xs, 11px);
      color: var(--pages-accent-11, #3730a3);
    }
    .reply-cancel {
      cursor: pointer;
      background: none;
      border: none;
      color: var(--pages-neutral-8, #888);
      font-size: 14px;
    }
    .type-selector {
      margin-bottom: var(--pages-space-2, 8px);
    }
    .type-selector select {
      background: var(--pages-neutral-1, #fafafa);
      color: var(--pages-neutral-12, #111);
      border: 1px solid var(--pages-neutral-5, #d4d4d4);
      border-radius: var(--pages-radius-sm, 4px);
      padding: var(--pages-space-1, 4px) var(--pages-space-2, 8px);
      font-size: var(--pages-font-size-xs, 11px);
      font-family: var(--pages-font-family, 'Inter', system-ui, sans-serif);
    }
    textarea {
      width: 100%;
      resize: none;
      border: 1px solid var(--pages-neutral-5, #d4d4d4);
      border-radius: var(--pages-radius-md, 6px);
      padding: var(--pages-space-2, 8px) var(--pages-space-3, 12px);
      font-family: var(--pages-font-family, 'Inter', system-ui, sans-serif);
      font-size: var(--pages-font-size-base, 14px);
      line-height: var(--pages-line-height-base, 20px);
      color: var(--pages-neutral-12, #111);
      background: var(--pages-neutral-1, #fafafa);
      min-height: 40px;
      max-height: 200px;
      overflow-y: auto;
      box-sizing: border-box;
    }
    textarea:focus {
      outline: none;
      border-color: var(--pages-accent-7, #818cf8);
      box-shadow: 0 0 0 2px var(--pages-accent-3, #e0e7ff);
    }
    .error {
      font-size: var(--pages-font-size-xs, 11px);
      color: var(--pages-danger-11, #991b1b);
      margin-top: var(--pages-space-1, 4px);
    }
  `;

  computeAvailableTypes(): MessageType[] {
    let types = this.messageTypes;
    if (this.allowedTypes?.length) {
      types = types.filter(t => this.allowedTypes!.includes(t));
    }
    if (this.deniedTypes?.length) {
      types = types.filter(t => !this.deniedTypes!.includes(t));
    }
    return types;
  }

  private _handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this._send();
    }
  }

  private _handleInput() {
    this._text = this._textarea.value;
    this._autoResize();
  }

  private _autoResize() {
    const ta = this._textarea;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }

  private _send() {
    const content = this._text.trim();
    if (!content || !this.channelId) return;

    this._error = '';
    emitPagesEvent(this, ChannelEventTopics.SEND_MESSAGE, {
      channelId: this.channelId,
      content,
      ...(this.replyTo ? { inReplyTo: this.replyTo.messageId } : {}),
      ...(this.showTypeSelector ? { speechAct: this._selectedType } : {}),
    });

    this._text = '';
    this._textarea.value = '';
    this._textarea.style.height = 'auto';
    this.replyTo = undefined;
  }

  private _cancelReply() {
    this.replyTo = undefined;
  }

  private _onTypeChange(e: Event) {
    this._selectedType = (e.target as HTMLSelectElement).value as MessageType;
  }

  setError(error: string) {
    this._error = error;
  }

  override render() {
    const availableTypes = this.computeAvailableTypes();

    return html`
      ${this.replyTo ? html`
        <div class="reply-banner">
          <span>Replying to <strong>${this.replyTo.senderName}</strong></span>
          <button class="reply-cancel" aria-label="Cancel reply" @click=${this._cancelReply}>✕</button>
        </div>
      ` : nothing}
      ${this.showTypeSelector ? html`
        <div class="type-selector">
          <select @change=${this._onTypeChange} .value=${this._selectedType}>
            ${availableTypes.map(t => html`<option value=${t}>${t}</option>`)}
          </select>
        </div>
      ` : nothing}
      <textarea
        aria-label="Message"
        placeholder="Type a message..."
        @keydown=${this._handleKeydown}
        @input=${this._handleInput}
        rows="1"
      ></textarea>
      ${this._error ? (this.renderError?.(this._error) ?? html`<div class="error">${this._error}</div>`) : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'channel-input': ChannelInputElement;
  }
}
