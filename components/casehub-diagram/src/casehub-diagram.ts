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
import type { AdapterResult, CaseRuntimeState } from '@casehubio/graph-stencil-case';
import { toDecorations } from '@casehubio/graph-stencil-case';
import { computeElkLayout, toReactFlowGraph } from '@casehubio/graph-renderer';
import type { ElkLayoutResult } from '@casehubio/graph-renderer';
import type { Node, Edge } from '@xyflow/react';
import { edgesOf } from '@casehubio/graph-core';
import type { PersistenceBackend } from '@casehubio/graph-core';
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

const MAX_UNDO = 50;

@customElement('casehub-diagram')
export class CasehubDiagram extends LitElement {
  @property() yaml = '';
  @property() src = '';
  @property({ attribute: false }) schema: Record<string, unknown> = {};
  @property({ attribute: false }) backend: PersistenceBackend | null = null;
  @property() uri = '';
  @property({ attribute: false }) runtimeState: CaseRuntimeState | null = null;

  @state() private _nodes: Node[] = [];
  @state() private _edges: Edge[] = [];
  @state() private _error = '';
  @state() private _selectedNodeId = '';
  @state() private _selectedData: Record<string, unknown> = {};
  @state() private _selectedSchema: Record<string, unknown> = {};
  @state() private _saving = false;
  @state() private _showConflict = false;
  @state() private _confirmMessage = '';
  @state() private _mode: 'design' | 'runtime' = 'design';
  @state() private _staleSeconds = 0;

  private _currentYaml = '';
  private _savedYaml = '';
  private _version = '';
  private _adapterResult: AdapterResult | null = null;
  private _undoStack: string[] = [];
  private _redoStack: string[] = [];
  private _renderInProgress = false;
  private _pendingRenderYaml = '';
  private _lastLayout: ElkLayoutResult | undefined;
  private _conflictVersion = '';
  private _pendingConfirm: ((v: boolean) => void) | null = null;

  override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    registerCaseStencils();
    this.addEventListener('keydown', this._handleKeydown);
  }

  override disconnectedCallback(): void {
    this.removeEventListener('keydown', this._handleKeydown);
    super.disconnectedCallback();
  }

  override async updated(changed: Map<string, unknown>): Promise<void> {
    if (changed.has('yaml') && this.yaml) {
      this._currentYaml = this.yaml;
      this._savedYaml = this.yaml;
      this._undoStack = [];
      this._redoStack = [];
      this._selectedNodeId = '';
      await this._fullRender(this.yaml);
    }
    if (changed.has('src') && this.src) {
      try {
        const response = await fetch(this.src);
        const text = await response.text();
        this._currentYaml = text;
        this._savedYaml = text;
        this._undoStack = [];
        this._redoStack = [];
        this._selectedNodeId = '';
        await this._fullRender(text);
      } catch (e) {
        this._error = `Failed to fetch ${this.src}: ${e}`;
      }
    }
    if ((changed.has('backend') || changed.has('uri')) && this.backend && this.uri) {
      await this._load();
    }
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
          this._applyDecorations();
        }
      }
    }
  }

  private async _fullRender(yamlStr: string): Promise<void> {
    if (this._renderInProgress) {
      this._pendingRenderYaml = yamlStr;
      return;
    }
    this._renderInProgress = true;
    try {
      this._error = '';
      this._adapterResult = toGraph(yamlStr);
      this._lastLayout = await computeElkLayout(this._adapterResult.model, { direction: 'DOWN', spacing: 60 });
      const decorations = this._mode === 'runtime' && this.runtimeState ? toDecorations(this.runtimeState) : undefined;
      const { nodes, edges } = toReactFlowGraph(this._adapterResult.model, this._lastLayout, decorations);
      this._nodes = nodes;
      this._edges = edges;
    } catch (e) {
      this._error = String(e);
    } finally {
      this._renderInProgress = false;
      if (this._pendingRenderYaml && this._pendingRenderYaml !== yamlStr) {
        const pending = this._pendingRenderYaml;
        this._pendingRenderYaml = '';
        await this._fullRender(pending);
      } else {
        this._pendingRenderYaml = '';
      }
    }
  }

  private _updateWithoutLayout(yamlStr: string): void {
    try {
      this._error = '';
      this._adapterResult = toGraph(yamlStr);
      const decorations = this._mode === 'runtime' && this.runtimeState ? toDecorations(this.runtimeState) : undefined;
      const { nodes, edges } = toReactFlowGraph(this._adapterResult.model, this._lastLayout, decorations);
      this._nodes = nodes;
      this._edges = edges;
      this._updateSelectedNode();
    } catch (e) {
      this._error = `Edit failed: ${e}`;
      this._currentYaml = this._undoStack.pop() ?? this._currentYaml;
    }
  }

  private _updateSelectedNode(): void {
    if (!this._selectedNodeId || !this._adapterResult) {
      this._selectedData = {};
      this._selectedSchema = {};
      return;
    }
    const node = this._adapterResult.model.nodes.find(n => n.id === this._selectedNodeId);
    if (!node) {
      this._selectedNodeId = '';
      this._selectedData = {};
      this._selectedSchema = {};
      return;
    }
    this._selectedData = { ...node.properties };
    const defKey = SCHEMA_TYPE_MAP[node.type];
    if (defKey && this.schema.$defs) {
      this._selectedSchema = (this.schema.$defs as Record<string, Record<string, unknown>>)[defKey] ?? {};
    }
  }

  private _updateStaleness(): void {
    if (!this.runtimeState) { this._staleSeconds = 0; return; }
    const elapsed = Math.floor((Date.now() - new Date(this.runtimeState.timestamp).getTime()) / 1000);
    this._staleSeconds = Math.max(0, elapsed - 30);
  }

  private _applyDecorations(): void {
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
      this._applyDecorations();
    } else if (this._adapterResult) {
      const { nodes, edges } = toReactFlowGraph(this._adapterResult.model, this._lastLayout);
      this._nodes = nodes;
      this._edges = edges;
    }
  };

  private _handleNodeClick = (e: Event): void => {
    const detail = (e as CustomEvent<{ nodeId: string }>).detail;
    this._selectedNodeId = detail.nodeId;
    this._updateSelectedNode();
  };

  private _handleSelectionChange = (e: Event): void => {
    const detail = (e as CustomEvent<{ nodeIds: string[] }>).detail;
    if (detail.nodeIds.length === 0) {
      this._selectedNodeId = '';
      this._selectedData = {};
      this._selectedSchema = {};
    }
  };

  private _handlePropertyChange = (e: Event): void => {
    const detail = (e as CustomEvent<{ field: (string | number)[]; value: unknown }>).detail;
    if (!this._selectedNodeId || !this._adapterResult) return;

    const nodePath = this._adapterResult.yamlPaths.get(this._selectedNodeId);
    if (!nodePath) return;

    this._undoStack.push(this._currentYaml);
    if (this._undoStack.length > MAX_UNDO) this._undoStack.shift();
    this._redoStack = [];

    try {
      this._currentYaml = applyPropertyEdit(
        this._currentYaml,
        nodePath,
        detail.field,
        detail.value,
      );
      this._updateWithoutLayout(this._currentYaml);
    } catch (e) {
      this._currentYaml = this._undoStack.pop() ?? this._currentYaml;
      this._error = `Edit failed: ${e}`;
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

  private _handleDelete = async (): Promise<void> => {
    if (!this._selectedNodeId || !this._adapterResult) return;
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

    this._pushUndo();
    this._currentYaml = removeElement(this._currentYaml, nodePath);
    this._selectedNodeId = '';
    this._selectedData = {};
    this._selectedSchema = {};
    await this._fullRender(this._currentYaml);
  };

  private _confirmDeleteDialog(type: string, name: string, edgeCount: number): Promise<boolean> {
    return new Promise(resolve => {
      this._pendingConfirm = resolve;
      this._confirmMessage = type === 'worker'
        ? `Worker '${name}' has ${edgeCount} binding(s) dispatching to its capabilities. Those bindings will reference external capabilities after removal.`
        : `Remove ${type} '${name}'? It has ${edgeCount} connection(s).`;
      this.requestUpdate();
    });
  }

  private _pushUndo(): void {
    this._undoStack.push(this._currentYaml);
    if (this._undoStack.length > MAX_UNDO) this._undoStack.shift();
    this._redoStack = [];
  }

  private _handleKeydown = (e: KeyboardEvent): void => {
    const tag = (e.target as HTMLElement).tagName;
    const isTextInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;

    if (e.key === 'Escape') {
      this._selectedNodeId = '';
      this._selectedData = {};
      this._selectedSchema = {};
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isTextInput) {
      e.preventDefault();
      this._handleDelete();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this._undo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      this._redo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      this._save();
    }
  };

  private async _undo(): Promise<void> {
    if (this._undoStack.length === 0) return;
    this._redoStack.push(this._currentYaml);
    this._currentYaml = this._undoStack.pop()!;
    await this._fullRender(this._currentYaml);
    this._updateSelectedNode();
  }

  private async _redo(): Promise<void> {
    if (this._redoStack.length === 0) return;
    this._undoStack.push(this._currentYaml);
    this._currentYaml = this._redoStack.pop()!;
    await this._fullRender(this._currentYaml);
    this._updateSelectedNode();
  }

  private async _load(): Promise<void> {
    if (!this.backend || this._saving) return;
    try {
      const result = await this.backend.read(this.uri);
      if (result.status === 'ok') {
        this._currentYaml = result.yaml;
        this._savedYaml = result.yaml;
        this._version = result.version;
        this._undoStack = [];
        this._redoStack = [];
        this._selectedNodeId = '';
        await this._fullRender(result.yaml);
      } else if (result.status === 'not_found') {
        const empty = 'dsl: "1.0.0"
namespace: 
name: 
version: "1.0.0"
spec:
  bindings: []
  workers: []
';
        this._currentYaml = empty;
        this._savedYaml = empty;
        this._version = '';
        await this._fullRender(empty);
      } else if (result.status === 'parse_error') {
        this._error = result.message;
      } else if (result.status === 'schema_error') {
        this._currentYaml = result.yaml;
        this._savedYaml = result.yaml;
        this._version = result.version;
        await this._fullRender(result.yaml);
      }
    } catch (e) {
      this._error = `Load failed: ${e}`;
    }
  }

  private async _save(): Promise<void> {
    if (!this.backend || this._currentYaml === this._savedYaml || this._saving || this._renderInProgress) return;
    this._saving = true;
    this.requestUpdate();
    try {
      const result = await this.backend.write(this.uri, this._currentYaml, this._version);
      if (result.status === 'ok') {
        this._version = result.version;
        this._savedYaml = this._currentYaml;
      } else if (result.status === 'conflict') {
        this._conflictVersion = result.currentVersion;
        this._showConflict = true;
      }
    } catch (e) {
      this._error = `Save failed: ${e}`;
    } finally {
      this._saving = false;
      this.requestUpdate();
    }
  }

  private async _resolveConflict(action: 'overwrite' | 'reload' | 'cancel'): Promise<void> {
    this._showConflict = false;
    if (action === 'overwrite' && this.backend) {
      this._version = this._conflictVersion;
      await this._save();
    } else if (action === 'reload') {
      await this._load();
    }
    this.requestUpdate();
  }

  private _renderConflictDialog() {
    return html`
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 1000;">
        <div style="background: var(--pages-surface-color, #fff); padding: 20px; border-radius: 8px; max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          <div style="font-weight: 600; margin-bottom: 12px;">Conflict detected</div>
          <div style="font-size: 13px; margin-bottom: 16px;">The file was modified externally since your last load.</div>
          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button @click=${() => this._resolveConflict('cancel')}>Keep editing</button>
            <button @click=${() => this._resolveConflict('reload')}>Discard my changes</button>
            <button @click=${() => this._resolveConflict('overwrite')}>Save anyway</button>
          </div>
        </div>
      </div>
    `;
  }

  private _renderDeleteConfirm() {
    return html`
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 1000;">
        <div style="background: var(--pages-surface-color, #fff); padding: 20px; border-radius: 8px; max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          <div style="font-size: 13px; margin-bottom: 16px;">${this._confirmMessage}</div>
          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button @click=${() => { this._confirmMessage = ''; this._pendingConfirm?.(false); this.requestUpdate(); }}>Cancel</button>
            <button @click=${() => { this._confirmMessage = ''; this._pendingConfirm?.(true); this.requestUpdate(); }}>Remove</button>
          </div>
        </div>
      </div>
    `;
  }

  override render() {
    if (this._error) {
      return html`<div style="color: red; padding: 16px;">${this._error}</div>`;
    }
    const hasSelection = this._selectedNodeId !== '';
    const isExternal = hasSelection && this._adapterResult?.model.nodes.find(n => n.id === this._selectedNodeId)?.type === 'external';
    const isDirty = this._currentYaml !== this._savedYaml;

    return html`
      <div style="display: flex; flex-direction: column; width: 100%; height: 100%;">
        <casehub-diagram-toolbar
          ?hasBackend=${this.backend != null}
          ?dirty=${isDirty}
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
