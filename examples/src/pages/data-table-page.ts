import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { WorkItemResponse } from '@casehubio/blocks-ui-core';
import type { ColumnDef, SelectionChangeDetail, RowActivateDetail } from '@casehubio/blocks-ui-data-table';
import '@casehubio/blocks-ui-data-table';

interface WorkItemRootResponse {
  item: WorkItemResponse;
  childCount: number;
  completedCount: number | null;
  requiredCount: number | null;
  groupStatus: string | null;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

@customElement('data-table-page')
export class DataTablePage extends LitElement {
  @state() private items: WorkItemRootResponse[] = [];
  @state() private selectedKeys: string[] = [];
  @state() private lastActivated: string = '';

  private columns: ColumnDef<WorkItemRootResponse>[] = [
    { id: 'title', label: 'Title', sortable: true, width: '2fr',
      getValue: r => r.item.title },
    { id: 'status', label: 'Status', sortable: true, width: '120px',
      getValue: r => r.item.status,
      render: (v) => html`<span style="
        display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px;
        font-weight: 500; text-transform: uppercase; letter-spacing: 0.02em;
        background: var(--pages-neutral-4, #e5e5e5); color: var(--pages-neutral-11, #666);
      ">${v}</span>` },
    { id: 'priority', label: 'Priority', sortable: true, width: '100px',
      getValue: r => r.item.priority },
    { id: 'category', label: 'Category', sortable: true, width: '140px',
      getValue: r => r.item.category ?? '—' },
    { id: 'assignee', label: 'Assignee', sortable: true, width: '120px',
      getValue: r => r.item.assigneeId ?? 'Unassigned' },
    { id: 'created', label: 'Age', type: 'date' as const, sortable: true, width: '80px',
      getValue: r => r.item.createdAt,
      render: (v) => relativeTime(v as string) },
  ];

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin-bottom: 8px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin-bottom: 16px; color: var(--pages-neutral-11, #555); font-size: 14px; }
    .demo-section { margin-bottom: 32px; }
    .demo-section h3 { margin-bottom: 8px; font-size: 16px; font-weight: 500; color: var(--pages-neutral-12, #111); }
    .table-container {
      border: 1px solid var(--pages-neutral-5, #e0e0e0);
      border-radius: 8px; overflow: hidden; height: 500px;
    }
    .status-bar {
      padding: 8px 16px; font-size: 12px; color: var(--pages-neutral-9, #888);
      border-top: 1px solid var(--pages-neutral-5, #e0e0e0);
      background: var(--pages-neutral-2, #fafafa);
    }
    pages-data-table::part(row) {
      border-left: 3px solid transparent;
    }
    pages-data-table::part(priority-urgent) {
      border-left-color: var(--pages-danger-9, #dc2626);
    }
    pages-data-table::part(priority-high) {
      border-left-color: var(--pages-warning-9, #d97706);
    }
    pages-data-table::part(priority-medium) {
      border-left-color: var(--pages-accent-9, #2563eb);
    }
    pages-data-table::part(priority-low) {
      border-left-color: var(--pages-neutral-7, #a3a3a3);
    }
  `;

  override async connectedCallback() {
    super.connectedCallback();
    const resp = await fetch('/workitems/inbox');
    const data = await resp.json();
    this.items = data as WorkItemRootResponse[];
  }

  private handleSelection(e: CustomEvent<SelectionChangeDetail>) {
    this.selectedKeys = [...e.detail.selectedKeys];
  }

  private handleActivate(e: CustomEvent<RowActivateDetail>) {
    const row = e.detail.row as WorkItemRootResponse;
    this.lastActivated = row.item.title;
  }

  override render() {
    return html`
      <h2>Data Table</h2>
      <p>Generic data table with configurable columns, three display modes, multi-select, sorting, and column visibility.
         Uses CSS Grid rendering and virtual scrolling. Keyboard navigable (arrows, Enter, Space, Escape).</p>

      <div class="demo-section">
        <div class="table-container">
          <pages-data-table
            .rows=${this.items}
            .columns=${this.columns as ColumnDef[]}
            .getRowKey=${(r: unknown) => (r as WorkItemRootResponse).item.id}
            .getRowClass=${(r: unknown) => 'priority-' + (r as WorkItemRootResponse).item.priority.toLowerCase()}
            mode="auto"
            .pageSize=${10}
            selection="multi"
            .selectedKeys=${this.selectedKeys}
            client-sort
            @selection-change=${this.handleSelection}
            @row-activate=${this.handleActivate}
          ></pages-data-table>
        </div>

        <div class="status-bar">
          ${this.selectedKeys.length > 0
            ? `${this.selectedKeys.length} row(s) selected`
            : 'No selection'}
          ${this.lastActivated ? ` — Last activated: ${this.lastActivated}` : ''}
          — ${this.items.length} total rows
          — Mode: ${this.currentMode}
        </div>
      </div>
    `;
  }
}
