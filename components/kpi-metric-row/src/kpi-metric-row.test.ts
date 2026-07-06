import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MetricDefinition } from './kpi-metric-row.js';
import './kpi-metric-row.js';

type KpiMetricRowEl = HTMLElement & {
  metrics: MetricDefinition[];
  endpoint: string | null;
  columns: number | null;
  updateComplete: Promise<boolean>;
  configure: (props: Record<string, unknown>) => void;
  refresh: () => Promise<void>;
};

const sampleMetrics: MetricDefinition[] = [
  { key: 'cases', value: 142, label: 'Active Cases', unit: 'cases', status: 'normal' },
  { key: 'sla', value: '98.2', label: 'SLA Compliance', unit: '%', trend: { direction: 'up', delta: '+1.3%' }, status: 'normal' },
  { key: 'backlog', value: 23, label: 'Backlog', sparkline: [30, 28, 25, 27, 23], status: 'warning' },
];

describe('kpi-metric-row', () => {
  let el: KpiMetricRowEl;

  beforeEach(async () => {
    el = document.createElement('kpi-metric-row') as KpiMetricRowEl;
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => el.remove());

  it('renders empty state when no metrics', () => {
    expect(el.shadowRoot!.textContent).toContain('No metrics available');
  });

  it('renders metric cards', async () => {
    el.metrics = sampleMetrics;
    await el.updateComplete;
    const cards = el.shadowRoot!.querySelectorAll('[role="listitem"]');
    expect(cards.length).toBe(3);
  });

  it('renders value and label', async () => {
    el.metrics = [{ key: 'test', value: 42, label: 'Test Metric' }];
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('42');
    expect(el.shadowRoot!.textContent).toContain('Test Metric');
  });

  it('renders unit suffix', async () => {
    el.metrics = [{ key: 'test', value: 98, label: 'Score', unit: '%' }];
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain('%');
  });

  it('renders trend arrow and delta', async () => {
    el.metrics = [{ key: 'test', value: 50, label: 'Metric', trend: { direction: 'up', delta: '+5' } }];
    await el.updateComplete;
    const text = el.shadowRoot!.textContent!;
    expect(text).toContain('+5');
  });

  it('renders sparkline as SVG', async () => {
    el.metrics = [{ key: 'test', value: 10, label: 'Metric', sparkline: [5, 10, 8, 12, 10] }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('svg')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('polyline')).toBeTruthy();
  });

  it('renders status border', async () => {
    el.metrics = [{ key: 'test', value: 10, label: 'Metric', status: 'warning' }];
    await el.updateComplete;
    const card = el.shadowRoot!.querySelector('[role="listitem"]')!;
    expect(card.classList.contains('status-warning')).toBe(true);
  });

  it('emits pages-event on card click', async () => {
    el.metrics = [{ key: 'test', value: 42, label: 'Test' }];
    await el.updateComplete;
    const handler = vi.fn();
    document.addEventListener('pages-event', handler);
    el.shadowRoot!.querySelector<HTMLElement>('[role="listitem"]')!.click();
    const cardEvent = handler.mock.calls.find(
      (c: any) => c[0].detail.topic === 'kpi.card-clicked'
    );
    expect(cardEvent).toBeTruthy();
    expect(cardEvent![0].detail.payload.key).toBe('test');
    document.removeEventListener('pages-event', handler);
  });

  it('cards are keyboard accessible', async () => {
    el.metrics = [{ key: 'test', value: 42, label: 'Test' }];
    await el.updateComplete;
    const card = el.shadowRoot!.querySelector<HTMLElement>('[role="listitem"]')!;
    expect(card.getAttribute('tabindex')).toBe('0');
  });

  it('has aria-label on cards combining label, value, unit', async () => {
    el.metrics = [{ key: 'test', value: 42, label: 'Active', unit: 'cases' }];
    await el.updateComplete;
    const card = el.shadowRoot!.querySelector('[role="listitem"]')!;
    const label = card.getAttribute('aria-label')!;
    expect(label).toContain('Active');
    expect(label).toContain('42');
    expect(label).toContain('cases');
  });

  it('sparklines are aria-hidden', async () => {
    el.metrics = [{ key: 'test', value: 10, label: 'M', sparkline: [1, 2, 3] }];
    await el.updateComplete;
    const svg = el.shadowRoot!.querySelector('svg');
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
  });

  it('configure() sets properties', async () => {
    el.configure({ metrics: sampleMetrics, columns: 2 });
    await el.updateComplete;
    expect(el.columns).toBe(2);
    expect(el.shadowRoot!.querySelectorAll('[role="listitem"]').length).toBe(3);
  });
});
