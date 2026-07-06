import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './queue-pill-bar.js';
import type { QueueView, QueueSummaryEntry } from '@casehubio/blocks-ui-core';

const QUEUES: QueueView[] = [
  { id: 'q1', name: 'Compliance', labelPattern: 'domain=compliance', scope: null },
  { id: 'q2', name: 'Clinical Safety', labelPattern: 'domain=clinical', scope: null },
];

const SUMMARIES: QueueSummaryEntry[] = [
  { queueId: 'q1', count: 12, breachCount: 0 },
  { queueId: 'q2', count: 8, breachCount: 2 },
];

describe('queue-pill-bar', () => {
  let el: HTMLElement & {
    queues: QueueView[];
    summaries: QueueSummaryEntry[];
    selectedQueueId: string | null;
    selectedQueueCount: number | null;
  };

  beforeEach(async () => {
    // Mock IntersectionObserver
    global.IntersectionObserver = class IntersectionObserver {
      callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        // Immediately trigger visibility for tests
        setTimeout(() => {
          this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this);
        }, 0);
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() { return []; }
      root = null;
      rootMargin = '';
      thresholds = [];
    } as any;

    el = document.createElement('queue-pill-bar') as any;
    el.queues = QUEUES;
    el.summaries = SUMMARIES;
    document.body.appendChild(el);
    await (el as any).updateComplete;
  });

  afterEach(() => el.remove());

  it('renders a pill for each queue', () => {
    const pills = el.shadowRoot!.querySelectorAll('[role="radio"]');
    expect(pills.length).toBe(2);
  });

  it('shows queue name and count', () => {
    const pill = el.shadowRoot!.querySelector('[data-id="q1"]');
    expect(pill?.textContent).toContain('Compliance');
    expect(pill?.textContent).toContain('12');
  });

  it('shows breach badge when breachCount > 0', () => {
    const pill = el.shadowRoot!.querySelector('[data-id="q2"]');
    const badge = pill?.querySelector('.pill-badge');
    expect(badge?.textContent?.trim()).toBe('2');
  });

  it('sorts pills by urgency — breached first', () => {
    const pills = el.shadowRoot!.querySelectorAll('[role="radio"]');
    expect(pills[0]?.getAttribute('data-id')).toBe('q2');
    expect(pills[1]?.getAttribute('data-id')).toBe('q1');
  });

  it('emits queue.scope-changed on pill click', async () => {
    const handler = vi.fn();
    el.addEventListener('pages-event', handler);
    const pill = el.shadowRoot!.querySelector('[data-id="q1"]') as HTMLElement;
    pill.click();
    expect(handler).toHaveBeenCalled();
    const detail = handler.mock.calls[0][0].detail;
    expect(detail.topic).toBe('queue.scope-changed');
    expect(detail.payload.queue.id).toBe('q1');
  });

  it('emits null queue on deselect (click active pill)', async () => {
    el.selectedQueueId = 'q1';
    await (el as any).updateComplete;
    const handler = vi.fn();
    el.addEventListener('pages-event', handler);
    const pill = el.shadowRoot!.querySelector('[data-id="q1"]') as HTMLElement;
    pill.click();
    expect(handler.mock.calls[0][0].detail.payload.queue).toBeNull();
  });

  it('loads queues when endpoint is empty string (mock-fetch pattern)', async () => {
    const mockQueues = [{ id: 'q1', name: 'Test', labelPattern: 'domain=test', scope: null }];
    const mockSummaries = [{ queueId: 'q1', count: 5, breachCount: 0 }];
    const originalFetch = window.fetch;
    window.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/queues') return Promise.resolve(new Response(JSON.stringify(mockQueues), { status: 200 }));
      if (url === '/queues/summary') return Promise.resolve(new Response(JSON.stringify(mockSummaries), { status: 200 }));
      return originalFetch(url);
    });

    const freshEl = document.createElement('queue-pill-bar') as any;
    freshEl.endpoint = '';
    document.body.appendChild(freshEl);
    await freshEl.updateComplete;
    await new Promise(r => setTimeout(r, 10));
    await freshEl.updateComplete;

    const pills = freshEl.shadowRoot!.querySelectorAll('[role="radio"]');
    expect(pills.length).toBe(1);
    expect(pills[0]?.textContent).toContain('Test');

    freshEl.remove();
    window.fetch = originalFetch;
  });

  it('uses selectedQueueCount for active pill when provided', async () => {
    el.selectedQueueId = 'q1';
    el.selectedQueueCount = 15;
    await (el as any).updateComplete;
    const pill = el.shadowRoot!.querySelector('[data-id="q1"]');
    expect(pill?.textContent).toContain('15');
  });
});
