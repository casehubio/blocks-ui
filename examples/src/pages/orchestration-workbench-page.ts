import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '@casehubio/blocks-ui-orchestration-workbench';
import mockData from '../../mock-data/execution.json';

@customElement('blocks-example-orchestration-workbench')
export class OrchestrationWorkbenchPage extends LitElement {
  private _data = mockData as unknown as { snapshot: unknown; events: unknown[] };

  static override styles = css`
    :host { display: flex; flex-direction: column; height: 100%; padding: 24px; box-sizing: border-box; }
    h2 { font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); margin-bottom: 8px; }
    p { color: var(--pages-neutral-11, #555); font-size: 14px; margin-bottom: 24px; }
    .workbench-container { flex: 1; min-height: 0; border: 1px solid var(--pages-neutral-5, #e0e0e0);
      border-radius: 6px; overflow: hidden; }
  `;

  override render() {
    return html`
      <h2>Orchestration Workbench</h2>
      <p>Composes execution-monitor (left) and blocks-timeline with orchestration-events strategy (right)
        in a split-workbench. Selection coordination between agent roster and audit event timeline.
        Shows the full claim adjudication execution with 17 audit events.</p>
      <div class="workbench-container">
        <blocks-orchestration-workbench .data=${this._data} selectionTopic="demo-orchestration">
        </blocks-orchestration-workbench>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'blocks-example-orchestration-workbench': OrchestrationWorkbenchPage; }
}
