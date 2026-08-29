import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { onPagesEvent } from '@casehubio/pages-data';
import type { DebateStreamEntry } from './types.js';

const AGENT_LABELS: Record<string, string> = {
  REV: 'Reviewer',
  IMP: 'Implementer',
  HUMAN: 'Human',
  SUPERVISOR: 'Supervisor',
  MODERATOR: 'Moderator',
  SELECTOR: 'Selector',
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  RAISE: 'raised point',
  AGREE: 'agreed',
  COUNTER: 'countered',
  DISPUTE: 'disputed',
  QUALIFY: 'qualified',
  FLAG_HUMAN: 'flagged for human',
  DECLINED: 'declined',
  MEMO: 'memo',
  SUB_TASK_REQUEST: 'sub-task request',
  SUB_TASK_FINDING: 'sub-task finding',
  SUB_TASK_ERROR: 'sub-task error',
  RESTART_CONTEXT: 'restart',
  COMMENT: 'commented',
  HUMAN_OVERRIDE: 'overrode',
  REPRIORITISE: 'reprioritised',
  VERIFIED: 'verified',
  DEFERRED: 'deferred',
};

@customElement('debate-feed')
export class DebateFeed extends LitElement {
  @state() _entries: DebateStreamEntry[] = [];
  @state() private _debateSessionId: string | null = null;

  private _cleanups: (() => void)[] = [];
  private _shouldAutoScroll = true;

  private _configured = false;

  configure(props: Record<string, unknown>): void {
    this._configured = true;
    if (props.debateSessionId !== undefined) {
      this._debateSessionId = props.debateSessionId as string;
      this._entries = [];
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'log');
    this.setAttribute('aria-label', 'Debate feed');
    this.setAttribute('aria-live', 'polite');
    this._cleanups.push(
      onPagesEvent<DebateStreamEntry[]>(document, 'debate-entries', (payload) => {
        this._entries = [...this._entries, ...payload];
      }),
      onPagesEvent(document, 'reconnected', () => {
        this._entries = [];
      }),
    );
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._cleanups.forEach(fn => fn());
    this._cleanups = [];
  }

  override updated(): void {
    if (this._shouldAutoScroll) {
      const container = this.renderRoot.querySelector('.debate-container');
      if (container) container.scrollTop = container.scrollHeight;
    }
  }

  private _onContainerScroll(e: Event): void {
    const el = e.target as HTMLElement;
    this._shouldAutoScroll =
      el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }

  private _onEntryClick(entry: DebateStreamEntry): void {
    if (entry.pointId && entry.entryType !== 'RESTART_CONTEXT') {
      this.dispatchEvent(new CustomEvent('point-selected', {
        bubbles: true,
        detail: {
          pointId: entry.pointId,
          round: entry.round,
          location: entry.location,
        },
      }));
    }
  }

  private _formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .debate-container {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .placeholder {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--pages-neutral-8, #9ca3af);
      font-size: 13px;
      text-align: center;
      padding: 40px;
    }

    .round-divider {
      margin: 20px 0 12px;
      padding: 4px 10px;
      border-bottom: 1px solid var(--pages-neutral-5, #d4d4d4);
      color: var(--pages-neutral-8, #9ca3af);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .entry {
      padding: 10px 12px;
      border: 1px solid var(--pages-neutral-4, #e5e7eb);
      border-radius: 3px;
      background: var(--pages-neutral-1, #fafafa);
      cursor: pointer;
      transition: all 0.15s;
    }

    .entry:hover {
      border-color: var(--pages-accent-9, #6366f1);
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .entry-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      font-size: 11px;
      color: var(--pages-neutral-8, #9ca3af);
    }

    .entry-agent {
      font-weight: 600;
      color: var(--sepia, var(--pages-neutral-11, #6b7280));
    }
    .entry-agent.human {
      color: var(--human-badge, #e67e22);
    }

    .entry-timestamp {
      margin-left: auto;
      font-size: 10px;
    }

    .entry-content {
      color: var(--pages-neutral-12, #111);
      line-height: 1.5;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .entry-meta {
      margin-top: 6px;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 2px;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .badge-priority-high { background: var(--pages-error-9, #dc2626); color: white; }
    .badge-priority-medium { background: var(--pages-warning-9, #d97706); color: white; }
    .badge-priority-low { background: var(--pages-neutral-8, #9ca3af); color: white; }
    .badge-scope { background: var(--pages-accent-2, #e0e7ff); color: var(--pages-accent-9, #6366f1); border: 1px solid var(--pages-accent-9, #6366f1); }
    .badge-location { background: var(--chrome, var(--pages-neutral-2, #f5f5f5)); color: var(--sepia, var(--pages-neutral-11, #6b7280)); border: 1px solid var(--pages-neutral-5, #d4d4d4); font-family: 'SFMono-Regular', Consolas, monospace; }

    .entry-raise { border-left: 3px solid var(--pages-neutral-12, #111); }
    .entry-agree { border-left: 3px solid var(--pages-success-9, #16a34a); }
    .entry-counter { border-left: 3px solid var(--pages-warning-9, #d97706); }
    .entry-dispute { border-left: 3px solid var(--pages-error-9, #dc2626); }
    .entry-qualify { border-left: 3px solid var(--pages-accent-9, #6366f1); }

    .entry-flag_human {
      border: 2px solid var(--pages-warning-9, #d97706);
      background: var(--pages-warning-2, #fef3c7);
    }

    .entry-flag_human::before {
      content: '⚠️ HUMAN ATTENTION REQUIRED';
      display: block;
      margin-bottom: 6px;
      font-size: 10px;
      font-weight: 700;
      color: var(--pages-warning-9, #d97706);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .entry-declined {
      opacity: 0.5;
      text-decoration: line-through;
      background: var(--chrome, var(--pages-neutral-2, #f5f5f5));
    }

    .entry-memo {
      font-style: italic;
      color: var(--pages-neutral-8, #9ca3af);
      border-left: 3px solid var(--pages-neutral-4, #e5e7eb);
    }

    .entry-sub_task_request,
    .entry-sub_task_finding,
    .entry-sub_task_error {
      margin-left: 24px;
      border-left: 2px dashed var(--pages-neutral-5, #d4d4d4);
      background: var(--chrome, var(--pages-neutral-2, #f5f5f5));
      font-size: 12px;
    }

    .entry-restart_context {
      border: none;
      background: none;
      padding: 8px 0;
      text-align: center;
      color: var(--pages-neutral-8, #9ca3af);
      font-size: 11px;
      cursor: default;
    }

    .entry-restart_context:hover {
      border: none;
      box-shadow: none;
    }

    .entry-restart_context::before {
      content: '';
      display: block;
      width: 100%;
      height: 1px;
      border-top: 1px dashed var(--pages-neutral-5, #d4d4d4);
      margin-bottom: 4px;
    }

    .entry-restart_context::after {
      content: '';
      display: block;
      width: 100%;
      height: 1px;
      border-top: 1px dashed var(--pages-neutral-5, #d4d4d4);
      margin-top: 4px;
    }
  `;

  private _renderEntry(entry: DebateStreamEntry) {
    const typeClass = entry.entryType.toLowerCase();

    if (entry.entryType === 'RESTART_CONTEXT') {
      return html`<div class="entry entry-restart_context"><span>── session branched ──</span></div>`;
    }

    const hasMeta = entry.priority || entry.scope || entry.location ||
      (entry.pointId && (entry.entryType === 'SUB_TASK_REQUEST' ||
        entry.entryType === 'SUB_TASK_FINDING' ||
        entry.entryType === 'SUB_TASK_ERROR'));

    return html`
      <div class="entry entry-${typeClass}" @click=${() => this._onEntryClick(entry)}>
        <div class="entry-header">
          <span class="entry-agent ${entry.agentRole === 'HUMAN' ? 'human' : ''}">${entry.agentRole === 'HUMAN' ? '👤 ' : ''}${AGENT_LABELS[entry.agentRole] || entry.agentRole}</span>
          <span>${ENTRY_TYPE_LABELS[entry.entryType] || entry.entryType}</span>
          ${entry.timestamp ? html`<span class="entry-timestamp">${this._formatTimestamp(entry.timestamp)}</span>` : nothing}
        </div>
        <div class="entry-content">${entry.content}</div>
        ${hasMeta ? html`
          <div class="entry-meta">
            ${entry.priority ? html`<span class="badge badge-priority-${entry.priority.toLowerCase()}">${entry.priority}</span>` : nothing}
            ${entry.scope ? html`<span class="badge badge-scope">${entry.scope}</span>` : nothing}
            ${entry.location ? html`<span class="badge badge-location">${entry.location}</span>` : nothing}
            ${entry.pointId && (entry.entryType === 'SUB_TASK_REQUEST' || entry.entryType === 'SUB_TASK_FINDING' || entry.entryType === 'SUB_TASK_ERROR')
              ? html`<span class="badge">→ ${entry.pointId.substring(0, 8)}</span>` : nothing}
          </div>
        ` : nothing}
      </div>
    `;
  }

  override render() {
    if (!this._configured) {
      return html`<div class="placeholder"><div>Waiting for debate session…</div></div>`;
    }

    if (this._entries.length === 0) {
      return html`<div class="debate-container"><div class="placeholder">No entries yet</div></div>`;
    }

    let currentRound: number | null = null;
    return html`
      <div class="debate-container" @scroll=${this._onContainerScroll}>
        ${this._entries.map(entry => {
          const parts = [];
          if (entry.round !== currentRound) {
            currentRound = entry.round;
            parts.push(html`<div class="round-divider">Round ${entry.round}</div>`);
          }
          parts.push(this._renderEntry(entry));
          return parts;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'debate-feed': DebateFeed;
  }
}
