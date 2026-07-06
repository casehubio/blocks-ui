import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface FilterChangeDetail {
  type: 'status' | 'priority';
  value: string;
  active: boolean;
}

const STATUS_FILTERS = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'SUSPENDED', 'DELEGATED'] as const;
const PRIORITY_FILTERS = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const;

@customElement('inbox-filter-bar')
export class InboxFilterBar extends LitElement {
  @property({ type: Object }) activeStatusFilters: Set<string> = new Set();
  @property({ type: Object }) activePriorityFilters: Set<string> = new Set();
  @property({ type: Object }) statusCounts: Map<string, number> = new Map();
  @property({ type: Object }) priorityCounts: Map<string, number> = new Map();

  static override styles = css`
    :host {
      display: block;
    }

    .filter-container {
      display: flex;
      flex-wrap: wrap;
      gap: var(--blocks-space-3, 12px);
      align-items: center;
    }

    .filter-section {
      display: flex;
      gap: var(--blocks-space-2, 8px);
      align-items: center;
    }

    .filter-label {
      font-size: var(--blocks-font-size-sm, 12px);
      font-weight: 600;
      color: var(--blocks-neutral-11, #555555);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      padding: var(--blocks-space-1, 4px) var(--blocks-space-3, 12px);
      border-radius: var(--blocks-radius-md, 6px);
      font-size: var(--blocks-font-size-sm, 12px);
      font-weight: 500;
      background: var(--blocks-neutral-3, #f5f5f5);
      color: var(--blocks-neutral-11, #555555);
      cursor: pointer;
      border: 1px solid var(--blocks-neutral-6, #e0e0e0);
      transition: all 0.15s;
    }

    @media (prefers-reduced-motion: no-preference) {
      .chip {
        transition: background 0.15s, border-color 0.15s, color 0.15s;
      }
    }

    .chip:hover {
      background: var(--blocks-neutral-4, #eeeeee);
      border-color: var(--blocks-neutral-7, #cccccc);
    }

    .chip.active {
      background: var(--blocks-accent-9, #0080ff);
      color: var(--blocks-accent-1, #ffffff);
      border-color: var(--blocks-accent-10, #0066cc);
    }

    .chip.active:hover {
      background: var(--blocks-accent-10, #0066cc);
    }

    .chip.disabled {
      opacity: 0.4;
      cursor: default;
      pointer-events: none;
    }

    .chip-count {
      color: var(--blocks-neutral-9, #888);
      font-size: var(--blocks-font-size-xs, 11px);
    }

    .chip.active .chip-count {
      color: var(--blocks-accent-1, #ffffff);
    }

    .clear-filters {
      padding: var(--blocks-space-1, 4px) var(--blocks-space-3, 12px);
      font-size: var(--blocks-font-size-sm, 12px);
      font-weight: 500;
      background: none;
      border: 1px solid var(--blocks-neutral-6, #e0e0e0);
      border-radius: var(--blocks-radius-md, 6px);
      color: var(--blocks-neutral-11, #555555);
      cursor: pointer;
      transition: all 0.15s;
    }

    @media (prefers-reduced-motion: no-preference) {
      .clear-filters {
        transition: background 0.15s, border-color 0.15s;
      }
    }

    .clear-filters:hover {
      background: var(--blocks-neutral-3, #f5f5f5);
      border-color: var(--blocks-neutral-7, #cccccc);
    }

    .divider {
      width: 1px;
      height: var(--blocks-space-5, 20px);
      background: var(--blocks-neutral-6, #e0e0e0);
    }
  `;

  private emitFilterChange(type: 'status' | 'priority', value: string, active: boolean) {
    this.dispatchEvent(
      new CustomEvent<FilterChangeDetail>('filter-change', {
        bubbles: true,
        composed: true,
        detail: { type, value, active },
      }),
    );
  }

  private emitClearFilters() {
    this.dispatchEvent(
      new CustomEvent('clear-filters', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleStatusChipClick(status: string) {
    const isActive = this.activeStatusFilters.has(status);
    this.emitFilterChange('status', status, !isActive);
  }

  private handlePriorityChipClick(priority: string) {
    const isActive = this.activePriorityFilters.has(priority);
    this.emitFilterChange('priority', priority, !isActive);
  }

  private formatLabel(value: string): string {
    return value
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  override render() {
    const hasActiveFilters =
      this.activeStatusFilters.size > 0 || this.activePriorityFilters.size > 0;

    return html`
      <div class="filter-container">
        <div class="filter-section">
          <span class="filter-label">Status:</span>
          ${STATUS_FILTERS.map((status) => {
            const count = this.statusCounts.get(status);
            const isDisabled = count !== undefined && count === 0;
            return html`
              <button
                class="chip status-chip ${this.activeStatusFilters.has(status)
                  ? 'active'
                  : ''} ${isDisabled ? 'disabled' : ''}"
                data-status="${status}"
                aria-disabled="${isDisabled}"
                @click="${() => !isDisabled && this.handleStatusChipClick(status)}"
                role="button"
                tabindex="0"
              >
                ${this.formatLabel(status)}${count !== undefined
                  ? html` <span class="chip-count">(${count})</span>`
                  : ''}
              </button>
            `;
          })}
        </div>

        <div class="divider"></div>

        <div class="filter-section">
          <span class="filter-label">Priority:</span>
          ${PRIORITY_FILTERS.map((priority) => {
            const count = this.priorityCounts.get(priority);
            const isDisabled = count !== undefined && count === 0;
            return html`
              <button
                class="chip priority-chip ${this.activePriorityFilters.has(priority)
                  ? 'active'
                  : ''} ${isDisabled ? 'disabled' : ''}"
                data-priority="${priority}"
                aria-disabled="${isDisabled}"
                @click="${() => !isDisabled && this.handlePriorityChipClick(priority)}"
                role="button"
                tabindex="0"
              >
                ${this.formatLabel(priority)}${count !== undefined
                  ? html` <span class="chip-count">(${count})</span>`
                  : ''}
              </button>
            `;
          })}
        </div>

        ${hasActiveFilters
          ? html`
              <div class="divider"></div>
              <button
                class="clear-filters"
                @click="${this.emitClearFilters}"
                role="button"
                tabindex="0"
              >
                Clear all
              </button>
            `
          : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'inbox-filter-bar': InboxFilterBar;
  }
}
