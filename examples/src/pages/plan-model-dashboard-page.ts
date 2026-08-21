import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '@casehubio/blocks-ui-blocks-plan-model-dashboard';
import type { CasePlanModelSnapshot } from '@casehubio/graph-stencil-htn';
import mockData from '../../mock-data/plan-model.json';

@customElement('blocks-example-plan-model-dashboard')
export class PlanModelDashboardPage extends LitElement {
  private _planModel = mockData.planModel as unknown as CasePlanModelSnapshot;

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); margin-bottom: 8px; }
    p { color: var(--pages-neutral-11, #555); font-size: 14px; margin-bottom: 24px; }
    .dashboard-container { border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 6px;
      background: var(--pages-neutral-1, #fff); padding: 16px; }
  `;

  override render() {
    return html`
      <h2>Plan Model Dashboard</h2>
      <p>CasePlanModel dashboard — card-based grid showing agenda table with status badges,
        focus area with rationale, resource budget, sub-case list, and compound definition progress bars.</p>
      <div class="dashboard-container">
        <blocks-plan-model-dashboard .planModel=${this._planModel}></blocks-plan-model-dashboard>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blocks-example-plan-model-dashboard': PlanModelDashboardPage;
  }
}
