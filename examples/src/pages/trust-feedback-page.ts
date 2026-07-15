import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../../../components/trust-feedback-display/src/trust-feedback-display.js';
import type { GateDecision } from '../../../components/trust-feedback-display/src/types.js';

const DECISIONS: Array<{ label: string; data: GateDecision }> = [
  {
    label: 'Approved + Endorsed (score up)',
    data: { decision: 'APPROVED', actor: 'agent-alice', attestation: 'ENDORSED', trustScoreBefore: 0.72, trustScoreAfter: 0.85, dimension: 'clinical-governance' },
  },
  {
    label: 'Rejected + Overruled (score down)',
    data: { decision: 'REJECTED', actor: 'agent-bob', attestation: 'OVERRULED', trustScoreBefore: 0.65, trustScoreAfter: 0.45, dimension: 'data-quality' },
  },
  {
    label: 'Approved + Endorsed (score unchanged)',
    data: { decision: 'APPROVED', actor: 'agent-carol', attestation: 'ENDORSED', trustScoreBefore: 0.70, trustScoreAfter: 0.70, dimension: 'operational' },
  },
  {
    label: 'Approved + Overruled (score up)',
    data: { decision: 'APPROVED', actor: 'agent-dave', attestation: 'OVERRULED', trustScoreBefore: 0.55, trustScoreAfter: 0.62, dimension: 'safety-monitoring' },
  },
];

@customElement('trust-feedback-page')
export class TrustFeedbackPage extends LitElement {
  @state() private _selectedIndex = 0;
  @state() private _compact = false;

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin-bottom: 8px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin-bottom: 24px; color: var(--pages-neutral-11, #555); font-size: 14px; }
    h3 { margin: 24px 0 12px; font-size: 16px; font-weight: 600; }
    .controls { margin-bottom: 16px; display: flex; gap: 12px; align-items: center; }
    select { padding: 6px 12px; border: 1px solid var(--pages-neutral-6, #ccc); border-radius: 4px; font-size: 13px; }
    label { font-size: 13px; color: var(--pages-neutral-11, #555); display: flex; align-items: center; gap: 4px; }
    .demo-section { margin-bottom: 32px; padding: 16px; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 6px; background: var(--pages-neutral-1, #fff); max-width: 500px; }
    .compact-grid { display: flex; flex-direction: column; gap: 8px; }
  `;

  override render() {
    const selected = DECISIONS[this._selectedIndex]!;

    return html`
      <h2>Trust Feedback Display</h2>
      <p>Post-gate trust score delta — decision, attestation, trust before/after. Full card and compact inline modes.</p>

      <div class="controls">
        <select @change=${(e: Event) => { this._selectedIndex = Number((e.target as HTMLSelectElement).value); }}>
          ${DECISIONS.map((d, i) => html`<option value=${i} ?selected=${i === this._selectedIndex}>${d.label}</option>`)}
        </select>
        <label>
          <input type="checkbox" ?checked=${this._compact} @change=${(e: Event) => { this._compact = (e.target as HTMLInputElement).checked; }} />
          Compact
        </label>
      </div>

      <h3>Interactive Demo</h3>
      <div class="demo-section">
        <trust-feedback-display
          .gateDecision=${selected.data}
          ?compact=${this._compact}
        ></trust-feedback-display>
      </div>

      <h3>No Data</h3>
      <div class="demo-section">
        <trust-feedback-display></trust-feedback-display>
      </div>

      <h3>All Variants (Compact)</h3>
      <div class="demo-section">
        <div class="compact-grid">
          ${DECISIONS.map(d => html`
            <trust-feedback-display .gateDecision=${d.data} compact></trust-feedback-display>
          `)}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'trust-feedback-page': TrustFeedbackPage;
  }
}
