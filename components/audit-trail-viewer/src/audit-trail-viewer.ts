import { LitElement, html, css, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { DataSourceAdapter } from '@casehubio/pages-component';
import { renderPropertyTree, propertyTreeStyles } from '@casehubio/pages-ui-components';
import { LiveRegionMixin } from '@casehubio/pages-primitives/a11y';
import type { WorkIdentity } from '@casehubio/blocks-ui-core';
import type { LedgerEntry, VerificationResult, Attestation } from './types.js';
import '@casehubio/pages-ui-components/event-trail';
import { columnId, ColumnType } from '@casehubio/pages-data/dist/dataset/types.js';
import type { CellValue, ColumnId, TypedRow } from '@casehubio/pages-data/dist/dataset/types.js';
import type { DataSource, DataSink } from '@casehubio/pages-data/dist/datasource/types.js';

const ID_COL = columnId('id');
const OCCURRED_AT_COL = columnId('occurredAt');
const ACTOR_ID_COL = columnId('actorId');
const ACTOR_TYPE_COL = columnId('actorType');
const ENTRY_TYPE_COL = columnId('entryType');
const DIGEST_COL = columnId('digest');

const ENTRY_COL_DEFS = [
  { id: ID_COL, type: ColumnType.TEXT, getValue: (e: LedgerEntry) => e.id },
  { id: OCCURRED_AT_COL, name: 'Timestamp', type: ColumnType.TEXT, getValue: (e: LedgerEntry) => e.occurredAt },
  { id: ACTOR_ID_COL, name: 'Actor', type: ColumnType.TEXT, getValue: (e: LedgerEntry) => e.actorId ?? '' },
  { id: ACTOR_TYPE_COL, type: ColumnType.TEXT, getValue: (e: LedgerEntry) => e.actorType ?? '' },
  { id: ENTRY_TYPE_COL, name: 'Type', type: ColumnType.TEXT, getValue: (e: LedgerEntry) => e.entryType },
  { id: DIGEST_COL, name: 'Digest', type: ColumnType.TEXT, getValue: (e: LedgerEntry) => e.digest },
] as const;

const ENTRY_COL_CONFIG = [
  { id: ID_COL, visible: false },
  { id: OCCURRED_AT_COL, sortable: true },
  { id: ACTOR_ID_COL, sortable: true },
  { id: ACTOR_TYPE_COL, visible: false },
  { id: ENTRY_TYPE_COL, sortable: true },
  { id: DIGEST_COL, sortable: false },
];

const ENTRY_RENDERERS = new Map<ColumnId, (cell: CellValue, row: TypedRow) => unknown>([
  [OCCURRED_AT_COL, (cell: CellValue) => {
    if (cell.type === 'NULL') return '';
    const date = new Date((cell as { value: string }).value);
    return html`<span>${date.toLocaleTimeString()}</span>`;
  }],
  [ACTOR_ID_COL, (cell: CellValue, row: TypedRow) => {
    if (cell.type === 'NULL' || !(cell as { value: string }).value) return html`<span class="redacted">Redacted</span>`;
    const actorId = (cell as { value: string }).value;
    const actorTypeCell = row.cell(ACTOR_TYPE_COL);
    const actorType = actorTypeCell.type !== 'NULL' && (actorTypeCell as { value: string }).value
      ? (actorTypeCell as { value: string }).value : null;
    return html`
      <div class="actor-cell">
        <span>${actorId}</span>
        ${actorType ? html`<span class="badge actor-type">${actorType}</span>` : ''}
      </div>
    `;
  }],
  [ENTRY_TYPE_COL, (cell: CellValue) => {
    if (cell.type === 'NULL') return '';
    return html`<span class="entry-type">${(cell as { value: string }).value}</span>`;
  }],
  [DIGEST_COL, (cell: CellValue) => {
    if (cell.type === 'NULL') return '';
    const digest = (cell as { value: string }).value;
    return html`<code class="digest">${digest.substring(0, 8)}...</code>`;
  }],
]);

@customElement('blocks-audit-trail-viewer')
export class AuditTrailViewer extends LiveRegionMixin(LitElement) {
  @property({ type: String }) endpoint?: string;
  @property({ type: Object }) identity?: WorkIdentity;
  @property({ type: String, attribute: 'subject-id' }) subjectId?: string;
  @property({ type: String, attribute: 'actor-id' }) actorId?: string;
  @property({ type: Object }) renderEntryPayload?: (entry: LedgerEntry) => TemplateResult | undefined;

  readonly verify = new DataSourceAdapter(this, {
    sourceFactory: (url) => this._createVerifySource(url),
  });

  @state() private _entries: LedgerEntry[] = [];
  @state() private _verification: VerificationResult | null = null;
  @state() private _attestations: Map<string, Attestation[]> = new Map();

  private _createVerifySource(url: string): DataSource {
    let abort: AbortController | undefined;
    return {
      connect: (sink: DataSink) => {
        abort = new AbortController();
        const signal = abort.signal;
        globalThis.fetch(url, { signal })
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then((data: VerificationResult) => {
            if (signal.aborted) return;
            this._verification = data;
            sink.apply({ type: 'snapshot', dataset: { columns: [], rows: [] } });
          })
          .catch(err => {
            if (signal.aborted || err.name === 'AbortError') return;
            sink.error({ message: err instanceof Error ? err.message : String(err), permanent: true });
          });
      },
      disconnect: () => { abort?.abort(); abort = undefined; },
    };
  }

  override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('endpoint') || changed.has('subjectId') || changed.has('identity')) {
      this._updateVerifyEndpoint();
    }
  }

  private _buildLedgerEndpoint(): string | undefined {
    if (!this.endpoint || !this.subjectId || !this.identity) return undefined;
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(`${this.endpoint}/api/v1/ledger/entries`, base);
    url.searchParams.set('subjectId', this.subjectId);
    if (this.identity.tenancyId) url.searchParams.set('tenancyId', this.identity.tenancyId);
    return url.toString();
  }

  private _updateVerifyEndpoint(): void {
    if (!this.endpoint || !this.subjectId || !this.identity) {
      this.verify.endpoint = undefined;
      return;
    }
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const verifyUrl = new URL(`${this.endpoint}/api/v1/ledger/verify`, base);
    verifyUrl.searchParams.set('subjectId', this.subjectId);
    this.verify.endpoint = verifyUrl.toString();
  }

  configure(props: Record<string, unknown>): void {
    if (props.endpoint !== undefined) this.endpoint = props.endpoint as string;
    if (props.subjectId !== undefined) this.subjectId = props.subjectId as string;
    if (props.actorId !== undefined) this.actorId = props.actorId as string;
    if (props.identity !== undefined) this.identity = props.identity as WorkIdentity;
    queueMicrotask(() => {
      this._updateVerifyEndpoint();
      this.verify.refresh();
    });
  }

  private _handleDataLoaded(e: CustomEvent<{ entries: unknown[] }>): void {
    this._entries = e.detail.entries as LedgerEntry[];
  }

  private async _handleDetailChange(e: CustomEvent): Promise<void> {
    const { key, expanded } = e.detail as { key: string; expanded: boolean };
    if (!key) return;
    if (expanded && !this._attestations.has(key)) {
      await this._fetchAttestations(key);
    }
  }

  private _getRowDetail = (row: TypedRow): TemplateResult | undefined => {
    const entryId = row.text(ID_COL);
    const entry = this._entries.find(e => e.id === entryId);
    if (!entry) return undefined;
    return this._renderExpandedDetailContent(entry);
  };

  private async _fetchAttestations(entryId: string): Promise<void> {
    if (!this.endpoint) return;
    const url = `${this.endpoint}/api/v1/ledger/entries/${entryId}/attestations`;
    const response = await globalThis.fetch(url);
    if (!response.ok) return;
    const attestations = await response.json();
    this._attestations = new Map(this._attestations).set(entryId, attestations);
  }

  private _renderVerificationBanner(): TemplateResult {
    if (!this._verification) return html``;
    const { verified, redactedCount = 0 } = this._verification;
    let statusClass = '';
    let message = '';
    if (!verified) {
      statusClass = 'failed';
      message = 'Chain verification failed';
    } else if (redactedCount > 0) {
      statusClass = 'verified-redacted';
      message = `Chain verified — ${redactedCount} entries redacted`;
    } else {
      statusClass = 'verified';
      message = 'Chain verified';
    }
    return html`
      <div class="verification-banner ${statusClass}" role="status" aria-live="polite">
        <span class="status-icon">${verified ? '✓' : '⚠'}</span>
        <span>${message}</span>
        <code class="tree-root">${this._verification.treeRoot}</code>
      </div>
    `;
  }

  private _renderExpandedDetailContent(entry: LedgerEntry): TemplateResult {
    const attestations = this._attestations.get(entry.id) || [];
    return html`
      <div class="entry-detail" role="region" aria-labelledby="entry-${entry.id}">
        <div class="detail-section">
          <h4>Full Digest</h4>
          <code class="full-digest">${entry.digest}</code>
        </div>
        ${entry.traceId ? html`<div class="detail-section"><h4>Trace ID</h4><code>${entry.traceId}</code></div>` : ''}
        ${entry.causedByEntryId ? html`<div class="detail-section"><h4>Caused By</h4><code>${entry.causedByEntryId}</code></div>` : ''}
        <div class="detail-section">
          <h4>Payload</h4>
          ${entry.payload === null ? html`<span class="redacted">Content redacted</span>` : this._renderPayload(entry)}
        </div>
        ${attestations.length > 0 ? html`
          <div class="detail-section">
            <h4>Attestations</h4>
            <div class="attestations">
              ${attestations.map(att => html`
                <div class="attestation">
                  <span class="verdict ${(att.verdict ?? '').toLowerCase()}">${att.verdict ?? ''}</span>
                  <span class="attestor">${att.attestorId}</span>
                  ${att.capabilityTag ? html`<span class="capability">${att.capabilityTag}</span>` : ''}
                  ${att.confidence != null ? html`<span class="confidence">Confidence: ${att.confidence.toFixed(2)}</span>` : nothing}
                </div>
              `)}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  private _renderPayload(entry: LedgerEntry): TemplateResult {
    if (this.renderEntryPayload) {
      const customResult = this.renderEntryPayload(entry);
      if (customResult !== undefined) return customResult;
    }
    return renderPropertyTree(entry.payload);
  }

  override render(): TemplateResult {
    const verifyBanner = this.verify.error
      ? html`<div class="verification-banner failed" role="status" aria-live="polite">
          <span class="status-icon">⚠</span><span>Verification unavailable: ${this.verify.error}</span>
        </div>`
      : this.verify.loading
        ? html`<div class="verification-banner" role="status" aria-live="polite">Verifying chain integrity...</div>`
        : this._renderVerificationBanner();

    return html`
      ${verifyBanner}
      <pages-event-trail
        .endpoint=${this._buildLedgerEndpoint()}
        .columnDefs=${ENTRY_COL_DEFS}
        .columnConfig=${ENTRY_COL_CONFIG}
        .columnRenderers=${ENTRY_RENDERERS}
        .chipField=${ENTRY_TYPE_COL}
        .chipValues=${['COMMAND', 'EVENT', 'ATTESTATION']}
        .entityField=${ACTOR_ID_COL}
        entityLabel="Actor"
        showDateRange
        .getRowDetail=${this._getRowDetail}
        .getRowKey=${(row: TypedRow) => row.text(ID_COL)}
        @detail-change=${this._handleDetailChange}
        @data-loaded=${this._handleDataLoaded}
      ></pages-event-trail>
    `;
  }

  static override styles = css`
    :host { display: block; font-family: var(--pages-font-family, system-ui); }
    .verification-banner {
      padding: 12px 16px; margin-bottom: 16px; border-radius: 4px;
      display: flex; align-items: center; gap: 8px; font-size: 14px;
    }
    .verification-banner.verified { background: var(--pages-success-2, #e6f7ed); color: var(--pages-success-11, #0d5a2e); }
    .verification-banner.verified-redacted { background: var(--pages-warning-2, #fef5e6); color: var(--pages-warning-11, #7d4e00); }
    .verification-banner.failed { background: var(--pages-error-2, #fdeeed); color: var(--pages-error-11, #b91c1c); }
    .status-icon { font-size: 16px; font-weight: bold; }
    .tree-root { font-family: var(--pages-font-mono, monospace); font-size: 12px; margin-left: auto; opacity: 0.7; }
    .actor-cell { display: flex; align-items: center; gap: 8px; }
    .badge { padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 500; text-transform: uppercase; }
    .actor-type { background: var(--pages-accent-3, #dbeafe); color: var(--pages-accent-11, #1e40af); }
    .entry-type { font-weight: 500; text-transform: uppercase; font-size: 13px; }
    .digest { font-family: var(--pages-font-mono, monospace); font-size: 12px; background: var(--pages-neutral-2, #f8f9fa); padding: 2px 6px; border-radius: 3px; }
    .entry-detail { padding: 16px; background: var(--pages-neutral-1, #fafbfc); border-left: 3px solid var(--pages-accent-9, #3b82f6); margin: 8px 0; }
    .detail-section { margin-bottom: 16px; }
    .detail-section:last-child { margin-bottom: 0; }
    .detail-section h4 { margin: 0 0 8px 0; font-size: 13px; font-weight: 600; text-transform: uppercase; color: var(--pages-neutral-11, #1f2937); }
    .full-digest { font-family: var(--pages-font-mono, monospace); font-size: 12px; background: var(--pages-neutral-2, #fff); padding: 8px; border-radius: 4px; display: block; word-break: break-all; }
    .attestations { display: flex; flex-direction: column; gap: 8px; }
    .attestation { display: flex; gap: 12px; align-items: center; padding: 8px; background: var(--pages-neutral-2, #fff); border-radius: 4px; font-size: 13px; }
    .verdict { padding: 2px 8px; border-radius: 3px; font-weight: 600; text-transform: uppercase; font-size: 11px; }
    .verdict.sound { background: var(--pages-success-3, #c6f0d9); color: var(--pages-success-11, #0d5a2e); }
    .verdict.flagged { background: var(--pages-error-3, #fbcfcc); color: var(--pages-error-11, #b91c1c); }
    .verdict.endorsed { background: var(--pages-accent-3, #dbeafe); color: var(--pages-accent-11, #1e40af); }
    .verdict.challenged { background: var(--pages-warning-3, #fde5c5); color: var(--pages-warning-11, #7d4e00); }
    .capability { font-family: var(--pages-font-mono, monospace); font-size: 11px; color: var(--pages-neutral-11, #1f2937); }
    .confidence { font-size: 12px; color: var(--pages-neutral-10, #6b7280); margin-left: auto; }
    .redacted { font-style: italic; color: var(--pages-neutral-9, #9ca3af); }
    ${propertyTreeStyles}
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'blocks-audit-trail-viewer': AuditTrailViewer;
  }
}
