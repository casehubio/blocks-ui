import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@casehubio/blocks-ui-execution-monitor';
import type { ExecutionSnapshot, ExecutionState } from '@casehubio/blocks-ui-core';
import mockData from '../../mock-data/execution.json';

const BASE_SNAPSHOT = mockData.snapshot as unknown as ExecutionSnapshot;

function withState(s: ExecutionState, result?: string): ExecutionSnapshot {
  return {
    ...BASE_SNAPSHOT, state: s,
    ...(result ? { result, completedAt: '2026-08-18T10:30:24Z' } : {}),
    ...(s === 'IDLE' ? { activeAgents: [], completedAgents: [] } : {}),
  } as unknown as ExecutionSnapshot;
}

@customElement('blocks-example-execution-monitor')
export class ExecutionMonitorPage extends LitElement {
  @state() private _state: ExecutionState = 'RUNNING';

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); margin-bottom: 8px; }
    p { color: var(--pages-neutral-11, #555); font-size: 14px; margin-bottom: 24px; }
    .controls { display: flex; gap: 16px; align-items: center; margin-bottom: 16px; }
    label { font-size: 13px; font-weight: 500; color: var(--pages-neutral-11, #555); }
    select { padding: 4px 8px; border-radius: 4px; border: 1px solid var(--pages-neutral-6, #ccc);
      background: var(--pages-neutral-1, #fff); font-size: 13px; color: var(--pages-neutral-12, #111); }
    .monitor-container { border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 6px;
      background: var(--pages-neutral-1, #fff); padding: 16px; }
  `;

  private get _snapshot(): ExecutionSnapshot {
    switch (this._state) {
      case 'COMPLETE': return withState('COMPLETE', 'COMPLETED');
      case 'FAULTED': return withState('FAULTED', 'FAILED');
      case 'CANCELLED': return withState('CANCELLED', 'CANCELLED');
      default: return withState(this._state);
    }
  }

  override render() {
    return html`
      <h2>Execution Monitor</h2>
      <p>SSE-driven live execution state for the orchestration framework. Shows state badge (7 states),
        pattern badge (HTN), execution model summary with failure policy, and agent roster with
        type and result badges. Supports both SSE endpoint and inline data modes.</p>
      <div class="controls">
        <label>Execution State:</label>
        <select @change=${(e: Event) => { this._state = (e.target as HTMLSelectElement).value as ExecutionState; }}>
          <option value="IDLE">Idle</option>
          <option value="RUNNING" selected>Running</option>
          <option value="WAITING_FOR_AGENT">Waiting for Agent</option>
          <option value="WAITING_FOR_EVENT">Waiting for Event</option>
          <option value="COMPLETE">Complete</option>
          <option value="FAULTED">Faulted</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>
      <div class="monitor-container">
        <blocks-execution-monitor .data=${this._snapshot}></blocks-execution-monitor>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'blocks-example-execution-monitor': ExecutionMonitorPage; }
}
