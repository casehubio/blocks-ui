import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '@casehubio/blocks-ui-blocks-plan-item-tree';
import type { PlanItemDefinition } from '@casehubio/graph-stencil-htn';
import mockData from '../../mock-data/plan-item.json';

@customElement('blocks-example-plan-item-tree')
export class PlanItemTreePage extends LitElement {
  private _definition = mockData.definition as unknown as PlanItemDefinition;

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); margin-bottom: 8px; }
    p { color: var(--pages-neutral-11, #555); font-size: 14px; margin-bottom: 24px; }
    .tree-container { border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 6px;
      background: var(--pages-neutral-1, #fff); padding: 16px; min-height: 400px; }
  `;

  override render() {
    return html`
      <h2>Plan Item Tree</h2>
      <p>PlanItemDefinition tree — recursive ARIA tree showing primitive and compound plan items.
        CompletionSemantics badges (All / M-of-N / FirstWins), DispatchMode pills
        (ORCHESTRATED / CHOREOGRAPHED), repeatable indicators, and entry/exit conditions.</p>
      <div class="tree-container">
        <blocks-plan-item-tree .definition=${this._definition}></blocks-plan-item-tree>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blocks-example-plan-item-tree': PlanItemTreePage;
  }
}
