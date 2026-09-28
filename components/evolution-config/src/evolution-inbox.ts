import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { PagesConfirmDialog } from '@casehubio/pages-ui-components';
import '@casehubio/pages-table';
import type { ColumnRenderer } from '@casehubio/pages-table';
import { fromRows } from '@casehubio/pages-data/dist/dataset/conversion.js';
import { columnId, ColumnType } from '@casehubio/pages-data/dist/dataset/types.js';
import type { CellValue, ColumnId, TypedRow } from '@casehubio/pages-data/dist/dataset/types.js';
import type { ConductorInboxEntry, InboxEntryStatus, GateOutcome } from './types.js';
import { EvolutionApi } from './api.js';
import { emitEvolutionEvent, EvolutionEventTopics } from './events.js';

const ID_COL = columnId('id');
const STAGE_COL = columnId('stage');
const CATEGORY_COL = columnId('category');
const SUMMARY_COL = columnId('summary');
const CONFIDENCE_COL = columnId('confidence');
const ESCALATION_COL = columnId('escalation');
const STATUS_COL = columnId('status');
const QUEUED_COL = columnId('queuedAt');
const TIMEOUT_COL = columnId('timeout');
const ACTIONS_COL = columnId('actions');

const COL_DEFS = [
  { id: ID_COL, type: ColumnType.TEXT, getValue: (e: ConductorInboxEntry) => e.id },
  { id: STAGE_COL, name: 'Stage', type: ColumnType.TEXT, getValue: (e: ConductorInboxEntry) => e.stage },
  { id: CATEGORY_COL, name: 'Category', type: ColumnType.TEXT, getValue: (e: ConductorInboxEntry) => e.category ?? '' },
  { id: SUMMARY_COL, name: 'Summary', type: ColumnType.TEXT, getValue: (e: ConductorInboxEntry) => e.summary ?? '' },
  { id: CONFIDENCE_COL, name: 'Confidence', type: ColumnType.TEXT, getValue: (e: ConductorInboxEntry) => String(e.confidence) },
  { id: ESCALATION_COL, name: 'Escalation', type: ColumnType.TEXT, getValue: (e: ConductorInboxEntry) => e.escalationTriggers.map(t => t.layer).join(', ') },
  { id: STATUS_COL, name: 'Status', type: ColumnType.TEXT, getValue: (e: ConductorInboxEntry) => e.status },
  { id: QUEUED_COL, name: 'Queued', type: ColumnType.TEXT, getValue: (e: ConductorInboxEntry) => e.queuedAt },
  { id: TIMEOUT_COL, name: 'Timeout', type: ColumnType.TEXT, getValue: (e: ConductorInboxEntry) => e.timeoutMinutes != null ? String(e.timeoutMinutes) : '' },
  { id: ACTIONS_COL, type: ColumnType.TEXT, getValue: () => '' },
] as const;

const COL_CONFIG = [
  { id: ID_COL, visible: false },
  { id: STAGE_COL, sortable: true, width: '120px' },
  { id: CATEGORY_COL, sortable: true, width: '120px' },
  { id: SUMMARY_COL, sortable: false, width: '1fr' },
  { id: CONFIDENCE_COL, sortable: true, width: '100px' },
  { id: ESCALATION_COL, sortable: false, width: '140px' },
  { id: STATUS_COL, sortable: true, width: '120px' },
  { id: QUEUED_COL, sortable: true, width: '140px' },
  { id: TIMEOUT_COL, sortable: false, width: '80px' },
  { id: ACTIONS_COL, sortable: false, width: '140px' },
];

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'background:var(--pages-warning-3,#fef3c7);color:var(--pages-warning-11,#92400e)',
  APPROVED: 'background:var(--pages-success-3,#dcfce7);color:var(--pages-success-11,#166534)',
  REJECTED: 'background:var(--pages-danger-3,#fee2e2);color:var(--pages-danger-11,#991b1b)',
  REDIRECTED: 'background:var(--pages-accent-3,#dbeafe);color:var(--pages-accent-11,#1e40af)',
  TIMED_OUT: 'background:var(--pages-neutral-3,#f5f5f5);color:var(--pages-neutral-9,#737373)',
  AUTO_APPROVED: 'background:var(--pages-success-2,#f0fdf4);color:var(--pages-success-11,#166534)',
};

export interface EvolutionInboxProps {
  endpoint?: string;
  caseId?: string;
  tenancyId?: string;
  inbox?: readonly ConductorInboxEntry[];
  readonly?: boolean;
}

@customElement('blocks-evolution-inbox')
export class EvolutionInbox extends LitElement {
  @property({ type: String }) endpoint?: string;
  @property({ type: String }) caseId?: string;
  @property({ type: String }) tenancyId?: string;
  @property({ type: Array, attribute: false }) inbox?: readonly ConductorInboxEntry[];
  @property({ type: Boolean }) readonly = false;

  @state() private _loading = false;
  @state() private _error: string | null = null;
  @state() private _fetched: ConductorInboxEntry[] | null = null;
  @state() private _showRejectDialog = false;
  @state() private _pendingRejectId: string | null = null;
  @state() private _rejectReason = '';
  @state() private _rejectFeedback = '';

  private _api?: EvolutionApi;

  private get _data(): readonly ConductorInboxEntry[] {
    return this.inbox ?? this._fetched ?? [];
  }

  private _columnRenderers: ReadonlyMap<ColumnId, ColumnRenderer> = new Map<ColumnId, ColumnRenderer>([
    [CATEGORY_COL, (cell: CellValue) => {
      const val = cell.type === 'NULL' ? '' : (cell as { value: string }).value;
      if (!val) return nothing;
      return html`<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:500;background:var(--pages-accent-3,#dbeafe);color:var(--pages-accent-11,#1e40af)">${val}</span>`;
    }],
    [SUMMARY_COL, (cell: CellValue) => {
      const val = cell.type === 'NULL' ? '' : (cell as { value: string }).value;
      return html`<span style="font-size:13px" title="${val}">${val}</span>`;
    }],
    [CONFIDENCE_COL, (cell: CellValue) => {
      const raw = cell.type === 'NULL' ? '0' : (cell as { value: string }).value;
      const pct = Math.round(parseFloat(raw) * 100);
      const barColor = pct >= 80 ? 'var(--pages-success-9,#22c55e)' : pct >= 50 ? 'var(--pages-warning-9,#f59e0b)' : 'var(--pages-danger-9,#ef4444)';
      return html`
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:6px;background:var(--pages-neutral-3,#f5f5f5);border-radius:3px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${barColor};border-radius:3px"></div>
          </div>
          <span style="font-size:11px;color:var(--pages-neutral-9,#737373);min-width:30px">${pct}%</span>
        </div>
      `;
    }],
    [ESCALATION_COL, (cell: CellValue) => {
      const val = cell.type === 'NULL' ? '' : (cell as { value: string }).value;
      if (!val) return nothing;
      const layers = val.split(', ');
      return html`${layers.map(l => html`<span style="display:inline-block;padding:1px 6px;border-radius:8px;font-size:10px;margin-right:4px;background:var(--pages-neutral-3,#f5f5f5);color:var(--pages-neutral-11,#404040)">${l}</span>`)}`;
    }],
    [STATUS_COL, (cell: CellValue) => {
      const val = cell.type === 'NULL' ? '' : (cell as { value: string }).value;
      const style = STATUS_STYLES[val] ?? '';
      return html`<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:500;${style}">${val.replace('_', ' ')}</span>`;
    }],
    [QUEUED_COL, (cell: CellValue) => {
      if (cell.type === 'NULL' || !(cell as { value: string }).value) return '';
      const d = new Date((cell as { value: string }).value);
      return html`<span style="font-size:12px;color:var(--pages-neutral-9,#737373)">${d.toLocaleString()}</span>`;
    }],
    [TIMEOUT_COL, (cell: CellValue) => {
      const val = cell.type === 'NULL' ? '' : (cell as { value: string }).value;
      if (!val) return html`<span style="color:var(--pages-neutral-7,#a3a3a3)">—</span>`;
      return html`<span style="font-size:12px">${val}m</span>`;
    }],
    [ACTIONS_COL, (_cell: CellValue, row: TypedRow) => {
      if (this.readonly) return nothing;
      const status = row.text(STATUS_COL);
      if (status !== 'PENDING') return nothing;
      const id = row.text(ID_COL);
      return html`
        <div style="display:flex;gap:4px">
          <button style="padding:4px 10px;border:none;border-radius:4px;font-size:12px;font-weight:500;cursor:pointer;background:var(--pages-success-3,#dcfce7);color:var(--pages-success-11,#166534)" aria-label="Approve ${id}" @click=${(e: Event) => { e.stopPropagation(); this._handleApprove(id); }}>Approve</button>
          <button style="padding:4px 10px;border:none;border-radius:4px;font-size:12px;font-weight:500;cursor:pointer;background:var(--pages-danger-3,#fee2e2);color:var(--pages-danger-11,#991b1b)" aria-label="Reject ${id}" @click=${(e: Event) => { e.stopPropagation(); this._openRejectDialog(id); }}>Reject</button>
        </div>
      `;
    }],
  ]);

  static override styles = css`
    :host { display: block; font-family: var(--pages-font-family, system-ui); }
    .empty { padding: 24px; text-align: center; color: var(--pages-neutral-9, #737373); }
    .loading { padding: 24px; text-align: center; color: var(--pages-neutral-9, #737373); }
    .error { padding: 16px; background: var(--pages-danger-3, #fee); color: var(--pages-danger-11, #c00); border-radius: 4px; }
    .reject-form { display: flex; flex-direction: column; gap: 12px; }
    .reject-form label { font-size: 13px; font-weight: 500; }
    .reject-form input, .reject-form textarea {
      width: 100%; padding: 8px; border: 1px solid var(--pages-neutral-6, #e0e0e0);
      border-radius: 4px; font-size: 13px; box-sizing: border-box;
    }
    .reject-form textarea { min-height: 60px; resize: vertical; }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', 'Conductor inbox');
    if (this.endpoint && !this._api) {
      this._api = new EvolutionApi(this.endpoint);
    }
    if (this._api && this.caseId && this.tenancyId && !this.inbox) {
      this._fetch();
    }
  }

  configure(props: Partial<EvolutionInboxProps>): void {
    if (props.endpoint !== undefined) this.endpoint = props.endpoint;
    if (props.caseId !== undefined) this.caseId = props.caseId;
    if (props.tenancyId !== undefined) this.tenancyId = props.tenancyId;
    if (props.inbox !== undefined) this.inbox = props.inbox;
    if (props.readonly !== undefined) this.readonly = props.readonly;
  }

  private async _fetch(): Promise<void> {
    if (!this._api || !this.caseId || !this.tenancyId) return;
    this._loading = true;
    this._error = null;
    try {
      this._fetched = await this._api.getInbox(this.caseId, this.tenancyId);
    } catch (e) {
      this._error = e instanceof Error ? e.message : 'Failed to load inbox';
    } finally {
      this._loading = false;
    }
  }

  private async _handleApprove(entryId: string): Promise<void> {
    if (!this._api || !this.caseId || !this.tenancyId) return;
    try {
      await this._api.resolveGate(this.caseId, this.tenancyId, entryId, 'APPROVED');
      emitEvolutionEvent(this, EvolutionEventTopics.GATE_RESOLVED, { entryId, outcome: 'APPROVED' as const });
      await this._fetch();
    } catch (e) {
      this._error = e instanceof Error ? e.message : 'Failed to approve';
    }
  }

  private _openRejectDialog(entryId: string): void {
    this._pendingRejectId = entryId;
    this._rejectReason = '';
    this._rejectFeedback = '';
    this._showRejectDialog = true;
  }

  private async _confirmReject(): Promise<void> {
    const entryId = this._pendingRejectId;
    if (!entryId || !this._rejectReason.trim()) return;
    this._showRejectDialog = false;
    if (!this._api || !this.caseId || !this.tenancyId) return;
    try {
      await this._api.resolveGate(this.caseId, this.tenancyId, entryId,
        'REJECTED', this._rejectReason.trim(), this._rejectFeedback.trim() || undefined);
      emitEvolutionEvent(this, EvolutionEventTopics.GATE_RESOLVED, { entryId, outcome: 'REJECTED' as const });
      this._pendingRejectId = null;
      await this._fetch();
    } catch (e) {
      this._error = e instanceof Error ? e.message : 'Failed to reject';
    }
  }

  override render() {
    this.setAttribute('aria-busy', String(this._loading));
    if (this._loading) return html`<div class="loading">Loading inbox...</div>`;
    if (this._error) return html`<div class="error">${this._error}</div>`;
    const data = this._data;
    if (data.length === 0) return html`<div class="empty">No inbox entries.</div>`;

    return html`
      <pages-table
        .dataSet=${fromRows([...data], COL_DEFS)}
        .columnConfig=${COL_CONFIG}
        .columnRenderers=${this._columnRenderers}
        .getRowKey=${(row: TypedRow) => row.text(ID_COL)}
        mode="scroll"
        selection="none"
      ></pages-table>

      <pages-confirm-dialog
        .open=${this._showRejectDialog}
        heading="Reject gate entry?"
        confirmLabel="Reject"
        cancelLabel="Cancel"
        confirmVariant="danger"
        @confirm=${() => this._confirmReject()}
        @cancel=${() => { this._showRejectDialog = false; this._pendingRejectId = null; }}
      >
        <div class="reject-form">
          <label>Reason (required)</label>
          <input type="text" .value=${this._rejectReason}
                 @input=${(e: Event) => { this._rejectReason = (e.target as HTMLInputElement).value; }} />
          <label>Feedback (optional)</label>
          <textarea .value=${this._rejectFeedback}
                    @input=${(e: Event) => { this._rejectFeedback = (e.target as HTMLTextAreaElement).value; }}></textarea>
        </div>
      </pages-confirm-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blocks-evolution-inbox': EvolutionInbox;
  }
}
