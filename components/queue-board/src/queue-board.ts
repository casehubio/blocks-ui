import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import {
  type QueueView,
  type WorkItemResponse,
  type WorkItemPriority,
  type WorkIdentity,
  emitPagesEvent,
  WorkItemEventTopics,
  type QueueSelectedPayload,
  SSEManager,
  type WorkItemLifecycleEvent,
  RovingTabindexMixin,
} from '@casehubio/blocks-ui-core';
import '@casehubio/blocks-ui-work-item-row';
import './queue-card.js';
import type { QueueCard } from './queue-card.js';

interface QueueData {
  queue: QueueView;
  items: WorkItemResponse[];
  summary: {
    total: number;
    priorityBreakdown: Map<WorkItemPriority, number>;
    breachCount: number;
    oldestAgeMs: number | null;
  };
  loading: boolean;
}

type ViewMode = 'dashboard' | 'list';

@customElement('queue-board')
export class QueueBoard extends RovingTabindexMixin(LitElement) {
  @property() endpoint = '';
  @property({ type: Object }) identity: WorkIdentity | null = null;

  @state() private _queues: QueueData[] = [];
  @state() private _viewMode: ViewMode = 'dashboard';
  @state() private _selectedQueueId: string | null = null;
  @state() private _loading = true;
  @state() private _highlightedQueueId: string | null = null;

  private _sseManager = new SSEManager();
  private _sseCleanup: (() => void) | null = null;
  private _queueSSECleanup: (() => void) | null = null;
  private _refreshTimer: number | null = null;
  private _intersectionObserver: IntersectionObserver | null = null;
  private _itemCache = new Map<string, WorkItemResponse>();

  static override styles = css`
    :host {
      display: block;
      container-type: inline-size;
    }

    .dashboard {
      display: grid;
      gap: var(--blocks-space-4, 16px);
      grid-template-columns: repeat(3, 1fr);
    }

    .dashboard.hidden {
      display: none;
    }

    @container (max-width: 768px) {
      .dashboard {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @container (max-width: 480px) {
      .dashboard {
        grid-template-columns: 1fr;
      }
    }

    .list-view {
      display: none;
    }

    .list-view.visible {
      display: block;
    }

    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--blocks-space-4, 16px);
      padding: var(--blocks-space-4, 16px);
      background: var(--blocks-neutral-1, #fafafa);
      border: 1px solid var(--blocks-neutral-4, #e5e5e5);
      border-radius: var(--blocks-radius-md, 6px);
    }

    .list-title {
      font-size: var(--blocks-font-size-xl, 20px);
      font-weight: var(--blocks-font-weight-semibold, 600);
      color: var(--blocks-neutral-12, #111);
    }

    .back-button {
      background: var(--blocks-neutral-1, #fafafa);
      border: 1px solid var(--blocks-neutral-4, #e5e5e5);
      border-radius: var(--blocks-radius-sm, 4px);
      padding: var(--blocks-space-2, 8px) var(--blocks-space-4, 16px);
      cursor: pointer;
      color: var(--blocks-neutral-12, #111);
      font-size: var(--blocks-font-size-base, 14px);
    }

    .back-button:hover {
      background: var(--blocks-neutral-2, #f5f5f5);
      border-color: var(--blocks-neutral-5, #d4d4d4);
    }

    .back-button:focus-visible {
      outline: 2px solid var(--blocks-accent-9, #2563eb);
      outline-offset: 2px;
    }

    .work-items-list {
      display: flex;
      flex-direction: column;
      gap: var(--blocks-space-2, 8px);
    }

    .skeleton {
      background: linear-gradient(
        90deg,
        var(--blocks-neutral-3, #f5f5f5) 25%,
        var(--blocks-neutral-2, #fafafa) 50%,
        var(--blocks-neutral-3, #f5f5f5) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s ease-in-out infinite;
      border-radius: var(--blocks-radius-md, 6px);
      height: 150px;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this._loadQueues();
    this._setupGlobalSSE();
    this._setupRefreshTimer();
    this._setupIntersectionObserver();
    this.addEventListener('keydown', this._handleKeydown);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._cleanup();
    this.removeEventListener('keydown', this._handleKeydown);
  }

  private _cleanup() {
    this._sseCleanup?.();
    this._sseCleanup = null;
    this._queueSSECleanup?.();
    this._queueSSECleanup = null;
    this._sseManager.disconnectAll();
    if (this._refreshTimer !== null) {
      clearInterval(this._refreshTimer);
    }
    this._intersectionObserver?.disconnect();
  }

  private async _loadQueues() {
    try {
      this._loading = true;
      const response = await fetch(`${this.endpoint}/queues`);
      if (!response.ok) throw new Error('Failed to load queues');

      const queues: QueueView[] = await response.json();

      // Initialize queue data with loading state
      this._queues = queues.map((queue) => ({
        queue,
        items: [],
        summary: {
          total: 0,
          priorityBreakdown: new Map(),
          breachCount: 0,
          oldestAgeMs: null,
        },
        loading: true,
      }));

      this._loading = false;
      this.requestUpdate();

      // Load items concurrently
      await Promise.all(this._queues.map((qData) => this._loadQueueItems(qData.queue.id)));
    } catch (error) {
      console.error('Failed to load queues:', error);
      this._loading = false;
    }
  }

  private async _loadQueueItems(queueId: string) {
    const queueIndex = this._queues.findIndex((q) => q.queue.id === queueId);
    if (queueIndex === -1) return;

    const qData = this._queues[queueIndex];
    if (!qData) return;

    try {
      const response = await fetch(`${this.endpoint}/queues/${queueId}/items`);
      if (!response.ok) throw new Error(`Failed to load items for queue ${queueId}`);

      const items: WorkItemResponse[] = await response.json();

      // Cache items
      items.forEach((item) => this._itemCache.set(item.id, item));

      // Compute summary
      const summary = this._computeSummary(items);

      // Update queue data
      this._queues[queueIndex] = {
        queue: qData.queue,
        items,
        summary,
        loading: false,
      };

      // Sort queues by urgency
      this._queues = this._sortQueuesByUrgency(this._queues);

      this.requestUpdate();
    } catch (error) {
      console.error(`Failed to load items for queue ${queueId}:`, error);
      this._queues[queueIndex] = {
        queue: qData.queue,
        items: qData.items,
        summary: qData.summary,
        loading: false,
      };
      this.requestUpdate();
    }
  }

  private _computeSummary(items: WorkItemResponse[]) {
    const priorityBreakdown = new Map<WorkItemPriority, number>();
    let breachCount = 0;
    let oldestAgeMs: number | null = null;
    const now = Date.now();

    for (const item of items) {
      // Priority breakdown
      const count = priorityBreakdown.get(item.priority) || 0;
      priorityBreakdown.set(item.priority, count + 1);

      // SLA breach check
      if (item.expiresAt && new Date(item.expiresAt).getTime() < now) {
        breachCount++;
      }

      // Oldest age
      const createdAt = new Date(item.createdAt).getTime();
      const ageMs = now - createdAt;
      if (oldestAgeMs === null || ageMs > oldestAgeMs) {
        oldestAgeMs = ageMs;
      }
    }

    return {
      total: items.length,
      priorityBreakdown,
      breachCount,
      oldestAgeMs,
    };
  }

  private _sortQueuesByUrgency(queues: QueueData[]): QueueData[] {
    return [...queues].sort((a, b) => {
      // Breaches first
      if (a.summary.breachCount > 0 && b.summary.breachCount === 0) return -1;
      if (b.summary.breachCount > 0 && a.summary.breachCount === 0) return 1;

      // Then by breach count
      if (a.summary.breachCount !== b.summary.breachCount) {
        return b.summary.breachCount - a.summary.breachCount;
      }

      // Then by total count
      return b.summary.total - a.summary.total;
    });
  }

  private _setupGlobalSSE() {
    if (this.endpoint == null) return;

    const url = `${this.endpoint}/workitems/events`;
    const handler = (event: { type: string; data: unknown }) => {
      if (event.type === 'work-item.lifecycle') {
        this._handleLifecycleEvent(event.data as WorkItemLifecycleEvent);
      }
    };

    this._sseManager.subscribe(url, handler);
    this._sseCleanup = () => this._sseManager.unsubscribe(url, handler);
  }

  private _setupQueueSSE(queueId: string) {
    this._queueSSECleanup?.();
    this._queueSSECleanup = null;

    if (this.endpoint == null) return;

    const url = `${this.endpoint}/queues/${queueId}/events`;
    const handler = (_event: { type: string; data: unknown }) => {
      // Queue-specific events handled here if needed
    };

    this._sseManager.subscribe(url, handler);
    this._queueSSECleanup = () => this._sseManager.unsubscribe(url, handler);
  }

  private _handleLifecycleEvent(event: WorkItemLifecycleEvent) {
    // Only recompute if item is in cache (meaning we've loaded it)
    const cachedItem = this._itemCache.get(event.workItemId);
    if (!cachedItem) return;

    // Update cached item
    const updatedItem = { ...cachedItem, status: event.status };
    this._itemCache.set(event.workItemId, updatedItem);

    // Recompute summary for affected queues
    for (let i = 0; i < this._queues.length; i++) {
      const qData = this._queues[i];
      if (!qData) continue;

      const itemIndex = qData.items.findIndex((item) => item.id === event.workItemId);

      if (itemIndex !== -1) {
        // Update item in queue
        qData.items[itemIndex] = updatedItem;

        // Recompute summary
        const summary = this._computeSummary(qData.items);

        this._queues[i] = {
          queue: qData.queue,
          items: qData.items,
          summary,
          loading: qData.loading,
        };
      }
    }

    // Re-sort by urgency
    this._queues = this._sortQueuesByUrgency(this._queues);
    this.requestUpdate();
  }

  private _setupRefreshTimer() {
    // 30s staggered refresh
    this._refreshTimer = window.setInterval(() => {
      if (document.hidden) return; // Skip when tab is hidden

      // Refresh queues one at a time with stagger
      this._queues.forEach((qData, index) => {
        setTimeout(() => {
          this._loadQueueItems(qData.queue.id);
        }, index * 1000); // 1s stagger between each queue
      });
    }, 30000); // 30s interval
  }

  private _setupIntersectionObserver() {
    this._intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const card = entry.target as QueueCard;
            const queueId = card.queueId;

            // Load if not already loaded
            const qData = this._queues.find((q) => q.queue.id === queueId);
            if (qData && qData.loading && qData.items.length === 0) {
              this._loadQueueItems(queueId);
            }
          }
        });
      },
      { rootMargin: '100px' },
    );
  }

  private _handleCardClick(queueId: string, queueName: string) {
    this._selectedQueueId = queueId;
    this._viewMode = 'list';

    // Emit queue.selected event
    emitPagesEvent<QueueSelectedPayload>(this, WorkItemEventTopics.QUEUE_SELECTED, {
      queueId,
      queueName,
    });

    // Setup queue-specific SSE
    this._setupQueueSSE(queueId);

    this.requestUpdate();
  }

  private _handleBackToDashboard() {
    const prevQueueId = this._selectedQueueId;
    this._selectedQueueId = null;
    this._viewMode = 'dashboard';

    // Highlight the card briefly
    if (prevQueueId) {
      this._highlightedQueueId = prevQueueId;
      setTimeout(() => {
        this._highlightedQueueId = null;
        this.requestUpdate();
      }, 1000);
    }

    // Emit queue.deselected event
    emitPagesEvent(this, WorkItemEventTopics.QUEUE_DESELECTED, {});

    // Close queue-specific SSE
    this._queueSSECleanup?.();
    this._queueSSECleanup = null;

    this.requestUpdate();
  }

  private _handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this._viewMode === 'list') {
      e.preventDefault();
      this._handleBackToDashboard();
    }
  };

  override render() {
    if (this._loading) {
      return html`<div class="skeleton"></div>`;
    }

    return html`
      <div class="dashboard ${this._viewMode === 'list' ? 'hidden' : ''}">
        ${repeat(
          this._queues,
          (qData) => qData.queue.id,
          (qData) => html`
            <queue-card
              queue-id=${qData.queue.id}
              queue-name=${qData.queue.name}
              .summary=${qData.summary}
              .loading=${qData.loading}
              .highlighted=${this._highlightedQueueId === qData.queue.id}
              @card-click=${() => this._handleCardClick(qData.queue.id, qData.queue.name)}
            ></queue-card>
          `,
        )}
      </div>

      <div class="list-view ${this._viewMode === 'list' ? 'visible' : ''}">
        ${this._renderListView()}
      </div>
    `;
  }

  private _renderListView() {
    if (!this._selectedQueueId) return '';

    const qData = this._queues.find((q) => q.queue.id === this._selectedQueueId);
    if (!qData) return '';

    return html`
      <div class="list-header">
        <div class="list-title">${qData.queue.name}</div>
        <button
          class="back-button"
          @click=${this._handleBackToDashboard}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              this._handleBackToDashboard();
            }
          }}
        >
          ← Back to Dashboard
        </button>
      </div>
      <div class="work-items-list">
        ${repeat(
          qData.items,
          (item) => item.id,
          (item) => html`
            <work-item-row
              .item=${item}
              @pages-event=${(e: CustomEvent) => {
                // Forward pages-event from work-item-row
                this.dispatchEvent(new CustomEvent('pages-event', { detail: e.detail }));
              }}
            ></work-item-row>
          `,
        )}
      </div>
    `;
  }

  protected override updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);

    // Observe cards after render
    if (changedProperties.has('_queues') && this._intersectionObserver) {
      const cards = this.shadowRoot?.querySelectorAll('queue-card');
      cards?.forEach((card) => {
        this._intersectionObserver!.observe(card);
      });
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'queue-board': QueueBoard;
  }
}
