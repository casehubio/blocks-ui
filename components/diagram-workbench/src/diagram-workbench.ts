import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import { customElement, property, state } from 'lit/decorators.js';
import { onPagesEvent } from '@casehubio/pages-data';
import type { CaseRuntimeState } from '@casehubio/graph-stencil-case';

import '@casehubio/pages-ui-components/split-workbench';
import '@casehubio/blocks-ui-casehub-diagram';
import '@casehubio/blocks-ui-swf-diagram';

const DIAGRAM_TAGS: Record<string, string> = {
  swf: 'swf-diagram',
  case: 'casehub-diagram',
};

interface DrillDownState {
  name: string;
  yaml: string;
  diagramType: string;
}

@customElement('blocks-diagram-workbench')
export class DiagramWorkbench extends LitElement {
  @property() yaml = '';
  @property() src = '';
  @property({ attribute: false }) runtimeState: CaseRuntimeState | null = null;

  @state() private _drillDown: DrillDownState | null = null;

  private _unsubs: Array<() => void> = [];

  static override styles = css`
    :host { display: block; height: 100%; font-family: var(--pages-font-family, system-ui); }
    pages-split-workbench { height: 100%; }
    .case-panel { height: 100%; overflow: hidden; }
    casehub-diagram { width: 100%; height: 100%; }
    .swf-panel { height: 100%; display: flex; flex-direction: column; }
    .worker-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; border-bottom: 1px solid var(--pages-border-color, #333);
      background: var(--pages-neutral-3, #2a2a2a); font-weight: 600; font-size: 14px;
      color: var(--pages-text-primary, #e5e5e5);
    }
    .worker-header button {
      border: none; background: none; cursor: pointer; font-size: 16px;
      color: var(--pages-text-secondary, #999); padding: 2px 6px; border-radius: 4px;
    }
    .worker-header button:hover { background: var(--pages-neutral-4, #3a3a3a); }
    swf-diagram { flex: 1; min-height: 0; }
    .empty {
      display: flex; align-items: center; justify-content: center;
      height: 100%; color: var(--pages-text-tertiary, #999); font-style: italic;
    }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', 'Diagram workbench');
    this._unsubs.push(
      onPagesEvent(this, 'diagram:drill-down:resolved', (payload: unknown) => {
        const p = payload as { name: string; yaml: string; diagramType: string };
        this._drillDown = { name: p.name, yaml: p.yaml, diagramType: p.diagramType };
      }),
    );
  }

  override disconnectedCallback(): void {
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
    super.disconnectedCallback();
  }

  configure(props: Record<string, unknown>): void {
    if (props.yaml !== undefined) this.yaml = props.yaml as string;
    if (props.src !== undefined) this.src = props.src as string;
  }

  private _clearSelection(): void {
    this._drillDown = null;
  }

  private _renderDrillDown(): TemplateResult | typeof nothing {
    if (!this._drillDown) return nothing;
    const tag = DIAGRAM_TAGS[this._drillDown.diagramType];
    if (!tag) {
      return html`<div class="empty">Unknown diagram type: ${this._drillDown.diagramType}</div>`;
    }
    const tagLiteral = unsafeStatic(tag);
    return staticHtml`
      <${tagLiteral}
        .yaml=${this._drillDown.yaml}
        layout-direction="RIGHT">
      </${tagLiteral}>
    `;
  }

  override render(): TemplateResult {
    if (!this._drillDown) {
      return html`
        <div class="case-panel">
          <casehub-diagram
            .yaml=${this.yaml}
            .src=${this.src}
            .runtimeState=${this.runtimeState}
          ></casehub-diagram>
        </div>
      `;
    }

    return html`
      <pages-split-workbench selection-topic="diagram">
        <div slot="list" class="case-panel">
          <casehub-diagram
            .yaml=${this.yaml}
            .src=${this.src}
            .runtimeState=${this.runtimeState}
          ></casehub-diagram>
        </div>
        <div slot="detail" class="swf-panel">
          <div class="worker-header">
            <span>${this._drillDown.name}</span>
            <button @click=${() => this._clearSelection()} title="Close">✕</button>
          </div>
          ${this._renderDrillDown()}
        </div>
      </pages-split-workbench>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blocks-diagram-workbench': DiagramWorkbench;
  }
}
