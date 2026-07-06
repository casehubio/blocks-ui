import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiveRegionMixin } from '@casehubio/blocks-ui-core';
import type { ColumnDef, DisplayMode, PageChangeDetail, LoadMoreDetail, SelectionMode, SelectionChangeDetail, RowActivateDetail, SortDirection, SortChangeDetail, ColumnChangeDetail } from './types.js';
import { computeScrollWindow } from './virtual-scroll-engine.js';
import { createComparator } from './sort.js';

const AUTO_THRESHOLD = 50;

@customElement('pages-data-table')
export class PagesDataTable extends LiveRegionMixin(LitElement) {
  @property({ type: Array }) rows: readonly unknown[] = [];
  @property({ type: Array }) columns: readonly ColumnDef[] = [];
  @property({ type: String }) mode: DisplayMode = 'auto';
  @property({ type: String }) selection: SelectionMode = 'none';
  @property({ type: Array, attribute: 'selected-keys' }) selectedKeys?: readonly string[];
  @property({ attribute: false }) getRowKey?: (row: unknown) => string;
  @property({ attribute: false }) getRowClass?: (row: unknown) => string;
  @property({ type: Boolean }) loading = false;
  @property({ type: String, attribute: 'empty-message' }) emptyMessage = 'No data';
  @property({ type: Number, attribute: 'row-height' }) rowHeight = 48;
  @property({ type: Number, attribute: 'buffer-size' }) bufferSize = 5;
  @property({ type: Number, attribute: 'page-size' }) pageSize = 25;
  @property({ type: Number, attribute: 'current-page' }) currentPage = 0;
  @property({ type: Number, attribute: 'total-rows' }) totalRows?: number;
  @property({ type: Boolean, attribute: 'has-more' }) hasMore = false;
  @property({ type: String, attribute: 'sort-column-id' }) sortColumnId?: string;
  @property({ type: String, attribute: 'sort-direction' }) sortDirection: SortDirection = 'none';
  @property({ type: Boolean, attribute: 'client-sort' }) clientSort = false;

  @state() private _scrollTop = 0;
  @state() private _containerHeight = 0;
  @state() private _loadingMore = false;
  @state() private _internalSelectedKeys = new Set<string>();
  @state() private _lastClickedKey: string | null = null;
  @state() private _columnPickerOpen = false;
  @state() private _focusRowIndex = 0;
  @state() private _focusColIndex = 0;
  @state() private _hiddenColumnIds = new Set<string>();

  static override styles = css`
    :host {
      display: block;
      height: 100%;
      font-family: var(--blocks-font-family, system-ui);
    }

    .data-table {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    .header-container {
      display: flex;
      align-items: stretch;
      border-bottom: 1px solid var(--blocks-neutral-6, #d4d4d4);
      background: var(--blocks-neutral-2, #fafafa);
      flex-shrink: 0;
    }

    .header {
      display: grid;
      flex: 1;
      min-width: 0;
    }

    .header-cell {
      padding: var(--blocks-space-3, 12px) var(--blocks-space-2, 8px);
      font-weight: var(--blocks-font-weight-semibold, 600);
      font-size: var(--blocks-font-size-sm, 12px);
      color: var(--blocks-neutral-12, #171717);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .checkbox-cell {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--blocks-space-3, 12px) var(--blocks-space-2, 8px);
    }

    .checkbox {
      width: 16px;
      height: 16px;
      border: 2px solid var(--blocks-neutral-7, #a3a3a3);
      border-radius: 3px;
      cursor: pointer;
      background: var(--blocks-neutral-1, #ffffff);
      position: relative;
    }

    .checkbox[aria-checked="true"]::after,
    .checkbox[aria-checked="mixed"]::after {
      content: '';
      position: absolute;
      left: 4px;
      top: 1px;
      width: 4px;
      height: 8px;
      border: solid var(--blocks-neutral-1, #ffffff);
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }

    .checkbox[aria-checked="true"],
    .checkbox[aria-checked="mixed"] {
      background: var(--blocks-primary-9, #3b82f6);
      border-color: var(--blocks-primary-9, #3b82f6);
    }

    .checkbox[aria-checked="mixed"]::after {
      border-width: 0 0 2px 0;
      transform: rotate(0deg);
      top: 6px;
      left: 2px;
      width: 8px;
      height: 0;
    }

    .body {
      flex: 1;
      overflow-y: auto;
      overflow-x: auto;
      position: relative;
    }

    .body-content {
      position: relative;
    }

    .row {
      display: grid;
      border-bottom: 1px solid var(--blocks-neutral-4, #e5e5e5);
    }

    .row:hover {
      background: var(--blocks-neutral-3, #f5f5f5);
    }

    .row:focus {
      outline: 2px solid var(--blocks-primary-9, #3b82f6);
      outline-offset: -2px;
    }

    .row[aria-selected="true"] {
      background: var(--blocks-primary-3, #dbeafe);
    }

    .row[aria-selected="true"]:hover {
      background: var(--blocks-primary-4, #bfdbfe);
    }

    .cell {
      padding: var(--blocks-space-3, 12px) var(--blocks-space-2, 8px);
      font-size: var(--blocks-font-size-base, 14px);
      color: var(--blocks-neutral-11, #404040);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .empty-state,
    .loading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--blocks-space-8, 32px);
      color: var(--blocks-neutral-9, #737373);
      font-size: var(--blocks-font-size-base, 14px);
    }

    .pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--blocks-space-3, 12px) var(--blocks-space-4, 16px);
      border-top: 1px solid var(--blocks-neutral-4, #e5e5e5);
      background: var(--blocks-neutral-1, #ffffff);
    }

    .pagination-info {
      display: flex;
      align-items: center;
      gap: var(--blocks-space-4, 16px);
      font-size: var(--blocks-font-size-sm, 12px);
      color: var(--blocks-neutral-11, #404040);
    }

    .pagination-controls {
      display: flex;
      align-items: center;
      gap: var(--blocks-space-2, 8px);
    }

    .pagination-button {
      padding: var(--blocks-space-2, 8px) var(--blocks-space-3, 12px);
      border: 1px solid var(--blocks-neutral-6, #d4d4d4);
      background: var(--blocks-neutral-1, #ffffff);
      color: var(--blocks-neutral-11, #404040);
      font-size: var(--blocks-font-size-sm, 12px);
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.15s;
    }

    .pagination-button:hover:not(:disabled) {
      background: var(--blocks-neutral-2, #fafafa);
      border-color: var(--blocks-neutral-7, #a3a3a3);
    }

    .pagination-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .sortable-header {
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .sortable-header:hover {
      background: var(--blocks-neutral-3, #f5f5f5);
    }

    .sort-indicator {
      font-size: 10px;
      opacity: 0.3;
      flex-shrink: 0;
    }

    .sort-indicator.active {
      opacity: 1;
      color: var(--blocks-accent-9, #2563eb);
    }

    .column-picker-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      flex-shrink: 0;
      padding: 0 var(--blocks-space-2, 8px);
    }

    .column-picker-trigger {
      padding: var(--blocks-space-1, 4px) var(--blocks-space-2, 8px);
      border: 1px solid var(--blocks-neutral-6, #d4d4d4);
      background: var(--blocks-neutral-1, #ffffff);
      cursor: pointer;
      border-radius: 4px;
      font-size: 14px;
      line-height: 1;
    }

    .column-picker-dropdown {
      position: absolute;
      top: 100%;
      right: var(--blocks-space-2, 8px);
      margin-top: var(--blocks-space-1, 4px);
      background: var(--blocks-neutral-1, #ffffff);
      border: 1px solid var(--blocks-neutral-6, #d4d4d4);
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      z-index: 10;
      min-width: 200px;
    }

    .column-picker-item {
      display: flex;
      align-items: center;
      gap: var(--blocks-space-2, 8px);
      padding: var(--blocks-space-2, 8px) var(--blocks-space-3, 12px);
      cursor: pointer;
    }

    .column-picker-item:hover {
      background: var(--blocks-neutral-2, #fafafa);
    }

    .column-picker-item input[type="checkbox"] {
      margin: 0;
    }

    .column-picker-item input[type="checkbox"]:disabled {
      cursor: not-allowed;
    }
  `;

  private _onScroll = (e: Event): void => {
    const target = e.target as HTMLElement;
    this._scrollTop = target.scrollTop;

    // Check for load-more in scroll mode
    if (this.mode === 'scroll' && this.hasMore && !this._loadingMore) {
      const { scrollTop, clientHeight, scrollHeight } = target;
      const bufferHeight = this.bufferSize * this.rowHeight;
      const nearBottom = scrollTop + clientHeight >= scrollHeight - bufferHeight;

      if (nearBottom) {
        this._loadingMore = true;
        const detail: LoadMoreDetail = {};
        this.dispatchEvent(new CustomEvent('load-more', {
          detail,
          bubbles: true,
          composed: true,
        }));
      }
    }
  };

  private _emitPageChange(page: number): void {
    const detail: PageChangeDetail = {
      page,
      pageSize: this.pageSize,
    };
    this.dispatchEvent(new CustomEvent('page-change', {
      detail,
      bubbles: true,
      composed: true,
    }));
  }

  private _goToFirstPage = (): void => {
    this.currentPage = 0;
    this._focusRowIndex = 0; // I8
    this._emitPageChange(0);
  };

  private _goToPrevPage = (): void => {
    if (this.currentPage > 0) {
      this.currentPage = this.currentPage - 1;
      this._focusRowIndex = 0; // I8
      this._emitPageChange(this.currentPage);
    }
  };

  private _goToNextPage = (): void => {
    if (this.currentPage < this._totalPageCount - 1) {
      this.currentPage = this.currentPage + 1;
      this._focusRowIndex = 0; // I8
      this._emitPageChange(this.currentPage);
    }
  };

  private _goToLastPage = (): void => {
    const lastPage = this._totalPageCount - 1;
    this.currentPage = lastPage;
    this._focusRowIndex = 0; // I8
    this._emitPageChange(lastPage);
  };

  private _resizeObserver?: ResizeObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    this._updateContainerHeight();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._resizeObserver?.disconnect();
  }

  override firstUpdated(): void {
    this._updateContainerHeight();
    // I13: ResizeObserver for container height
    const body = this.shadowRoot?.querySelector('.body');
    if (body && typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => {
        this._updateContainerHeight();
      });
      this._resizeObserver.observe(body);
    }
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    // Reset _loadingMore when new rows arrive in scroll mode
    if (changed.has('rows') && this.mode === 'scroll') {
      this._loadingMore = false;
    }

    // Validate getRowKey requirement
    if (this.selection !== 'none' && !this.getRowKey) {
      throw new Error('getRowKey is required when selection is enabled');
    }

    // Sync controlled selection state
    if (changed.has('selectedKeys') && this.selectedKeys !== undefined) {
      this._internalSelectedKeys = new Set(this.selectedKeys);
    }
  }

  private _updateContainerHeight(): void {
    const body = this.shadowRoot?.querySelector('.body');
    if (body) {
      this._containerHeight = body.clientHeight;
    }
  }

  private get _selectedKeys(): Set<string> {
    // Controlled mode: use provided selectedKeys
    if (this.selectedKeys !== undefined) {
      return new Set(this.selectedKeys);
    }
    // Uncontrolled mode: use internal state
    return this._internalSelectedKeys;
  }

  private _isRowSelected(row: unknown): boolean {
    if (this.selection === 'none' || !this.getRowKey) return false;
    const key = this.getRowKey(row);
    return this._selectedKeys.has(key);
  }

  private _emitSelectionChange(keys: Set<string>): void {
    const selectedKeys = Array.from(keys);
    const selectedRows = this.rows.filter(row => {
      if (!this.getRowKey) return false;
      return keys.has(this.getRowKey(row));
    });

    const detail: SelectionChangeDetail = {
      selectedKeys,
      selectedRows,
    };

    // Add scope for server-side paginated mode
    if (this.mode === 'paginated' && this.totalRows !== undefined) {
      (detail as any).scope = 'page';
    }

    this.dispatchEvent(new CustomEvent('selection-change', {
      detail,
      bubbles: true,
      composed: true,
    }));
  }

  private _emitRowActivate(row: unknown): void {
    const detail: RowActivateDetail = this.getRowKey
      ? { row, key: this.getRowKey(row) }
      : { row };

    this.dispatchEvent(new CustomEvent('row-activate', {
      detail,
      bubbles: true,
      composed: true,
    }));
  }

  private _toggleRowSelection(row: unknown): void {
    if (!this.getRowKey) return;
    const key = this.getRowKey(row);
    const newSelection = new Set(this._selectedKeys);

    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      newSelection.add(key);
    }

    // Update internal state for uncontrolled mode
    if (this.selectedKeys === undefined) {
      this._internalSelectedKeys = newSelection;
    }

    this._emitSelectionChange(newSelection);
  }

  private _selectRow(row: unknown, exclusive = false): void {
    if (!this.getRowKey) return;
    const key = this.getRowKey(row);
    const newSelection = exclusive ? new Set([key]) : new Set(this._selectedKeys);
    newSelection.add(key);

    // Update internal state for uncontrolled mode
    if (this.selectedKeys === undefined) {
      this._internalSelectedKeys = newSelection;
    }

    this._lastClickedKey = key;
    this._emitSelectionChange(newSelection);
  }

  private _selectRange(row: unknown): void {
    if (!this.getRowKey || !this._lastClickedKey) {
      this._selectRow(row);
      return;
    }

    const currentKey = this.getRowKey(row);
    const allKeys = this.rows.map(r => this.getRowKey!(r));
    const lastIndex = allKeys.indexOf(this._lastClickedKey);
    const currentIndex = allKeys.indexOf(currentKey);

    if (lastIndex === -1 || currentIndex === -1) {
      this._selectRow(row);
      return;
    }

    const [start, end] = lastIndex < currentIndex
      ? [lastIndex, currentIndex]
      : [currentIndex, lastIndex];

    const newSelection = new Set(this._selectedKeys);
    for (let i = start; i <= end; i++) {
      const key = allKeys[i];
      if (key) newSelection.add(key);
    }

    // Update internal state for uncontrolled mode
    if (this.selectedKeys === undefined) {
      this._internalSelectedKeys = newSelection;
    }

    this._emitSelectionChange(newSelection);
  }

  private _handleRowClick = (row: unknown, event: MouseEvent): void => {
    event.stopPropagation();

    if (this.selection === 'single') {
      // Single mode: click selects exclusively and activates
      this._selectRow(row, true);
      this._emitRowActivate(row);
    } else if (this.selection === 'multi') {
      // Multi mode: single click selects exclusively (no activate)
      this._selectRow(row, true);
    }
  };

  private _handleRowDoubleClick = (row: unknown, event: MouseEvent): void => {
    event.stopPropagation();

    if (this.selection === 'multi' || this.selection === 'none') {
      this._emitRowActivate(row);
    }
  };

  private _handleCheckboxClick = (row: unknown, event: MouseEvent): void => {
    event.stopPropagation();

    if ((event as any).shiftKey && this._lastClickedKey) {
      this._selectRange(row);
    } else {
      this._toggleRowSelection(row);
    }

    if (this.getRowKey) {
      this._lastClickedKey = this.getRowKey(row);
    }
  };

  private _handleSelectAll = (event: MouseEvent): void => {
    event.stopPropagation();

    // C1 fix: Use correct source based on mode
    const sourceRows = this._usePagination ? this._visibleRows : this.rows;
    const visibleKeys = sourceRows
      .map(row => this.getRowKey!(row))
      .filter((key): key is string => key !== undefined);

    const allSelected = visibleKeys.every(key => this._selectedKeys.has(key));
    const newSelection = new Set(this._selectedKeys);

    if (allSelected) {
      // Deselect all visible
      visibleKeys.forEach(key => newSelection.delete(key));
    } else {
      // Select all visible
      visibleKeys.forEach(key => newSelection.add(key));
    }

    // Update internal state for uncontrolled mode
    if (this.selectedKeys === undefined) {
      this._internalSelectedKeys = newSelection;
    }

    this._emitSelectionChange(newSelection);
  };

  private _handleHeaderClick = (column: ColumnDef): void => {
    if (!column.sortable) return;

    // Cycle: none → asc → desc → none
    const currentDirection = this.sortColumnId === column.id ? this.sortDirection : 'none';
    let newDirection: SortDirection;

    switch (currentDirection) {
      case 'none':
        newDirection = 'asc';
        break;
      case 'asc':
        newDirection = 'desc';
        break;
      case 'desc':
        newDirection = 'none';
        break;
    }

    this.sortColumnId = newDirection === 'none' ? undefined : column.id;
    this.sortDirection = newDirection;

    const detail: SortChangeDetail = {
      columnId: column.id,
      direction: newDirection,
    };

    this.dispatchEvent(new CustomEvent('sort-change', {
      detail,
      bubbles: true,
      composed: true,
    }));
  };

  private _toggleColumnPicker = (): void => {
    this._columnPickerOpen = !this._columnPickerOpen;
  };

  private _toggleColumnVisibility = (columnId: string): void => {
    // I12 fix: Don't mutate columns property
    const visibleCount = this.columns.filter(c => !this._hiddenColumnIds.has(c.id) && c.visible !== false).length;

    // Prevent hiding the last visible column
    const targetColumn = this.columns.find(c => c.id === columnId);
    const isCurrentlyHidden = this._hiddenColumnIds.has(columnId) || targetColumn?.visible === false;

    if (!isCurrentlyHidden && visibleCount <= 1) {
      return;
    }

    // Toggle internal hidden state
    const newHidden = new Set(this._hiddenColumnIds);
    if (isCurrentlyHidden) {
      newHidden.delete(columnId);
    } else {
      newHidden.add(columnId);
    }
    this._hiddenColumnIds = newHidden;

    const visibleColumns = this.columns
      .filter(c => !this._hiddenColumnIds.has(c.id) && c.visible !== false)
      .map(c => c.id);

    const detail: ColumnChangeDetail = {
      visibleColumns,
    };

    this.dispatchEvent(new CustomEvent('column-change', {
      detail,
      bubbles: true,
      composed: true,
    }));
  };

  private _handleKeyDown = (event: KeyboardEvent): void => {
    const key = event.key;
    const target = event.target as HTMLElement;

    // Check if the event is coming from a row or from the grid container
    const isRowTarget = target.classList.contains('row') && !target.classList.contains('header');
    const isGridTarget = target === this;

    // For Escape, handle at grid level
    if (key === 'Escape' && this.selection === 'multi') {
      const newSelection = new Set<string>();
      if (this.selectedKeys === undefined) {
        this._internalSelectedKeys = newSelection;
      }
      this._emitSelectionChange(newSelection);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // For other keys, only handle if target is a row
    if (!isRowTarget) {
      return;
    }

    // Find which row is currently focused by looking at the DOM
    const rows = this.shadowRoot?.querySelectorAll('.row[role="row"]:not(.header)');
    if (!rows || rows.length === 0) return;

    let currentRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] === target) {
        currentRowIndex = i;
        break;
      }
    }

    if (currentRowIndex === -1) return;

    const totalRows = this.rows.length;
    let handled = false;

    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        if (this._focusRowIndex < totalRows - 1) {
          this._focusRowIndex++;
          // I6: Shift+ArrowDown selection
          if (event.shiftKey && this.selection === 'multi') {
            const row = this.rows[this._focusRowIndex];
            if (row) this._toggleRowSelection(row);
          }
          this._scrollToRowIfNeeded(this._focusRowIndex);
          void this._focusRow(this._focusRowIndex);
          handled = true;
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (this._focusRowIndex > 0) {
          this._focusRowIndex--;
          // I6: Shift+ArrowUp selection
          if (event.shiftKey && this.selection === 'multi') {
            const row = this.rows[this._focusRowIndex];
            if (row) this._toggleRowSelection(row);
          }
          this._scrollToRowIfNeeded(this._focusRowIndex);
          void this._focusRow(this._focusRowIndex);
          handled = true;
        }
        break;

      case 'ArrowRight': {
        event.preventDefault();
        const colCount = this._visibleColumns.length;
        if (this._focusColIndex < colCount - 1) {
          this._focusColIndex++;
        }
        handled = true;
        break;
      }

      case 'ArrowLeft': {
        event.preventDefault();
        if (this._focusColIndex > 0) {
          this._focusColIndex--;
        }
        handled = true;
        break;
      }

      case 'Home':
        if (event.ctrlKey || event.metaKey) {
          this._focusRowIndex = 0;
          this._focusColIndex = 0;
          this._scrollToRowIfNeeded(this._focusRowIndex);
          void this._focusRow(this._focusRowIndex);
        } else {
          this._focusRowIndex = 0;
          this._scrollToRowIfNeeded(this._focusRowIndex);
          void this._focusRow(this._focusRowIndex);
        }
        handled = true;
        break;

      case 'End':
        if (event.ctrlKey || event.metaKey) {
          this._focusRowIndex = totalRows - 1;
          this._focusColIndex = this._visibleColumns.length - 1;
          this._scrollToRowIfNeeded(this._focusRowIndex);
          void this._focusRow(this._focusRowIndex);
        } else {
          this._focusRowIndex = totalRows - 1;
          this._scrollToRowIfNeeded(this._focusRowIndex);
          void this._focusRow(this._focusRowIndex);
        }
        handled = true;
        break;

      case 'Enter': {
        const row = this._visibleRows[currentRowIndex];
        if (row) {
          this._emitRowActivate(row);
          handled = true;
        }
        break;
      }

      case ' ': {
        if (this.selection === 'multi') {
          const row = this._visibleRows[currentRowIndex];
          if (row) {
            this._toggleRowSelection(row);
            handled = true;
          }
        }
        break;
      }

      case 'a':
        if ((event.ctrlKey || event.metaKey) && this.selection === 'multi') {
          const allKeys = this._visibleRows
            .map(row => this.getRowKey!(row))
            .filter((key): key is string => key !== undefined);
          const newSelection = new Set(allKeys);
          if (this.selectedKeys === undefined) {
            this._internalSelectedKeys = newSelection;
          }
          this._emitSelectionChange(newSelection);
          handled = true;
        }
        break;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  private _scrollToRowIfNeeded(rowIndex: number): void {
    if (!this._useVirtualScroll) return;
    const body = this.shadowRoot?.querySelector('.body') as HTMLElement | null;
    if (!body) return;

    const rowTop = rowIndex * this.rowHeight;
    const rowBottom = rowTop + this.rowHeight;
    const viewTop = body.scrollTop;
    const viewBottom = viewTop + body.clientHeight;

    if (rowTop < viewTop) {
      // Row is above the visible window, scroll up
      body.scrollTop = rowTop;
    } else if (rowBottom > viewBottom) {
      // Row is below the visible window, scroll down
      body.scrollTop = rowBottom - body.clientHeight;
    }
  }

  private async _focusRow(index: number): Promise<void> {
    await this.updateComplete;
    const rows = this.shadowRoot?.querySelectorAll('.row[role="row"]:not(.header)');
    if (!rows || rows.length === 0) return;

    // In virtual scroll mode, map absolute index to display index
    if (this._useVirtualScroll && this._scrollWindow) {
      const displayIndex = index - this._scrollWindow.startIndex;
      if (displayIndex >= 0 && displayIndex < rows.length && rows[displayIndex]) {
        (rows[displayIndex] as HTMLElement).focus();
      }
    } else {
      // Non-virtual scroll: direct mapping
      if (rows[index]) {
        (rows[index] as HTMLElement).focus();
      }
    }
  }

  private get _visibleColumns(): readonly ColumnDef[] {
    return this.columns.filter(c => !this._hiddenColumnIds.has(c.id) && c.visible !== false);
  }

  private get _gridTemplateColumns(): string {
    if (this._visibleColumns.length === 0) return '1fr';
    const columns = this._visibleColumns.map(c => c.width ?? '1fr').join(' ');
    // Prepend checkbox column in multi mode
    return this.selection === 'multi' ? `40px ${columns}` : columns;
  }

  private get _useVirtualScroll(): boolean {
    if (this.mode === 'scroll') return true;
    return this.mode === 'auto' && this.rows.length > AUTO_THRESHOLD;
  }

  private get _usePagination(): boolean {
    return this.mode === 'paginated';
  }

  private get _totalPageCount(): number {
    if (!this._usePagination) return 1;

    const total = this.totalRows ?? this.rows.length;
    return Math.ceil(total / this.pageSize);
  }

  private get _visibleRows(): readonly unknown[] {
    // Apply client-side sorting first if enabled
    let rows = this.rows;
    if (this.clientSort && this.sortColumnId && this.sortDirection !== 'none') {
      const column = this.columns.find(c => c.id === this.sortColumnId);
      if (column) {
        const comparator = createComparator(column, this.sortDirection);
        rows = [...this.rows].sort((a, b) => {
          const aVal = column.getValue(a);
          const bVal = column.getValue(b);
          return comparator(aVal, bVal);
        });
      }
    }

    if (this._usePagination) {
      // Server-side: totalRows is set, render all provided rows (they ARE the page)
      if (this.totalRows !== undefined) {
        return rows;
      }
      // Client-side: slice rows by current page
      const start = this.currentPage * this.pageSize;
      const end = start + this.pageSize;
      return rows.slice(start, end);
    }

    if (!this._useVirtualScroll) {
      return rows;
    }

    const window = computeScrollWindow(
      this._scrollTop,
      this._containerHeight,
      this.rowHeight,
      rows.length,
      this.bufferSize,
    );

    return rows.slice(window.startIndex, window.endIndex);
  }

  private get _scrollWindow() {
    if (!this._useVirtualScroll) {
      return null;
    }

    return computeScrollWindow(
      this._scrollTop,
      this._containerHeight,
      this.rowHeight,
      this.rows.length,
      this.bufferSize,
    );
  }

  private _formatValue(value: unknown, column: ColumnDef): string {
    if (value == null) return '';

    switch (column.type) {
      case 'date':
        return new Date(value as string).toLocaleDateString();
      case 'number':
        return (value as number).toLocaleString();
      case 'text':
      default:
        return String(value);
    }
  }

  private _ariaSortValue(col: ColumnDef): string | typeof nothing {
    if (!col.sortable) return nothing;
    if (this.sortColumnId !== col.id) return 'none';
    if (this.sortDirection === 'asc') return 'ascending';
    if (this.sortDirection === 'desc') return 'descending';
    return 'none';
  }

  private _renderSortIndicator(column: ColumnDef) {
    if (!column.sortable) return nothing;
    const isSorted = this.sortColumnId === column.id;
    const dir = isSorted ? this.sortDirection : 'none';
    const arrow = dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '▲';
    return html`<span class="sort-indicator ${isSorted && dir !== 'none' ? 'active' : ''}">${arrow}</span>`;
  }

  private _renderHeaderCell(column: ColumnDef) {
    const isSortable = column.sortable === true;

    return html`
      <div
        class="header-cell ${isSortable ? 'sortable-header' : ''}"
        role="columnheader"
        aria-sort="${this._ariaSortValue(column)}"
        @click="${isSortable ? () => this._handleHeaderClick(column) : nothing}"
      >
        ${column.label}${this._renderSortIndicator(column)}
      </div>
    `;
  }

  private _renderColumnPicker() {
    const visibleCount = this.columns.filter(c => !this._hiddenColumnIds.has(c.id) && c.visible !== false).length;

    return html`
      <div class="column-picker-wrapper">
        <button
          class="column-picker-trigger"
          @click="${this._toggleColumnPicker}"
          aria-label="Column picker"
        >
          ⋮
        </button>
        ${this._columnPickerOpen ? html`
          <div class="column-picker-dropdown">
            ${this.columns.map(col => {
              const isVisible = !this._hiddenColumnIds.has(col.id) && col.visible !== false;
              const isLastVisible = isVisible && visibleCount === 1;

              return html`
                <label class="column-picker-item">
                  <input
                    type="checkbox"
                    .checked="${isVisible}"
                    ?disabled="${isLastVisible}"
                    @change="${() => this._toggleColumnVisibility(col.id)}"
                  />
                  <span>${col.label}</span>
                </label>
              `;
            })}
          </div>
        ` : nothing}
      </div>
    `;
  }

  private _renderCell(row: unknown, column: ColumnDef) {
    const value = column.getValue(row);
    const content = column.render
      ? column.render(value, row)
      : this._formatValue(value, column);

    const align = column.align ?? 'start';

    return html`
      <div
        class="cell"
        role="gridcell"
        style="text-align: ${align}"
      >
        ${content}
      </div>
    `;
  }

  private _renderCheckbox(row: unknown, isHeader = false) {
    if (this.selection !== 'multi') return nothing;

    if (isHeader) {
      // C1 fix: Use correct source based on mode
      const sourceRows = this._usePagination ? this._visibleRows : this.rows;
      const visibleKeys = sourceRows
        .map(r => this.getRowKey!(r))
        .filter((key): key is string => key !== undefined);
      const selectedCount = visibleKeys.filter(key => this._selectedKeys.has(key)).length;
      const checked = selectedCount === visibleKeys.length && visibleKeys.length > 0 ? 'true' :
                      selectedCount > 0 ? 'mixed' : 'false';

      return html`
        <div class="checkbox-cell">
          <div
            class="checkbox"
            role="checkbox"
            aria-checked="${checked}"
            aria-label="Select all"
            @click="${this._handleSelectAll}"
          ></div>
        </div>
      `;
    }

    const isSelected = this._isRowSelected(row);
    return html`
      <div class="checkbox-cell">
        <div
          class="checkbox"
          role="checkbox"
          aria-checked="${isSelected ? 'true' : 'false'}"
          aria-label="Select row"
          @click="${(e: MouseEvent) => this._handleCheckboxClick(row, e)}"
        ></div>
      </div>
    `;
  }

  private _renderRow(row: unknown, actualIndex: number, displayIndex: number) {
    const rowClass = this.getRowClass?.(row) ?? '';
    const part = rowClass ? `row ${rowClass}` : 'row';
    const ariaRowIndex = actualIndex + 2; // 1-based, header is row 1
    const isSelected = this._isRowSelected(row);
    // C3 fix: tabindex comparison uses actualIndex
    const tabindex = actualIndex === this._focusRowIndex ? '0' : '-1';

    return html`
      <div
        class="row"
        role="row"
        part="${part}"
        aria-rowindex="${ariaRowIndex}"
        aria-selected="${this.selection !== 'none' && isSelected ? 'true' : 'false'}"
        tabindex="${tabindex}"
        style="grid-template-columns: ${this._gridTemplateColumns}"
        @click="${(e: MouseEvent) => this._handleRowClick(row, e)}"
        @dblclick="${(e: MouseEvent) => this._handleRowDoubleClick(row, e)}"
      >
        ${this._renderCheckbox(row)}
        ${this._visibleColumns.map(col => this._renderCell(row, col))}
      </div>
    `;
  }

  private _renderPaginationFooter() {
    if (!this._usePagination || this.mode === 'scroll') return nothing;

    const currentPageNum = this.currentPage + 1; // 1-based for display
    const totalPages = this._totalPageCount;
    const isFirstPage = this.currentPage === 0;
    const isLastPage = this.currentPage === totalPages - 1;

    const total = this.totalRows ?? this.rows.length;
    const start = this.currentPage * this.pageSize + 1;
    const end = Math.min((this.currentPage + 1) * this.pageSize, total);

    return html`
      <div class="pagination" role="navigation" aria-label="Table pagination">
        <div class="pagination-info">
          <span>Page ${currentPageNum} of ${totalPages}</span>
          <span>Showing ${start}-${end} of ${total}</span>
        </div>
        <div class="pagination-controls">
          <button
            class="pagination-button"
            aria-label="First page"
            ?disabled="${isFirstPage}"
            @click="${this._goToFirstPage}"
          >
            First
          </button>
          <button
            class="pagination-button"
            aria-label="Previous page"
            ?disabled="${isFirstPage}"
            @click="${this._goToPrevPage}"
          >
            Prev
          </button>
          <button
            class="pagination-button"
            aria-label="Next page"
            ?disabled="${isLastPage}"
            @click="${this._goToNextPage}"
          >
            Next
          </button>
          <button
            class="pagination-button"
            aria-label="Last page"
            ?disabled="${isLastPage}"
            @click="${this._goToLastPage}"
          >
            Last
          </button>
        </div>
      </div>
    `;
  }

  override render() {
    const visibleCols = this._visibleColumns;
    const totalRows = this.rows.length + 1; // +1 for header
    const ariaRowCount = totalRows;
    const ariaColCount = visibleCols.length;

    if (this.loading) {
      return html`
        <div class="data-table" role="grid" aria-busy="true">
          <div class="loading-state">Loading...</div>
        </div>
      `;
    }

    if (this.rows.length === 0) {
      return html`
        <div class="data-table" role="grid" aria-rowcount="${ariaRowCount}" aria-colcount="${ariaColCount}">
          <div class="header-container">
            <div
              class="header"
              role="row"
              part="header-row"
              style="grid-template-columns: ${this._gridTemplateColumns}"
            >
              ${this.selection === 'multi' ? html`<div class="header-cell"></div>` : nothing}
              ${visibleCols.map(col => this._renderHeaderCell(col))}
            </div>
            ${this._renderColumnPicker()}
          </div>
          <div class="empty-state">${this.emptyMessage}</div>
        </div>
      `;
    }

    const window = this._scrollWindow;

    return html`
      <div class="data-table" role="grid" aria-rowcount="${ariaRowCount}" aria-colcount="${ariaColCount}" aria-label="Data table" @keydown="${this._handleKeyDown}">
        <div class="header-container">
          <div
            class="header"
            role="row"
            part="header-row"
            style="grid-template-columns: ${this._gridTemplateColumns}"
          >
            ${this._renderCheckbox(this.rows[0], true)}
            ${visibleCols.map(col => this._renderHeaderCell(col))}
          </div>
          ${this._renderColumnPicker()}
        </div>
        <div class="body" @scroll="${this._onScroll}">
          ${this._useVirtualScroll && window
            ? html`
                <div class="body-content" style="height: ${window.totalHeight}px">
                  <div style="transform: translateY(${window.offsetY}px)">
                    ${this._visibleRows.map((row, idx) => {
                      const actualIndex = window.startIndex + idx;
                      return this._renderRow(row, actualIndex, idx);
                    })}
                  </div>
                </div>
              `
            : html`
                <div class="body-content">
                  ${this._visibleRows.map((row, idx) => {
                    const actualIndex = this._usePagination && this.totalRows === undefined
                      ? this.currentPage * this.pageSize + idx
                      : idx;
                    return this._renderRow(row, actualIndex, idx);
                  })}
                </div>
              `}
        </div>
        ${this._renderPaginationFooter()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pages-data-table': PagesDataTable;
  }
}
