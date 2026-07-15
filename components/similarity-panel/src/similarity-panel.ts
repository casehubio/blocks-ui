import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { DataSourceMixin, createTypedFetchSource, EMPTY_DATASET, emitPagesEvent } from '@casehubio/blocks-ui-core';
import '@casehubio/pages-table';
import type { TableColumnConfig, ColumnRenderer } from '@casehubio/pages-table';
import type { SourceFactory } from '@casehubio/pages-component';
import { fromRows } from '@casehubio/pages-data/dist/dataset/conversion.js';
import { columnId, ColumnType } from '@casehubio/pages-data/dist/dataset/types.js';
import type { CellValue, ColumnId, TypedRow } from '@casehubio/pages-data/dist/dataset/types.js';
import type { Precedent } from './types.js';

export const SimilarityPanelTopics = {
  PRECEDENT_SELECTED: 'precedent.selected',
} as const;

const CASE_ID_COL = columnId('caseId');
const SIMILARITY_COL = columnId('similarity');
const OUTCOME_COL = columnId('outcome');
const RESOLUTION_COL = columnId('resolutionTime');

const PRECEDENT_COLUMNS = [
  { id: CASE_ID_COL, name: 'Case', type: ColumnType.TEXT, getValue: (p: Precedent) => p.caseId },
  { id: SIMILARITY_COL, name: 'Similarity', type: ColumnType.NUMBER, getValue: (p: Precedent) => p.similarity },
  { id: OUTCOME_COL, name: 'Outcome', type: ColumnType.TEXT, getValue: (p: Precedent) => p.outcome },
  { id: RESOLUTION_COL, name: 'Resolution', type: ColumnType.TEXT, getValue: (p: Precedent) => p.resolutionTime },
];

const TABLE_CONFIG: readonly TableColumnConfig[] = [
  { id: CASE_ID_COL, sortable: true },
  { id: SIMILARITY_COL, sortable: true },
  { id: OUTCOME_COL, sortable: true },
  { id: RESOLUTION_COL, sortable: true },
];

function getOutcomeClass(outcome: string): string {
  const lower = outcome.toLowerCase();
  if (lower.includes('resolved')) return 'outcome--resolved';
  if (lower.includes('pending')) return 'outcome--pending';
  if (lower.includes('escalated')) return 'outcome--escalated';
  return '';
}

@customElement('similarity-panel')
export class SimilarityPanel extends DataSourceMixin(LitElement) {
  @property({ attribute: false }) data: Precedent[] | null = null;
  @property({ type: String, attribute: 'empty-message' }) emptyMessage = 'No similar cases found';

  static override styles = css`
    :host { display: block; font-family: var(--pages-font-family, system-ui); }
    .empty { color: var(--pages-neutral-9, #888); font-style: italic; padding: var(--pages-space-4, 1rem); }
    .similarity-bar { display: flex; align-items: center; gap: var(--pages-space-2, 0.5rem); }
    .bar-bg { flex: 1; height: 8px; background: var(--pages-neutral-4, #e5e5e5); border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--pages-accent-9, #3b82f6); }
    .percentage { font-weight: 600; min-width: 45px; font-size: 13px; }
    .outcome-badge { display: inline-block; padding: 4px 8px; border-radius: var(--pages-radius-2, 4px); font-size: 12px; font-weight: 500; }
    .outcome--resolved { background: var(--pages-success-3, #d4edda); color: var(--pages-success-11, #155724); }
    .outcome--pending { background: var(--pages-warning-3, #fff3cd); color: var(--pages-warning-11, #856404); }
    .outcome--escalated { background: var(--pages-orange-3, #ffe5d0); color: var(--pages-orange-11, #8a4000); }
  `;

  private _columnRenderers: ReadonlyMap<ColumnId, ColumnRenderer> = new Map([
    [SIMILARITY_COL, (cell: CellValue) => {
      const value = cell.type === 'NULL' ? 0 : (cell as { value: number }).value;
      return html`
        <div class="similarity-bar">
          <div class="bar-bg">
            <div class="bar-fill" style="width: ${value}%"></div>
          </div>
          <span class="percentage">${value}%</span>
        </div>
      `;
    }],
    [OUTCOME_COL, (cell: CellValue) => {
      const value = cell.type === 'NULL' ? '' : String((cell as { value: string }).value);
      return html`<span class="outcome-badge ${getOutcomeClass(value)}">${value}</span>`;
    }],
  ]);

  override resolveEndpoint(): string | undefined {
    if (this.data) return undefined;
    return this.endpoint;
  }

  override createSourceFactory(): SourceFactory {
    return (url) => createTypedFetchSource<Precedent[]>(url, (data, sink) => {
      const dataset = fromRows(data, PRECEDENT_COLUMNS);
      sink.apply({ type: 'snapshot', dataset });
    });
  }

  override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('data') && this.data) {
      this.dataSet = fromRows(this.data, PRECEDENT_COLUMNS);
    }
  }

  private _handleRowActivate(e: CustomEvent) {
    const row = e.detail.row as TypedRow;
    emitPagesEvent(this, SimilarityPanelTopics.PRECEDENT_SELECTED, {
      caseId: row.text(CASE_ID_COL),
      similarity: row.number(SIMILARITY_COL),
      outcome: row.text(OUTCOME_COL),
    });
  }

  override render() {
    if (this.loading) return html`<div class="empty">Loading precedents...</div>`;
    if (this.error) return html`<div class="empty">Precedent data unavailable</div>`;
    if (!this.dataSet || this.dataSet.rows.length === 0) return html`<div class="empty">${this.emptyMessage}</div>`;

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
    'similarity-panel': SimilarityPanel;
  }
}
