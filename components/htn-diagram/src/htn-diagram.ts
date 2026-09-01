import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { htnYamlToGraph, registerHtnStencils } from '@casehubio/graph-stencil-htn';
import { DiagramBaseMixin } from '@casehubio/pages-diagram-core';
import type { AdapterResult } from '@casehubio/pages-diagram-core';
import '@casehubio/graph-renderer';

@customElement('htn-diagram')
export class HtnDiagram extends DiagramBaseMixin(LitElement) {
  @property({ attribute: 'layout-direction' })
  layoutDirection: 'DOWN' | 'RIGHT' = 'DOWN';

  override connectedCallback(): void {
    super.connectedCallback();
    this.style.display = 'block';
    this.style.width = '100%';
    this.style.height = '100%';
    registerHtnStencils();
  }

  protected _adaptYaml(yaml: string): AdapterResult {
    return htnYamlToGraph(yaml);
  }

  protected _applyPropertyEdit(
    yaml: string,
    _nodePath: readonly (string | number)[],
    _field: (string | number)[],
    _value: unknown,
  ): string {
    return yaml;
  }

  protected override _layoutOptions() {
    return { direction: this.layoutDirection, spacing: 60 };
  }

  protected _emptyTemplate(): string | null {
    return null;
  }

  override render() {
    if (this._error) return this._renderError();
    return html`
      <div style="display: flex; height: 100%; overflow: hidden;">
        <pages-graph-canvas
          .nodes=${this._nodes}
          .edges=${this._edges}
          role="img"
          aria-label="HTN decomposition diagram"
          style="flex: 1; height: 100%; min-width: 0;"
          @pages-event=${(e: CustomEvent) => {
            const topic = e.detail?.topic as string | undefined;
            if (topic === 'graph:node:click') this._handleNodeClick(e);
            if (topic === 'graph:selection:change') this._handleSelectionChange(e);
          }}
        ></pages-graph-canvas>
        ${this._selectedNodeId ? html`
          <div style="width:280px; border-left:1px solid var(--pages-neutral-4,#e5e7eb); overflow-y:auto; padding:8px;">
            ${this._renderPropertyPanel()}
          </div>
        ` : nothing}
      </div>
      ${this._showConflict ? this._renderConflictDialog() : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'htn-diagram': HtnDiagram;
  }
}
