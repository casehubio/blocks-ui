import { describe, it, expect, vi } from 'vitest';
import { fetchSource } from './fetch-source.js';
import type { DataSink } from '@casehubio/pages-data';

function createMockSink(): DataSink & { applyCalls: any[]; errorCalls: any[] } {
  const sink = {
    applyCalls: [] as any[],
    errorCalls: [] as any[],
    apply(event: any) { sink.applyCalls.push(event); },
    error(err: any) { sink.errorCalls.push(err); },
  };
  return sink;
}

function mockFetchOk(data: unknown): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  }) as unknown as typeof globalThis.fetch;
}

function mockFetchFail(status: number): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
  }) as unknown as typeof globalThis.fetch;
}

function mockFetchReject(message: string): typeof globalThis.fetch {
  return vi.fn().mockRejectedValue(new Error(message)) as unknown as typeof globalThis.fetch;
}

describe('fetchSource', () => {
  it('delivers JSON response as snapshot dataset', async () => {
    const data = [{ id: 1, name: 'Alice' }];
    const source = fetchSource('http://api/items', { fetchFn: mockFetchOk(data) });
    const sink = createMockSink();
    source.connect(sink);
    await new Promise(r => setTimeout(r, 10));

    expect(sink.applyCalls).toHaveLength(1);
    expect(sink.applyCalls[0].type).toBe('snapshot');
    expect(sink.applyCalls[0].dataset).toEqual(data);
  });

  it('calls sink.error on HTTP failure', async () => {
    const source = fetchSource('http://api/items', { fetchFn: mockFetchFail(500) });
    const sink = createMockSink();
    source.connect(sink);
    await new Promise(r => setTimeout(r, 10));

    expect(sink.errorCalls).toHaveLength(1);
    expect(sink.errorCalls[0].message).toContain('500');
    expect(sink.errorCalls[0].permanent).toBe(true);
  });

  it('calls sink.error on network failure', async () => {
    const source = fetchSource('http://api/items', { fetchFn: mockFetchReject('network down') });
    const sink = createMockSink();
    source.connect(sink);
    await new Promise(r => setTimeout(r, 10));

    expect(sink.errorCalls).toHaveLength(1);
    expect(sink.errorCalls[0].message).toContain('network down');
  });

  it('does not call sink after disconnect (abort)', async () => {
    let resolvePromise!: (v: any) => void;
    const fetchFn = vi.fn().mockReturnValue(
      new Promise(r => { resolvePromise = r; })
    ) as unknown as typeof globalThis.fetch;

    const source = fetchSource('http://api/items', { fetchFn });
    const sink = createMockSink();
    source.connect(sink);
    source.disconnect();

    resolvePromise({ ok: true, json: () => Promise.resolve([]) });
    await new Promise(r => setTimeout(r, 10));

    expect(sink.applyCalls).toHaveLength(0);
    expect(sink.errorCalls).toHaveLength(0);
  });

  it('passes static headers', async () => {
    const fetchFn = mockFetchOk([]);
    const source = fetchSource('http://api/items', {
      fetchFn,
      headers: { 'X-Custom': 'value' },
    });
    const sink = createMockSink();
    source.connect(sink);
    await new Promise(r => setTimeout(r, 10));

    expect(fetchFn).toHaveBeenCalledWith('http://api/items', expect.objectContaining({
      headers: { 'X-Custom': 'value' },
    }));
  });

  it('evaluates dynamic headers function on each connect', async () => {
    let callCount = 0;
    const fetchFn = mockFetchOk([]);
    const source = fetchSource('http://api/items', {
      fetchFn,
      headers: () => {
        callCount++;
        return { 'X-Call': String(callCount) };
      },
    });
    const sink = createMockSink();

    source.connect(sink);
    await new Promise(r => setTimeout(r, 10));
    expect(fetchFn).toHaveBeenCalledWith('http://api/items', expect.objectContaining({
      headers: { 'X-Call': '1' },
    }));

    source.disconnect();
    source.connect(sink);
    await new Promise(r => setTimeout(r, 10));
    expect(fetchFn).toHaveBeenLastCalledWith('http://api/items', expect.objectContaining({
      headers: { 'X-Call': '2' },
    }));
  });

  it('uses custom method', async () => {
    const fetchFn = mockFetchOk([]);
    const source = fetchSource('http://api/items', { fetchFn, method: 'POST' });
    const sink = createMockSink();
    source.connect(sink);
    await new Promise(r => setTimeout(r, 10));

    expect(fetchFn).toHaveBeenCalledWith('http://api/items', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('passes body', async () => {
    const fetchFn = mockFetchOk([]);
    const source = fetchSource('http://api/items', { fetchFn, body: '{"q":"x"}' });
    const sink = createMockSink();
    source.connect(sink);
    await new Promise(r => setTimeout(r, 10));

    expect(fetchFn).toHaveBeenCalledWith('http://api/items', expect.objectContaining({
      body: '{"q":"x"}',
    }));
  });

  it('uses globalThis.fetch when no fetchFn provided', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetchOk({ result: true });
    try {
      const source = fetchSource('http://api/items');
      const sink = createMockSink();
      source.connect(sink);
      await new Promise(r => setTimeout(r, 10));

      expect(sink.applyCalls).toHaveLength(1);
      expect(sink.applyCalls[0].dataset).toEqual({ result: true });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
