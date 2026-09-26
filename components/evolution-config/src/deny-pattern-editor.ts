import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { PagesConfirmDialog } from '@casehubio/pages-ui-components';
import '@casehubio/pages-table';
import type { TableColumnConfig, ColumnRenderer } from '@casehubio/pages-table';
import { fromRows } from '@casehubio/pages-data/dist/dataset/conversion.js';
import { columnId, ColumnType } from '@casehubio/pages-data/dist/dataset/types.js';
import type { CellValue, ColumnId, TypedRow } from '@casehubio/pages-data/dist/dataset/types.js';
import type { DenyPatternView, DynamicDenyEntry } from './types.js';
import { EvolutionApi } from './api.js';
import { emitEvolutionEvent, EvolutionEventTopics } from './events.js';

const D_PATTERN_COL = columnId('pattern');
const D_ADDED_BY_COL = columnId('addedBy');
const D_ADDED_AT_COL = columnId('addedAt');
const D_ACTIONS_COL = columnId('actions');

const DYNAMIC_COL_DEFS = [
  { id: D_PATTERN_COL, name: 'Pattern', type: ColumnType.TEXT, getValue: (r: DynamicDenyEntry) => r.pattern },
  { id: D_ADDED_BY_COL, name: 'Added by', type: ColumnType.TEXT, getValue: (r: DynamicDenyEntry) => r.addedBy },
  { id: D_ADDED_AT_COL, name: 'Added at', type: ColumnType.TEXT, getValue: (r: DynamicDenyEntry) => r.addedAt },
  { id: D_ACTIONS_COL, type: ColumnType.TEXT, getValue: () => '' },
] as const;

const DYNAMIC_COL_CONFIG: readonly TableColumnConfig[] = [
  { id: D_PATTERN_COL, sortable: true, width: '1fr' },
  { id: D_ADDED_BY_COL, sortable: true, width: '120px' },
  { id: D_ADDED_AT_COL, sortable: true, width: '160px' },
  { id: D_ACTIONS_COL, sortable: false, width: '60px' },
];

export interface DenyPatternEditorProps {
  endpoint?: string;
  caseId?: string;
  tenancyId?: string;
  patterns?: DenyPatternView;
  readonly?: boolean;
}

@customElement('blocks-deny-pattern-editor')
export class DenyPatternEditor extends LitElement {
  @property({ type: String }) endpoint?: string;
  @property({ type: String }) caseId?: string;
  @property({ type: String }) tenancyId?: string;
  @property({ type: Object }) patterns?: DenyPatternView;
  @property({ type: Boolean }) readonly = false;

  @state() private _loading = false;
  @state() private _error: string | null = null;
  @state() private _data: DenyPatternView | null = null;
  @state() private _showAddForm = false;
  @state() private _addValue = '';
  @state() private _showRemoveDialog = false;
  @state() private _pendingRemovePattern: string | null = null;

  private _api?: EvolutionApi;

  private _columnRenderers: ReadonlyMap<ColumnId, ColumnRenderer> = new Map<ColumnId, ColumnRenderer>([
    [D_PATTERN_COL, (cell: CellValue) => {
      const val = cell.type === 'NULL' ? '' : (cell as { value: string }).value;
      return html`<code style="font-family:var(--pages-font-mono,monospace);font-size:13px">${val}</code>`;
    }],
    [D_ADDED_AT_COL, (cell: CellValue) => {
      if (cell.type === 'NULL' || !(cell as { value: string }).value) return '';
      const d = new Date((cell as { value: string }).value);
      return html`<span style="font-size:12px;color:var(--pages-neutral-9,#737373)">${d.toLocaleString()}</span>`;
    }],
    [D_ACTIONS_COL, (_cell: CellValue, row: TypedRow) => {
      if (this.readonly) return nothing;
      const pattern = row.text(D_PATTERN_COL);
      return html`<button style="padding:4px 12px;border:none;border-radius:4px;font-size:13px;font-weight:500;cursor:pointer;background:var(--pages-danger-3,#fee);color:var(--pages-danger-11,#c00)" aria-label="Delete ${pattern}" @click=${(e: Event) => { e.stopPropagation(); this._handleRemove(pattern); }}>Delete</button>`;
    }],
  ]);

  static override styles = css`
    :host { display: block; font-family: var(--pages-font-family, system-ui); }
    .section-header {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--pages-neutral-9, #737373);
      margin: 16px 0 8px; padding: 4px 0;
      border-bottom: 1px solid var(--pages-neutral-4, #e0e0e0);
    }
    .structural-list {
      list-style: none; padding: 0; margin: 0 0 16px;
    }
    .structural-item {
      padding: 4px 8px; font-family: var(--pages-font-mono, monospace);
      font-size: 13px; color: var(--pages-neutral-11, #555);
    }
    .structural-item:nth-child(even) {
      background: var(--pages-neutral-2, #fafafa);
    }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .btn-add {
      padding: 6px 14px; background: var(--pages-accent-9, #0080ff); color: white;
      border: none; border-radius: 4px; font-size: 13px; font-weight: 500; cursor: pointer;
    }
    .btn-add:hover { background: var(--pages-accent-10, #0066cc); }
    .add-form {
      border: 1px solid var(--pages-neutral-6, #e0e0e0); border-radius: 8px;
      padding: 16px; margin-bottom: 12px; background: var(--pages-neutral-2, #fafafa);
    }
    .add-form input {
      width: 100%; padding: 8px; border: 1px solid var(--pages-neutral-6, #e0e0e0);
      border-radius: 4px; font-family: var(--pages-font-mono, monospace); font-size: 13px;
      box-sizing: border-box;
    }
    .add-form-actions { display: flex; gap: 8px; margin-top: 12px; }
    .add-form-actions button {
      padding: 6px 14px; border: none; border-radius: 4px;
      font-size: 13px; font-weight: 500; cursor: pointer;
    }
    .btn-submit { background: var(--pages-accent-9, #0080ff); color: white; }
    .btn-cancel { background: var(--pages-neutral-3, #f5f5f5); color: var(--pages-neutral-11, #555); }
    .loading { padding: 24px; color: var(--pages-neutral-9, #737373); text-align: center; }
    .error { padding: 16px; background: var(--pages-danger-3, #fee); color: var(--pages-danger-11, #c00); border-radius: 4px; }
    .empty { padding: 24px; color: var(--pages-neutral-9, #737373); text-align: center; }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', 'Deny pattern editor');
    if (this.endpoint && !this._api) {
      this._api = new EvolutionApi(this.endpoint);
    }
    if (this._api && this.caseId && this.tenancyId) {
      this._fetch();
    }
  }

  configure(props: Partial<DenyPatternEditorProps>): void {
    if (props.endpoint !== undefined) this.endpoint = props.endpoint;
    if (props.caseId !== undefined) this.caseId = props.caseId;
    if (props.tenancyId !== undefined) this.tenancyId = props.tenancyId;
    if (props.patterns !== undefined) this.patterns = props.patterns;
    if (props.readonly !== undefined) this.readonly = props.readonly;
  }

  private get _view(): DenyPatternView | null {
    return this.patterns ?? this._data;
  }

  private async _fetch(): Promise<void> {
    if (!this._api || !this.caseId || !this.tenancyId) return;
    this._loading = true;
    this._error = null;
    try {
      this._data = await this._api.getDenyPatterns(this.caseId, this.tenancyId);
    } catch (e) {
      this._error = e instanceof Error ? e.message : 'Failed to load deny patterns';
    } finally {
      this._loading = false;
    }
  }

  /** @internal — exposed for testing */
  _handleAdd(pattern: string): void {
    if (!pattern.trim()) return;
    if (this._api && this.caseId && this.tenancyId) {
      this._api.addDenyPattern(this.caseId, this.tenancyId, pattern.trim())
        .then(() => this._fetch())
        .catch((e: Error) => { this._error = e.message; });
    }
    emitEvolutionEvent(this, EvolutionEventTopics.DENY_PATTERN_CHANGED, {
      action: 'add' as const, pattern: pattern.trim(),
    });
    this._showAddForm = false;
    this._addValue = '';
  }

  private _handleRemove(pattern: string): void {
    this._pendingRemovePattern = pattern;
    this._showRemoveDialog = true;
  }

  private async _confirmRemove(): Promise<void> {
    const pattern = this._pendingRemovePattern;
    if (!pattern) return;
    this._showRemoveDialog = false;
    this._pendingRemovePattern = null;
    if (this._api && this.caseId && this.tenancyId) {
      try {
        await this._api.removeDenyPattern(this.caseId, this.tenancyId, pattern);
        await this._fetch();
      } catch (e) {
        this._error = e instanceof Error ? e.message : 'Failed to remove deny pattern';
      }
    }
    emitEvolutionEvent(this, EvolutionEventTopics.DENY_PATTERN_CHANGED, {
      action: 'remove' as const, pattern,
    });
  }

  override render() {
    this.setAttribute('aria-busy', String(this._loading));
    if (this._loading) return html`<div class="loading">Loading deny patterns...</div>`;
    if (this._error) return html`<div class="error">${this._error}</div>`;

    const view = this._view;
    if (!view) return html`<div class="empty">No deny pattern data available.</div>`;

    const staticPatterns = view.staticPatterns;
    const dynamicPatterns = view.dynamicPatterns;

    return html`
      <div class="section-header">Structural Patterns</div>
      ${staticPatterns.length === 0
        ? html`<div class="empty">No structural deny patterns.</div>`
        : html`
          <ul class="structural-list" role="list">
            ${staticPatterns.map(p => html`<li class="structural-item" role="listitem">${p}</li>`)}
          </ul>
        `
      }

      <div class="section-header">Dynamic Patterns</div>

      ${!this.readonly ? html`
        <div class="header">
          <span></span>
          <button class="btn-add" @click=${() => { this._showAddForm = true; }}>Add Pattern</button>
        </div>
      ` : nothing}

      ${this._showAddForm ? html`
        <div class="add-form" role="form" aria-label="Add deny pattern">
          <input type="text" placeholder="Pattern to deny (e.g. AuthController)"
                 .value=${this._addValue}
                 @input=${(e: Event) => { this._addValue = (e.target as HTMLInputElement).value; }}
                 @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this._handleAdd(this._addValue); }} />
          <div class="add-form-actions">
            <button class="btn-submit" @click=${() => this._handleAdd(this._addValue)}>Add</button>
            <button class="btn-cancel" @click=${() => { this._showAddForm = false; this._addValue = ''; }}>Cancel</button>
          </div>
        </div>
      ` : nothing}

      ${dynamicPatterns.length === 0
        ? html`<div class="empty">No dynamic deny patterns configured.</div>`
        : html`
          <pages-table
            .dataSet=${fromRows([...dynamicPatterns], DYNAMIC_COL_DEFS)}
            .columnConfig=${DYNAMIC_COL_CONFIG}
            .columnRenderers=${this._columnRenderers}
            .getRowKey=${(row: TypedRow) => row.text(D_PATTERN_COL)}
            mode="scroll"
            selection="none"
          ></pages-table>
        `
      }

      <pages-confirm-dialog
        .open=${this._showRemoveDialog}
        heading="Remove deny pattern?"
        message="This pattern will be removed and the evolution conductor may propose changes matching it."
        confirmLabel="Remove"
        cancelLabel="Keep"
        confirmVariant="danger"
        @confirm=${() => this._confirmRemove()}
        @cancel=${() => { this._showRemoveDialog = false; this._pendingRemovePattern = null; }}
      ></pages-confirm-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blocks-deny-pattern-editor': DenyPatternEditor;
  }
}
