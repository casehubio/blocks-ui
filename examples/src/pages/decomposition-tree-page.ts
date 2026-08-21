import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@casehubio/blocks-ui-blocks-decomposition-tree';
import type { DecompositionSnapshot, NodeStateSnapshot } from '@casehubio/graph-stencil-htn';
import mockData from '../../mock-data/decomposition.json';

@customElement('blocks-example-decomposition-tree')
export class DecompositionTreePage extends LitElement {
  @state() private _showStates = true;

  private _decomposition = mockData.decomposition as unknown as DecompositionSnapshot;
  private _nodeStates = mockData.nodeStates as Record<string, NodeStateSnapshot>;

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); margin-bottom: 8px; }
    p { color: var(--pages-neutral-11, #555); font-size: 14px; margin-bottom: 24px; }
    .controls { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
    .toggle { padding: 6px 14px; border-radius: 4px; border: 1px solid var(--pages-neutral-6, #ccc);
      background: var(--pages-neutral-1, #fff); cursor: pointer; font-size: 13px;
      color: var(--pages-neutral-11, #555); }
    .toggle.active { background: var(--pages-accent-9, #2563eb); color: white;
      border-color: var(--pages-accent-9, #2563eb); }
    .tree-container { border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 6px;
      background: var(--pages-neutral-1, #fff); padding: 16px; min-height: 400px; }
  `;

  override render() {
    return html`
      <h2>Decomposition Tree</h2>
      <p>HTN decomposition tree — recursive ARIA tree for CompoundTask → DecompositionMethod → children hierarchy.
        Strategy badges with colour coding, guard label display, and runtime status badges on leaf nodes.</p>
      <div class="controls">
        <button class="toggle ${this._showStates ? 'active' : ''}"
          @click=${() => { this._showStates = !this._showStates; }}>
          ${this._showStates ? 'Runtime States On' : 'Runtime States Off'}
        </button>
      </div>
      <div class="tree-container">
        <blocks-decomposition-tree
          .decomposition=${this._decomposition}
          .nodeStates=${this._showStates ? this._nodeStates : undefined}
          selectionTopic="demo-decomposition"
        ></blocks-decomposition-tree>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blocks-example-decomposition-tree': DecompositionTreePage;
  }
}
