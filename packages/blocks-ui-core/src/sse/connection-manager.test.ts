import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SSEManager, type SSEEvent } from './connection-manager.js';

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0; // CONNECTING
  url: string;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    setTimeout(() => { this.readyState = 1; }, 0); // OPEN
  }

  close(): void {
    this.readyState = 2; // CLOSED
  }

  simulateMessage(data: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }
}

describe('SSEManager', () => {
  let manager: SSEManager;

  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
    manager = new SSEManager();
  });

  afterEach(() => {
    manager.disconnectAll();
    vi.unstubAllGlobals();
  });

  it('creates one EventSource per unique URL', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    manager.subscribe('/events', h1);
    manager.subscribe('/events', h2);
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it('dispatches events to all subscribers', async () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    manager.subscribe('/events', h1);
    manager.subscribe('/events', h2);
    MockEventSource.instances[0]!.simulateMessage({ type: 'test', id: '1' });

    // Wait for RAF flush
    await new Promise(resolve => requestAnimationFrame(resolve));

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('closes EventSource when last subscriber unsubscribes', () => {
    const h1 = vi.fn();
    manager.subscribe('/events', h1);
    manager.unsubscribe('/events', h1);
    expect(MockEventSource.instances[0]!.readyState).toBe(2);
  });

  it('reports connection status', () => {
    manager.subscribe('/events', vi.fn());
    expect(manager.status('/events')).toBe('connected');
    expect(manager.status('/other')).toBe('disconnected');
  });
});
