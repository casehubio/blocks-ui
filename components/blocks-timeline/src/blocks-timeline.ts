import { html, css, nothing, LitElement } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { DataSourceMixin, fetchSource } from '@casehubio/blocks-ui-core';
import { LiveRegionMixin } from '@casehubio/pages-primitives';
import { emitPagesEvent } from '@casehubio/pages-component';
import type { SourceFactory } from '@casehubio/pages-component';
import type { WorkIdentity } from '@casehubio/blocks-ui-core';
import type { TimelineNode, Layout, TimelineStrategy, PaginationMeta } from './types.js';
import { renderVertical, verticalStyles } from './renderers/vertical.js';
import { renderHorizontal, horizontalStyles } from './renderers/horizontal.js';
import { renderCompact, compactStyles } from './renderers/compact.js';

@customElement('blocks-timeline')
export class BlocksTimeline extends DataSourceMixin(LiveRegionMixin(LitElement)) {
  @property({ attribute: false }) strategy!: TimelineStrategy;
  @property({ attribute: false }) data?: unknown;
  @property() layout?: Layout;
  @property({ attribute: false }) renderNode?: (node: TimelineNode) => TemplateResult;
  @property({ attribute: false }) renderDetail?: (node: TimelineNode) => TemplateResult;
  @property({ attribute: false }) activeFilters?: Set<string> | string[];
  @property({ attribute: false }) headers?: Record<string, string> | (() => Record<string, string>) | undefined;
  @property({ type: Number }) pageSize = 20;

  @state() private _nodes: TimelineNode[] = [];
  @state() private _expandedKeys = new Set<string>();
  @state() private _internalFilters: Set<string> | null = null;
  @state() private _paginationMeta: PaginationMeta | undefined = undefined;
  @state() private _loadingMore = false;

  private _lastDataSet: unknown = undefined;
  private _paginatedEndpoint: string | undefined = undefined;
  private _paginatedPageSize = 0;

  override createSourceFactory(): SourceFactory {
    return (url) => fetchSource(url, {
      headers: () => {
        const h = typeof this.headers === 'function' ? this.headers() : this.headers;
        return h ?? {};
      },
    });
  }

  override configure(props: Record<string, unknown>): void {
    if (props.identity !== undefined) {
      const id = props.identity as WorkIdentity;
      this.headers = id?.tenancyId ? { 'X-Tenancy-ID': id.tenancyId } : undefined;
    }
    super.configure(props);
  }

  private get _isPaginated(): boolean {
    return !!this.strategy?.supportsPagination && !!this.endpoint && this.data == null;
  }

  override resolveEndpoint(): string | undefined {
    if (this.data != null) return undefined;
    if (this._isPaginated) return undefined;
    return this.endpoint;
  }

  private _buildPagedUrl(page: number): string {
    const base = this.endpoint!;
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}page=${page}&size=${this.pageSize}`;
  }

  private _resolveHeaders(): Record<string, string> {
    const h = typeof this.headers === 'function' ? this.headers() : this.headers;
    return h ?? {};
  }

  private async _fetchPage(page: number): Promise<void> {
    const url = this._buildPagedUrl(page);
    const headers = this._resolveHeaders();
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.json();

      const transformed = this.strategy.transformData
        ? this.strategy.transformData(raw)
        : raw;
      const newNodes = this.strategy.toNodes(transformed);

      if (page === 0) {
        this._nodes = newNodes;
      } else {
        this._nodes = [...this._nodes, ...newNodes];
      }

      if (this.strategy.extractPaginationMeta) {
        this._paginationMeta = this.strategy.extractPaginationMeta(raw);
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async _loadMore(): Promise<void> {
    if (!this._paginationMeta || this._loadingMore) return;
    const nextPage = this._paginationMeta.page + 1;
    if (nextPage >= this._paginationMeta.totalPages) return;

    this._loadingMore = true;
    await this._fetchPage(nextPage);
    this._loadingMore = false;
  }

  override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);

    if (this._isPaginated && (changed.has('endpoint') || changed.has('strategy') || changed.has('pageSize'))
        && (this.endpoint !== this._paginatedEndpoint || this.pageSize !== this._paginatedPageSize)) {
      this._paginatedEndpoint = this.endpoint;
      this._paginatedPageSize = this.pageSize;
      this._paginationMeta = undefined;
      this._fetchPage(0);
    }

    const dataChanged = changed.has('data') || changed.has('strategy') || this.dataSet !== this._lastDataSet;
    this._lastDataSet = this.dataSet;

    if (dataChanged && this.strategy && !this._isPaginated) {
      const raw = this.data ?? this.dataSet;
      if (raw != null) {
        const transformed = this.strategy.transformData
          ? this.strategy.transformData(raw)
          : raw;
        this._nodes = this.strategy.toNodes(transformed);
      } else {
        this._nodes = [];
      }
    }
  }

  private get _activeLayout(): Layout {
    return this.layout ?? this.strategy?.defaultLayout ?? 'vertical';
  }

  private get _resolvedFilters(): Set<string> | null {
    if (this.activeFilters != null) {
      return this.activeFilters instanceof Set ? this.activeFilters : new Set(this.activeFilters);
    }
    return this._internalFilters;
  }

  private get _filteredNodes(): TimelineNode[] {
    const filters = this._resolvedFilters;
    if (!filters || !this.strategy?.filterCategories) return this._nodes;
    return this._nodes.filter(n => n.category == null || filters.has(n.category));
  }

  private _resolveRenderNode(): ((node: TimelineNode) => TemplateResult) | undefined {
    return this.renderNode ?? this.strategy?.renderNode;
  }

  private _resolveRenderDetail(): ((node: TimelineNode) => TemplateResult) | undefined {
    return this.renderDetail ?? this.strategy?.renderDetail;
  }

  private _handleNodeClick(node: TimelineNode, index: number): void {
    emitPagesEvent(this, 'timeline.node-selected', { node, index });
  }

  private _handleExpandRequested(): void {
    emitPagesEvent(this, 'timeline.expand-requested', {});
  }

  private _handleToggleExpand(key: string): void {
    const next = new Set(this._expandedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this._expandedKeys = next;
  }

  private _handleFilterToggle(category: string): void {
    const current = this._resolvedFilters ?? new Set(this.strategy?.filterCategories ?? []);
    const next = new Set(current);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    this._internalFilters = next;
  }

  private _handleVerticalKeyDown(e: KeyboardEvent, index: number): void {
    const nodes = this.shadowRoot!.querySelectorAll('.timeline-node');
    if (e.key === 'ArrowDown' && index < nodes.length - 1) {
      e.preventDefault();
      (nodes[index + 1] as HTMLElement).focus();
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      (nodes[index - 1] as HTMLElement).focus();
    }
  }

  private _handleHorizontalKeyDown(e: KeyboardEvent, index: number): void {
    const items = this.shadowRoot!.querySelectorAll('[role="listitem"]');
    if (e.key === 'ArrowRight' && index < items.length - 1) {
      e.preventDefault();
      (items[index + 1] as HTMLElement).focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      (items[index - 1] as HTMLElement).focus();
    }
  }

  private _renderFilterBar(): TemplateResult | typeof nothing {
    const categories = this.strategy?.filterCategories;
    if (!categories || this._activeLayout === 'compact') return nothing;

    const active = this._resolvedFilters ?? new Set(categories);
    return html`
      <div class="filter-bar" role="group" aria-label="Filter">
        ${categories.map(cat => html`
          <button
            class="filter-chip"
            role="checkbox"
            aria-checked="${active.has(cat)}"
            @click=${() => this._handleFilterToggle(cat)}
          >${cat}</button>
        `)}
      </div>
    `;
  }

  private _renderPaginationFooter(): TemplateResult | typeof nothing {
    if (!this._paginationMeta || this._activeLayout !== 'vertical') return nothing;
    const { page, totalPages, totalElements } = this._paginationMeta;
    const hasMore = page + 1 < totalPages;
    if (!hasMore && this._nodes.length >= totalElements) return nothing;

    return html`
      <div class="pagination-footer">
        <span class="pagination-progress">Showing ${this._nodes.length} of ${totalElements} events</span>
        ${hasMore ? html`
          <button class="load-more-button"
                  ?disabled=${this._loadingMore}
                  @click=${() => this._loadMore()}>
            ${this._loadingMore ? 'Loading…' : 'Load more'}
          </button>
        ` : nothing}
      </div>
    `;
  }

  override render(): TemplateResult {
    if (!this.data && this.loading) {
      return html`<div class="timeline-container">Loading timeline...</div>`;
    }

    if (!this.data && this.error) {
      return html`
        <div class="timeline-container">
          <div class="error-message">Failed to load timeline: ${this.error}</div>
          <button @click=${() => this.dataSource.refresh()}>Retry</button>
        </div>
      `;
    }

    const layout = this._activeLayout;
    const filtered = this._filteredNodes;
    const renderNodeCb = this._resolveRenderNode();
    const renderDetailCb = this._resolveRenderDetail();

    return html`
      <div class="timeline-container">
        ${this._renderFilterBar()}
        ${layout === 'vertical' ? renderVertical(filtered, {
          expandedKeys: this._expandedKeys,
          onNodeClick: (n, i) => this._handleNodeClick(n, i),
          onToggleExpand: (k) => this._handleToggleExpand(k),
          onKeyDown: (e, i) => this._handleVerticalKeyDown(e, i),
          renderNode: renderNodeCb,
          renderDetail: renderDetailCb,
        }) : layout === 'horizontal' ? renderHorizontal(filtered, {
          onNodeClick: (n, i) => this._handleNodeClick(n, i),
          onKeyDown: (e, i) => this._handleHorizontalKeyDown(e, i),
          renderNode: renderNodeCb,
        }) : renderCompact(filtered, {
          onExpandRequested: () => this._handleExpandRequested(),
          onKeyDown: () => {},
        })}
        ${this._renderPaginationFooter()}
      </div>
    `;
  }

  static override styles = css`
    :host {
      display: block;
      font-family: var(--pages-font-family, system-ui);
      color: var(--pages-neutral-12, #111);
    }

    .timeline-container { padding: 16px; }
    .error-message { color: var(--pages-error-11, #dc2626); margin-bottom: 12px; }

    .filter-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .filter-chip {
      padding: 6px 12px;
      border-radius: 16px;
      border: 1px solid var(--pages-neutral-6, #d1d5db);
      background: var(--pages-neutral-1, #fff);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .filter-chip[aria-checked="true"] {
      background: var(--pages-accent-9, #2563eb);
      color: white;
      border-color: var(--pages-accent-9, #2563eb);
    }

    .filter-chip:hover { border-color: var(--pages-accent-7, #3b82f6); }

    .pagination-footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 16px;
      margin-top: 8px;
    }

    .pagination-progress {
      font-size: 13px;
      color: var(--pages-neutral-9, #6b7280);
    }

    .load-more-button {
      padding: 8px 16px;
      border: 1px solid var(--pages-accent-7, #3b82f6);
      background: var(--pages-neutral-1, #fff);
      color: var(--pages-accent-9, #2563eb);
      border-radius: var(--pages-radius-sm, 4px);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: background 0.2s;
    }

    .load-more-button:hover { background: var(--pages-accent-3, #dbeafe); }
    .load-more-button:disabled { cursor: default; opacity: 0.6; }

    ${verticalStyles}
    ${horizontalStyles}
    ${compactStyles}
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'blocks-timeline': BlocksTimeline;
  }
}
