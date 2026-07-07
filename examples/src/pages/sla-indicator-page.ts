import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@casehubio/blocks-ui-sla-indicator';

function futureISO(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

function pastISO(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

@customElement('sla-indicator-page')
export class SlaIndicatorPage extends LitElement {
  @state() private _timeShift = 0;

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin-bottom: 8px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin-bottom: 24px; color: var(--pages-neutral-11, #555); font-size: 14px; }
    h3 { margin: 24px 0 12px; font-size: 16px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px;
      max-width: 900px;
    }
    .card {
      border: 1px solid var(--pages-neutral-5, #e0e0e0);
      border-radius: 6px;
      padding: 16px;
      background: var(--pages-neutral-1, #fff);
    }
    .card-label {
      font-size: 12px;
      color: var(--pages-neutral-9, #888);
      margin-bottom: 8px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .card-indicator { display: flex; align-items: center; min-height: 24px; }
    .controls { margin-bottom: 24px; display: flex; gap: 8px; }
    .btn {
      padding: 6px 14px;
      border: 1px solid var(--pages-neutral-6, #ccc);
      border-radius: 4px;
      background: var(--pages-neutral-1, #fff);
      cursor: pointer;
      font-size: 13px;
      color: var(--pages-neutral-11, #555);
    }
    .btn:hover { background: var(--pages-neutral-3, #f0f0f0); }
    .shift-label { font-size: 13px; color: var(--pages-neutral-9, #888); line-height: 32px; }
  `;

  override render() {
    const shift = this._timeShift;

    return html`
      <h2>SLA Indicator</h2>
      <p>Compact deadline countdown with progressive urgency styling. Real-time updates via SharedTimerController.</p>

      <div class="controls">
        <button class="btn" @click=${() => { this._timeShift -= 1800000; }}>-30m</button>
        <button class="btn" @click=${() => { this._timeShift -= 300000; }}>-5m</button>
        <button class="btn" @click=${() => { this._timeShift = 0; }}>Reset</button>
        <button class="btn" @click=${() => { this._timeShift += 300000; }}>+5m</button>
        <button class="btn" @click=${() => { this._timeShift += 1800000; }}>+30m</button>
        <span class="shift-label">${shift === 0 ? 'Real time' : `Shifted ${shift > 0 ? '+' : ''}${Math.round(shift / 60000)}m`}</span>
      </div>

      <h3>Compact Mode (default — for inbox rows)</h3>
      <div class="grid">
        <div class="card">
          <div class="card-label">Normal — 2 days remaining</div>
          <div class="card-indicator">
            <sla-indicator deadline="${futureISO(172800000 + shift)}" sla-window="604800000" warning-threshold="0.25" critical-threshold="0.10"></sla-indicator>
          </div>
        </div>
        <div class="card">
          <div class="card-label">Warning — 4 hours remaining</div>
          <div class="card-indicator">
            <sla-indicator deadline="${futureISO(14400000 + shift)}" sla-window="86400000" warning-threshold="0.25" critical-threshold="0.10"></sla-indicator>
          </div>
        </div>
        <div class="card">
          <div class="card-label">Critical — 12 minutes remaining</div>
          <div class="card-indicator">
            <sla-indicator deadline="${futureISO(720000 + shift)}" sla-window="3600000" warning-threshold="0.25" critical-threshold="0.10"></sla-indicator>
          </div>
        </div>
        <div class="card">
          <div class="card-label">Breached — 3 hours ago</div>
          <div class="card-indicator">
            <sla-indicator deadline="${pastISO(10800000 - shift)}" sla-window="86400000"></sla-indicator>
          </div>
        </div>
        <div class="card">
          <div class="card-label">Breached + Escalation L2</div>
          <div class="card-indicator">
            <sla-indicator deadline="${pastISO(7200000 - shift)}" escalation-stage="L2"></sla-indicator>
          </div>
        </div>
        <div class="card">
          <div class="card-label">Absolute fallback (no slaWindow)</div>
          <div class="card-indicator">
            <sla-indicator deadline="${futureISO(2400000 + shift)}"></sla-indicator>
          </div>
        </div>
      </div>

      <h3>Expanded Mode (for detail panels)</h3>
      <div class="grid">
        <div class="card">
          <div class="card-label">Normal — expanded</div>
          <div class="card-indicator">
            <sla-indicator deadline="${futureISO(259200000 + shift)}" sla-window="604800000" ?compact=${false}></sla-indicator>
          </div>
        </div>
        <div class="card">
          <div class="card-label">Warning — expanded + escalation</div>
          <div class="card-indicator">
            <sla-indicator deadline="${futureISO(7200000 + shift)}" sla-window="86400000" escalation-stage="Manager" ?compact=${false}></sla-indicator>
          </div>
        </div>
        <div class="card">
          <div class="card-label">Breached — expanded</div>
          <div class="card-indicator">
            <sla-indicator deadline="${pastISO(86400000 - shift)}" ?compact=${false}></sla-indicator>
          </div>
        </div>
      </div>
    `;
  }
}
