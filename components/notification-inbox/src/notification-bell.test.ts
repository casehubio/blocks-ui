import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { SSEHandler, SSEEvent, SSESubscribeOptions, SSEManager } from '@casehubio/pages-data/dist/sse/sse-manager.js';
import './notification-bell.js';
import type { NotificationBell } from './notification-bell.js';

function fixture<T extends HTMLElement>(element: T): T {
  document.body.appendChild(element);
  return element;
}

// Mock SSEManager
class MockSSEManager {
  private subscribers = new Map<string, Array<{ handler: SSEHandler; options?: SSESubscribeOptions }>>();

  subscribe(url: string, handler: SSEHandler, options?: SSESubscribeOptions): void {
    if (!this.subscribers.has(url)) {
      this.subscribers.set(url, []);
    }
    this.subscribers.get(url)!.push({ handler, ...(options != null ? { options } : {}) });
  }

  unsubscribe(url: string, handler: SSEHandler): void {
    const handlers = this.subscribers.get(url);
    if (handlers) {
      const index = handlers.findIndex(h => h.handler === handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(url: string, event: SSEEvent): void {
    const handlers = this.subscribers.get(url);
    if (handlers) {
      for (const { handler, options } of handlers) {
        if (options?.eventNames) {
          if (options.eventNames.includes(event.type)) {
            handler(event);
          }
        } else {
          handler(event);
        }
      }
    }
  }

  getSubscriptions(url: string): Array<{ handler: SSEHandler; options?: SSESubscribeOptions }> {
    return this.subscribers.get(url) || [];
  }
}

describe('notification-bell', () => {
  let mockSSEManager: MockSSEManager;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSSEManager = new MockSSEManager();
    mockFetch = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders bell icon with no badge when unreadCount is 0', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0 }),
    });

    const el = fixture(document.createElement('notification-bell')) as NotificationBell;
    el.endpoint = 'http://localhost:8080';
    el.fetchFn = mockFetch;
    el.sseManager = mockSSEManager as unknown as SSEManager;
    await el.updateComplete;

    const button = el.shadowRoot!.querySelector('button');
    expect(button).toBeTruthy();

    const badge = el.shadowRoot!.querySelector('.badge');
    expect(badge).toBeFalsy();
  });

  it('shows badge with count when unreadCount > 0', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ count: 5 }),
    });

    const el = fixture(document.createElement('notification-bell')) as NotificationBell;
    el.endpoint = 'http://localhost:8080';
    el.fetchFn = mockFetch;
    el.sseManager = mockSSEManager as unknown as SSEManager;
    await el.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 10));

    const badge = el.shadowRoot!.querySelector('.badge');
    expect(badge).toBeTruthy();
    expect(badge!.textContent).toBe('5');
  });

  it('shows 99+ when unreadCount exceeds 99', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ count: 150 }),
    });

    const el = fixture(document.createElement('notification-bell')) as NotificationBell;
    el.endpoint = 'http://localhost:8080';
    el.fetchFn = mockFetch;
    el.sseManager = mockSSEManager as unknown as SSEManager;
    await el.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 10));

    const badge = el.shadowRoot!.querySelector('.badge');
    expect(badge).toBeTruthy();
    expect(badge!.textContent).toBe('99+');
  });

  it('toggles dropdown on click', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0 }),
    });

    const el = fixture(document.createElement('notification-bell')) as NotificationBell;
    el.endpoint = 'http://localhost:8080';
    el.fetchFn = mockFetch;
    el.sseManager = mockSSEManager as unknown as SSEManager;
    await el.updateComplete;

    const button = el.shadowRoot!.querySelector('button')!;

    expect(el.open).toBe(false);
    let dropdown = el.shadowRoot!.querySelector('.dropdown');
    expect(dropdown).toBeFalsy();

    button.click();
    await el.updateComplete;

    expect(el.open).toBe(true);
    dropdown = el.shadowRoot!.querySelector('.dropdown');
    expect(dropdown).toBeTruthy();

    button.click();
    await el.updateComplete;

    expect(el.open).toBe(false);
  });

  it('closes dropdown on Escape key', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0 }),
    });

    const el = fixture(document.createElement('notification-bell')) as NotificationBell;
    el.endpoint = 'http://localhost:8080';
    el.fetchFn = mockFetch;
    el.sseManager = mockSSEManager as unknown as SSEManager;
    el.open = true;
    await el.updateComplete;

    await el.updateComplete;
    expect(el.open).toBe(true);

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    el.dispatchEvent(event);
    await el.updateComplete;

    expect(el.open).toBe(false);
  });

  it('subscribes to SSE on connectedCallback with named events', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0 }),
    });

    const el = fixture(document.createElement('notification-bell')) as NotificationBell;
    el.endpoint = 'http://localhost:8080';
    el.fetchFn = mockFetch;
    el.sseManager = mockSSEManager as unknown as SSEManager;
    await el.updateComplete;

    const subs = mockSSEManager.getSubscriptions('http://localhost:8080/notifications/stream');
    expect(subs.length).toBe(1);
    expect(subs[0]!.options?.eventNames).toEqual(['notification', 'notification-updated', 'unread-count']);
  });

  it('updates unreadCount from SSE unread-count event', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ count: 5 }),
    });

    const el = fixture(document.createElement('notification-bell')) as NotificationBell;
    el.endpoint = 'http://localhost:8080';
    el.fetchFn = mockFetch;
    el.sseManager = mockSSEManager as unknown as SSEManager;
    await el.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 10));

    let badge = el.shadowRoot!.querySelector('.badge');
    expect(badge!.textContent).toBe('5');

    mockSSEManager.emit('http://localhost:8080/notifications/stream', {
      type: 'unread-count',
      data: { count: 10 },
    });

    await el.updateComplete;

    badge = el.shadowRoot!.querySelector('.badge');
    expect(badge!.textContent).toBe('10');
  });

  it('increments count optimistically on SSE notification event', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ count: 5 }),
    });

    const el = fixture(document.createElement('notification-bell')) as NotificationBell;
    el.endpoint = 'http://localhost:8080';
    el.fetchFn = mockFetch;
    el.sseManager = mockSSEManager as unknown as SSEManager;
    await el.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 10));

    let badge = el.shadowRoot!.querySelector('.badge');
    expect(badge!.textContent).toBe('5');

    mockSSEManager.emit('http://localhost:8080/notifications/stream', {
      type: 'notification',
      data: { id: 'n1', title: 'New notification' },
    });

    await el.updateComplete;

    badge = el.shadowRoot!.querySelector('.badge');
    expect(badge!.textContent).toBe('6');
  });

  it('aria-label includes count when unread', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ count: 3 }),
    });

    const el = fixture(document.createElement('notification-bell')) as NotificationBell;
    el.endpoint = 'http://localhost:8080';
    el.fetchFn = mockFetch;
    el.sseManager = mockSSEManager as unknown as SSEManager;
    await el.updateComplete;
    await new Promise(resolve => setTimeout(resolve, 10));

    const button = el.shadowRoot!.querySelector('button')!;
    expect(button.getAttribute('aria-label')).toContain('3');
  });

  it('aria-expanded reflects open state', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ count: 0 }),
    });

    const el = fixture(document.createElement('notification-bell')) as NotificationBell;
    el.endpoint = 'http://localhost:8080';
    el.fetchFn = mockFetch;
    el.sseManager = mockSSEManager as unknown as SSEManager;
    await el.updateComplete;

    const button = el.shadowRoot!.querySelector('button')!;
    expect(button.getAttribute('aria-expanded')).toBe('false');

    button.click();
    await el.updateComplete;

    expect(button.getAttribute('aria-expanded')).toBe('true');
  });
});
