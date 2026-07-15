import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../../../components/sla-breach-policy/src/sla-breach-policy.js';
import type { TierDefinition } from '../../../components/sla-breach-policy/src/types.js';

const CLINICAL_TIERS: TierDefinition[] = [
  { threshold: 0.75, label: 'Warning', consequence: 'Notification sent to study coordinator' },
  { threshold: 0.50, label: 'Escalation L1', consequence: 'Auto-assign to principal investigator', regulation: 'ICH E6 §4.5.1' },
  { threshold: 0.25, label: 'Escalation L2', consequence: 'Sponsor notification and priority override', regulation: 'EU CTR Art.37' },
  { threshold: 0.0, label: 'Breach', consequence: 'Regulatory compliance report generated' },
];

const SIMPLE_TIERS: TierDefinition[] = [
  { threshold: 0.50, label: 'Warning', consequence: 'Team notification' },
  { threshold: 0.0, label: 'Breach', consequence: 'Escalation to manager' },
];

function futureISO(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

@customElement('sla-breach-policy-page')
export class SlaBreachPolicyPage extends LitElement {
  @state() private _timeRemaining = 60;
  @state() private _showDeadline = true;

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin-bottom: 8px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin-bottom: 24px; color: var(--pages-neutral-11, #555); font-size: 14px; }
    h3 { margin: 24px 0 12px; font-size: 16px; font-weight: 600; }
    .controls { margin-bottom: 16px; display: flex; gap: 16px; align-items: center; }
    input[type="range"] { width: 200px; }
    label { font-size: 13px; color: var(--pages-neutral-11, #555); display: flex; align-items: center; gap: 4px; }
    .value-label { font-size: 13px; color: var(--pages-neutral-9, #888); min-width: 40px; }
    .demo-section { margin-bottom: 32px; padding: 16px; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 6px; background: var(--pages-neutral-1, #fff); max-width: 500px; }
  `;

  override render() {
    return html`
      <h2>SLA Breach Policy</h2>
      <p>Breach escalation tiers with active-tier highlighting. Complements sla-indicator with optional live countdown.</p>

      <div class="controls">
        <label>
          Time Remaining:
          <input type="range" min="0" max="100" .value=${String(this._timeRemaining)}
            @input=${(e: Event) => { this._timeRemaining = Number((e.target as HTMLInputElement).value); }} />
        </label>
        <span class="value-label">${this._timeRemaining}%</span>
        <label>
          <input type="checkbox" ?checked=${this._showDeadline}
            @change=${(e: Event) => { this._showDeadline = (e.target as HTMLInputElement).checked; }} />
          Show deadline countdown
        </label>
      </div>

      <h3>Clinical Trial Tiers (with regulations)</h3>
      <div class="demo-section">
        <sla-breach-policy
          .tiers=${CLINICAL_TIERS}
          time-remaining="${this._timeRemaining}"
          .deadline=${this._showDeadline ? futureISO(this._timeRemaining * 360000) : ''}
        ></sla-breach-policy>
      </div>

      <h3>Simple Tiers (2 levels)</h3>
      <div class="demo-section">
        <sla-breach-policy
          .tiers=${SIMPLE_TIERS}
          time-remaining="${this._timeRemaining}"
        ></sla-breach-policy>
      </div>

      <h3>Empty State</h3>
      <div class="demo-section">
        <sla-breach-policy></sla-breach-policy>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sla-breach-policy-page': SlaBreachPolicyPage;
  }
}
