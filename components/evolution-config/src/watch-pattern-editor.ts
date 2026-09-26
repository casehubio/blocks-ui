import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { PagesConfirmDialog } from '@casehubio/pages-ui-components';
import '@casehubio/pages-table';
import type { TableColumnConfig, ColumnRenderer } from '@casehubio/pages-table';
import { fromRows } from '@casehubio/pages-data/dist/dataset/conversion.js';
import { columnId, ColumnType } from '@casehubio/pages-data/dist/dataset/types.js';
import type { CellValue, ColumnId, TypedRow } from '@casehubio/pages-data/dist/dataset/types.js';
import type { WatchPattern, WatchPatternInput, CategoryDescriptor } from './types.js';
import { EvolutionApi } from './api.js';
import { emitEvolutionEvent, EvolutionEventTopics } from './events.js';

const W_ID_COL = columnId('id');
const W_CATEGORY_COL = columnId('category');
const W_AREA_COL = columnId('areaId');
const W_TARGET_COL = columnId('targetPattern');
const W_SIZE_COL = columnId('minEstimatedSize');
const W_CREATED_COL = columnId('createdAt');
const W_ACTIONS_COL = columnId('actions');

const WATCH_COL_DEFS = [
  { id: W_ID_COL, type: ColumnType.TEXT, getValue: (r: WatchPattern) => r.id },
  { id: W_CATEGORY_COL, name: 'Category', type: ColumnType.TEXT, getValue: (r: WatchPattern) => r.category ?? '' },
  { id: W_AREA_COL, name: 'Area', type: ColumnType.TEXT, getValue: (r: WatchPattern) => r.areaId ?? '' },
  { id: W_TARGET_COL, name: 'Target Pattern', type: ColumnType.TEXT, getValue: (r: WatchPattern) => r.targetPattern ?? '' },
  { id: W_SIZE_COL, name: 'Min Size', type: ColumnType.TEXT, getValue: (r: WatchPattern) => r.minEstimatedSize != null ? String(r.minEstimatedSize) : '' },
  { id: W_CREATED_COL, name: 'Created', type: ColumnType.TEXT, getValue: (r: WatchPattern) => r.createdAt },
  { id: W_ACTIONS_COL, type: ColumnType.TEXT, getValue: () => '' },
] as const;

const WATCH_COL_CONFIG: readonly TableColumnConfig[] = [
  { id: W_ID_COL, visible: false },
  { id: W_CATEGORY_COL, sortable: true, width: '120px' },
  { id: W_AREA_COL, sortable: true, width: '120px' },
  { id: W_TARGET_COL, sortable: true, width: '1fr' },
  { id: W_SIZE_COL, sortable: true, width: '80px' },
  { id: W_CREATED_COL, sortable: true, width: '140px' },
  { id: W_ACTIONS_COL, sortable: false, width: '60px' },
];

export interface WatchPatternEditorProps {
  endpoint?: string;
  caseId?: string;
  tenancyId?: string;
  patterns?: readonly WatchPattern[];
  categories?: readonly CategoryDescriptor[];
  readonly?: boolean;
}

interface FormData {
  category: string;
  areaId: string;
  targetPattern: string;
  minEstimatedSize: string;
}

const EMPTY_FORM: FormData = { category: '', areaId: '', targetPattern: '', minEstimatedSize: '' };

@customElement('blocks-watch-pattern-editor')
export class WatchPatternEditor extends LitElement {
  @property({ type: String }) endpoint?: string;
  @property({ type: String }) caseId?: string;
  @property({ type: String }) tenancyId?: string;
  @property({ type: Array }) patterns?: readonly WatchPattern[];
  @property({ type: Array }) categories?: readonly CategoryDescriptor[];
  @property({ type: Boolean }) readonly = false;

  @state() private _loading = false;
  @state() private _error: string | null = null;
  @state() private _data: WatchPattern[] | null = null;
  @state() private _showAddForm = false;
  @state() private _formData: FormData = { ...EMPTY_FORM };
  @state() private _showRemoveDialog = false;
  @state() private _pendingRemoveId: string | null = null;

  private _api?: EvolutionApi;

  private _columnRenderers: ReadonlyMap<ColumnId, ColumnRenderer> = new Map<ColumnId, ColumnRenderer>([
    [W_CATEGORY_COL, (cell: CellValue) => {
      const val = cell.type === 'NULL' ? '' : (cell as { value: string }).value;
      if (!val) return html`<span style="color:var(--pages-neutral-7,#999);font-style:italic">Any</span>`;
      return html`<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:500;background:var(--pages-accent-3,#cce5ff);color:var(--pages-accent-11,#0066cc)">${val}</span>`;
    }],
    [W_AREA_COL, (cell: CellValue) => {
      const val = cell.type === 'NULL' ? '' : (cell as { value: string }).value;
      return val ? html`${val}` : html`<span style="color:var(--pages-neutral-7,#999);font-style:italic">Any</span>`;
    }],
    [W_TARGET_COL, (cell: CellValue) => {
      const val = cell.type === 'NULL' ? '' : (cell as { value: string }).value;
      if (!val) return html`<span style="color:var(--pages-neutral-7,#999);font-style:italic">Any</span>`;
      return html`<code style="font-family:var(--pages-font-mono,monospace);font-size:13px">${val}</code>`;
    }],
    [W_SIZE_COL, (cell: CellValue) => {
      const val = cell.type === 'NULL' ? '' : (cell as { value: string }).value;
      return val || html`<span style="color:var(--pages-neutral-7,#999)">—</span>`;
    }],
    [W_CREATED_COL, (cell: CellValue) => {
      if (cell.type === 'NULL' || !(cell as { value: string }).value) return '';
      const d = new Date((cell as { value: string }).value);
      return html`<span style="font-size:12px;color:var(--pages-neutral-9,#737373)">${d.toLocaleString()}</span>`;
    }],
    [W_ACTIONS_COL, (_cell: CellValue, row: TypedRow) => {
      if (this.readonly) return nothing;
      const id = row.text(W_ID_COL);
      return html`<button style="padding:4px 12px;border:none;border-radius:4px;font-size:13px;font-weight:500;cursor:pointer;background:var(--pages-danger-3,#fee);color:var(--pages-danger-11,#c00)" aria-label="Delete watch pattern ${id}" @click=${(e: Event) => { e.stopPropagation(); this._handleRemove(id); }}>Delete</button>`;
    }],
  ]);

  static override styles = css`
    :host { display: block; font-family: var(--pages-font-family, system-ui); }
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
    .form-row { display: flex; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
    .form-field { display: flex; flex-direction: column; flex: 1; min-width: 140px; }
    .form-field label { font-size: 11px; font-weight: 600; margin-bottom: 4px; color: var(--pages-neutral-9, #737373); }
    .form-field input, .form-field select {
      padding: 6px 8px; border: 1px solid var(--pages-neutral-6, #e0e0e0);
      border-radius: 4px; font-size: 13px;
    }
    .add-form-actions { display: flex; gap: 8px; margin-top: 12px; }
    .add-form-actions button {
      padding: 6px 14px; border: none; border-radius: 4px;
      font-size: 13px; font-weight: 500; cursor: pointer;
    }
    .btn-submit { background: var(--pages-accent-9, #0080ff); color: white; }
    .btn-cancel { background: var(--pages-neutral-3, #f5f5f5); color: var(--pages-neutral-11, #555); }
    .validation-error { color: var(--pages-danger-11, #c00); font-size: 12px; margin-top: 4px; }
    .loading { padding: 24px; color: var(--pages-neutral-9, #737373); text-align: center; }
    .error { padding: 16px; background: var(--pages-danger-3, #fee); color: var(--pages-danger-11, #c00); border-radius: 4px; }
    .empty { padding: 24px; color: var(--pages-neutral-9, #737373); text-align: center; }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', 'Watch pattern editor');
    if (this.endpoint && !this._api) {
      this._api = new EvolutionApi(this.endpoint);
    }
    if (this._api && this.caseId && this.tenancyId) {
      this._fetch();
    }
  }

  configure(props: Partial<WatchPatternEditorProps>): void {
    if (props.endpoint !== undefined) this.endpoint = props.endpoint;
    if (props.caseId !== undefined) this.caseId = props.caseId;
    if (props.tenancyId !== undefined) this.tenancyId = props.tenancyId;
    if (props.patterns !== undefined) this.patterns = props.patterns;
    if (props.categories !== undefined) this.categories = props.categories;
    if (props.readonly !== undefined) this.readonly = props.readonly;
  }

  private get _items(): readonly WatchPattern[] {
    return this.patterns ?? this._data ?? [];
  }

  private async _fetch(): Promise<void> {
    if (!this._api || !this.caseId || !this.tenancyId) return;
    this._loading = true;
    this._error = null;
    try {
      this._data = await this._api.getWatchPatterns(this.caseId, this.tenancyId);
    } catch (e) {
      this._error = e instanceof Error ? e.message : 'Failed to load watch patterns';
    } finally {
      this._loading = false;
    }
  }

  private _isFormValid(): boolean {
    const { category, areaId, targetPattern, minEstimatedSize } = this._formData;
    return !!(category.trim() || areaId.trim() || targetPattern.trim() || minEstimatedSize.trim());
  }

  /** @internal — exposed for testing */
  _handleAdd(): void {
    if (!this._isFormValid()) return;
    const input: WatchPatternInput = {
      ...(this._formData.category.trim() ? { category: this._formData.category.trim() } : {}),
      ...(this._formData.areaId.trim() ? { areaId: this._formData.areaId.trim() } : {}),
      ...(this._formData.targetPattern.trim() ? { targetPattern: this._formData.targetPattern.trim() } : {}),
      ...(this._formData.minEstimatedSize.trim() ? { minEstimatedSize: parseInt(this._formData.minEstimatedSize.trim(), 10) } : {}),
    };
    if (this._api && this.caseId && this.tenancyId) {
      this._api.addWatchPattern(this.caseId, this.tenancyId, input)
        .then(() => this._fetch())
        .catch((e: Error) => { this._error = e.message; });
    }
    emitEvolutionEvent(this, EvolutionEventTopics.WATCH_PATTERN_CHANGED, {
      action: 'add' as const, input,
    });
    this._showAddForm = false;
    this._formData = { ...EMPTY_FORM };
  }

  private _handleRemove(patternId: string): void {
    this._pendingRemoveId = patternId;
    this._showRemoveDialog = true;
  }

  private async _confirmRemove(): Promise<void> {
    const id = this._pendingRemoveId;
    if (!id) return;
    this._showRemoveDialog = false;
    this._pendingRemoveId = null;
    if (this._api && this.caseId && this.tenancyId) {
      try {
        await this._api.removeWatchPattern(this.caseId, this.tenancyId, id);
        await this._fetch();
      } catch (e) {
        this._error = e instanceof Error ? e.message : 'Failed to remove watch pattern';
      }
    }
    emitEvolutionEvent(this, EvolutionEventTopics.WATCH_PATTERN_CHANGED, {
      action: 'remove' as const, patternId: id,
    });
  }

  private _updateField(field: keyof FormData, value: string): void {
    this._formData = { ...this._formData, [field]: value };
  }

  override render() {
    this.setAttribute('aria-busy', String(this._loading));
    if (this._loading) return html`<div class="loading">Loading watch patterns...</div>`;
    if (this._error) return html`<div class="error">${this._error}</div>`;

    const items = this._items;

    return html`
      ${!this.readonly ? html`
        <div class="header">
          <span></span>
          <button class="btn-add" @click=${() => { this._showAddForm = true; }}>Add Watch Pattern</button>
        </div>
      ` : nothing}

      ${this._showAddForm ? html`
        <div class="add-form" role="form" aria-label="Add watch pattern">
          <div class="form-row">
            <div class="form-field">
              <label>Category</label>
              ${this.categories && this.categories.length > 0
                ? html`<select .value=${this._formData.category}
                                @change=${(e: Event) => this._updateField('category', (e.target as HTMLSelectElement).value)}>
                    <option value="">Any</option>
                    ${this.categories.map(c => html`<option value=${c.id}>${c.name}</option>`)}
                  </select>`
                : html`<input type="text" placeholder="e.g. lint-fix"
                              .value=${this._formData.category}
                              @input=${(e: Event) => this._updateField('category', (e.target as HTMLInputElement).value)} />`
              }
            </div>
            <div class="form-field">
              <label>Area</label>
              <input type="text" placeholder="Capability area"
                     .value=${this._formData.areaId}
                     @input=${(e: Event) => this._updateField('areaId', (e.target as HTMLInputElement).value)} />
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label>Target Pattern</label>
              <input type="text" placeholder="Glob pattern (e.g. *.java)"
                     .value=${this._formData.targetPattern}
                     @input=${(e: Event) => this._updateField('targetPattern', (e.target as HTMLInputElement).value)} />
            </div>
            <div class="form-field">
              <label>Min Size</label>
              <input type="number" placeholder="Minimum change size"
                     .value=${this._formData.minEstimatedSize}
                     @input=${(e: Event) => this._updateField('minEstimatedSize', (e.target as HTMLInputElement).value)} />
            </div>
          </div>
          <div class="add-form-actions">
            <button class="btn-submit" ?disabled=${!this._isFormValid()} @click=${() => this._handleAdd()}>Add</button>
            <button class="btn-cancel" @click=${() => { this._showAddForm = false; this._formData = { ...EMPTY_FORM }; }}>Cancel</button>
          </div>
        </div>
      ` : nothing}

      ${items.length === 0
        ? html`<div class="empty">No active watch patterns.</div>`
        : html`
          <pages-table
            .dataSet=${fromRows([...items], WATCH_COL_DEFS)}
            .columnConfig=${WATCH_COL_CONFIG}
            .columnRenderers=${this._columnRenderers}
            .getRowKey=${(row: TypedRow) => row.text(W_ID_COL)}
            mode="scroll"
            selection="none"
          ></pages-table>
        `
      }

      <pages-confirm-dialog
        .open=${this._showRemoveDialog}
        heading="Remove watch pattern?"
        message="This watch pattern will be removed and matching improvements will no longer trigger escalation."
        confirmLabel="Remove"
        cancelLabel="Keep"
        confirmVariant="danger"
        @confirm=${() => this._confirmRemove()}
        @cancel=${() => { this._showRemoveDialog = false; this._pendingRemoveId = null; }}
      ></pages-confirm-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blocks-watch-pattern-editor': WatchPatternEditor;
  }
}
