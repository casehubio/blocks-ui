import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '@casehubio/blocks-ui-blocks-timeline';
import { stateProgressionStrategy, linearResolveStatus } from '@casehubio/blocks-ui-blocks-timeline';
import type { StageConfig } from '@casehubio/blocks-ui-blocks-timeline';

@customElement('timeline-commitment-page')
export class TimelineCommitmentPage extends LitElement {
  private _fulfilledData = {
    currentState: 'FULFILLED',
    transitions: [
      { state: 'OPEN', actor: 'requester-system', timestamp: '2026-07-10T09:00:00Z' },
      { state: 'ACKNOWLEDGED', actor: 'agent-042', timestamp: '2026-07-10T09:05:00Z' },
      { state: 'FULFILLED', actor: 'agent-042', timestamp: '2026-07-10T10:30:00Z' },
    ],
  };

  private _declinedData = {
    currentState: 'DECLINED',
    transitions: [
      { state: 'OPEN', actor: 'orchestrator', timestamp: '2026-07-10T14:00:00Z' },
      { state: 'DECLINED', actor: 'agent-099', timestamp: '2026-07-10T14:02:00Z' },
    ],
  };

  private _linearData = { currentState: 'ACKNOWLEDGED' };

  private _customStages: StageConfig[] = [
    { key: 'DRAFT', label: 'Draft' },
    { key: 'SUBMITTED', label: 'Submitted' },
    { key: 'REVIEWED', label: 'Reviewed' },
    { key: 'APPROVED', label: 'Approved', terminal: 'success' },
    { key: 'REJECTED', label: 'Rejected', terminal: 'failure' },
  ];

  private _customData = {
    currentState: 'REVIEWED',
    transitions: [
      { state: 'DRAFT', actor: 'author', timestamp: '2026-07-10T08:00:00Z' },
      { state: 'SUBMITTED', actor: 'author', timestamp: '2026-07-10T09:00:00Z' },
      { state: 'REVIEWED', actor: 'reviewer-1', timestamp: '2026-07-10T11:00:00Z' },
    ],
  };

  override render() {
    return html`
      <div class="page-container">
        <div class="header">
          <h1>Timeline — Commitment Lifecycle</h1>
          <p class="description">
            State progression strategy visualising qhorus COMMAND → RESPONSE → terminal lifecycle.
            Horizontal pipeline layout with transition-based status resolution.
          </p>
        </div>

        <h2>Fulfilled Commitment</h2>
        <p class="subtitle">OPEN → ACKNOWLEDGED → FULFILLED (success terminal)</p>
        <div class="viewer-container">
          <blocks-timeline
            .strategy=${stateProgressionStrategy()}
            .data=${this._fulfilledData}
          ></blocks-timeline>
        </div>

        <h2>Declined Commitment</h2>
        <p class="subtitle">OPEN → DECLINED (failure terminal, skips ACKNOWLEDGED)</p>
        <div class="viewer-container">
          <blocks-timeline
            .strategy=${stateProgressionStrategy()}
            .data=${this._declinedData}
          ></blocks-timeline>
        </div>

        <h2>Linear Pipeline (no transitions)</h2>
        <p class="subtitle">Uses linearResolveStatus — positional completion based on stage order</p>
        <div class="viewer-container">
          <blocks-timeline
            .strategy=${stateProgressionStrategy({ resolveStatus: linearResolveStatus })}
            .data=${this._linearData}
          ></blocks-timeline>
        </div>

        <h2>Custom Stages</h2>
        <p class="subtitle">Document approval pipeline: Draft → Submitted → Reviewed → Approved/Rejected</p>
        <div class="viewer-container">
          <blocks-timeline
            .strategy=${stateProgressionStrategy({ stages: this._customStages })}
            .data=${this._customData}
          ></blocks-timeline>
        </div>

        <div class="info-panel">
          <h2>Component Features</h2>
          <ul>
            <li><strong>State Progression Strategy:</strong> Maps state-machine data to a fixed pipeline of stages with current position</li>
            <li><strong>Transition-Based Resolution:</strong> Default resolveStatus uses transition history — visited stages are completed, unvisited are skipped</li>
            <li><strong>Linear Resolve Status:</strong> Opt-in positional ordering for simple pipelines without transition data</li>
            <li><strong>Custom Stages:</strong> Pass your own StageConfig[] — key, label, icon, terminal (success/failure)</li>
            <li><strong>Terminal Types:</strong> success terminals show green (completed), failure terminals show red (failed)</li>
            <li><strong>Qhorus Defaults:</strong> 7 built-in stages matching qhorus CommitmentState: OPEN, ACKNOWLEDGED, FULFILLED, DECLINED, FAILED, DELEGATED, EXPIRED</li>
          </ul>

          <h3>Try It</h3>
          <ul>
            <li>Compare Fulfilled vs Declined — same stages, different status colouring</li>
            <li>Note how Declined skips ACKNOWLEDGED (shown as "skipped" grey) because transitions show it was never visited</li>
            <li>Compare Linear Pipeline — without transitions, linearResolveStatus uses position: everything before current is completed</li>
            <li>Custom Stages shows a non-qhorus pipeline with its own stage definitions</li>
          </ul>
        </div>
      </div>
    `;
  }

  static override styles = css`
    :host { display: block; padding: 24px; font-family: var(--pages-font-family, system-ui); }
    .page-container { max-width: 1200px; margin: 0 auto; }
    .header { margin-bottom: 32px; }
    h1 { margin: 0 0 8px 0; font-size: 28px; font-weight: 600; color: var(--pages-gray-12, #111827); }
    h2 { margin: 32px 0 8px 0; font-size: 20px; font-weight: 600; color: var(--pages-gray-12, #111827); }
    .description { margin: 0; font-size: 16px; color: var(--pages-gray-11, #1f2937); line-height: 1.5; }
    .subtitle { margin: 0 0 12px 0; font-size: 14px; color: var(--pages-gray-9, #6b7280); }
    .viewer-container { margin-bottom: 16px; border: 1px solid var(--pages-gray-6, #d1d5db); border-radius: 8px; background: white; }
    .info-panel { padding: 24px; background: var(--pages-gray-1, #fafbfc); border-radius: 8px; margin-top: 32px; }
    .info-panel h2 { margin: 0 0 16px 0; }
    .info-panel h3 { margin: 24px 0 12px 0; font-size: 16px; font-weight: 600; }
    .info-panel ul { margin: 0; padding-left: 24px; }
    .info-panel li { margin-bottom: 8px; line-height: 1.5; }
  `;
}
