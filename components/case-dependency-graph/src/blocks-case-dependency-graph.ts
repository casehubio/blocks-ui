import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { zoom, zoomIdentity } from 'd3-zoom';
import { drag } from 'd3-drag';
import { select } from 'd3-selection';
import type { GraphModel, GraphNode } from '@casehubio/graph-core';
import { emitPagesEvent, onPagesEvent, lookupRelationshipType } from '@casehubio/blocks-ui-core';
import { createSimulation, stopSimulation } from './force-layout.js';
import { renderGraph, clearGraph } from './graph-renderer.js';
import { toDOT } from './dot-export.js';
import type { SimNode, SimLink, FilterChangePayload } from './types.js';
import './blocks-dependency-toolbar.js';

type Simulation = ReturnType<typeof createSimulation>;

@customElement('blocks-case-dependency-graph')
export class BlocksCaseDependencyGraph extends LitElement {
  @property({ type: String }) endpoint: string | undefined;
  @property({ attribute: false }) graphData: GraphModel | undefined;
  @property({ attribute: 'selection-topic' }) selectionTopic = 'case-graph';
  @property({ attribute: false }) renderNode: ((node: GraphNode) => SVGElement | undefined) | undefined;
  @property({ attribute: false }) renderTooltip: ((node: GraphNode) => string) | undefined;

  @state() private _model: GraphModel | null = null;
  @state() private _loading = false;
  @state() private _error: string | null = null;
  @state() private _selectedTypes: Set<string> = new Set();

  private _sim: Simulation | null = null;
  private _simNodes: SimNode[] = [];
  private _simLinks: SimLink[] = [];
  private _unsubs: Array<() => void> = [];
  private _zoomBehavior: ReturnType<typeof zoom> | null = null;

  static override styles = css`
    :host { display: flex; flex-direction: column; height: 100%; }
    .canvas-area { flex: 1; position: relative; overflow: hidden; }
    svg { width: 100%; height: 100%; }
    .empty, .loading, .error {
      display: flex; align-items: center; justify-content: center;
      height: 100%; color: var(--pages-text-tertiary, #999); font-style: italic;
    }
    .error button { margin-left: 8px; }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this._unsubs.push(
      onPagesEvent(this, 'dependency-toolbar:filter-change', (p: unknown) => {
        this._selectedTypes = (p as FilterChangePayload).selectedTypes;
        this._applyFilter();
      }),
      onPagesEvent(this, 'dependency-toolbar:refresh', () => this.refresh()),
      onPagesEvent(this, 'dependency-toolbar:export-dot', () => this._downloadDOT()),
    );
  }

  override disconnectedCallback(): void {
    this._cleanup();
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
    super.disconnectedCallback();
  }

  override updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('graphData') || changed.has('endpoint')) {
      if (this.graphData) {
        this._model = this.graphData;
        this._error = null;
        this._loading = false;
      } else if (this.endpoint) {
        this._fetchData();
      } else {
        this._model = null;
        this._cleanup();
      }
    }
    if (this._model && this._model.nodes.length > 0 && !this._sim) {
      const svg = this.shadowRoot?.querySelector('svg');
      if (svg) this._buildGraph();
    }
  }

  exportDOT(): string {
    return this._model ? toDOT(this._model) : '';
  }

  refresh(): void {
    if (this.endpoint) this._fetchData();
    else if (this._model) this._buildGraph();
  }

  focusNode(id: string): void {
    const node = this._simNodes.find(n => n.id === id);
    if (!node || node.x == null || node.y == null) return;
    const svg = this.shadowRoot?.querySelector('svg') as SVGSVGElement | null;
    if (!svg || !this._zoomBehavior) return;

    const width = svg.clientWidth || 800;
    const height = svg.clientHeight || 600;
    const scale = 1.2;
    const tx = width / 2 - node.x * scale;
    const ty = height / 2 - node.y * scale;

    const transform = zoomIdentity.translate(tx, ty).scale(scale);
    select(svg as SVGSVGElement).transition().duration(500).call(
      this._zoomBehavior.transform as any, transform,
    );

    emitPagesEvent(this, `${this.selectionTopic}:selected`, { id });
  }

  private async _fetchData(): Promise<void> {
    if (!this.endpoint) return;
    this._loading = true;
    this._error = null;
    try {
      const res = await fetch(this.endpoint, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this._model = await res.json() as GraphModel;
    } catch (e) {
      this._error = e instanceof Error ? e.message : String(e);
    } finally {
      this._loading = false;
    }
  }

  private _buildGraph(): void {
    this._cleanup();
    const model = this._model;
    if (!model || model.nodes.length === 0) return;

    const svg = this.shadowRoot?.querySelector('svg');
    if (!svg) return;
    const container = svg.querySelector('.container') as SVGGElement;
    if (!container) return;

    const nodeIds = new Set(model.nodes.map(n => n.id));
    const validEdges = model.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    this._simNodes = model.nodes.map(n => ({
      id: n.id,
      label: String(n.properties.label ?? n.id),
      status: String(n.properties.status ?? ''),
      domain: String(n.properties.domain ?? 'case'),
    }));

    const nodeMap = new Map(this._simNodes.map(n => [n.id, n]));
    this._simLinks = validEdges.map(e => ({
      id: e.id,
      type: e.type,
      source: nodeMap.get(e.source)!,
      target: nodeMap.get(e.target)!,
    }));

    this._selectedTypes = new Set(validEdges.map(e => e.type));
    this._setupArrowMarkers(svg);

    const width = svg.clientWidth || 800;
    const height = svg.clientHeight || 600;

    renderGraph(container, this._simNodes, this._simLinks, {
      renderNode: this.renderNode,
      renderTooltip: this.renderTooltip,
    });

    this._sim = createSimulation(this._simNodes, this._simLinks, width, height);
    this._sim.on('tick', () => {
      select(container).selectAll<SVGGElement, SimNode>('.nodes g')
        .attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
      select(container).selectAll<SVGLineElement, SimLink>('.edges line')
        .attr('x1', d => (d.source as SimNode).x ?? 0)
        .attr('y1', d => (d.source as SimNode).y ?? 0)
        .attr('x2', d => (d.target as SimNode).x ?? 0)
        .attr('y2', d => (d.target as SimNode).y ?? 0);
    });

    this._zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        select(container).attr('transform', event.transform);
      });
    select(svg as SVGSVGElement).call(this._zoomBehavior);

    const sim = this._sim;
    const dragBehavior = drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null; d.fy = null;
      });
    select(container).selectAll<SVGGElement, SimNode>('.nodes g').call(dragBehavior);

    const topic = this.selectionTopic;
    const host = this;
    select(container).selectAll<SVGGElement, SimNode>('.nodes g')
      .on('click', (_, d) => {
        emitPagesEvent(host, `${topic}:selected`, { id: d.id });
      });
  }

  private _setupArrowMarkers(svg: SVGSVGElement): void {
    const defs = svg.querySelector('defs');
    if (!defs) return;
    defs.innerHTML = '';

    const types = new Set(this._simLinks.map(l => l.type));
    for (const type of types) {
      const desc = lookupRelationshipType(type);
      if (!desc.directed) continue;
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', `arrow-${type}`);
      marker.setAttribute('viewBox', '0 -5 10 10');
      marker.setAttribute('refX', '20');
      marker.setAttribute('refY', '0');
      marker.setAttribute('markerWidth', '6');
      marker.setAttribute('markerHeight', '6');
      marker.setAttribute('orient', 'auto');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('fill', desc.color);
      path.setAttribute('d', 'M0,-5L10,0L0,5');
      marker.appendChild(path);
      defs.appendChild(marker);
    }
  }

  private _applyFilter(): void {
    const container = this.shadowRoot?.querySelector('.container') as SVGGElement | null;
    if (!container) return;
    select(container).selectAll<SVGLineElement, SimLink>('.edges line')
      .attr('display', d => this._selectedTypes.has(d.type) ? null : 'none');

    const filteredLinks = this._simLinks.filter(l => this._selectedTypes.has(l.type));
    if (this._sim) {
      const linkForce = this._sim.force('link') as any;
      if (linkForce) linkForce.links(filteredLinks);
      this._sim.alphaTarget(0.1).restart();
      setTimeout(() => this._sim?.alphaTarget(0), 500);
    }
  }

  private _cleanup(): void {
    if (this._sim) { stopSimulation(this._sim); this._sim = null; }
    this._zoomBehavior = null;
    const container = this.shadowRoot?.querySelector('.container') as SVGGElement | null;
    if (container) clearGraph(container);
  }

  private _downloadDOT(): void {
    const dot = this.exportDOT();
    if (!dot) return;
    const blob = new Blob([dot], { type: 'text/vnd.graphviz' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'dependencies.dot'; a.click();
    URL.revokeObjectURL(url);
  }

  private _edgeTypeSummary(): Array<{ type: string; count: number }> {
    if (!this._model) return [];
    const counts = new Map<string, number>();
    for (const e of this._model.edges) {
      counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    }
    return [...counts.entries()].map(([type, count]) => ({ type, count }));
  }

  override render() {
    if (this._loading) return html`<div class="loading">Loading graph...</div>`;
    if (this._error) return html`<div class="error">Error: ${this._error} <button @click=${() => this.refresh()}>Retry</button></div>`;
    if (!this._model || this._model.nodes.length === 0) return html`<div class="empty">No graph data</div>`;

    const nodeCount = this._model.nodes.length;
    const edgeCount = this._model.edges.length;
    const ariaLabel = `Case dependency graph: ${nodeCount} case${nodeCount !== 1 ? 's' : ''}, ${edgeCount} relationship${edgeCount !== 1 ? 's' : ''}`;

    return html`
      <blocks-dependency-toolbar
        .edgeTypes=${this._edgeTypeSummary()}
        .selectedTypes=${this._selectedTypes}
        .nodeCount=${nodeCount}
        .edgeCount=${edgeCount}
      ></blocks-dependency-toolbar>
      <div class="canvas-area">
        <svg role="img" aria-label=${ariaLabel}>
          <defs></defs>
          <g class="container"></g>
        </svg>
      </div>
    `;
  }
}
