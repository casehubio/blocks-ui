import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../../../components/trust-workbench/src/trust-workbench.js';
import type { RoutingDecisionSummary, RoutingDecisionDetail } from '../../../components/trust-workbench/src/types.js';
import type { RoutingRationaleData, CandidateScore } from '../../../components/routing-rationale/src/types.js';
import type { GateDecision } from '../../../components/trust-feedback-display/src/types.js';

const POLICY = {
  threshold: 0.7, borderlineMargin: 0.1, blendFactor: 0.6,
  minimumObservations: 10, qualityFloors: { accuracy: 0.6 }, cbrWeight: 0.15,
  bootstrapEscalationRequired: false,
} as const;

const CANDIDATES: Record<string, { selected: CandidateScore; alternatives: CandidateScore[] }> = {
  'code-review': {
    selected: { workerId: 'agent-alice', trustScore: 0.88, workloadScore: 0.65, phase: 'QUALIFIED', observations: 42, finalScore: 0.79, rationale: 'Highest trust-weighted composite' },
    alternatives: [
      { workerId: 'agent-bob', trustScore: 0.71, workloadScore: 0.90, phase: 'BORDERLINE', observations: 28, finalScore: 0.78, exclusionReason: 'Within borderline margin' },
      { workerId: 'agent-carol', trustScore: 0.45, workloadScore: 0.95, phase: 'EXCLUDED_PHASE2B', observations: 15, finalScore: 0, exclusionReason: 'Below threshold' },
      { workerId: 'agent-dave', trustScore: null, workloadScore: 1.0, phase: 'BOOTSTRAP', observations: 3, finalScore: 1.0 },
    ],
  },
  'triage': {
    selected: { workerId: 'agent-bob', trustScore: 0.82, workloadScore: 0.70, phase: 'QUALIFIED', observations: 35, finalScore: 0.77 },
    alternatives: [
      { workerId: 'agent-alice', trustScore: 0.75, workloadScore: 0.60, phase: 'QUALIFIED', observations: 20, finalScore: 0.69 },
    ],
  },
  'escalation': {
    selected: { workerId: 'agent-alice', trustScore: 0.91, workloadScore: 0.50, phase: 'QUALIFIED', observations: 55, finalScore: 0.74 },
    alternatives: [],
  },
};

const SUMMARIES: RoutingDecisionSummary[] = [
  { id: 'dec-1', timestamp: new Date(Date.now() - 5 * 60000).toISOString(), capabilityTag: 'code-review', selectedWorkerId: 'agent-alice', finalScore: 0.79, phase: 'QUALIFIED' },
  { id: 'dec-2', timestamp: new Date(Date.now() - 25 * 60000).toISOString(), capabilityTag: 'triage', selectedWorkerId: 'agent-bob', finalScore: 0.77, phase: 'QUALIFIED' },
  { id: 'dec-3', timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), capabilityTag: 'code-review', selectedWorkerId: 'agent-alice', finalScore: 0.81, phase: 'QUALIFIED' },
  { id: 'dec-4', timestamp: new Date(Date.now() - 5 * 3600000).toISOString(), capabilityTag: 'escalation', selectedWorkerId: 'agent-alice', finalScore: 0.74, phase: 'QUALIFIED' },
  { id: 'dec-5', timestamp: new Date(Date.now() - 24 * 3600000).toISOString(), capabilityTag: 'triage', selectedWorkerId: 'agent-bob', finalScore: 0.75, phase: 'QUALIFIED' },
  { id: 'dec-6', timestamp: new Date(Date.now() - 48 * 3600000).toISOString(), capabilityTag: 'code-review', selectedWorkerId: 'agent-alice', finalScore: 0.76, phase: 'QUALIFIED' },
];

const FEEDBACK: Record<string, GateDecision[]> = {
  'dec-1': [
    { decision: 'APPROVED', actor: 'agent-alice', attestation: 'ENDORSED', trustScoreBefore: 0.85, trustScoreAfter: 0.88, dimension: 'code-review' },
  ],
  'dec-2': [
    { decision: 'APPROVED', actor: 'agent-bob', attestation: 'ENDORSED', trustScoreBefore: 0.78, trustScoreAfter: 0.82, dimension: 'triage' },
    { decision: 'APPROVED', actor: 'agent-bob', attestation: 'OVERRULED', trustScoreBefore: 0.82, trustScoreAfter: 0.80, dimension: 'triage' },
  ],
  'dec-3': [
    { decision: 'REJECTED', actor: 'agent-alice', attestation: 'ENDORSED', trustScoreBefore: 0.83, trustScoreAfter: 0.81, dimension: 'code-review' },
  ],
  'dec-4': [
    { decision: 'APPROVED', actor: 'agent-alice', attestation: 'ENDORSED', trustScoreBefore: 0.89, trustScoreAfter: 0.91, dimension: 'escalation' },
  ],
  'dec-5': [],
  'dec-6': [
    { decision: 'APPROVED', actor: 'agent-alice', attestation: 'ENDORSED', trustScoreBefore: 0.73, trustScoreAfter: 0.76, dimension: 'code-review' },
  ],
};

function buildDetail(id: string): RoutingDecisionDetail {
  const summary = SUMMARIES.find(s => s.id === id)!;
  const cap = CANDIDATES[summary.capabilityTag] ?? CANDIDATES['code-review']!;
  const rationale: RoutingRationaleData = {
    capabilityTag: summary.capabilityTag,
    strategyId: 'trust-weighted',
    selected: cap.selected,
    alternatives: cap.alternatives,
    policy: POLICY,
  };
  return { rationale, feedback: FEEDBACK[id] ?? [] };
}

@customElement('trust-workbench-page')
export class TrustWorkbenchPage extends LitElement {
  @state() private _eventLog: string[] = [];

  static override styles = css`
    :host { display: block; padding: 24px; height: calc(100vh - 48px); }
    h2 { margin: 0 0 8px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin: 0 0 16px; color: var(--pages-neutral-11, #555); font-size: 14px; }
    .workbench-container { height: calc(100% - 100px); border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 6px; overflow: hidden; }
    .event-log { margin-top: 12px; padding: 8px 12px; background: var(--pages-neutral-2, #f5f5f5); border-radius: 4px; max-height: 80px; overflow-y: auto; font-size: 12px; font-family: monospace; color: var(--pages-neutral-11, #555); }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('pages-event', this._logEvent);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('pages-event', this._logEvent);
  }

  private _logEvent = (e: Event): void => {
    const detail = (e as CustomEvent).detail;
    if (!detail?.topic) return;
    const topic = detail.topic as string;
    if (topic.startsWith('trust') || topic.startsWith('trust-routing')) {
      this._eventLog = [
        `[${new Date().toLocaleTimeString()}] ${topic}: ${JSON.stringify(detail.payload ?? detail.data ?? {})}`.slice(0, 120),
        ...this._eventLog.slice(0, 9),
      ];
    }
  };

  private _resolver = async (id: string): Promise<RoutingDecisionDetail> => {
    await new Promise(r => setTimeout(r, 200));
    return buildDetail(id);
  };

  override render() {
    return html`
      <h2>Trust Workbench</h2>
      <p>Composite trust visibility — score panel, routing history, and feedback display in a pre-wired split-workbench.
        Uses inline data mode (no backend). Click a capability in the score panel to filter, click a routing decision to see detail.</p>

      <div class="workbench-container">
        <trust-workbench
          endpoint="/api"
          actor-id="agent-alice"
          .routingHistory=${SUMMARIES}
          .routingDetailResolver=${this._resolver}
        ></trust-workbench>
      </div>

      ${this._eventLog.length > 0 ? html`
        <div class="event-log">
          ${this._eventLog.map(e => html`<div>${e}</div>`)}
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'trust-workbench-page': TrustWorkbenchPage;
  }
}
