import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiveRegionMixin, emitPagesEvent } from '@casehubio/blocks-ui-core';

export const KpiMetricRowTopics = {
  CARD_CLICKED: 'kpi.card-clicked',
} as const;

export interface MetricDefinition {
  readonly key: string;
  readonly value: number | string;
  readonly label: string;
  readonly unit?: string;
  readonly trend?: { readonly direction: 'up' | 'down' | 'stable'; readonly delta: string };
  readonly sparkline?: readonly number[];
  readonly status?: 'normal' | 'warning' | 'critical';
}

const TREND_ARROWS: Record<string, string> = { up: '▲', down: '▼', stable: '—' };

function renderSparkline(data: readonly number[]): TemplateResult {
  if (data.length < 2) return html``;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 48;
  const h = 20;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  const polygonPoints = `0,${h} ${points} ${w},${h}`;

  return html`
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" class="sparkline">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="currentColor" stop-opacity="0.2" />
          <stop offset="100%" stop-color="currentColor" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points="${polygonPoints}" fill="url(#spark-fill)" />
      <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
    </svg>
  `;
}

@customElement('kpi-metric-row')
export class KpiMetricRow extends LiveRegionMixin(LitElement) {
  @property({ type: Array }) metrics: MetricDefinition[] = [];
  @property({ type: String }) endpoint: string | null = null;
  @property({ type: Number }) columns: number | null = null;

  @state() private _loading = false;
  @state() private _error: string | null = null;

  static override styles = css`
    :host { display: block; font-family: var(--blocks-font-family, system-ui); }

    .grid {
      display: grid;
      gap: var(--blocks-space-3, 12px);
    }

    .empty {
      text-align: center;
      padding: var(--blocks-space-6, 24px);
      color: var(--blocks-neutral-9, #888);
      font-size: var(--blocks-font-size-base, 14px);
    }

    .error {
      text-align: center;
      padding: var(--blocks-space-4, 16px);
      color: var(--blocks-danger-9, #dc2626);
      font-size: var(--blocks-font-size-sm, 12px);
    }

    .card {
      background: var(--blocks-neutral-2, #fafafa);
      border-radius: var(--blocks-radius-md, 6px);
      padding: var(--blocks-space-4, 16px);
      border-left: 3px solid transparent;
      cursor: pointer;
      transition: background var(--blocks-duration-fast, 120ms) var(--blocks-ease-out);
      outline: none;
    }

    .card:hover { background: var(--blocks-neutral-3, #f5f5f5); }
    .card:focus-visible { outline: 2px solid var(--blocks-accent-9, #2563eb); outline-offset: 2px; }

    .card.status-normal { border-left-color: var(--blocks-success-9, #16a34a); }
    .card.status-warning { border-left-color: var(--blocks-warning-9, #d97706); }
    .card.status-critical { border-left-color: var(--blocks-danger-9, #dc2626); }

    .value-row { display: flex; align-items: baseline; gap: var(--blocks-space-1, 4px); }

    .value {
      font-size: var(--blocks-font-size-2xl, 24px);
      font-weight: var(--blocks-font-weight-bold, 700);
      color: var(--blocks-neutral-12, #111);
      font-variant-numeric: tabular-nums;
    }

    .unit {
      font-size: var(--blocks-font-size-sm, 12px);
      color: var(--blocks-neutral-9, #888);
    }

    .label {
      font-size: var(--blocks-font-size-sm, 12px);
      color: var(--blocks-neutral-9, #888);
      margin-top: var(--blocks-space-1, 4px);
    }

    .trend {
      display: inline-flex;
      align-items: center;
      gap: var(--blocks-space-0.5, 2px);
      font-size: var(--blocks-font-size-xs, 11px);
      margin-top: var(--blocks-space-1, 4px);
    }

    .trend.up { color: var(--blocks-success-9, #16a34a); }
    .trend.down { color: var(--blocks-danger-9, #dc2626); }
    .trend.stable { color: var(--blocks-neutral-9, #888); }

    .sparkline { margin-top: var(--blocks-space-2, 8px); }
    .card.status-warning .sparkline { color: var(--blocks-warning-9, #d97706); }
    .card.status-critical .sparkline { color: var(--blocks-danger-9, #dc2626); }
    .card.status-normal .sparkline { color: var(--blocks-success-9, #16a34a); }
    .sparkline { color: var(--blocks-accent-9, #2563eb); }

    .skeleton-card {
      background: var(--blocks-neutral-3, #f5f5f5);
      border-radius: var(--blocks-radius-md, 6px);
      padding: var(--blocks-space-4, 16px);
      min-height: 80px;
      animation: shimmer 1.5s ease-in-out infinite;
    }

    @keyframes shimmer {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    @media (prefers-reduced-motion: reduce) {
      .card { transition: none; }
      .skeleton-card { animation: none; }
    }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.endpoint) this._fetchMetrics();
  }

  override render() {
    const gridStyle = this.columns
      ? `grid-template-columns: repeat(${this.columns}, 1fr)`
      : 'grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))';

    if (this._loading) {
      const count = this.columns ?? 3;
      return html`
        <div class="grid" role="list" style="${gridStyle}">
          ${Array.from({ length: count }, () => html`<div class="skeleton-card"></div>`)}
        </div>
      `;
    }

    if (this._error) {
      return html`<div class="error">${this._error}</div>`;
    }

    if (this.metrics.length === 0) {
      return html`<div class="empty">No metrics available</div>`;
    }

    return html`
      <div class="grid" role="list" style="${gridStyle}">
        ${this.metrics.map(m => this._renderCard(m))}
      </div>
    `;
  }

  private _renderCard(m: MetricDefinition): TemplateResult {
    const statusClass = m.status ? `status-${m.status}` : '';
    const ariaLabel = [m.label, String(m.value), m.unit, m.trend ? `${m.trend.direction} ${m.trend.delta}` : '']
      .filter(Boolean).join(' ');

    return html`
      <div
        class="card ${statusClass}"
        role="listitem"
        tabindex="0"
        aria-label="${ariaLabel}"
        @click=${() => this._handleCardClick(m)}
        @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._handleCardClick(m); } }}
      >
        <div class="value-row">
          <span class="value">${m.value}</span>
          ${m.unit ? html`<span class="unit">${m.unit}</span>` : nothing}
        </div>
        <div class="label">${m.label}</div>
        ${m.trend ? html`
          <span class="trend ${m.trend.direction}">
            ${TREND_ARROWS[m.trend.direction]} ${m.trend.delta}
          </span>
        ` : nothing}
        ${m.sparkline ? renderSparkline(m.sparkline) : nothing}
      </div>
    `;
  }

  private _handleCardClick(m: MetricDefinition): void {
    this.announce(`Selected ${m.label}: ${m.value} ${m.unit ?? ''}`);
    emitPagesEvent(this, KpiMetricRowTopics.CARD_CLICKED, {
      key: m.key,
      value: m.value,
      label: m.label,
    });
  }

  private async _fetchMetrics(): Promise<void> {
    if (!this.endpoint) return;
    this._loading = true;
    this._error = null;
    try {
      const resp = await fetch(this.endpoint);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this.metrics = data as MetricDefinition[];
    } catch (e) {
      this._error = `Failed to load metrics: ${(e as Error).message}`;
    } finally {
      this._loading = false;
    }
  }

  async refresh(): Promise<void> {
    await this._fetchMetrics();
  }

  configure(props: {
    metrics?: MetricDefinition[];
    endpoint?: string | null;
    columns?: number | null;
  }): void {
    if (props.metrics !== undefined) this.metrics = props.metrics;
    if (props.endpoint !== undefined) this.endpoint = props.endpoint;
    if (props.columns !== undefined) this.columns = props.columns;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'kpi-metric-row': KpiMetricRow;
  }
}
