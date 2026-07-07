import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  type QueueView,
  type QueueSummaryEntry,
  type QueueScopeChangedPayload,
  emitPagesEvent,
  WorkItemEventTopics,
} from '@casehubio/blocks-ui-core';

@customElement('queue-pill-bar')
export class QueuePillBar extends LitElement {
  @property({ type: String }) endpoint = '';
  @property({ type: Array }) queues: QueueView[] = [];
  @property({ type: Array }) summaries: QueueSummaryEntry[] = [];
  @property({ type: String }) selectedQueueId: string | null = null;
  @property({ type: Number }) selectedQueueCount: number | null = null;

  private _pollTimer: number | null = null;
  private _observer: IntersectionObserver | null = null;

  static override styles = css`
    :host {
      display: block;
      padding: var(--pages-space-2, 8px) var(--pages-space-3, 12px);
      border-bottom: 1px solid var(--pages-neutral-4, #e5e5e5);
      background: var(--pages-neutral-2, var(--pages-neutral-2, #f5f5f5));
      overflow-x: auto;
    }

    .pill-bar {
      display: flex;
      gap: var(--pages-space-1, 6px);
      align-items: center;
    }

    .label {
      font-size: 10px;
      color: var(--pages-neutral-9, #888);
      font-weight: 600;
      text-transform: uppercase;
      margin-right: 4px;
      white-space: nowrap;
    }

    [role="radio"] {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 14px;
      border: 1px solid var(--pages-neutral-4, #e5e5e5);
      background: var(--pages-neutral-1, #fafafa);
      color: var(--pages-neutral-12, #111);
      font-size: 11px;
      cursor: pointer;
      white-space: nowrap;
      outline: none;
    }

    [role="radio"]:focus-visible {
      box-shadow: 0 0 0 2px var(--pages-accent-9, #2563eb);
    }

    [role="radio"][aria-checked="true"] {
      background: var(--pages-accent-9, #2563eb);
      border-color: var(--pages-accent-9, #2563eb);
      color: white;
    }

    .pill-count {
      font-weight: 600;
      color: var(--pages-accent-9, #2563eb);
    }

    [role="radio"][aria-checked="true"] .pill-count {
      color: white;
    }

    .pill-badge {
      display: inline-flex;
      padding: 0 5px;
      border-radius: 8px;
      background: var(--pages-danger-9, #dc2626);
      color: white;
      font-size: 9px;
      font-weight: 700;
      line-height: 1.6;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this._observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && this._observer) {
          this._observer.disconnect();
          this._observer = null;
          this._loadQueues();
          this._startPolling();
        }
      },
      { threshold: 0 }
    );
    this._observer.observe(this);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._observer?.disconnect();
    this._observer = null;
    this._stopPolling();
  }

  private async _loadQueues() {
    if (this.endpoint == null) return;
    try {
      const [queuesRes, summaryRes] = await Promise.all([
        fetch(`${this.endpoint}/queues`),
        fetch(`${this.endpoint}/queues/summary`),
      ]);
      if (queuesRes.ok) this.queues = await queuesRes.json();
      if (summaryRes.ok) this.summaries = await summaryRes.json();
    } catch { /* silent — counts are informational */ }
  }

  private async _refreshSummary() {
    if (this.endpoint == null) return;
    try {
      const res = await fetch(`${this.endpoint}/queues/summary`);
      if (res.ok) this.summaries = await res.json();
    } catch { /* silent retry on next poll */ }
  }

  private _startPolling() {
    this._pollTimer = window.setInterval(() => {
      if (!document.hidden) this._refreshSummary();
    }, 30000);
  }

  private _stopPolling() {
    if (this._pollTimer !== null) clearInterval(this._pollTimer);
  }

  private _getSortedQueues(): Array<{ queue: QueueView; count: number; breachCount: number }> {
    return this.queues
      .map(queue => {
        const summary = this.summaries.find(s => s.queueId === queue.id);
        const isSelected = this.selectedQueueId === queue.id;
        const count = isSelected && this.selectedQueueCount !== null
          ? this.selectedQueueCount
          : (summary?.count ?? 0);
        return { queue, count, breachCount: summary?.breachCount ?? 0 };
      })
      .sort((a, b) => {
        if (a.breachCount > 0 && b.breachCount === 0) return -1;
        if (b.breachCount > 0 && a.breachCount === 0) return 1;
        if (a.breachCount !== b.breachCount) return b.breachCount - a.breachCount;
        return b.count - a.count;
      });
  }

  private _handlePillClick(queue: QueueView) {
    const newQueue = this.selectedQueueId === queue.id ? null : queue;
    this.selectedQueueId = newQueue?.id ?? null;
    emitPagesEvent<QueueScopeChangedPayload>(this, WorkItemEventTopics.QUEUE_SCOPE_CHANGED, {
      queue: newQueue,
    });
  }

  override render() {
    if (this.queues.length === 0) return nothing;

    const sorted = this._getSortedQueues();

    return html`
      <div role="radiogroup" aria-label="Queue scope" class="pill-bar">
        <span class="label">Queues:</span>
        ${sorted.map(({ queue, count, breachCount }) => html`
          <span
            role="radio"
            tabindex="-1"
            aria-checked="${this.selectedQueueId === queue.id}"
            data-id="${queue.id}"
            @click="${() => this._handlePillClick(queue)}"
            @keydown="${(e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this._handlePillClick(queue);
              }
            }}"
          >
            ${queue.name}
            <span class="pill-count">${count}</span>
            ${breachCount > 0 ? html`<span class="pill-badge">${breachCount}</span>` : nothing}
          </span>
        `)}
      </div>
    `;
  }
}
