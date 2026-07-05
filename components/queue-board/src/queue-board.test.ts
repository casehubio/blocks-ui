import { describe, it, expect, beforeAll, vi } from 'vitest';
import './queue-board.js';
import './queue-card.js';
import type { QueueBoard } from './queue-board.js';

// Mock EventSource for jsdom environment
class MockEventSource {
  url: string;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  close() {}
}

// Mock IntersectionObserver for jsdom environment
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
  }

  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

beforeAll(() => {
  (global as any).EventSource = MockEventSource;
  (global as any).IntersectionObserver = MockIntersectionObserver;
});

describe('QueueBoard', () => {
  it('renders without crashing', async () => {
    const element = document.createElement('queue-board') as QueueBoard;
    element.endpoint = 'http://test.local';
    document.body.appendChild(element);

    await new Promise((resolve) => setTimeout(resolve, 100));
    await element.updateComplete;

    expect(element).toBeTruthy();
    expect(element.shadowRoot).toBeTruthy();

    document.body.removeChild(element);
  });

  it('shows loading state initially', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    let resolveQueues: (value: Response) => void;
    const queuesPromise = new Promise<Response>((resolve) => {
      resolveQueues = resolve;
    });

    fetchSpy.mockImplementation(async (url) => {
      if (url === 'http://test.local/queues') {
        return queuesPromise;
      }
      return new Response('Not Found', { status: 404 });
    });

    const element = document.createElement('queue-board') as QueueBoard;
    element.endpoint = 'http://test.local';
    document.body.appendChild(element);

    await element.updateComplete;

    // Should show skeleton while loading
    const skeleton = element.shadowRoot!.querySelector('.skeleton');
    expect(skeleton).toBeTruthy();

    // Clean up
    resolveQueues!(new Response(JSON.stringify([]), { status: 200 }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    document.body.removeChild(element);
    fetchSpy.mockRestore();
  });

  it('switches to list view when a card is clicked', async () => {
    const element = document.createElement('queue-board') as QueueBoard;
    element.endpoint = 'http://test.local';
    document.body.appendChild(element);

    await element.updateComplete;

    // Manually trigger list mode
    (element as any)._handleCardClick('q1', 'Test Queue');
    await element.updateComplete;

    // Should emit pages-event
    const eventSpy = vi.fn();
    element.addEventListener('pages-event', eventSpy);

    (element as any)._handleCardClick('q1', 'Test Queue');

    expect(eventSpy).toHaveBeenCalled();

    document.body.removeChild(element);
  });

  it('returns to dashboard on Escape key', async () => {
    const element = document.createElement('queue-board') as QueueBoard;
    element.endpoint = 'http://test.local';
    document.body.appendChild(element);

    await element.updateComplete;

    // Enter list mode
    (element as any)._selectedQueueId = 'q1';
    (element as any)._viewMode = 'list';
    await element.updateComplete;

    // Press Escape
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    element.dispatchEvent(escapeEvent);

    await element.updateComplete;

    // Should be back in dashboard mode
    expect((element as any)._viewMode).toBe('dashboard');
    expect((element as any)._selectedQueueId).toBeNull();

    document.body.removeChild(element);
  });
});

describe('QueueCard', () => {
  it('renders queue name and count', async () => {
    const card = document.createElement('queue-card') as any;
    card.queueName = 'Test Queue';
    card.summary = {
      total: 5,
      priorityBreakdown: new Map(),
      breachCount: 0,
      oldestAgeMs: 1000 * 60 * 30,
    };

    document.body.appendChild(card);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const queueName = card.shadowRoot!.querySelector('.queue-name')?.textContent;
    expect(queueName).toBe('Test Queue');

    const itemCount = card.shadowRoot!.querySelector('.item-count')?.textContent;
    expect(itemCount).toBe('5');

    document.body.removeChild(card);
  });

  it('shows breach indicator when items are breached', async () => {
    const card = document.createElement('queue-card') as any;
    card.queueName = 'Urgent Queue';
    card.summary = {
      total: 3,
      priorityBreakdown: new Map(),
      breachCount: 2,
      oldestAgeMs: null,
    };

    document.body.appendChild(card);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const breachText = card.shadowRoot!.querySelector('.sla-status')?.textContent;
    expect(breachText).toContain('2 breached');

    const cardEl = card.shadowRoot!.querySelector('.card');
    expect(cardEl?.classList.contains('breached')).toBe(true);

    document.body.removeChild(card);
  });

  it('formats age correctly', async () => {
    const card = document.createElement('queue-card') as any;
    card.queueName = 'Queue';
    card.summary = {
      total: 1,
      priorityBreakdown: new Map(),
      breachCount: 0,
      oldestAgeMs: 1000 * 60 * 90, // 90 minutes = 1.5 hours
    };

    document.body.appendChild(card);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const ageText = card.shadowRoot!.querySelector('.oldest-age')?.textContent;
    expect(ageText).toContain('1h'); // Should show in hours

    document.body.removeChild(card);
  });
});
