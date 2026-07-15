import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { DataSourceMixin, createTypedFetchSource, emitPagesEvent } from '@casehubio/blocks-ui-core';
import '@casehubio/pages-table';
import type { TableColumnConfig, ColumnRenderer } from '@casehubio/pages-table';
import type { SourceFactory } from '@casehubio/pages-component';
import { fromRows } from '@casehubio/pages-data/dist/dataset/conversion.js';
import { columnId, ColumnType } from '@casehubio/pages-data/dist/dataset/types.js';
import type { CellValue, ColumnId, TypedRow } from '@casehubio/pages-data/dist/dataset/types.js';
import type { RequirementDefinition } from './types.js';

export const ComplianceSummaryTopics = {
  REQUIREMENT_SELECTED: 'compliance.requirement-selected',
} as const;

const REGULATION_COL = columnId('regulation');
const REQUIREMENT_COL = columnId('requirement');
const MECHANISM_COL = columnId('mechanism');
const STATUS_COL = columnId('status');
const EVIDENCE_COL = columnId('evidence');

const REQUIREMENT_COLUMNS = [
  { id: REGULATION_COL, name: 'Regulation', type: ColumnType.TEXT, getValue: (r: RequirementDefinition) => r.regulation },
  { id: REQUIREMENT_COL, name: 'Requirement', type: ColumnType.TEXT, getValue: (r: RequirementDefinition) => r.requirement },
  { id: MECHANISM_COL, name: 'Mechanism', type: ColumnType.TEXT, getValue: (r: RequirementDefinition) => r.mechanism },
  { id: STATUS_COL, name: 'Status', type: ColumnType.TEXT, getValue: (r: RequirementDefinition) => r.status },
  { id: EVIDENCE_COL, name: 'Evidence', type: ColumnType.TEXT, getValue: (r: RequirementDefinition) => r.evidenceUrl ?? '' },
];

const TABLE_CONFIG: readonly TableColumnConfig[] = [
  { id: REGULATION_COL, sortable: true },
  { id: REQUIREMENT_COL, sortable: true },
  { id: MECHANISM_COL, sortable: true },
  { id: STATUS_COL, sortable: true },
  { id: EVIDENCE_COL },
];

const STATUS_CLASSES: Record<string, string> = {
  MET: 'status--met',
  PARTIAL: 'status--partial',
  GAP: 'status--gap',
  BREACHED: 'status--breached',
};

@customElement('compliance-summary')
export class ComplianceSummary extends DataSourceMixin(LitElement) {
  @property({ attribute: false }) requirements: RequirementDefinition[] | null = null;

  static override styles = css`
    :host { display: block; font-family: var(--pages-font-family, system-ui); }
    .empty { color: var(--pages-neutral-9, #888); font-style: italic; padding: var(--pages-space-4, 1rem); }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: var(--pages-radius-2, 4px); font-weight: 600; font-size: 12px; }
    .status--met { background: var(--pages-success-3, #d4edda); color: var(--pages-success-11, #155724); }
    .status--partial { background: var(--pages-warning-3, #fff3cd); color: var(--pages-warning-11, #856404); }
    .status--gap { background: var(--pages-orange-3, #ffe5d0); color: var(--pages-orange-11, #8a4000); }
    .status--breached { background: var(--pages-danger-3, #f8d7da); color: var(--pages-danger-11, #721c24); }
    .evidence-link { color: var(--pages-accent-9, #3b82f6); text-decoration: none; font-size: 13px; }
    .evidence-link:hover { text-decoration: underline; }
    .evidence-dash { color: var(--pages-neutral-9, #888); }
  `;

  private _columnRenderers: ReadonlyMap<ColumnId, ColumnRenderer> = new Map([
    [STATUS_COL, (cell: CellValue) => {
      const value = cell.type === 'NULL' ? '' : String((cell as { value: string }).value);
      const cls = STATUS_CLASSES[value] ?? '';
      return html`<span class="status-badge ${cls}">${value}</span>`;
    }],
    [EVIDENCE_COL, (cell: CellValue) => {
      const url = cell.type === 'NULL' ? '' : String((cell as { value: string }).value);
      if (url) {
        return html`<a href="${url}" class="evidence-link" target="_blank" rel="noopener">View</a>`;
      }
      return html`<span class="evidence-dash">—</span>`;
    }],
  ]);

  override resolveEndpoint(): string | undefined {
    if (this.requirements) return undefined;
    return this.endpoint;
  }

  override createSourceFactory(): SourceFactory {
    return (url) => createTypedFetchSource<RequirementDefinition[]>(url, (data, sink) => {
      const dataset = fromRows(data, REQUIREMENT_COLUMNS);
      sink.apply({ type: 'snapshot', dataset });
    });
  }

  override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('requirements') && this.requirements) {
      this.dataSet = fromRows(this.requirements, REQUIREMENT_COLUMNS);
    }
  }

  private _handleRowActivate(e: CustomEvent) {
    const row = e.detail.row as TypedRow;
    emitPagesEvent(this, ComplianceSummaryTopics.REQUIREMENT_SELECTED, {
      regulation: row.text(REGULATION_COL),
      requirement: row.text(REQUIREMENT_COL),
      status: row.text(STATUS_COL),
    });
  }

  override render() {
    if (this.loading) return html`<div class="empty">Loading requirements...</div>`;
    if (this.error) return html`<div class="empty">Compliance data unavailable</div>`;
    if (!this.dataSet || this.dataSet.rows.length === 0) return html`<div class="empty">No regulatory requirements defined</div>`;

    return html`
      <pages-table
        .dataSet=${this.dataSet}
        .columnConfig=${TABLE_CONFIG}
        .columnRenderers=${this._columnRenderers}
        @row-activate=${this._handleRowActivate}
      ></pages-table>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'compliance-summary': ComplianceSummary;
  }
}
