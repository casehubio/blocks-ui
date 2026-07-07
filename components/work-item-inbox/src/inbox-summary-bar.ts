import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { InboxSummary } from '@casehubio/blocks-ui-core';

export interface FilterClickDetail {
  type: 'overdue' | 'claimDeadlineBreached';
  value: string | null;
}

@customElement('inbox-summary-bar')
export class InboxSummaryBar extends LitElement {
  @property({ type: Object }) summary: InboxSummary | null = null;
  @property({ type: Boolean }) overdueActive = false;
  @property({ type: Boolean }) claimBreachActive = false;
  @property({ type: Boolean }) hideClaimBreach = false;
  @property({ type: Number }) visibleTotal: number | null = null;
  @property({ type: Number }) visibleOverdue: number | null = null;
  @property({ type: Number }) visibleBreach: number | null = null;

  static override styles = css`
    :host { display: block; }

    .summary-container {
      display: flex;
      gap: var(--pages-space-2, 8px);
      flex-wrap: wrap;
      align-items: center;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: var(--pages-space-1-5, 6px);
      padding: var(--pages-space-1, 4px) var(--pages-space-3, 12px);
      border-radius: 16px;
      font-size: var(--pages-font-size-sm, 12px);
      font-weight: 500;
      border: 1px solid var(--pages-neutral-6, #e0e0e0);
      background: var(--pages-neutral-3, #f5f5f5);
      color: var(--pages-neutral-11, #555);
    }

    button.badge {
      cursor: pointer;
    }

    @media (prefers-reduced-motion: no-preference) {
      button.badge { transition: background 0.15s, border-color 0.15s, color 0.15s; }
    }

    button.badge:hover {
      background: var(--pages-neutral-4, #eee);
      border-color: var(--pages-neutral-7, #ccc);
    }

    .badge.total {
      background: var(--pages-accent-3, #e6f4ff);
      color: var(--pages-accent-11, #0066cc);
      border-color: var(--pages-accent-6, #99d6ff);
    }

    .badge.overdue,
    .badge.claim-breach {
      background: var(--pages-danger-3, #ffe6e6);
      color: var(--pages-danger-11, #cc0000);
      border-color: var(--pages-danger-6, #ff9999);
    }

    button.badge.overdue:hover,
    button.badge.claim-breach:hover {
      background: var(--pages-danger-4, #ffcccc);
    }

    button.badge.active {
      background: var(--pages-accent-9, #2563eb);
      color: var(--pages-accent-1, #fff);
      border-color: var(--pages-accent-10, #1d4ed8);
    }

    button.badge.active:hover {
      background: var(--pages-accent-10, #1d4ed8);
    }

    .badge-label { color: inherit; }
    .badge-count { font-weight: 600; }
  `;

  private emitFilterClick(type: FilterClickDetail['type']) {
    this.dispatchEvent(
      new CustomEvent<FilterClickDetail>('filter-click', {
        bubbles: true,
        composed: true,
        detail: { type, value: null },
      }),
    );
  }

  override render() {
    if (!this.summary) {
      return html`<div class="summary-container"></div>`;
    }

    const overdueCount = this.visibleOverdue ?? this.summary.overdue;
    const breachCount = this.visibleBreach ?? this.summary.claimDeadlineBreached;

    return html`
      <div class="summary-container">
        <span class="badge total">
          <span class="badge-label">Total:</span>
          <span class="badge-count">${this.visibleTotal ?? this.summary.total}</span>
        </span>

        ${overdueCount > 0
          ? html`
              <button
                class="badge overdue ${this.overdueActive ? 'active' : ''}"
                @click="${() => this.emitFilterClick('overdue')}"
                tabindex="0"
              >
                <span class="badge-label">Overdue:</span>
                <span class="badge-count">${overdueCount}</span>
              </button>
            `
          : null}

        ${breachCount > 0 && !this.hideClaimBreach
          ? html`
              <button
                class="badge claim-breach ${this.claimBreachActive ? 'active' : ''}"
                @click="${() => this.emitFilterClick('claimDeadlineBreached')}"
                tabindex="0"
              >
                <span class="badge-label">Claim breach:</span>
                <span class="badge-count">${breachCount}</span>
              </button>
            `
          : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'inbox-summary-bar': InboxSummaryBar;
  }
}
