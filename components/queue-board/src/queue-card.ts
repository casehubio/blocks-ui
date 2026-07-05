import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { WorkItemPriority } from '@casehubio/blocks-ui-core';

interface QueueSummary {
  total: number;
  priorityBreakdown: Map<WorkItemPriority, number>;
  breachCount: number;
  oldestAgeMs: number | null;
}

@customElement('queue-card')
export class QueueCard extends LitElement {
  @property() queueId = '';
  @property() queueName = '';
  @property({ type: Object }) summary: QueueSummary | null = null;
  @property({ type: Boolean }) loading = false;
  @property({ type: Boolean }) highlighted = false;

  static override styles = css`
    :host {
      display: block;
    }

    .card {
      background: var(--blocks-neutral-1, #fafafa);
      border: 1px solid var(--blocks-neutral-4, #e5e5e5);
      border-radius: var(--blocks-radius-md, 6px);
      padding: var(--blocks-space-4, 16px);
      cursor: pointer;
      position: relative;
    }

    @media (prefers-reduced-motion: no-preference) {
      .card {
        transition: all 0.2s ease;
      }
    }

    .card:hover {
      border-color: var(--blocks-neutral-5, #d4d4d4);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .card:focus-visible {
      outline: 2px solid var(--blocks-accent-9, #2563eb);
      outline-offset: 2px;
    }

    .card.breached {
      border-left: 4px solid var(--blocks-danger-9, #dc2626);
    }

    @media (prefers-reduced-motion: no-preference) {
      .card.breached {
        animation: pulse 2s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { border-left-color: var(--blocks-danger-9, #dc2626); }
        50% { border-left-color: var(--blocks-danger-8, #ef4444); }
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .card.breached {
        animation: none;
      }
    }

    .card.highlighted {
      background: var(--blocks-neutral-2, #f5f5f5);
    }

    .queue-name {
      font-size: var(--blocks-font-size-lg, 16px);
      font-weight: var(--blocks-font-weight-semibold, 600);
      margin-bottom: var(--blocks-space-2, 8px);
      color: var(--blocks-neutral-12, #111);
    }

    .item-count {
      font-size: 2.5rem;
      font-weight: var(--blocks-font-weight-semibold, 600);
      color: var(--blocks-accent-9, #2563eb);
      margin: var(--blocks-space-4, 16px) 0;
    }

    .priority-bar {
      display: flex;
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
      margin: var(--blocks-space-2, 8px) 0;
      background: var(--blocks-neutral-3, #f5f5f5);
    }

    .priority-segment {
      height: 100%;
    }

    @media (prefers-reduced-motion: no-preference) {
      .priority-segment {
        transition: width 0.3s ease;
      }
    }

    .priority-segment.urgent {
      background: var(--blocks-danger-9, #dc2626);
    }

    .priority-segment.high {
      background: var(--blocks-warning-9, #d97706);
    }

    .priority-segment.medium {
      background: var(--blocks-accent-9, #2563eb);
    }

    .priority-segment.low {
      background: var(--blocks-neutral-7, #a3a3a3);
    }

    .stats {
      display: flex;
      justify-content: space-between;
      margin-top: var(--blocks-space-2, 8px);
      font-size: var(--blocks-font-size-sm, 12px);
      color: var(--blocks-neutral-9, #888);
    }

    .sla-status {
      display: flex;
      align-items: center;
      gap: var(--blocks-space-1, 4px);
    }

    .sla-status.healthy {
      color: var(--blocks-success-9, #16a34a);
    }

    .sla-status.breached {
      color: var(--blocks-danger-9, #dc2626);
      font-weight: var(--blocks-font-weight-semibold, 600);
    }

    .oldest-age {
      color: var(--blocks-neutral-9, #888);
    }

    .skeleton {
      background: linear-gradient(
        90deg,
        var(--blocks-neutral-3, #f5f5f5) 25%,
        var(--blocks-neutral-2, #fafafa) 50%,
        var(--blocks-neutral-3, #f5f5f5) 75%
      );
      background-size: 200% 100%;
      border-radius: var(--blocks-radius-sm, 4px);
    }

    @media (prefers-reduced-motion: no-preference) {
      .skeleton {
        animation: shimmer 1.5s ease-in-out infinite;
      }

      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    }

    .skeleton-name {
      height: 1.5rem;
      width: 60%;
      margin-bottom: var(--blocks-space-2, 8px);
    }

    .skeleton-count {
      height: 3rem;
      width: 40%;
      margin: var(--blocks-space-4, 16px) 0;
    }

    .skeleton-bar {
      height: 8px;
      margin: var(--blocks-space-2, 8px) 0;
    }
  `;

  private formatAge(ageMs: number): string {
    const minutes = Math.floor(ageMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  }

  override render() {
    if (this.loading) {
      return html`
        <div class="card">
          <div class="skeleton skeleton-name"></div>
          <div class="skeleton skeleton-count"></div>
          <div class="skeleton skeleton-bar"></div>
        </div>
      `;
    }

    if (!this.summary) {
      return html`<div class="card">No data</div>`;
    }

    const { total, priorityBreakdown, breachCount, oldestAgeMs } = this.summary;
    const hasBreaches = breachCount > 0;

    return html`
      <div
        class="card ${hasBreaches ? 'breached' : ''} ${this.highlighted ? 'highlighted' : ''}"
        tabindex="0"
        role="button"
        @click=${this._handleClick}
        @keydown=${this._handleKeydown}
      >
        <div class="queue-name">${this.queueName}</div>
        <div class="item-count">${total}</div>
        ${this.renderPriorityBar(priorityBreakdown, total)}
        <div class="stats">
          <div class="sla-status ${hasBreaches ? 'breached' : 'healthy'}">
            ${hasBreaches
              ? html`<span>${breachCount} breached</span>`
              : html`<span>✓</span>`}
          </div>
          ${oldestAgeMs !== null
            ? html`<div class="oldest-age">Oldest: ${this.formatAge(oldestAgeMs)}</div>`
            : ''}
        </div>
      </div>
    `;
  }

  private renderPriorityBar(breakdown: Map<WorkItemPriority, number>, total: number) {
    if (total === 0) return '';

    const segments: Array<{ priority: WorkItemPriority; percent: number }> = [];
    const priorities: WorkItemPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

    for (const priority of priorities) {
      const count = breakdown.get(priority) || 0;
      if (count > 0) {
        segments.push({ priority, percent: (count / total) * 100 });
      }
    }

    return html`
      <div class="priority-bar">
        ${segments.map(
          ({ priority, percent }) => html`
            <div
              class="priority-segment ${priority.toLowerCase()}"
              style="width: ${percent}%"
              title="${priority}: ${Math.round(percent)}%"
            ></div>
          `,
        )}
      </div>
    `;
  }

  private _handleClick() {
    this.dispatchEvent(new CustomEvent('card-click', { bubbles: true }));
  }

  private _handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._handleClick();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'queue-card': QueueCard;
  }
}
