import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@casehubio/blocks-ui-kpi-metric-row';
import type { MetricDefinition } from '@casehubio/blocks-ui-kpi-metric-row';

const DASHBOARD_METRICS: MetricDefinition[] = [
  {
    key: 'active-cases',
    value: 142,
    label: 'Active Cases',
    unit: 'cases',
    trend: { direction: 'down', delta: '-8' },
    sparkline: [165, 158, 152, 148, 145, 142],
    status: 'normal',
  },
  {
    key: 'sla-compliance',
    value: '98.2',
    label: 'SLA Compliance',
    unit: '%',
    trend: { direction: 'up', delta: '+1.3%' },
    sparkline: [95.1, 96.0, 96.8, 97.2, 97.9, 98.2],
    status: 'normal',
  },
  {
    key: 'backlog',
    value: 23,
    label: 'Backlog',
    trend: { direction: 'up', delta: '+5' },
    sparkline: [12, 15, 18, 16, 20, 23],
    status: 'warning',
  },
  {
    key: 'avg-resolution',
    value: '4.2',
    label: 'Avg Resolution',
    unit: 'hrs',
    trend: { direction: 'stable', delta: '0' },
    sparkline: [4.5, 4.3, 4.1, 4.4, 4.2, 4.2],
    status: 'normal',
  },
  {
    key: 'breaches',
    value: 3,
    label: 'SLA Breaches',
    trend: { direction: 'up', delta: '+2' },
    status: 'critical',
  },
];

const IOT_METRICS: MetricDefinition[] = [
  { key: 'devices', value: 1247, label: 'Connected Devices', unit: 'devices', status: 'normal' },
  { key: 'health', value: '99.1', label: 'Fleet Health', unit: '%', status: 'normal', sparkline: [98.5, 98.8, 99.0, 98.9, 99.1, 99.1] },
  { key: 'alerts', value: 7, label: 'Active Alerts', status: 'warning', trend: { direction: 'down', delta: '-3' } },
  { key: 'offline', value: 12, label: 'Offline', status: 'critical' },
];

@customElement('kpi-metric-row-page')
export class KpiMetricRowPage extends LitElement {
  @state() private _columns: number | null = null;
  @state() private _lastClicked = '';

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin-bottom: 8px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin-bottom: 24px; color: var(--pages-neutral-11, #555); font-size: 14px; }
    h3 { margin: 24px 0 12px; font-size: 16px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    .controls { margin-bottom: 16px; display: flex; gap: 8px; align-items: center; }
    .btn {
      padding: 6px 14px;
      border: 1px solid var(--pages-neutral-6, #ccc);
      border-radius: 4px;
      background: var(--pages-neutral-1, #fff);
      cursor: pointer;
      font-size: 13px;
      color: var(--pages-neutral-11, #555);
    }
    .btn.active { background: var(--pages-accent-9, #2563eb); color: white; border-color: var(--pages-accent-9); }
    .section { max-width: 900px; margin-bottom: 32px; }
    .event-log {
      margin-top: 8px;
      font-size: 12px;
      color: var(--pages-neutral-9, #888);
      min-height: 20px;
    }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('pages-event', this._handlePagesEvent);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('pages-event', this._handlePagesEvent);
  }

  private _handlePagesEvent = (e: Event): void => {
    const detail = (e as CustomEvent).detail;
    if (detail.topic === 'kpi.card-clicked') {
      this._lastClicked = `Clicked: ${detail.payload.label} = ${detail.payload.value}`;
    }
  };

  override render() {
    return html`
      <h2>KPI Metric Row</h2>
      <p>Responsive metric card grid with sparklines, trends, and status indicators. Click a card to see the event.</p>

      <div class="controls">
        <span style="font-size: 13px; color: var(--pages-neutral-9);">Columns:</span>
        <button class="btn ${this._columns === null ? 'active' : ''}" @click=${() => { this._columns = null; }}>Auto</button>
        <button class="btn ${this._columns === 2 ? 'active' : ''}" @click=${() => { this._columns = 2; }}>2</button>
        <button class="btn ${this._columns === 3 ? 'active' : ''}" @click=${() => { this._columns = 3; }}>3</button>
        <button class="btn ${this._columns === 4 ? 'active' : ''}" @click=${() => { this._columns = 4; }}>4</button>
      </div>

      <h3>Operations Dashboard</h3>
      <div class="section">
        <kpi-metric-row .metrics=${DASHBOARD_METRICS} .columns=${this._columns}></kpi-metric-row>
        <div class="event-log">${this._lastClicked}</div>
      </div>

      <h3>IoT Fleet Overview</h3>
      <div class="section">
        <kpi-metric-row .metrics=${IOT_METRICS} .columns=${this._columns}></kpi-metric-row>
      </div>

      <h3>Empty State</h3>
      <div class="section">
        <kpi-metric-row .metrics=${[]}></kpi-metric-row>
      </div>
    `;
  }
}
