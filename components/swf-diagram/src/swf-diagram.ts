import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { toSwfGraph, applySwfPropertyEdit, addSwfTask, removeSwfTask, registerSwfStencils, createSwfEditPolicy } from '@casehubio/graph-stencil-swf';
import { DiagramBaseMixin } from '@casehubio/diagram-core';
import type { AdapterResult } from '@casehubio/diagram-core';
import type { EditPolicy, GraphEdit } from '@casehubio/graph-renderer';
import '@casehubio/graph-renderer';

const swfEditPolicy = createSwfEditPolicy();

function svgIcon(paths: string, color: string, size = 20) {
  return html`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${unsafeSVG(paths)}</svg>`;
}

const SWF_ICON_PATHS: Record<string, { paths: string; color: string }> = {
  phone: {
    paths: '<path d="M5 4h3l1.5 4-2 1.5a8 8 0 003 3L12 11l4 1.5V16a1 1 0 01-1 1A13 13 0 014 5a1 1 0 011-1"></path>',
    color: '#2563eb',
  },
  edit: {
    paths: '<path d="M12 3l5 5-9 9H3v-5z"></path><path d="M10 5l5 5"></path>',
    color: '#7c3aed',
  },
  'git-branch': {
    paths: '<circle cx="7" cy="5" r="2"></circle><circle cx="13" cy="15" r="2"></circle><circle cx="7" cy="15" r="2"></circle><path d="M7 7v6m6-6V7a2 2 0 00-2-2H7"></path>',
    color: '#0891b2',
  },
  'alert-triangle': {
    paths: '<path d="M10 3L2 17h16L10 3z" fill="#dc2626" fill-opacity="0.12"></path><path d="M10 8v3m0 2.5v.5"></path>',
    color: '#dc2626',
  },
  shield: {
    paths: '<path d="M10 2L3 6v4c0 4.4 3 8.5 7 10 4-1.5 7-5.6 7-10V6l-7-4z" fill="#16a34a" fill-opacity="0.1"></path><path d="M8 10l2 2 3-4"></path>',
    color: '#16a34a',
  },
};

function swfIconRenderer(icon: string) {
  const def = SWF_ICON_PATHS[icon];
  if (!def) return html`<span style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;">${icon}</span>`;
  return svgIcon(def.paths, def.color);
}

@customElement('swf-diagram')
export class SwfDiagram extends DiagramBaseMixin(LitElement) {
  @property({ attribute: 'layout-direction' })
  layoutDirection: 'DOWN' | 'RIGHT' = 'DOWN';

  override connectedCallback(): void {
    super.connectedCallback();
    registerSwfStencils();
  }

  protected _adaptYaml(yaml: string): AdapterResult {
    return toSwfGraph(yaml);
  }

  protected _applyPropertyEdit(
    yaml: string,
    nodePath: readonly (string | number)[],
    field: (string | number)[],
    value: unknown,
  ): string {
    return applySwfPropertyEdit(yaml, nodePath, field, value);
  }

  protected override _layoutOptions() {
    return { direction: this.layoutDirection, spacing: 40, containerPadding: 25, wrapping: true };
  }

  protected override _editPolicy(): EditPolicy {
    return swfEditPolicy;
  }

  protected override _iconRenderer() {
    return swfIconRenderer;
  }

  protected override _applyGraphEdit(yaml: string, edit: GraphEdit): string {
    switch (edit.type) {
      case 'addNode':
        return addSwfTask(yaml, edit.nodeType);
      case 'removeNode': {
        const node = this._adapterResult?.model.nodes.find(n => n.id === edit.nodeId);
        const label = node?.properties['label'];
        if (!label || typeof label !== 'string') throw new Error(`Cannot resolve task name for ${edit.nodeId}`);
        return removeSwfTask(yaml, label);
      }
      case 'addEdge':
        throw new Error('addEdge for SWF diagrams — not yet implemented');
      case 'removeEdge':
        throw new Error('removeEdge for SWF diagrams — not yet implemented');
      case 'reconnectEdge':
        throw new Error('reconnectEdge for SWF diagrams — not yet implemented');
      case 'splitEdge':
        throw new Error('splitEdge for SWF diagrams — not yet implemented');
      default:
        throw new Error(`Unsupported edit type: ${(edit as GraphEdit).type}`);
    }
  }

  protected _emptyTemplate(): string | null {
    return null;
  }

  private _computeFilteredEdges() {
    const nodeParents = new Map(this._nodes.map(n => [n.id, n.parentId]));
    return this._edges.filter(e => {
      const sp = nodeParents.get(e.source);
      const tp = nodeParents.get(e.target);
      if (!sp || !tp || sp !== tp) return true;
      return sp === 'root';
    });
  }

  private _computeFilteredNodes(filteredEdges: typeof this._edges) {
    const connectedIds = new Set(filteredEdges.flatMap(e => [e.source, e.target]));
    const containerTypes = new Set(['swf-try-catch']);
    return this._nodes
      .filter(n => n.type !== 'swf-root')
      .map(n => {
        const cleared = n.parentId === 'root' ? { ...n, parentId: undefined } : { ...n };
        if (!connectedIds.has(n.id)) {
          cleared.data = { ...cleared.data, _hideHandles: true };
        }
        if (containerTypes.has(n.type ?? '')) {
          cleared.style = {
            ...cleared.style,
            background: 'var(--pages-neutral-4, #e5e5e5)',
            border: '2px solid #d97706',
            borderRadius: '10px',
          };
        }
        return cleared;
      });
  }

  override render() {
    if (this._error) {
      return this._renderError();
    }
    const hasSelection = this._selectedNodeId !== '';
    const isReadonly = this.readonly || !!this._adapterResult?.degraded;
    const filteredEdges = this._computeFilteredEdges();
    const filteredNodes = this._computeFilteredNodes(filteredEdges);

    return html`
      <div style="display: flex; flex-direction: column; width: 100%; height: 100%;">
        <diagram-toolbar
          ?hasBackend=${this.backend != null}
          ?hasNodes=${this._nodes.length > 0}
          ?dirty=${this._isDirty}
          ?saving=${this._saving}
          @toolbar-save=${() => this._save()}
          @toolbar-export=${(e: CustomEvent<{ format: 'svg' | 'png' }>) => this._exportDiagram(e.detail.format)}
        ></diagram-toolbar>
        <div style="display: flex; flex: 1; overflow: hidden;">
          <div style="border-right:1px solid var(--pages-neutral-4,#e5e7eb); display:flex; flex-direction:column; overflow-y:auto; flex-shrink:0; padding:8px;">
            ${this._renderStencilPalette()}
          </div>
          <pages-graph-canvas
            .nodes=${filteredNodes}
            .edges=${filteredEdges}
            .editPolicy=${this._editPolicy()}
            .onMutation=${this._handleMutation}
            role="img"
            aria-label="Workflow diagram"
            style="flex: 1; height: 100%; min-width: 0;"
            @pages-event=${(e: CustomEvent) => {
              const topic = e.detail?.topic as string | undefined;
              if (topic === 'graph:node:click') this._handleNodeClick(e);
              if (topic === 'graph:selection:change') this._handleSelectionChange(e);
            }}
          ></pages-graph-canvas>
          ${hasSelection && !isReadonly ? html`
            <div style="width:300px; border-left:1px solid var(--pages-neutral-4,#e5e7eb); display:flex; flex-direction:column; overflow-y:auto; flex-shrink:0;">
              <div style="padding:6px 10px; border-bottom:1px solid var(--pages-neutral-4,#e5e7eb); background:var(--pages-neutral-2,#f8f9fa);">
                <span style="font-size:12px; font-weight:600; color:var(--pages-neutral-11,#374151); text-transform:uppercase; letter-spacing:0.5px;">Properties</span>
              </div>
              <div style="padding:8px;">
                ${this._renderPropertyPanel()}
              </div>
            </div>
          ` : nothing}
          ${this._adapterResult?.degraded ? html`
            <div style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); background: var(--pages-warning-color, #f59e0b); color: #000; padding: 4px 12px; border-radius: 4px; font-size: 12px;">
              Property editing unavailable — ${this._adapterResult.degraded.reason}
            </div>
          ` : nothing}
        </div>
        ${this._showConflict ? this._renderConflictDialog() : nothing}
      </div>
    `;
  }
}
