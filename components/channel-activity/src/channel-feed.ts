import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { QhorusMessage, Reaction, CommitmentState } from './types.js';
import { isTerminalMessageType } from './types.js';
import { emitPagesEvent } from '@casehubio/blocks-ui-core';
import { ChannelEventTopics } from './events.js';
import './channel-message.js';
import './channel-thread.js';

interface MessageGroup {
  sender: string;
  actorType: string;
  messages: QhorusMessage[];
}

const CURSOR_STORAGE_KEY = 'channel-activity.cursors';

@customElement('channel-feed')
export class ChannelFeedElement extends LitElement {
  @property({ type: Array }) messages: QhorusMessage[] = [];
  @property({ type: Array }) reactions: Reaction[] = [];
  @property({ type: Object }) commitments: Map<string, CommitmentState> = new Map();
  @property({ type: String }) channelId = '';
  @property({ type: String }) channelName?: string;
  @property({ type: Boolean }) terminalDimming = true;
  @property({ type: Boolean }) eventStyling = true;
  @property({ type: Boolean }) autoScroll = true;
  @property({ type: Number }) staleCursorMinutes = 30;
  @property({ attribute: false }) renderContextHeader?: () => TemplateResult;

  @state() private _prevMessageCount = 0;
  @state() private _showStalePrompt = false;
  @state() private _staleCursorId?: string;

  static override readonly styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
    .feed {
      flex: 1;
      overflow-y: auto;
      scroll-behavior: smooth;
    }
    @media (prefers-reduced-motion: reduce) {
      .feed { scroll-behavior: auto; }
    }
    .message-group-header {
      display: flex;
      align-items: center;
      gap: var(--pages-space-2, 8px);
      padding: var(--pages-space-3, 12px) var(--pages-space-4, 16px) 0;
    }
    .group-sender {
      font-weight: var(--pages-font-weight-semibold, 600);
      font-size: var(--pages-font-size-sm, 13px);
    }
    .message-item.terminal-dimmed { opacity: 0.8; }
    .message-item.event-dimmed { opacity: 0.55; }
    .message-item.event-dimmed channel-message { font-style: italic; }
    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--pages-neutral-8, #888);
      font-size: var(--pages-font-size-sm, 13px);
    }
    .stale-prompt {
      display: flex;
      flex-direction: column;
      gap: var(--pages-space-2, 8px);
      padding: var(--pages-space-3, 12px) var(--pages-space-4, 16px);
      background: var(--pages-warning-3, #fef3c7);
      border-bottom: 1px solid var(--pages-warning-11, #92400e);
      font-size: var(--pages-font-size-sm, 13px);
    }
    .stale-prompt button {
      background: var(--pages-neutral-1, #fafafa);
      border: 1px solid var(--pages-neutral-5, #d4d4d4);
      border-radius: var(--pages-radius-sm, 4px);
      padding: var(--pages-space-1, 4px) var(--pages-space-2, 8px);
      cursor: pointer;
      font-size: var(--pages-font-size-xs, 11px);
      text-align: left;
    }
    .stale-prompt button:hover { background: var(--pages-neutral-3, #e5e5e5); }
  `;

  private _loadCursors(): Record<string, { id: string; ts: number }> {
    try {
      const stored = sessionStorage.getItem(CURSOR_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (_e) { /* ignore */ }
    return {};
  }

  private _checkStaleCursor() {
    if (this.staleCursorMinutes <= 0 || !this.channelId) {
      this._showStalePrompt = false;
      return;
    }
    const cursors = this._loadCursors();
    const cursor = cursors[this.channelId];
    if (cursor && Date.now() - cursor.ts >= this.staleCursorMinutes * 60 * 1000) {
      this._showStalePrompt = true;
      this._staleCursorId = cursor.id;
    } else {
      this._showStalePrompt = false;
    }
  }

  private _onCatchUp() {
    this._showStalePrompt = false;
    emitPagesEvent(this, ChannelEventTopics.CURSOR_CATCHUP, {
      channelId: this.channelId,
      cursorId: this._staleCursorId,
    });
  }

  private _onReload() {
    this._showStalePrompt = false;
    emitPagesEvent(this, ChannelEventTopics.CURSOR_RELOAD, {
      channelId: this.channelId,
    });
  }

  _separateRootsAndReplies(): {
    roots: QhorusMessage[];
    repliesByParent: Map<string, QhorusMessage[]>;
  } {
    const messageIds = new Set(this.messages.map(m => m.id));
    const repliesByParent = new Map<string, QhorusMessage[]>();
    const roots: QhorusMessage[] = [];

    for (const m of this.messages) {
      if (m.inReplyTo && messageIds.has(m.inReplyTo)) {
        const list = repliesByParent.get(m.inReplyTo) ?? [];
        list.push(m);
        repliesByParent.set(m.inReplyTo, list);
      } else {
        roots.push(m);
      }
    }
    return { roots, repliesByParent };
  }

  private _groupFlat(messages: QhorusMessage[]): MessageGroup[] {
    const groups: MessageGroup[] = [];
    const TWO_MINUTES = 2 * 60 * 1000;

    for (const msg of messages) {
      const last = groups[groups.length - 1];
      if (last && last.sender === msg.sender) {
        const lastTime = new Date(last.messages[last.messages.length - 1]!.createdAt).getTime();
        const thisTime = new Date(msg.createdAt).getTime();
        if (thisTime - lastTime < TWO_MINUTES) {
          last.messages = [...last.messages, msg];
          continue;
        }
      }
      groups.push({ sender: msg.sender, actorType: msg.actorType, messages: [msg] });
    }
    return groups;
  }

  private _buildReactionIndex(): Map<string, Reaction[]> {
    const index = new Map<string, Reaction[]>();
    for (const r of this.reactions) {
      const list = index.get(r.messageId);
      if (list) list.push(r);
      else index.set(r.messageId, [r]);
    }
    return index;
  }

  private _threadReactions(rootId: string, replies: QhorusMessage[], index: Map<string, Reaction[]>): Reaction[] {
    const result: Reaction[] = [];
    const rootReactions = index.get(rootId);
    if (rootReactions) result.push(...rootReactions);
    for (const r of replies) {
      const replyReactions = index.get(r.id);
      if (replyReactions) result.push(...replyReactions);
    }
    return result;
  }

  private _messageItemClasses(msg: QhorusMessage): string {
    const classes = ['message-item'];
    if (this.terminalDimming && isTerminalMessageType(msg.messageType)) {
      classes.push('terminal-dimmed');
    }
    if (this.eventStyling && msg.messageType === 'EVENT') {
      classes.push('event-dimmed');
    }
    return classes.join(' ');
  }

  override willUpdate(changed: Map<string, unknown>) {
    if (changed.has('channelId')) {
      this._checkStaleCursor();
    }
    if (changed.has('messages') && this.messages.length > 0) {
      this._showStalePrompt = false;
    }
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('messages') && this.autoScroll && this.messages.length > this._prevMessageCount) {
      const feed = this.renderRoot.querySelector('.feed');
      if (feed) {
        const wasAtBottom = feed.scrollHeight - feed.scrollTop <= feed.clientHeight + 4;
        if (wasAtBottom) {
          requestAnimationFrame(() => { feed.scrollTop = feed.scrollHeight; });
        }
      }
    }
    this._prevMessageCount = this.messages.length;
  }

  override connectedCallback() {
    super.connectedCallback();
    if (this.channelId) this._checkStaleCursor();
  }

  override render() {
    return html`
      ${this.renderContextHeader?.() ?? nothing}
      ${this._showStalePrompt ? html`
        <div class="stale-prompt">
          <span>You were away for a while.</span>
          <button class="stale-catchup" @click=${this._onCatchUp}>Catch up from where you left off</button>
          <button class="stale-reload" @click=${this._onReload}>Reload full history</button>
        </div>
      ` : nothing}
      <div class="feed" role="log" aria-live="polite">
        ${this.messages.length === 0 ? html`
          <div class="empty">No messages yet</div>
        ` : this._renderFeed()}
      </div>
    `;
  }

  private _renderFeed() {
    const { roots, repliesByParent } = this._separateRootsAndReplies();
    const reactionIndex = this._buildReactionIndex();
    return this._groupFlat(roots).map(group => html`
      <div class="message-group">
        <div class="message-group-header">
          <span class="group-sender">${group.sender}</span>
        </div>
        ${group.messages.map(msg => repliesByParent.has(msg.id) ? html`
          <channel-thread .rootMessage=${msg}
                         .replies=${repliesByParent.get(msg.id)!}
                         .reactions=${this._threadReactions(msg.id, repliesByParent.get(msg.id)!, reactionIndex)}>
          </channel-thread>
        ` : html`
          <div class="${this._messageItemClasses(msg)}">
            <channel-message .message=${msg}
                            .reactions=${reactionIndex.get(msg.id) ?? []}
                            .showActorBadge=${group.messages.indexOf(msg) === 0}
                            .channelName=${this.channelName}
                            .parentMessage=${msg.inReplyTo ? this.messages.find(m => m.id === msg.inReplyTo) : undefined}>
            </channel-message>
          </div>
        `)}
      </div>
    `);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'channel-feed': ChannelFeedElement;
  }
}
