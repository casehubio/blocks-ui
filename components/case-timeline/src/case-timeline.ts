import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { DataSourceMixin, fetchSource, renderPropertyTree, propertyTreeStyles, type WorkIdentity } from '@casehubio/blocks-ui-core';
import { LiveRegionMixin } from '@casehubio/pages-primitives';
import type { SourceFactory } from '@casehubio/pages-component';
import {
  type CaseEvent,
  type EventStreamType,
  type PagedResponse,
  type EventLogEntryResponse,
  type NodeCategory,
  categorizeEvent,
  isCompactModeEvent,
} from './types.js';

@customElement('case-timeline')
export class CaseTimeline extends DataSourceMixin(LiveRegionMixin(LitElement)) {
  @property({ type: String, attribute: 'case-id' }) caseId?: string;
  @property({ type: String }) mode: 'full' | 'compact' = 'full';
  @property({ type: Object }) identity?: WorkIdentity;

  @state() private _events: CaseEvent[] = [];
  @state() private _expandedIds = new Set<number>();
  @state() private _activeStreamTypes = new Set<EventStreamType>(['CASE', 'WORKER', 'TIMER', 'SYSTEM', 'ORCHESTRATION']);
  @state() private _focusedIndex = -1;
  private _lastDataSet: unknown = undefined;

  override createSourceFactory(): SourceFactory {
    return (url, _id) => fetchSource(url, {
      headers: () => ({
        'Content-Type': 'application/json',
        ...(this.identity?.tenancyId && { 'X-Tenancy-ID': this.identity.tenancyId }),
      }),
    });
  }

  override resolveEndpoint(): string | undefined {
    if (!this.endpoint || !this.caseId) return undefined;
    return `${this.endpoint}/cases/${this.caseId}/events`;
  }

  override configure(props: Record<string, unknown>): void {
    if (props.caseId !== undefined) this.caseId = props.caseId as string;
    if (props.identity !== undefined) this.identity = props.identity as WorkIdentity;
    super.configure(props);
  }

  override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('caseId')) this.syncEndpoint();
    if (this.dataSet !== this._lastDataSet && this.dataSet) {
      this._lastDataSet = this.dataSet;
      const data = this.dataSet as PagedResponse<EventLogEntryResponse>;
      this._events = (data.content ?? []).map(entry => ({
        eventType: entry.eventType,
        streamType: entry.streamType,
        timestamp: entry.timestamp,
        payload: entry.payload,
        metadata: entry.metadata,
      }));
    }
  }

  private _toggleExpand(index: number): void {
    if (this._expandedIds.has(index)) {
      this._expandedIds.delete(index);
    } else {
      this._expandedIds.add(index);
    }
    this.requestUpdate();
  }

  private _handleNodeClick(event: CaseEvent, index: number): void {
    const category = categorizeEvent(event.eventType);

    // Emit work-item.selected for task nodes
    if (category === 'task' && event.payload && typeof event.payload === 'object' && 'taskId' in event.payload) {
      this.dispatchEvent(
        new CustomEvent('pages-event', {
          detail: {
            topic: 'work-item.selected',
            payload: { workItemId: (event.payload as Record<string, unknown>).taskId },
          },
          bubbles: true,
          composed: true,
        })
      );
    } else {
      // Emit generic timeline.event-selected
      this.dispatchEvent(
        new CustomEvent('pages-event', {
          detail: {
            topic: 'timeline.event-selected',
            payload: { event, index },
          },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  private _handleExpandRequestedClick(): void {
    this.dispatchEvent(
      new CustomEvent('pages-event', {
        detail: { topic: 'timeline.expand-requested' },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _toggleStreamType(streamType: EventStreamType): void {
    if (this._activeStreamTypes.has(streamType)) {
      this._activeStreamTypes.delete(streamType);
    } else {
      this._activeStreamTypes.add(streamType);
    }
    this.requestUpdate();
  }

  private _handleKeyDown(event: KeyboardEvent, index: number): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = index + 1;
      if (nextIndex < this._filteredEvents().length) {
        this._focusedIndex = nextIndex;
        this.requestUpdate();
        setTimeout(() => {
          const nextNode = this.shadowRoot?.querySelectorAll('.timeline-node')[nextIndex] as HTMLElement;
          nextNode?.focus();
        });
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = index - 1;
      if (prevIndex >= 0) {
        this._focusedIndex = prevIndex;
        this.requestUpdate();
        setTimeout(() => {
          const prevNode = this.shadowRoot?.querySelectorAll('.timeline-node')[prevIndex] as HTMLElement;
          prevNode?.focus();
        });
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this._toggleExpand(index);
    }
  }

  private _filteredEvents(): CaseEvent[] {
    return this._events.filter(event => this._activeStreamTypes.has(event.streamType));
  }

  private _formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  private _formatDate(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private _getRelativeTime(timestamp: string): string {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return this._formatDate(timestamp);
  }

  private _renderFullMode(): unknown {
    const filtered = this._filteredEvents();

    return html`
      <div class="filter-bar" role="group" aria-label="Event type filter">
        ${(['CASE', 'WORKER', 'ORCHESTRATION', 'TIMER', 'SYSTEM'] as EventStreamType[]).map(
          streamType => html`
            <button
              class="filter-chip"
              role="checkbox"
              aria-checked="${this._activeStreamTypes.has(streamType)}"
              @click="${() => this._toggleStreamType(streamType)}"
            >
              ${streamType}
            </button>
          `
        )}
      </div>

      <div class="timeline" role="list" aria-label="Case timeline">
        ${filtered.map((event, index) => {
          const category = categorizeEvent(event.eventType);
          const isExpanded = this._expandedIds.has(index);
          const ariaLabel = `${event.eventType.replace(/_/g, ' ')}, ${this._getRelativeTime(event.timestamp)}`;

          return html`
            <div
              class="timeline-node ${category}"
              role="listitem"
              tabindex="0"
              aria-label="${ariaLabel}"
              @keydown="${(e: KeyboardEvent) => this._handleKeyDown(e, index)}"
            >
              <div class="node-dot"></div>
              <div class="node-content">
                <div class="node-body" @click="${() => this._handleNodeClick(event, index)}">
                  <div class="node-header">
                    <span class="event-type-badge ${category}">${event.eventType.replace(/_/g, ' ')}</span>
                    <span class="timestamp">${this._formatTimestamp(event.timestamp)}</span>
                  </div>
                  ${event.metadata?.workerName
                    ? html`<div class="worker-info">Worker: ${event.metadata.workerName}</div>`
                    : nothing}
                  ${event.metadata?.trustScore
                    ? html`<div class="trust-score">Trust: ${(event.metadata.trustScore as number).toFixed(2)}</div>`
                    : nothing}
                </div>
                <button
                  class="expand-button"
                  aria-expanded="${isExpanded}"
                  @click="${(e: Event) => {
                    e.stopPropagation();
                    this._toggleExpand(index);
                  }}"
                >
                  ${isExpanded ? '▼' : '▶'} Details
                </button>
                ${isExpanded
                  ? html`
                      <div class="payload-detail" role="region">
                        ${renderPropertyTree(event.payload)}
                      </div>
                    `
                  : nothing}
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderCompactMode(): unknown {
    const compactEvents = this._events.filter(event => isCompactModeEvent(event.eventType));

    // Truncation: first 3 + last 2 when > 7
    let displayEvents = compactEvents;
    let hiddenCount = 0;

    if (compactEvents.length > 7) {
      const first3 = compactEvents.slice(0, 3);
      const last2 = compactEvents.slice(-2);
      displayEvents = [...first3, ...last2];
      hiddenCount = compactEvents.length - 5;
    }

    const summaryLabel = `Case timeline: ${compactEvents.length} events`;

    return html`
      <div
        class="compact-strip"
        role="img"
        aria-label="${summaryLabel}"
        tabindex="0"
        @click="${this._handleExpandRequestedClick}"
        @keydown="${(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this._handleExpandRequestedClick();
          }
        }}"
      >
        ${displayEvents.slice(0, 3).map(event => this._renderCompactDot(event))}
        ${hiddenCount > 0
          ? html`<span class="ellipsis" aria-hidden="true">...+${hiddenCount}</span>`
          : nothing}
        ${displayEvents.length > 3 ? displayEvents.slice(3).map(event => this._renderCompactDot(event)) : nothing}
      </div>
    `;
  }

  private _renderCompactDot(event: CaseEvent): unknown {
    const category = categorizeEvent(event.eventType);
    const tooltip = `${event.eventType.replace(/_/g, ' ')} - ${this._formatTimestamp(event.timestamp)}`;

    return html`
      <div
        class="event-dot ${category}"
        data-tooltip="${tooltip}"
        aria-hidden="true"
      ></div>
    `;
  }

  override render() {
    if (this.loading) {
      return html`<div class="timeline-container">Loading timeline...</div>`;
    }

    if (this.error) {
      return html`
        <div class="timeline-container">
          <div class="error-message">Failed to load timeline: ${this.error}</div>
          <button @click="${() => this.fetchData()}">Retry</button>
        </div>
      `;
    }

    return html`
      <div class="timeline-container">
        ${this.mode === 'full' ? this._renderFullMode() : this._renderCompactMode()}
      </div>
    `;
  }

  static override styles = css`
    :host {
      display: block;
      font-family: var(--pages-font-family, system-ui);
      color: var(--pages-neutral-12, #111);
    }

    .timeline-container {
      padding: 16px;
    }

    .error-message {
      color: var(--pages-error-11, #dc2626);
      margin-bottom: 12px;
    }

    /* Filter bar */
    .filter-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .filter-chip {
      padding: 6px 12px;
      border-radius: 16px;
      border: 1px solid var(--pages-neutral-6, #d1d5db);
      background: var(--pages-neutral-1, #fff);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .filter-chip[aria-checked="true"] {
      background: var(--pages-accent-9, #2563eb);
      color: white;
      border-color: var(--pages-accent-9, #2563eb);
    }

    .filter-chip:hover {
      border-color: var(--pages-accent-7, #3b82f6);
    }

    /* Full mode: vertical timeline */
    .timeline {
      position: relative;
      padding-left: 32px;
    }

    .timeline::before {
      content: '';
      position: absolute;
      left: 8px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--pages-neutral-5, #e5e7eb);
    }

    .timeline-node {
      position: relative;
      margin-bottom: 24px;
      padding-left: 24px;
      outline: none;
    }

    .timeline-node:focus {
      outline: 2px solid var(--pages-accent-8, #1d4ed8);
      outline-offset: 4px;
      border-radius: 8px;
    }

    .node-dot {
      position: absolute;
      left: -28px;
      top: 8px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--pages-neutral-7, #9ca3af);
      border: 2px solid var(--pages-neutral-1, #fff);
      z-index: 1;
    }

    .timeline-node.lifecycle .node-dot {
      width: 16px;
      height: 16px;
      top: 6px;
      left: -30px;
      background: var(--pages-success-9, #16a34a);
    }

    .timeline-node.milestone .node-dot {
      transform: rotate(45deg);
      background: var(--pages-accent-9, #2563eb);
    }

    .timeline-node.task .node-dot {
      background: var(--pages-warning-9, #f59e0b);
    }

    .timeline-node.agent .node-dot {
      background: var(--pages-purple-9, #9333ea);
    }

    .timeline-node.action-gate .node-dot {
      background: var(--pages-error-9, #dc2626);
    }

    .timeline-node.orchestration .node-dot {
      background: var(--pages-neutral-9, #6b7280);
    }

    .node-content {
      background: var(--pages-neutral-1, #fff);
      border: 1px solid var(--pages-neutral-5, #e5e7eb);
      border-radius: 8px;
      padding: 12px;
    }

    .node-body {
      cursor: pointer;
    }

    .node-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .event-type-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .event-type-badge.lifecycle {
      background: var(--pages-success-3, #d1fae5);
      color: var(--pages-success-11, #065f46);
    }

    .event-type-badge.milestone {
      background: var(--pages-accent-3, #dbeafe);
      color: var(--pages-accent-11, #1e3a8a);
    }

    .event-type-badge.task {
      background: var(--pages-warning-3, #fef3c7);
      color: var(--pages-warning-11, #92400e);
    }

    .event-type-badge.agent {
      background: var(--pages-purple-3, #f3e8ff);
      color: var(--pages-purple-11, #6b21a8);
    }

    .event-type-badge.action-gate {
      background: var(--pages-error-3, #fecaca);
      color: var(--pages-error-11, #991b1b);
    }

    .event-type-badge.orchestration {
      background: var(--pages-neutral-3, #e5e7eb);
      color: var(--pages-neutral-11, #374151);
    }

    .timestamp {
      font-size: 12px;
      color: var(--pages-neutral-10, #6b7280);
    }

    .worker-info,
    .trust-score {
      font-size: 13px;
      color: var(--pages-neutral-11, #1f2937);
      margin-top: 4px;
    }

    .expand-button {
      margin-top: 8px;
      padding: 4px 8px;
      font-size: 12px;
      border: 1px solid var(--pages-neutral-6, #d1d5db);
      background: var(--pages-neutral-1, #fff);
      border-radius: 4px;
      cursor: pointer;
    }

    .expand-button:hover {
      background: var(--pages-neutral-2, #f9fafb);
    }

    .payload-detail {
      margin-top: 12px;
      padding: 12px;
      background: var(--pages-neutral-2, #f9fafb);
      border-radius: 4px;
      font-size: 13px;
      max-height: 200px;
      overflow-y: auto;
    }

    ${propertyTreeStyles}

    /* Compact mode: horizontal strip */
    .compact-strip {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--pages-neutral-1, #fff);
      border: 1px solid var(--pages-neutral-5, #e5e7eb);
      border-radius: 24px;
      min-width: 200px;
      cursor: pointer;
      outline: none;
    }

    .compact-strip:hover {
      border-color: var(--pages-accent-7, #3b82f6);
      background: var(--pages-neutral-2, #f9fafb);
    }

    .compact-strip:focus {
      outline: 2px solid var(--pages-accent-8, #1d4ed8);
      outline-offset: 2px;
    }

    .event-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
      position: relative;
    }

    .event-dot.lifecycle {
      background: var(--pages-success-9, #16a34a);
    }

    .event-dot.milestone {
      background: var(--pages-accent-9, #2563eb);
      transform: rotate(45deg);
    }

    .event-dot[data-tooltip]:hover::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      background: var(--pages-neutral-12, #111);
      color: white;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
      z-index: 1000;
      pointer-events: none;
    }

    .event-dot[data-tooltip]:hover::before {
      content: '';
      position: absolute;
      bottom: calc(100% + 2px);
      left: 50%;
      transform: translateX(-50%);
      border: 6px solid transparent;
      border-top-color: var(--pages-neutral-12, #111);
      z-index: 1000;
      pointer-events: none;
    }

    .ellipsis {
      font-size: 13px;
      color: var(--pages-neutral-9, #6b7280);
      font-weight: 500;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'case-timeline': CaseTimeline;
  }
}
