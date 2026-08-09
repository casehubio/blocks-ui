import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { registerRelationshipType } from '@casehubio/blocks-ui-core';
import '../../../components/case-dependency-graph/src/blocks-case-dependency-graph.js';
import type { GraphModel } from '@casehubio/graph-core';

registerRelationshipType('blocks', {
  color: '#ef4444', style: 'solid', directed: true, label: 'Blocks',
});
registerRelationshipType('relates_to', {
  color: '#3b82f6', style: 'dotted', directed: false, label: 'Relates To',
});

const SAMPLE_GRAPH: GraphModel = {
  nodes: [
    { id: 'fraud-4012', type: 'case', properties: { label: 'Fraud #4012', status: 'RUNNING', domain: 'case' } },
    { id: 'fraud-3841', type: 'case', properties: { label: 'Fraud #3841', status: 'COMPLETED', domain: 'case' } },
    { id: 'fraud-4087', type: 'case', properties: { label: 'Fraud #4087', status: 'RUNNING', domain: 'case' } },
    { id: 'coord-500', type: 'case', properties: { label: 'Coordination #500', status: 'RUNNING', domain: 'case' } },
    { id: 'juris-a', type: 'case', properties: { label: 'Jurisdiction A', status: 'RUNNING', domain: 'case' } },
    { id: 'juris-b', type: 'case', properties: { label: 'Jurisdiction B', status: 'WAITING', domain: 'case' } },
    { id: 'juris-c', type: 'case', properties: { label: 'Jurisdiction C', status: 'COMPLETED', domain: 'case' } },
    { id: 'sub-1', type: 'case', properties: { label: 'Wire Transfer', status: 'COMPLETED', domain: 'case' } },
    { id: 'sub-2', type: 'case', properties: { label: 'Account Review', status: 'RUNNING', domain: 'case' } },
  ],
  edges: [
    { id: 'e1', type: 'supersedes', source: 'fraud-4012', target: 'fraud-4087' },
    { id: 'e2', type: 'relates_to', source: 'fraud-4012', target: 'fraud-3841' },
    { id: 'e3', type: 'coordination', source: 'coord-500', target: 'juris-a' },
    { id: 'e4', type: 'coordination', source: 'coord-500', target: 'juris-b' },
    { id: 'e5', type: 'coordination', source: 'coord-500', target: 'juris-c' },
    { id: 'e6', type: 'parent_child', source: 'fraud-4087', target: 'sub-1' },
    { id: 'e7', type: 'parent_child', source: 'fraud-4087', target: 'sub-2' },
    { id: 'e8', type: 'blocks', source: 'juris-a', target: 'juris-b' },
  ],
};

@customElement('blocks-example-case-dependency-graph')
export class CaseDependencyGraphPage extends LitElement {
  @state() private _eventLog: string[] = [];

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin-bottom: 8px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin-bottom: 24px; color: var(--pages-neutral-11, #555); font-size: 14px; }
    h3 { margin: 24px 0 12px; font-size: 16px; font-weight: 600; }
    .demo-section { margin-bottom: 32px; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 6px; background: var(--pages-neutral-1, #fff); height: 500px; }
    .event-log { margin-top: 24px; padding: 16px; background: var(--pages-neutral-2, #f5f5f5); border-radius: 8px; max-height: 150px; overflow-y: auto; }
    .event-log h3 { margin: 0 0 8px; font-size: 14px; }
    .event-log pre { margin: 0; font-size: 13px; font-family: monospace; white-space: pre-wrap; }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('pages-event', this._handleEvent as EventListener);
  }

  override disconnectedCallback(): void {
    this.removeEventListener('pages-event', this._handleEvent as EventListener);
    super.disconnectedCallback();
  }

  private _handleEvent = (e: CustomEvent): void => {
    if (e.detail?.topic === 'case-graph:selected') {
      const { id } = e.detail.data ?? e.detail.payload ?? {};
      this._eventLog = [
        `[${new Date().toLocaleTimeString()}] Selected: ${id}`,
        ...this._eventLog.slice(0, 9),
      ];
    }
  };

  override render() {
    return html`
      <h2>Case Dependency Graph</h2>
      <p>D3 force-directed graph of case relationships — parent/child, supersession, cross-repo coordination, and custom types via the relationship type registry.</p>

      <h3>Fraud Investigation Scenario</h3>
      <div class="demo-section">
        <blocks-case-dependency-graph
          .graphData=${SAMPLE_GRAPH}
          selection-topic="case-graph"
        ></blocks-case-dependency-graph>
      </div>

      <h3>Empty State</h3>
      <div class="demo-section" style="height: 100px;">
        <blocks-case-dependency-graph></blocks-case-dependency-graph>
      </div>

      ${this._eventLog.length > 0 ? html`
        <div class="event-log">
          <h3>Event Log</h3>
          <pre>${this._eventLog.join('\n')}</pre>
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blocks-example-case-dependency-graph': CaseDependencyGraphPage;
  }
}
