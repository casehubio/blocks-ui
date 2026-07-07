import { LitElement, html, css, type TemplateResult, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { DataEndpointMixin } from '@casehubio/blocks-ui-core/data-endpoint/data-endpoint.js';
import { LiveRegionMixin } from '@casehubio/blocks-ui-core/mixins/live-region.js';
import type { ColumnDef } from '@casehubio/blocks-ui-data-table';
import type { LedgerEntry, VerificationResult, Attestation, EntryTypeFilter } from './types.js';
import '@casehubio/blocks-ui-data-table';

@customElement('audit-trail-viewer')
export class AuditTrailViewer extends LiveRegionMixin(DataEndpointMixin(LitElement)) {
  @property({ type: String, attribute: 'subject-id' }) subjectId?: string;
  @property({ type: String, attribute: 'actor-id' }) actorId?: string;
  @property({ type: Object }) renderEntryPayload?: (entry: LedgerEntry) => TemplateResult | undefined;

  @state() private _entries: LedgerEntry[] = [];
  @state() private _verification: VerificationResult | null = null;
  @state() private _expandedEntryId: string | null = null;
  @state() private _attestations: Map<string, Attestation[]> = new Map();
  @state() private _selectedActorId: string | null = null;
  @state() private _selectedTypes: Set<EntryTypeFilter> = new Set();
  @state() private _dateFrom: string = '';
  @state() private _dateTo: string = '';

  private _columns: ColumnDef<LedgerEntry>[] = [
    {
      id: 'occurredAt',
      label: 'Timestamp',
      sortable: true,
      render: (value) => {
        const date = new Date(value as string);
        return html`<span>${date.toLocaleTimeString()}</span>`;
      },
    },
    {
      id: 'actorId',
      label: 'Actor',
      sortable: true,
      render: (value, row) => {
        if (!value) return html`<span class="redacted">Redacted</span>`;
        return html`
          <div class="actor-cell">
            <span>${value as string}</span>
            ${row.actorType ? html`<span class="badge actor-type">${row.actorType}</span>` : ''}
          </div>
        `;
      },
    },
    {
      id: 'entryType',
      label: 'Type',
      sortable: true,
      render: (value) => html`<span class="entry-type">${value as string}</span>`,
    },
    {
      id: 'digest',
      label: 'Digest',
      sortable: false,
      render: (value) => {
        const digest = value as string;
        return html`<code class="digest">${digest.substring(0, 8)}...</code>`;
      },
    },
  ];

  override async fetchData(): Promise<void> {
    if (!this.endpoint || !this.subjectId || !this.identity) return;

    this.announce('Loading audit trail');

    const entriesUrl = new URL(`${this.endpoint}/api/v1/ledger/entries`);
    entriesUrl.searchParams.set('subjectId', this.subjectId);
    entriesUrl.searchParams.set('tenancyId', this.identity.tenancyId);

    if (this._dateFrom) entriesUrl.searchParams.set('from', this._dateFrom);
    if (this._dateTo) entriesUrl.searchParams.set('to', this._dateTo);

    const verifyUrl = new URL(`${this.endpoint}/api/v1/ledger/verify`);
    verifyUrl.searchParams.set('subjectId', this.subjectId);

    const [entriesResponse, verifyResponse] = await Promise.all([
      this.fetchFn(entriesUrl.toString(), { signal: this.abortSignal }),
      this.fetchFn(verifyUrl.toString(), { signal: this.abortSignal }),
    ]);

    if (!entriesResponse.ok) throw new Error('Failed to fetch entries');
    if (!verifyResponse.ok) throw new Error('Failed to fetch verification');

    this._entries = await entriesResponse.json();
    this._verification = await verifyResponse.json();

    this.announce(`${this._entries.length} entries loaded`);
  }

  override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (
      (changed.has('subjectId') || changed.has('_dateFrom') || changed.has('_dateTo')) &&
      this.subjectId &&
      this.endpoint
    ) {
      this.fetchData();
    }
  }

  override configure(props: Record<string, unknown>): void {
    super.configure(props);
    if (props.subjectId !== undefined) this.subjectId = props.subjectId as string;
    if (props.actorId !== undefined) this.actorId = props.actorId as string;
  }

  private async _handleRowActivate(e: CustomEvent): Promise<void> {
    const entry = e.detail.row as LedgerEntry;
    if (this._expandedEntryId === entry.id) {
      this._expandedEntryId = null;
      return;
    }

    this._expandedEntryId = entry.id;

    if (!this._attestations.has(entry.id)) {
      await this._fetchAttestations(entry.id);
    }
  }

  private async _fetchAttestations(entryId: string): Promise<void> {
    if (!this.endpoint) return;

    const url = `${this.endpoint}/api/v1/ledger/entries/${entryId}/attestations`;
    const response = await this.fetchFn(url, { signal: this.abortSignal });
    if (!response.ok) return;

    const attestations = await response.json();
    this._attestations = new Map(this._attestations).set(entryId, attestations);
  }

  private _handleActorFilterChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    this._selectedActorId = select.value || null;
  }

  private _handleTypeChipClick(type: EntryTypeFilter): void {
    const newSet = new Set(this._selectedTypes);
    if (newSet.has(type)) {
      newSet.delete(type);
    } else {
      newSet.add(type);
    }
    this._selectedTypes = newSet;
  }

  private _handleDateFromChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    this._dateFrom = input.value;
  }

  private _handleDateToChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    this._dateTo = input.value;
  }

  private get _filteredEntries(): LedgerEntry[] {
    return this._entries.filter((entry) => {
      if (this._selectedActorId && entry.actorId !== this._selectedActorId) return false;
      if (this._selectedTypes.size > 0 && !this._selectedTypes.has(entry.entryType as EntryTypeFilter)) return false;
      return true;
    });
  }

  private get _uniqueActors(): Array<{ id: string; type: string | null }> {
    const actorsMap = new Map<string, string | null>();
    this._entries.forEach((entry) => {
      if (entry.actorId && !actorsMap.has(entry.actorId)) {
        actorsMap.set(entry.actorId, entry.actorType);
      }
    });
    return Array.from(actorsMap.entries()).map(([id, type]) => ({ id, type }));
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

  private _renderFilterControls(): TemplateResult {
    return html`
      <div class="filter-controls">
        <div class="filter-section">
          <label for="actor-filter">Actor:</label>
          <select id="actor-filter" @change=${this._handleActorFilterChange}>
            <option value="">All actors</option>
            ${this._uniqueActors.map(
              (actor) => html`
                <option value=${actor.id} ?selected=${this._selectedActorId === actor.id}>
                  ${actor.id} ${actor.type ? `(${actor.type})` : ''}
                </option>
              `
            )}
          </select>
        </div>

        <div class="filter-section" role="group" aria-label="Entry type filter">
          <span class="filter-label">Type:</span>
          ${(['COMMAND', 'EVENT', 'ATTESTATION'] as EntryTypeFilter[]).map(
            (type) => html`
              <button
                class="chip"
                role="checkbox"
                aria-checked=${this._selectedTypes.has(type) ? 'true' : 'false'}
                @click=${() => this._handleTypeChipClick(type)}
              >
                ${type}
              </button>
            `
          )}
        </div>

        <div class="filter-section">
          <label for="date-from">From:</label>
          <input
            id="date-from"
            type="date"
            .value=${this._dateFrom}
            @change=${this._handleDateFromChange}
          />
          <label for="date-to">To:</label>
          <input id="date-to" type="date" .value=${this._dateTo} @change=${this._handleDateToChange} />
        </div>
      </div>
    `;
  }

  private _renderExpandedDetail(entry: LedgerEntry): TemplateResult {
    if (this._expandedEntryId !== entry.id) return html``;

    const attestations = this._attestations.get(entry.id) || [];

    return html`
      <div class="entry-detail" role="region" aria-labelledby="entry-${entry.id}">
        <div class="detail-section">
          <h4>Full Digest</h4>
          <code class="full-digest">${entry.digest}</code>
        </div>

        ${entry.traceId
          ? html`
              <div class="detail-section">
                <h4>Trace ID</h4>
                <code>${entry.traceId}</code>
              </div>
            `
          : ''}
        ${entry.causedByEntryId
          ? html`
              <div class="detail-section">
                <h4>Caused By</h4>
                <code>${entry.causedByEntryId}</code>
              </div>
            `
          : ''}

        <div class="detail-section">
          <h4>Payload</h4>
          ${entry.payload === null
            ? html`<span class="redacted">Content redacted</span>`
            : this._renderPayload(entry)}
        </div>

        ${attestations.length > 0
          ? html`
              <div class="detail-section">
                <h4>Attestations</h4>
                <div class="attestations">
                  ${attestations.map(
                    (att) => html`
                      <div class="attestation">
                        <span class="verdict ${att.verdict.toLowerCase()}">${att.verdict}</span>
                        <span class="attestor">${att.attestorId}</span>
                        ${att.capabilityTag ? html`<span class="capability">${att.capabilityTag}</span>` : ''}
                        <span class="confidence">Confidence: ${att.confidence.toFixed(2)}</span>
                      </div>
                    `
                  )}
                </div>
              </div>
            `
          : ''}
      </div>
    `;
  }

  private _renderPayload(entry: LedgerEntry): TemplateResult {
    if (this.renderEntryPayload) {
      const customResult = this.renderEntryPayload(entry);
      if (customResult !== undefined) return customResult;
    }
    return html`<pre>${JSON.stringify(entry.payload, null, 2)}</pre>`;
  }

  override render(): TemplateResult {
    if (this.loading) {
      return html`<div class="loading">Loading audit trail...</div>`;
    }

    if (this.error) {
      return html`
        <div class="error" role="alert">
          <p>Failed to load audit trail: ${this.error}</p>
          <button @click=${() => this.fetchData()}>Retry</button>
        </div>
      `;
    }

    return html`
      ${this._renderVerificationBanner()} ${this._renderFilterControls()}
      <pages-data-table
        .columns=${this._columns}
        .data=${this._filteredEntries}
        client-filter
        @row-activate=${this._handleRowActivate}
      >
        ${this._filteredEntries.map((entry) => this._renderExpandedDetail(entry))}
      </pages-data-table>
    `;
  }

  static override styles = css`
    :host {
      display: block;
      font-family: var(--pages-font-family, system-ui);
    }

    .verification-banner {
      padding: 12px 16px;
      margin-bottom: 16px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }

    .verification-banner.verified {
      background: var(--pages-success-2, #e6f7ed);
      color: var(--pages-success-11, #0d5a2e);
    }

    .verification-banner.verified-redacted {
      background: var(--pages-warning-2, #fef5e6);
      color: var(--pages-warning-11, #7d4e00);
    }

    .verification-banner.failed {
      background: var(--pages-error-2, #fdeeed);
      color: var(--pages-error-11, #b91c1c);
    }

    .status-icon {
      font-size: 16px;
      font-weight: bold;
    }

    .tree-root {
      font-family: var(--pages-font-mono, monospace);
      font-size: 12px;
      margin-left: auto;
      opacity: 0.7;
    }

    .filter-controls {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
      padding: 12px;
      background: var(--pages-gray-2, #f8f9fa);
      border-radius: 4px;
      flex-wrap: wrap;
    }

    .filter-section {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .filter-label {
      font-weight: 500;
      font-size: 14px;
    }

    select,
    input[type='date'] {
      padding: 4px 8px;
      border: 1px solid var(--pages-gray-6, #d1d5db);
      border-radius: 4px;
      font-size: 14px;
    }

    .chip {
      padding: 4px 12px;
      border: 1px solid var(--pages-gray-6, #d1d5db);
      border-radius: 16px;
      background: white;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
    }

    .chip[aria-checked='true'] {
      background: var(--pages-accent-9, #3b82f6);
      color: white;
      border-color: var(--pages-accent-9, #3b82f6);
    }

    .chip:hover {
      background: var(--pages-gray-3, #e5e7eb);
    }

    .chip[aria-checked='true']:hover {
      background: var(--pages-accent-10, #2563eb);
    }

    .actor-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .badge {
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
    }

    .actor-type {
      background: var(--pages-accent-3, #dbeafe);
      color: var(--pages-accent-11, #1e40af);
    }

    .entry-type {
      font-weight: 500;
      text-transform: uppercase;
      font-size: 13px;
    }

    .digest {
      font-family: var(--pages-font-mono, monospace);
      font-size: 12px;
      background: var(--pages-gray-2, #f8f9fa);
      padding: 2px 6px;
      border-radius: 3px;
    }

    .entry-detail {
      padding: 16px;
      background: var(--pages-gray-1, #fafbfc);
      border-left: 3px solid var(--pages-accent-9, #3b82f6);
      margin: 8px 0;
    }

    .detail-section {
      margin-bottom: 16px;
    }

    .detail-section:last-child {
      margin-bottom: 0;
    }

    .detail-section h4 {
      margin: 0 0 8px 0;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--pages-gray-11, #1f2937);
    }

    .full-digest {
      font-family: var(--pages-font-mono, monospace);
      font-size: 12px;
      background: white;
      padding: 8px;
      border-radius: 4px;
      display: block;
      word-break: break-all;
    }

    .attestations {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .attestation {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 8px;
      background: white;
      border-radius: 4px;
      font-size: 13px;
    }

    .verdict {
      padding: 2px 8px;
      border-radius: 3px;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
    }

    .verdict.sound {
      background: var(--pages-success-3, #c6f0d9);
      color: var(--pages-success-11, #0d5a2e);
    }

    .verdict.flagged {
      background: var(--pages-error-3, #fbcfcc);
      color: var(--pages-error-11, #b91c1c);
    }

    .verdict.endorsed {
      background: var(--pages-accent-3, #dbeafe);
      color: var(--pages-accent-11, #1e40af);
    }

    .verdict.challenged {
      background: var(--pages-warning-3, #fde5c5);
      color: var(--pages-warning-11, #7d4e00);
    }

    .capability {
      font-family: var(--pages-font-mono, monospace);
      font-size: 11px;
      color: var(--pages-gray-11, #1f2937);
    }

    .confidence {
      font-size: 12px;
      color: var(--pages-gray-10, #6b7280);
      margin-left: auto;
    }

    .redacted {
      font-style: italic;
      color: var(--pages-gray-9, #9ca3af);
    }

    .loading,
    .error {
      padding: 24px;
      text-align: center;
      color: var(--pages-gray-11, #1f2937);
    }

    .error button {
      margin-top: 12px;
      padding: 8px 16px;
      background: var(--pages-accent-9, #3b82f6);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    .error button:hover {
      background: var(--pages-accent-10, #2563eb);
    }

    pre {
      font-family: var(--pages-font-mono, monospace);
      font-size: 12px;
      background: white;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 0;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'audit-trail-viewer': AuditTrailViewer;
  }
}
