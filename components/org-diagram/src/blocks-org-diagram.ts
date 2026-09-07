import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import {
  toOrgGraph,
  registerOrgStencils,
  applyOrgPropertyEdit,
  addOrgUnit,
  removeOrgUnit,
  addMember,
  addRelationship,
  removeRelationship,
  removeMember,
  createOrgEditPolicy,
  detectArchetype,
  orgLayoutOptions,
} from '@casehubio/graph-stencil-org';
import { computeRadialLayout } from '../../../packages/graph-stencil-org/src/layout/radial-layout.js';
import type {
  OrgAdapterResult,
  ArchetypeHint,
  OrgLayoutStrategy,
} from '@casehubio/graph-stencil-org';
import { toReactFlowGraph, computeElkLayout, validateEdgeRouting } from '@casehubio/graph-renderer';
import type { ElkLayoutOptions, ElkLayoutResult, EditPolicy, GraphEdit } from '@casehubio/graph-renderer';
import { emitPagesEvent } from '@casehubio/pages-data';
import { DiagramBaseMixin } from '@casehubio/pages-diagram-core';
import type { AdapterResult } from '@casehubio/pages-diagram-core';
import '@casehubio/graph-renderer';
import '@casehubio/pages-diagram-palette';
import './blocks-org-diagram-toolbar.js';

const orgEditPolicy = createOrgEditPolicy();

const EMPTY_ORG_YAML = `organization:
  units:
    - unitId: unit-1
      name: New Unit
      tenancyId: default
      members: []
      capabilities: []
      goals: []
      constraints: []
  relationships: []
`;

function orgMiniMapNodeColor(node: { type?: string }): string {
  switch (node.type) {
    case 'org-unit':  return '#6366f1';  // indigo-500 — matches unit border
    case 'org-agent': return '#6b7280';  // gray-500 — matches agent icon
    default:          return '#2563eb';  // blue-600
  }
}

function orgIconRenderer(icon: string): TemplateResult {
  if (icon === '□') {
    return html`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#6366f1" stroke-width="1.5">${unsafeSVG('<rect x="3" y="3" width="14" height="14" rx="2"/>')}</svg>`;
  }
  if (icon === '●') {
    return html`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#6b7280" stroke-width="1.5">${unsafeSVG('<circle cx="10" cy="7" r="3.5"/><path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6"/>')}</svg>`;
  }
  return html`<span style="width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;">${icon}</span>`;
}

@customElement('blocks-org-diagram')
export class BlocksOrgDiagram extends DiagramBaseMixin(LitElement) {
  @property({ attribute: 'selection-topic' }) selectionTopic = '';
  @property() layoutStrategy: OrgLayoutStrategy | 'auto' = 'auto';

  @state() private _archetypeHint: ArchetypeHint | null = null;
  @state() private _paletteOpen = true;
  @state() private _propertiesOpen = true;
  @state() private _chooserState: { x: number; y: number; sourceNodeId?: string | undefined } | null = null;
  private _lastPointerX = 0;
  private _lastPointerY = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    registerOrgStencils();
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', 'Organization diagram editor');
  }

  protected _adaptYaml(yaml: string): AdapterResult {
    const result = toOrgGraph(yaml);
    this._archetypeHint = detectArchetype(result.model);
    return result;
  }

  protected _applyPropertyEdit(
    yaml: string,
    nodePath: readonly (string | number)[],
    field: (string | number)[],
    value: unknown,
  ): string {
    return applyOrgPropertyEdit(yaml, nodePath, field, value);
  }

  protected _emptyTemplate(): string | null {
    return EMPTY_ORG_YAML;
  }

  protected override _editPolicy(): EditPolicy {
    return orgEditPolicy;
  }

  protected override _iconRenderer() {
    return orgIconRenderer;
  }

  override _paletteItems() {
    const policy = this._editPolicy();
    if (!policy || !this._adapterResult) return [];
    const model = this._adapterResult.model;
    const nearNode = this._selectedNodeId
      ? model.nodes.find(n => n.id === this._selectedNodeId) ?? null
      : null;
    return policy.getCreatableTypes(nearNode, model)
      .map(s => ({ type: s.type, label: s.label, icon: s.icon }));
  }

  override _renderStencilPalette(): TemplateResult {
    const items = this._paletteItems();
    if (items.length === 0) return html``;
    return html`
      <pages-diagram-palette
        .items=${items}
        .iconRenderer=${this._iconRenderer()}
        paletteId=${this.tagName.toLowerCase()}
        @pages-palette-select=${this._onOrgPaletteSelect}>
      </pages-diagram-palette>
    `;
  }

  private _onOrgPaletteSelect = (e: CustomEvent): void => {
    const nodeType = e.detail?.item?.type as string | undefined;
    if (!nodeType || !this._adapterResult) return;
    if (nodeType === 'org-agent' && this._selectedNodeId) {
      const selectedNode = this._adapterResult.model.nodes.find(n => n.id === this._selectedNodeId);
      if (selectedNode?.type === 'org-unit') {
        this._handleMutation({ type: 'addNode', nodeType, properties: { parentUnitId: selectedNode.properties['unitId'] as string } });
        return;
      }
    }
    this._handleMutation({ type: 'addNode', nodeType });
  };

  private _onCanvasPointerDown = (e: PointerEvent): void => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this._lastPointerX = e.clientX - rect.left;
    this._lastPointerY = e.clientY - rect.top;
  };

  private _onPaneClick = (): void => {
    if (this.readonly) return;
    this._chooserState = { x: this._lastPointerX, y: this._lastPointerY };
  };

  private _onConnectEndOnEmpty = (payload: { sourceNodeId?: string }): void => {
    if (this.readonly) return;
    this._chooserState = {
      x: this._lastPointerX,
      y: this._lastPointerY,
      sourceNodeId: payload?.sourceNodeId,
    };
  };

  private _chooserItems() {
    const policy = this._editPolicy();
    if (!policy || !this._adapterResult) return [];
    const model = this._adapterResult.model;
    let nearNode = this._selectedNodeId
      ? model.nodes.find(n => n.id === this._selectedNodeId) ?? null
      : null;
    if (!nearNode && this._chooserState?.sourceNodeId) {
      const src = model.nodes.find(n => n.id === this._chooserState!.sourceNodeId);
      if (src?.parentId) {
        nearNode = model.nodes.find(n => n.id === src.parentId) ?? null;
      }
    }
    return policy.getCreatableTypes(nearNode, model)
      .map(s => ({ type: s.type, label: s.label, icon: s.icon }));
  }

  private _onChooserSelect = (e: CustomEvent): void => {
    const nodeType = e.detail?.item?.type as string | undefined;
    if (!nodeType || !this._adapterResult || !this._chooserState) return;
    const { sourceNodeId } = this._chooserState;
    if (nodeType === 'org-agent') {
      let unitId: string | undefined;
      if (this._selectedNodeId) {
        const sel = this._adapterResult.model.nodes.find(n => n.id === this._selectedNodeId);
        if (sel?.type === 'org-unit') unitId = sel.properties['unitId'] as string;
      }
      if (!unitId && sourceNodeId) {
        const src = this._adapterResult.model.nodes.find(n => n.id === sourceNodeId);
        if (src?.parentId) {
          const parent = this._adapterResult.model.nodes.find(n => n.id === src.parentId);
          if (parent?.type === 'org-unit') unitId = parent.properties['unitId'] as string;
        }
      }
      if (!unitId) return;
      this._handleMutation({ type: 'addNode', nodeType, properties: { parentUnitId: unitId } });
    } else {
      this._handleMutation({ type: 'addNode', nodeType });
    }
    this._chooserState = null;
  };

  private _onChooserDismiss = (): void => {
    this._chooserState = null;
  };

  private _buildElkOpts(strategy: OrgLayoutStrategy): ElkLayoutOptions {
    const orgOpts = orgLayoutOptions(strategy);
    const opts: ElkLayoutOptions = {
      algorithm: orgOpts.algorithm,
      spacing: orgOpts.spacing,
      headerHeight: 48,
    };
    if (orgOpts.direction !== undefined) opts.direction = orgOpts.direction;
    if (orgOpts.containerPadding !== undefined) opts.containerPadding = orgOpts.containerPadding;
    if (orgOpts.elkOptions !== undefined) opts.elkOptions = orgOpts.elkOptions;
    return opts;
  }

  protected override _layoutOptions(): ElkLayoutOptions {
    const strategy = this.layoutStrategy === 'auto'
      ? (this._archetypeHint?.layout ?? 'force')
      : this.layoutStrategy;
    return this._buildElkOpts(strategy);
  }

  private _autoLayoutCandidates(): OrgLayoutStrategy[] {
    const primary = this._archetypeHint?.layout ?? 'force';
    const ALL: OrgLayoutStrategy[] = ['hub-spoke', 'star', 'tree', 'layered', 'force', 'flow', 'circular', 'nested', 'radial', 'grid'];
    return [primary, ...ALL.filter(s => s !== primary)];
  }

  override async _fullRender(yamlStr: string): Promise<void> {
    if ((this as any)._renderInProgress) {
      (this as any)._pendingRenderYaml = yamlStr;
      return;
    }
    (this as any)._renderInProgress = true;
    try {
      (this as any)._error = '';
      const result = this._adaptYaml(yamlStr);
      (this as any)._adapterResult = result;

      let bestLayout: ElkLayoutResult | undefined;
      let bestOpts: ElkLayoutOptions | undefined;
      let bestViolations = Infinity;
      let bestTotalDist = Infinity;

      if (this.layoutStrategy === 'auto') {
        const scoreLayout = (layout: ElkLayoutResult, dir?: string) => {
          const { nodes, edges } = toReactFlowGraph(result.model, layout, this._decorations(), dir);
          const validation = validateEdgeRouting(nodes, edges);
          const violations = validation.violations.length;
          const totalDist = edges.reduce((sum, e) => {
            const sn = nodes.find(n => n.id === e.source);
            const tn = nodes.find(n => n.id === e.target);
            if (!sn || !tn) return sum;
            return sum + Math.sqrt((sn.position.x - tn.position.x) ** 2 + (sn.position.y - tn.position.y) ** 2);
          }, 0);
          return { violations, totalDist };
        };

        const tryLayout = (layout: ElkLayoutResult, opts: ElkLayoutOptions, dir?: string) => {
          const { violations, totalDist } = scoreLayout(layout, dir);
          if (violations < bestViolations || (violations === bestViolations && totalDist < bestTotalDist)) {
            bestViolations = violations;
            bestTotalDist = totalDist;
            bestLayout = layout;
            bestOpts = opts;
          }
        };

        if (this._archetypeHint?.layout === 'hub-spoke' || this._archetypeHint?.layout === 'circular') {
          try {
            const radialLayout = computeRadialLayout(result.model);
            const radialOpts: ElkLayoutOptions = { spacing: 120 };
            tryLayout(radialLayout, radialOpts);
          } catch { /* skip */ }
        }

        if (bestViolations > 0 || !bestLayout) {
          const candidates = this._autoLayoutCandidates();
          for (const strategy of candidates) {
            const opts = this._buildElkOpts(strategy);
            try {
              const layout = await computeElkLayout(result.model, opts);
              const dir = opts.direction ?? (['layered', 'mrtree'].includes(opts.algorithm ?? '') ? 'DOWN' : undefined);
              tryLayout(layout, opts, dir);
              if (bestViolations === 0) break;
            } catch { /* skip failing algorithm */ }
          }
        }
      }

      if (!bestLayout || !bestOpts) {
        bestOpts = this._layoutOptions();
        bestLayout = await computeElkLayout(result.model, bestOpts);
      }

      if ((this as any)._adapterResult !== result) {
        (this as any)._renderInProgress = false;
        await this._fullRender((this as any)._currentYaml);
        return;
      }
      (this as any)._lastLayout = bestLayout;
      const dir = bestOpts.direction ?? (['layered', 'mrtree'].includes(bestOpts.algorithm ?? '') ? 'DOWN' : undefined);
      const { nodes, edges } = toReactFlowGraph(result.model, bestLayout, this._decorations(), dir);
      (this as any)._nodes = nodes;
      (this as any)._edges = edges;
    } catch (e) {
      (this as any)._error = String(e);
    } finally {
      (this as any)._renderInProgress = false;
      if ((this as any)._pendingRenderYaml && (this as any)._pendingRenderYaml !== yamlStr) {
        const pending = (this as any)._pendingRenderYaml;
        (this as any)._pendingRenderYaml = '';
        await this._fullRender(pending);
      } else {
        (this as any)._pendingRenderYaml = '';
      }
    }
  }

  protected override _applyGraphEdit(yaml: string, edit: GraphEdit): string {
    switch (edit.type) {
      case 'addNode': {
        if (edit.nodeType === 'org-unit') {
          const parentUnitId = edit.properties?.['parentUnitId'] as string | undefined;
          return addOrgUnit(yaml, parentUnitId !== undefined ? { parentUnitId } : undefined);
        }
        if (edit.nodeType === 'org-agent') {
          const parentUnitId = edit.properties?.['parentUnitId'] as string | undefined;
          if (!parentUnitId || !this._adapterResult) {
            throw new Error('Cannot add agent without selecting a unit');
          }
          const unitPath = this._adapterResult.yamlPaths.get(`unit:${parentUnitId}`);
          if (!unitPath) throw new Error(`No YAML path for unit ${parentUnitId}`);
          return addMember(yaml, unitPath, { agentId: `agent-${Date.now()}` });
        }
        throw new Error(`Unknown node type: ${edit.nodeType}`);
      }
      case 'removeNode': {
        const nodePath = this._adapterResult?.yamlPaths.get(edit.nodeId);
        if (!nodePath) throw new Error(`No YAML path for node ${edit.nodeId}`);
        if (edit.nodeId.startsWith('unit:')) {
          return removeOrgUnit(yaml, nodePath);
        }
        const parts = edit.nodeId.split(':');
        const unitId = parts[1];
        if (unitId === undefined) throw new Error(`Cannot parse node ID: ${edit.nodeId}`);
        const memberIndex = nodePath[nodePath.length - 1] as number;
        const unitPath = nodePath.slice(0, -2);
        return removeMember(yaml, unitPath, memberIndex);
      }
      case 'addEdge': {
        const sourceNode = this._adapterResult?.model.nodes.find(n => n.id === edit.sourceId);
        const targetNode = this._adapterResult?.model.nodes.find(n => n.id === edit.targetId);
        if (!sourceNode || !targetNode) throw new Error('Source or target node not found');
        const tenancyId = (sourceNode.properties['unitId'] as string) !== undefined
          ? this._findTenancyId()
          : 'default';
        return addRelationship(yaml, {
          sourceAgentId: sourceNode.properties['agentId'] as string,
          targetAgentId: targetNode.properties['agentId'] as string,
          kind: 'SUPERVISES',
          tenancyId,
        });
      }
      case 'removeEdge': {
        const edgePath = this._adapterResult?.yamlPaths.get(edit.edgeId);
        if (!edgePath) throw new Error(`No YAML path for edge ${edit.edgeId}`);
        return removeRelationship(yaml, edgePath);
      }
      case 'reconnectEdge':
        throw new Error('reconnectEdge — not yet implemented');
      default:
        throw new Error(`Unsupported edit type: ${(edit as GraphEdit).type}`);
    }
  }

  private _findTenancyId(): string {
    if (!this._adapterResult) return 'default';
    const unit = this._adapterResult.model.nodes.find(n => n.type === 'org-unit');
    return (unit?.properties['tenancyId'] as string | undefined) ?? 'default';
  }

  private _computeStats() {
    if (!this._adapterResult) return { units: 0, agents: 0, rels: 0 };
    const nodes = this._adapterResult.model.nodes;
    return {
      units: nodes.filter(n => n.type === 'org-unit').length,
      agents: nodes.filter(n => n.type === 'org-agent').length,
      rels: this._adapterResult.model.edges.length,
    };
  }

  private _onNodeClick(nodeId: string): void {
    if (!this.selectionTopic) return;
    const node = this._adapterResult?.model.nodes.find(n => n.id === nodeId);
    emitPagesEvent(this, this.selectionTopic, {
      nodeId,
      nodeType: node?.type ?? '',
      properties: node?.properties ?? {},
    });
  }

  private _onLayoutChange(e: CustomEvent<{ strategy: OrgLayoutStrategy | 'auto' }>): void {
    this.layoutStrategy = e.detail.strategy;
    if (this._adapterResult) {
      this._fullRender(this._currentYaml);
    }
  }

  private _renderDockHeader(title: string, side: 'left' | 'right') {
    const close = () => {
      if (side === 'left') this._paletteOpen = !this._paletteOpen;
      else this._propertiesOpen = !this._propertiesOpen;
    };
    return html`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:3px 6px;border-bottom:1px solid var(--pages-neutral-4,#e5e7eb);background:var(--pages-neutral-2,#f8f9fa);">
        <span style="font-size:11px;font-weight:600;color:var(--pages-neutral-11,#374151);text-transform:uppercase;letter-spacing:0.5px;">${title}</span>
        <button @click=${close}
          style="border:none;background:none;cursor:pointer;font-size:13px;color:var(--pages-neutral-9,#6b7280);padding:0 2px;line-height:1;"
          aria-label=${`Close ${title} panel`}>&times;</button>
      </div>`;
  }

  private _renderCollapsedDock(title: string, icon: string, side: 'left' | 'right') {
    const toggle = () => {
      if (side === 'left') this._paletteOpen = true;
      else this._propertiesOpen = true;
    };
    return html`
      <div style="width:28px;display:flex;flex-direction:column;align-items:center;border-${side === 'left' ? 'right' : 'left'}:1px solid var(--pages-neutral-4,#e5e7eb);background:var(--pages-neutral-2,#f8f9fa);padding-top:8px;">
        <button @click=${toggle}
          style="border:none;background:none;cursor:pointer;padding:4px;color:var(--pages-neutral-9,#6b7280);font-size:14px;writing-mode:vertical-rl;text-orientation:mixed;letter-spacing:1px;"
          aria-label=${`Open ${title} panel`}>${icon} ${title}</button>
      </div>`;
  }

  override render() {
    if (this._error) return this._renderError();

    const stats = this._computeStats();
    const hasSelection = this._selectedNodeId !== '';

    return html`
      <div style="display:flex;flex-direction:column;width:100%;height:100%;">
        <blocks-org-diagram-toolbar
          ?hasBackend=${this.backend != null}
          ?dirty=${this._isDirty}
          ?saving=${this._saving}
          .archetype=${this._archetypeHint?.archetype ?? null}
          .confidence=${this._archetypeHint?.confidence ?? 'low'}
          .layoutStrategy=${this.layoutStrategy}
          .unitCount=${stats.units}
          .agentCount=${stats.agents}
          .relationshipCount=${stats.rels}
          @toolbar-save=${() => this._save()}
          @toolbar-layout-change=${this._onLayoutChange}
          @toolbar-export=${(e: CustomEvent<{ format: 'svg' | 'png' }>) => this._exportDiagram(e.detail.format)}
        ></blocks-org-diagram-toolbar>
        <div style="display:flex;flex:1;overflow:hidden;">
          ${this._paletteOpen ? html`
            <div style="border-right:1px solid var(--pages-neutral-4,#e5e7eb);display:flex;flex-direction:column;overflow-y:auto;flex-shrink:0;">
              ${this._renderDockHeader('Stencils', 'left')}
              <div style="padding:2px 4px;">
                ${this._renderStencilPalette()}
              </div>
            </div>
          ` : this._renderCollapsedDock('Stencils', '⊞', 'left')}
          <div style="position:relative;flex:1;height:100%;min-width:0;" @pointerdown=${this._onCanvasPointerDown}>
            <pages-graph-canvas
              .nodes=${this._nodes}
              .edges=${this._edges}
              .editPolicy=${this._editPolicy()}
              .onMutation=${this._handleMutation}
              .miniMapNodeColor=${orgMiniMapNodeColor}
              role="img"
              aria-label=${`Organization diagram: ${stats.units} units, ${stats.agents} agents, ${stats.rels} relationships`}
              style="width:100%;height:100%;"
              @pages-event=${(e: CustomEvent) => {
                const topic = e.detail?.topic as string | undefined;
                const payload = e.detail?.payload ?? e.detail;
                if (topic === 'graph:node:click') this._handleNodeClick(e);
                if (topic === 'graph:selection:change') this._handleSelectionChange(e);
                if (topic === 'graph:pane:click') this._onPaneClick();
                if (topic === 'graph:connect:end-on-empty') this._onConnectEndOnEmpty(payload);
              }}
            ></pages-graph-canvas>
            ${this._chooserState ? html`
              <div style="position:absolute;left:${this._chooserState.x}px;top:${this._chooserState.y}px;z-index:10;">
                <pages-node-chooser
                  .items=${this._chooserItems()}
                  .iconRenderer=${this._iconRenderer()}
                  @pages-palette-select=${this._onChooserSelect}
                  @pages-chooser-dismiss=${this._onChooserDismiss}
                ></pages-node-chooser>
              </div>
            ` : nothing}
          </div>
          ${this._propertiesOpen ? html`
            <div style="width:300px;border-left:1px solid var(--pages-neutral-4,#e5e7eb);display:flex;flex-direction:column;overflow-y:auto;flex-shrink:0;">
              ${this._renderDockHeader('Properties', 'right')}
              ${hasSelection ? html`
                <div style="padding:8px;">
                  ${this._renderPropertyPanel()}
                </div>
              ` : html`
                <div style="padding:12px;color:var(--pages-neutral-8,#9ca3af);font-size:12px;font-style:italic;">
                  Click a node to view its properties
                </div>
              `}
            </div>
          ` : this._renderCollapsedDock('Properties', '☰', 'right')}
        </div>
        ${this._showConflict ? this._renderConflictDialog() : nothing}
        ${this._confirmMessage ? this._renderDeleteConfirm() : nothing}
      </div>
    `;
  }
}
