import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { WorkIdentity } from '@casehubio/blocks-ui-core';
import '@casehubio/blocks-ui-approval-gate';
import type { OutcomeDefinition, QuorumConfig, GateDecision } from '@casehubio/blocks-ui-approval-gate';

const CURRENT_USER: WorkIdentity = { userId: 'user-1', displayName: 'Alice Chen', groups: ['approvers', 'compliance'] };

const AML_OUTCOMES: OutcomeDefinition[] = [
  { key: 'file-sar', label: 'File SAR', variant: 'danger' },
  { key: 'close', label: 'Close Case', variant: 'neutral' },
];

const QUORUM: QuorumConfig = {
  required: 3,
  total: 5,
  voters: [
    { id: 'user-2', name: 'Bob Martinez', status: 'voted', outcome: 'approve' },
    { id: 'user-3', name: 'Charlie Kim', status: 'pending' },
    { id: 'user-1', name: 'Alice Chen', status: 'pending' },
    { id: 'user-4', name: 'Diana Patel', status: 'voted', outcome: 'approve' },
    { id: 'user-5', name: 'Eve Johnson', status: 'pending' },
  ],
};

const ALREADY_VOTED_QUORUM: QuorumConfig = {
  ...QUORUM,
  voters: QUORUM.voters.map(v =>
    v.id === 'user-1' ? { ...v, status: 'voted' as const, outcome: 'approve' } : v
  ),
};

const HISTORY: GateDecision[] = [
  { timestamp: '2026-07-04T09:15:00Z', actor: 'Bob Martinez', outcome: 'approve' },
  { timestamp: '2026-07-03T14:30:00Z', actor: 'Diana Patel', outcome: 'approve' },
];

const EVIDENCE_DATA = {
  'Transaction ID': 'TXN-2026-04521',
  'Amount': '$125,000',
  'Origin': 'Cayman Islands',
  'Risk Score': '87/100',
  'Pattern': 'Multiple rapid transfers to newly opened accounts',
};

@customElement('approval-gate-page')
export class ApprovalGatePage extends LitElement {
  @state() private _eventLog: string[] = [];

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin-bottom: 8px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin-bottom: 24px; color: var(--pages-neutral-11, #555); font-size: 14px; }
    h3 { margin: 32px 0 12px; font-size: 16px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    .scenario {
      max-width: 700px;
      border: 1px solid var(--pages-neutral-5, #e0e0e0);
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 24px;
      background: var(--pages-neutral-1, #fff);
    }
    .event-log {
      margin-top: 16px;
      padding: 12px;
      background: var(--pages-neutral-2, #f5f5f5);
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      color: var(--pages-neutral-11, #555);
      max-height: 120px;
      overflow-y: auto;
    }
    .event-log-item { padding: 2px 0; }
    .event-log-empty { color: var(--pages-neutral-8, #999); font-style: italic; }
  `;

  private _mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/complete') && init?.method === 'PUT') {
      const body = JSON.parse(init.body as string);
      this._eventLog = [...this._eventLog, `PUT ${url} → ${JSON.stringify(body)}`];
      return new Response(JSON.stringify({ status: 'COMPLETED', outcome: body.outcome }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return fetch(input, init);
  };

  override connectedCallback(): void {
    super.connectedCallback();
    (globalThis as any)._originalFetch = globalThis.fetch;
    globalThis.fetch = this._mockFetch as typeof fetch;
    document.addEventListener('pages-event', this._handleEvent);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    globalThis.fetch = (globalThis as any)._originalFetch;
    document.removeEventListener('pages-event', this._handleEvent);
  }

  private _handleEvent = (e: Event): void => {
    const detail = (e as CustomEvent).detail;
    if (detail.topic.startsWith('gate.') || detail.topic.startsWith('sla.')) {
      this._eventLog = [...this._eventLog, `${detail.topic}: ${JSON.stringify(detail.payload)}`];
    }
  };

  override render() {
    return html`
      <h2>Approval Gate</h2>
      <p>Structured human decision point — configurable outcomes, quorum tracking, evidence display, SLA deadline integration.</p>

      <h3>Simple Binary Approve/Reject</h3>
      <div class="scenario">
        <approval-gate
          gateId="gate-001"
          endpoint="/api/work-items"
          .identity=${CURRENT_USER}
          prompt="Approve PI authorisation for Trial ONCO-2026-Alpha?"
          contextText="Phase II clinical trial with 200 enrolled patients. Principal Investigator requests authorisation to proceed to Stage 3 dosing."
        ></approval-gate>
      </div>

      <h3>Custom Outcomes (AML)</h3>
      <div class="scenario">
        <approval-gate
          gateId="gate-002"
          endpoint="/api/work-items"
          .identity=${CURRENT_USER}
          prompt="Suspicious activity detected — file SAR or close?"
          contextText="Multiple rapid transfers totalling $125,000 to newly opened accounts in high-risk jurisdictions."
          .outcomes=${AML_OUTCOMES}
          .data=${EVIDENCE_DATA}
        ></approval-gate>
      </div>

      <h3>With Quorum (3-of-5)</h3>
      <div class="scenario">
        <approval-gate
          gateId="gate-003"
          endpoint="/api/work-items"
          .identity=${CURRENT_USER}
          prompt="Approve family trust distribution?"
          contextText="Quarterly distribution from Henderson Family Trust. Requires 3 of 5 trustee approvals."
          .quorum=${QUORUM}
          .history=${HISTORY}
        ></approval-gate>
      </div>

      <h3>With SLA Deadline</h3>
      <div class="scenario">
        <approval-gate
          gateId="gate-004"
          endpoint="/api/work-items"
          .identity=${CURRENT_USER}
          prompt="Approve SUSAR safety assessment?"
          contextText="Suspected Unexpected Serious Adverse Reaction requires expedited safety review within 72 hours."
          deadline="${new Date(Date.now() + 14400000).toISOString()}"
          .slaWindow=${259200000}
        ></approval-gate>
      </div>

      <h3>Already Decided (current user voted)</h3>
      <div class="scenario">
        <approval-gate
          gateId="gate-005"
          endpoint="/api/work-items"
          .identity=${CURRENT_USER}
          prompt="Approve oversight gate for agent risk decision?"
          contextText="Engine ActionGateWorkItemHandler flagged a high-risk automated decision for human review."
          .quorum=${ALREADY_VOTED_QUORUM}
          .history=${HISTORY}
        ></approval-gate>
      </div>

      <h3>With Slotted Evidence</h3>
      <div class="scenario">
        <approval-gate
          gateId="gate-006"
          endpoint="/api/work-items"
          .identity=${CURRENT_USER}
          prompt="Approve contractor quote for roof repair?"
        >
          <div slot="evidence" style="padding: 12px; background: var(--pages-neutral-2); border-radius: 4px; font-size: 14px;">
            <strong>Contractor:</strong> ABC Roofing Inc.<br/>
            <strong>Quote:</strong> $18,500<br/>
            <strong>Timeline:</strong> 2 weeks<br/>
            <strong>Warranty:</strong> 10 years materials, 5 years labour<br/>
            <strong>Competing quotes:</strong> $22,000 (XYZ), $19,800 (123 Roofing)
          </div>
        </approval-gate>
      </div>

      <h3>Event Log</h3>
      <div class="event-log">
        ${this._eventLog.length === 0
          ? html`<div class="event-log-empty">Interact with the gates above to see events here...</div>`
          : this._eventLog.map(e => html`<div class="event-log-item">${e}</div>`)}
      </div>
    `;
  }
}
