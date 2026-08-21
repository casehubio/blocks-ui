import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { onPagesEvent } from '@casehubio/blocks-ui-core';
import { stringify } from 'yaml';
import type { CaseRuntimeState } from '@casehubio/graph-stencil-case';
import type { CasehubDiagram } from '@casehubio/blocks-ui-casehub-diagram';
import '@casehubio/blocks-ui-split-workbench';
import '@casehubio/blocks-ui-casehub-diagram';
import '@casehubio/blocks-ui-swf-diagram';

interface SelectedWorker {
  name: string;
  yaml: string;
}

@customElement('blocks-diagram-workbench')
export class DiagramWorkbench extends LitElement {
  @property() yaml = '';
  @property() src = '';
  @property({ attribute: false }) runtimeState: CaseRuntimeState | null = null;

  @state() private _selectedWorker: SelectedWorker | null = null;

  private _unsubs: Array<() => void> = [];

  static override styles = css`
    :host { display: block; height: 100%; font-family: var(--pages-font-family, system-ui); }
    blocks-split-workbench { height: 100%; }
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
      onPagesEvent(this, 'diagram:worker-drill-down', (payload: unknown) => {
        const p = payload as { workerName: string; doYaml: string };
        this._selectedWorker = { name: p.workerName, yaml: p.doYaml };
      }),
      onPagesEvent(this, 'graph:node:click', (payload: unknown) => {
        const p = payload as { nodeId: string; nodeType: string };
        if (!p.nodeId.startsWith('worker:')) return;
        const caseDiag = this.renderRoot.querySelector('casehub-diagram') as CasehubDiagram | null;
        const props = caseDiag?.getNodeProperties(p.nodeId);
        const doBlock = props?.do;
        if (!doBlock) return;
        const name = String(props.name ?? p.nodeId.replace('worker:', ''));
        const doYaml = stringify({ document: { dsl: '1.0.0', namespace: 'embedded', name: 'worker-do', version: '1.0.0' }, do: doBlock });
        this._selectedWorker = { name, yaml: doYaml };
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
    this._selectedWorker = null;
  }

  override render(): TemplateResult {
    return html`
      <blocks-split-workbench selection-topic="diagram">
        <div slot="list" class="case-panel">
          <casehub-diagram
            .yaml=${this.yaml}
            .src=${this.src}
            .runtimeState=${this.runtimeState}
          ></casehub-diagram>
        </div>
        <div slot="detail" class="swf-panel">
          ${this._selectedWorker
            ? html`
              <div class="worker-header">
                <span>${this._selectedWorker.name}</span>
                <button @click=${() => this._clearSelection()} title="Close">✕</button>
              </div>
              <swf-diagram
                .yaml=${this._selectedWorker.yaml}
                layout-direction="RIGHT"
              ></swf-diagram>`
            : html`<div class="empty">Click ⤢ on a worker to inspect its workflow</div>`}
        </div>
      </blocks-split-workbench>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blocks-diagram-workbench': DiagramWorkbench;
  }
}
