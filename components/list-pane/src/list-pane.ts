import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { DataEndpointMixin, emitPagesEvent, onPagesEvent } from '@casehubio/blocks-ui-core';
import type { ColumnDef } from '@casehubio/blocks-ui-data-table';
import '@casehubio/blocks-ui-data-table';

@customElement('list-pane')
export class ListPane extends DataEndpointMixin(LitElement) {
  @property({ type: Array }) columns: ColumnDef<any>[] = [];
  @property({ attribute: false }) getRowKey?: (row: unknown) => string;
  @property({ attribute: false }) getRowClass?: (row: unknown) => string;
  @property({ type: String, attribute: 'selection-topic' }) selectionTopic = '';
  @property({ type: String, attribute: 'empty-message' }) emptyMessage = 'No items found';
  @property({ type: Number, attribute: 'page-size' }) pageSize = 25;

  @state() private _rows: readonly unknown[] = [];
  @state() private _totalRows: number | null = null;

  private _refreshUnsub?: () => void;
  private _lastActivatedIndex = -1;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--pages-neutral-7, #525252);
      font-size: var(--pages-font-size-sm, 12px);
    }

    pages-data-table {
      flex: 1;
    }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('tabindex', '-1');
    if (this.selectionTopic) {
      this._refreshUnsub = onPagesEvent(document, `${this.selectionTopic}:refresh`, () => {
        this.refresh();
      });
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._refreshUnsub?.();
  }

  override async fetchData(): Promise<void> {
    const init: RequestInit = {};
    if (this.abortSignal) init.signal = this.abortSignal;
    const resp = await this.fetchFn(this.endpoint!, init);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    if (Array.isArray(data)) {
      this._rows = data;
      this._totalRows = null;
    } else if (data && Array.isArray(data.items)) {
      this._rows = data.items;
      this._totalRows = data.total;
    } else {
      this._rows = [];
      this._totalRows = null;
    }
  }

  refresh(): void {
    this.configure({ endpoint: this.endpoint });
  }

  override focus(): void {
    const table = this.shadowRoot?.querySelector('pages-data-table') as HTMLElement | undefined;
    table?.focus();
  }

  private _handleRowActivate = (e: Event): void => {
    const detail = (e as CustomEvent).detail;
    this._lastActivatedIndex = detail.index ?? -1;
    if (this.selectionTopic && detail.row) {
      emitPagesEvent(document, `${this.selectionTopic}:selected`, detail.row);
    }
  };

  override render() {
    if (!this.loading && this._rows.length === 0 && !this.error) {
      return html`<div class="empty" role="status">${this.emptyMessage}</div>`;
    }

    return html`
      <pages-data-table
        .rows=${this._rows}
        .columns=${this.columns}
        .getRowKey=${this.getRowKey}
        .getRowClass=${this.getRowClass}
        .totalRows=${this._totalRows}
        .pageSize=${this.pageSize}
        .loading=${this.loading}
        .emptyMessage=${this.emptyMessage}
        selection="single"
        mode="paginated"
        client-sort
        client-filter
        @row-activate=${this._handleRowActivate}
      ></pages-data-table>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'list-pane': ListPane;
  }
}
