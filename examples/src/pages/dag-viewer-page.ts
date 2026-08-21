import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@casehubio/blocks-ui-blocks-dag-viewer';
import type { DagPlanSnapshot, DagResultSnapshot, DagDispatchMode } from '@casehubio/graph-stencil-htn';
import mockData from '../../mock-data/dag-plan.json';

const RESULT_SCENARIOS: Record<string, Record<string, { kind: string; reason?: string }>> = {
  'mid-flight': {
    'validate-input': { kind: 'Completed' }, 'enrich-policy': { kind: 'Completed' },
    'enrich-claimant': { kind: 'Completed' }, 'check-sanctions': { kind: 'Completed' },
    'fraud-scoring': { kind: 'Dispatched' }, 'medical-review': { kind: 'Dispatched' },
    'aggregate-risk': { kind: 'Pending' }, 'routing-decision': { kind: 'Pending' },
  },
  'completed': {
    'validate-input': { kind: 'Completed' }, 'enrich-policy': { kind: 'Completed' },
    'enrich-claimant': { kind: 'Completed' }, 'check-sanctions': { kind: 'Completed' },
    'fraud-scoring': { kind: 'Completed' }, 'medical-review': { kind: 'Completed' },
    'aggregate-risk': { kind: 'Completed' }, 'routing-decision': { kind: 'Completed' },
  },
  'partial-failure': {
    'validate-input': { kind: 'Completed' }, 'enrich-policy': { kind: 'Completed' },
    'enrich-claimant': { kind: 'Completed' },
    'check-sanctions': { kind: 'Failed', reason: 'Sanctions provider timeout' },
    'fraud-scoring': { kind: 'Completed' }, 'medical-review': { kind: 'Completed' },
    'aggregate-risk': { kind: 'Skipped', reason: 'Dependency failed: check-sanctions' },
    'routing-decision': { kind: 'Skipped', reason: 'Dependency failed: aggregate-risk' },
  },
};

@customElement('blocks-example-dag-viewer')
export class DagViewerPage extends LitElement {
  @state() private _scenario: keyof typeof RESULT_SCENARIOS = 'mid-flight';
  @state() private _dispatchMode: DagDispatchMode = 'STREAMING';

  private _dagPlan = mockData.plan as unknown as DagPlanSnapshot;

  static override styles = css`
    :host { display: block; padding: 24px; height: 100%; box-sizing: border-box; }
    h2 { font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); margin-bottom: 8px; }
    p { color: var(--pages-neutral-11, #555); font-size: 14px; margin-bottom: 24px; }
    .controls { display: flex; gap: 16px; align-items: center; margin-bottom: 16px; }
    label { font-size: 13px; font-weight: 500; color: var(--pages-neutral-11, #555); }
    select { padding: 4px 8px; border-radius: 4px; border: 1px solid var(--pages-neutral-6, #ccc);
      background: var(--pages-neutral-1, #fff); font-size: 13px; color: var(--pages-neutral-12, #111); }
    .viewer-container { border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 6px;
      background: var(--pages-neutral-1, #fff); height: 500px; }
  `;

  private get _dagResult(): DagResultSnapshot {
    const nodeStates = RESULT_SCENARIOS[this._scenario];
    const allDone = Object.values(nodeStates).every(s => s.kind === 'Completed');
    return {
      nodeStates, completedResults: {}, allSucceeded: allDone,
      elapsed: this._scenario === 'completed' ? 'PT24.8S' : 'PT12.4S',
      timestamp: '2026-08-18T10:30:12Z',
    } as unknown as DagResultSnapshot;
  }

  override render() {
    return html`
      <h2>DAG Viewer</h2>
      <p>DAG execution graph viewer — toolbar with dispatch mode badge, summary stats (completed / running / failed),
        staleness timer, and elapsed time. ELK-layouted graph canvas with dag-node stencils and dependency edges.</p>
      <div class="controls">
        <label>Scenario:</label>
        <select @change=${(e: Event) => { this._scenario = (e.target as HTMLSelectElement).value as keyof typeof RESULT_SCENARIOS; }}>
          <option value="mid-flight">Mid-flight (2 running)</option>
          <option value="completed">All Completed</option>
          <option value="partial-failure">Partial Failure</option>
        </select>
        <label>Dispatch:</label>
        <select @change=${(e: Event) => { this._dispatchMode = (e.target as HTMLSelectElement).value as DagDispatchMode; }}>
          <option value="STREAMING">Streaming</option>
          <option value="BARRIER">Barrier</option>
        </select>
      </div>
      <div class="viewer-container">
        <blocks-dag-viewer .dagPlan=${this._dagPlan} .dagResult=${this._dagResult}
          .dispatchMode=${this._dispatchMode} selectionTopic="demo-dag"></blocks-dag-viewer>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'blocks-example-dag-viewer': DagViewerPage; }
}
