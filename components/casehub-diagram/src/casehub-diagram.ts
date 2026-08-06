import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  toGraph,
  registerCaseStencils,
  applyPropertyEdit,
  addElement,
  removeElement,
  switchBindingTarget,
} from '@casehubio/graph-stencil-case';
import type { CaseRuntimeState } from '@casehubio/graph-stencil-case';
import { toDecorations } from '@casehubio/graph-stencil-case';
import { toReactFlowGraph } from '@casehubio/graph-renderer';
import type { ElkLayoutOptions } from '@casehubio/graph-renderer';
import type { NodeDecoration } from '@casehubio/graph-core';
import { edgesOf } from '@casehubio/graph-core';
import { DiagramBaseMixin } from '@casehubio/diagram-core';
import type { AdapterResult } from '@casehubio/diagram-core';
import '@casehubio/graph-renderer';
import './casehub-diagram-palette.js';
import './casehub-diagram-toolbar.js';
import './casehub-diagram-properties.js';

const SCHEMA_TYPE_MAP: Record<string, string> = {
  binding: 'Binding',
  worker: 'Worker',
  milestone: 'Milestone',
  goal: 'Goal',
  subcase: 'SubCase',
};

const PALETTE_TYPES = ['binding', 'worker', 'milestone', 'goal'];

const EMPTY_CASE_YAML = `dsl: "1.0.0"
namespace:
name:
version: "1.0.0"
spec:
  bindings: []
  workers: []
`;

@customElement('casehub-diagram')
export class CasehubDiagram extends DiagramBaseMixin(LitElement) {
  @property({ attribute: false }) runtimeState: CaseRuntimeState | null = null;

  @state() private _staleSeconds = 0;

  private _expandedWorkers = new Set<string>();
  private _expandDebounce: ReturnType<typeof setTimeout> | null = null;

  protected _adaptYaml(yaml: string): AdapterResult {
    return toGraph(yaml);
  }

  protected _applyPropertyEdit(
    yaml: string,
    nodePath: readonly (string | number)[],
    field: (string | number)[],
    value: unknown,
  ): string {
    return applyPropertyEdit(yaml, nodePath, field, value);
  }

  protected _schemaTypeMap(): Record<string, string> {
    return SCHEMA_TYPE_MAP;
  }

  protected _paletteTypes(): string[] {
    return PALETTE_TYPES;
  }

  protected _emptyTemplate(): string | null {
    return EMPTY_CASE_YAML;
  }

  protected _decorations(): ReadonlyMap<string, NodeDecoration> | undefined {
    if (this._mode === 'runtime' && this.runtimeState) {
      return toDecorations(this.runtimeState);
    }
    return undefined;
  }

  protected _layoutOptions(): ElkLayoutOptions {
    if (this._expandedWorkers.size === 0) {
      return { direction: 'DOWN', spacing: 60 };
    }
    const nodeSizes = new Map<string, { width: number; height: number }>();
    for (const id of this._expandedWorkers) {
      nodeSizes.set(id, { width: 320, height: 240 });
    }
    return { direction: 'DOWN', spacing: 60, nodeSizes };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    registerCaseStencils();
    this.addEventListener('worker-expand-toggle', this._handleWorkerExpand as EventListener);
  }

  override disconnectedCallback(): void {
    this.removeEventListener('worker-expand-toggle', this._handleWorkerExpand as EventListener);
    if (this._expandDebounce) clearTimeout(this._expandDebounce);
    super.disconnectedCallback();
  }

  private _handleWorkerExpand = (e: CustomEvent<{ workerId: string; expanded: boolean }>): void => {
    const { workerId, expanded } = e.detail;
    if (expanded) {
      this._expandedWorkers.add(workerId);
    } else {
      this._expandedWorkers.delete(workerId);
    }
    if (this._expandDebounce) clearTimeout(this._expandDebounce);
    this._expandDebounce = setTimeout(() => {
      this._expandDebounce = null;
      this._fullRender(this._currentYaml);
    }, 150);
  };

  override async updated(changed: Map<string, unknown>): Promise<void> {
    await super.updated(changed);
    if (changed.has('runtimeState')) {
      if (this.runtimeState === null) {
        this._mode = 'design';
        this._staleSeconds = 0;
        if (this._adapterResult) {
          const { nodes, edges } = toReactFlowGraph(this._adapterResult.model, this._lastLayout);
          this._nodes = nodes;
          this._edges = edges;
        }
      } else {
        this._updateStaleness();
        if (this._mode === 'runtime') {
          this._applyRuntimeDecorations();
        }
      }
    }
  }

  private _updateStaleness(): void {
    if (!this.runtimeState) { this._staleSeconds = 0; return; }
    const elapsed = Math.floor((Date.now() - new Date(this.runtimeState.timestamp).getTime()) / 1000);
    this._staleSeconds = Math.max(0, elapsed - 30);
  }

  private _applyRuntimeDecorations(): void {
    if (!this._adapterResult || !this.runtimeState) return;
    const decorations = toDecorations(this.runtimeState);
    const { nodes, edges } = toReactFlowGraph(this._adapterResult.model, this._lastLayout, decorations);
    this._nodes = nodes;
    this._edges = edges;
  }

  private _handleModeChange = (e: Event): void => {
    const detail = (e as CustomEvent<{ mode: 'design' | 'runtime' }>).detail;
    this._mode = detail.mode;
    if (this._mode === 'runtime' && this.runtimeState) {
      this._applyRuntimeDecorations();
    } else if (this._adapterResult) {
      const { nodes, edges } = toReactFlowGraph(this._adapterResult.model, this._lastLayout);
      this._nodes = nodes;
      this._edges = edges;
    }
  };

  private _handlePaletteAdd = async (e: Event): Promise<void> => {
    const detail = (e as CustomEvent<{ elementType: 'binding' | 'worker' | 'milestone' | 'goal' }>).detail;
    this._pushUndo();
    this._currentYaml = addElement(this._currentYaml, detail.elementType);
    await this._fullRender(this._currentYaml);
  };

  private _handleTargetTypeChange = async (e: Event): Promise<void> => {
    const detail = (e as CustomEvent<{ targetType: 'capability' | 'subCase' | 'humanTask' }>).detail;
    if (!this._selectedNodeId || !this._adapterResult) return;
    const nodePath = this._adapterResult.yamlPaths.get(this._selectedNodeId);
    if (!nodePath) return;
    this._pushUndo();
    this._currentYaml = switchBindingTarget(this._currentYaml, nodePath, detail.targetType);
    await this._fullRender(this._currentYaml);
    this._updateSelectedNode();
  };

  protected async _onDelete(): Promise<void> {
    if (!this._selectedNodeId || !this._adapterResult) return;
    if (this._confirmMessage) return;
    const node = this._adapterResult.model.nodes.find(n => n.id === this._selectedNodeId);
    if (!node || node.type === 'external') return;
    const nodePath = this._adapterResult.yamlPaths.get(this._selectedNodeId);
    if (!nodePath) return;

    const edges = edgesOf(this._adapterResult.model, this._selectedNodeId);
    if (edges.length > 0) {
      const name = String(node.properties['name'] ?? this._selectedNodeId);
      const confirmed = await this._confirmDeleteDialog(node.type, name, edges.length);
      if (!confirmed) return;
    }

    try {
      this._pushUndo();
      this._currentYaml = removeElement(this._currentYaml, nodePath);
      this._selectedNodeId = '';
      this._selectedData = {};
      this._selectedSchema = {};
      await this._fullRender(this._currentYaml);
    } catch (e) {
      this._error = `Delete failed: ${e}`;
    }
  }

  private _confirmDeleteDialog(type: string, name: string, edgeCount: number): Promise<boolean> {
    return new Promise(resolve => {
      this._pendingConfirm = resolve;
      this._confirmMessage = type === 'worker'
        ? `Worker '${name}' has ${edgeCount} binding(s) dispatching to its capabilities. Those bindings will reference external capabilities after removal.`
        : `Remove ${type} '${name}'? It has ${edgeCount} connection(s).`;
      this.requestUpdate();
    });
  }

  override render() {
    if (this._error) {
      return this._renderError();
    }
    const hasSelection = this._selectedNodeId !== '';
    const isExternal = hasSelection && this._adapterResult?.model.nodes.find(n => n.id === this._selectedNodeId)?.type === 'external';

    return html`
      <div style="display: flex; flex-direction: column; width: 100%; height: 100%;">
        <casehub-diagram-toolbar
          ?hasBackend=${this.backend != null}
          ?dirty=${this._isDirty}
          ?saving=${this._saving}
          ?runtimeAvailable=${this.runtimeState !== null}
          .mode=${this._mode}
          .staleSeconds=${this._staleSeconds}
          @toolbar-save=${() => this._save()}
          @toolbar-mode-change=${this._handleModeChange}
        ></casehub-diagram-toolbar>
        <div style="display: flex; flex: 1; overflow: hidden;">
          <casehub-diagram-palette
            @palette-add=${this._handlePaletteAdd}
          ></casehub-diagram-palette>
          <pages-graph-canvas
            .nodes=${this._nodes}
            .edges=${this._edges}
            style="flex: 1; height: 100%;"
            @pages-event=${(e: CustomEvent) => {
              const topic = e.detail?.topic as string | undefined;
              if (topic === 'graph:node-click') this._handleNodeClick(e);
              if (topic === 'graph:selection-change') this._handleSelectionChange(e);
            }}
          ></pages-graph-canvas>
          ${hasSelection ? html`
            <div style="width: 300px; border-left: 1px solid var(--pages-border-color, #ddd); overflow-y: auto;">
              <casehub-diagram-properties
                .schema=${this._selectedSchema}
                .data=${this._selectedData}
                ?readonly=${isExternal ?? false}
                @property-change=${this._handlePropertyChange}
                @target-type-change=${this._handleTargetTypeChange}
              ></casehub-diagram-properties>
            </div>
          ` : nothing}
        </div>
        ${this._showConflict ? this._renderConflictDialog() : nothing}
        ${this._confirmMessage ? this._renderDeleteConfirm() : nothing}
      </div>
    `;
  }
}
