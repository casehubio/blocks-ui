import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { DataEndpointMixin } from './data-endpoint.js';

@customElement('test-data-endpoint')
class TestComponent extends DataEndpointMixin(LitElement) {
  @property() subjectId?: string;
  fetchCount = 0;

  async fetchData(): Promise<void> {
    this.fetchCount++;
    const res = await this.fetchFn(`${this.endpoint}/items`, { signal: this.abortSignal });
    if (!res.ok) throw new Error('fetch failed');
  }

  override render() {
    if (this.loading) return html`<div class="loading">Loading</div>`;
    if (this.error) return html`<div class="error">${this.error}<button @click=${() => this.fetchData()}>Retry</button></div>`;
    return html`<div class="content">OK</div>`;
  }
}

describe('DataEndpointMixin', () => {
  let el: TestComponent;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  });
  afterEach(() => el?.remove());

  it('does not fetch without endpoint', async () => {
    el = document.createElement('test-data-endpoint') as TestComponent;
    el.fetchFn = mockFetch;
    document.body.appendChild(el);
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 10));
    expect(el.fetchCount).toBe(0);
  });

  it('fetches when endpoint is set via configure()', async () => {
    el = document.createElement('test-data-endpoint') as TestComponent;
    el.fetchFn = mockFetch;
    document.body.appendChild(el);
    el.configure({ endpoint: 'http://localhost:8080' });
    await new Promise(r => setTimeout(r, 10));
    expect(el.fetchCount).toBe(1);
  });

  it('fetches exactly once via configure() — no double-fetch from willUpdate', async () => {
    el = document.createElement('test-data-endpoint') as TestComponent;
    el.fetchFn = mockFetch;
    document.body.appendChild(el);
    el.configure({ endpoint: 'http://localhost:8080' });
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 50));
    expect(el.fetchCount).toBe(1);
  });

  it('re-fetches when endpoint changes via property', async () => {
    el = document.createElement('test-data-endpoint') as TestComponent;
    el.fetchFn = mockFetch;
    document.body.appendChild(el);
    el.endpoint = 'http://localhost:8080';
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 10));
    expect(el.fetchCount).toBe(1);
    el.endpoint = 'http://localhost:9090';
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 10));
    expect(el.fetchCount).toBe(2);
  });

  it('sets loading during fetch', async () => {
    let resolvePromise: () => void;
    mockFetch.mockReturnValue(new Promise(r => { resolvePromise = () => r({ ok: true }); }));
    el = document.createElement('test-data-endpoint') as TestComponent;
    el.fetchFn = mockFetch;
    document.body.appendChild(el);
    el.endpoint = 'http://localhost:8080';
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 10));
    expect(el.loading).toBe(true);
    resolvePromise!();
    await new Promise(r => setTimeout(r, 10));
    expect(el.loading).toBe(false);
  });

  it('sets error on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    el = document.createElement('test-data-endpoint') as TestComponent;
    el.fetchFn = mockFetch;
    document.body.appendChild(el);
    el.endpoint = 'http://localhost:8080';
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 10));
    expect(el.error).toContain('network down');
  });

  it('aborts in-flight fetch when endpoint changes', async () => {
    let abortSignals: AbortSignal[] = [];
    mockFetch.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.signal) abortSignals.push(init.signal);
      return new Promise(() => {});
    });
    el = document.createElement('test-data-endpoint') as TestComponent;
    el.fetchFn = mockFetch;
    document.body.appendChild(el);
    el.endpoint = 'http://localhost:8080';
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 10));
    el.endpoint = 'http://localhost:9090';
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 10));
    expect(abortSignals[0]?.aborted).toBe(true);
  });

  it('fetches when endpoint is empty string', async () => {
    el = document.createElement('test-data-endpoint') as TestComponent;
    el.fetchFn = mockFetch;
    el.endpoint = '';
    document.body.appendChild(el);
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 10));
    expect(el.fetchCount).toBe(1);
  });

  it('does not fetch when endpoint is not set', async () => {
    el = document.createElement('test-data-endpoint') as TestComponent;
    el.fetchFn = mockFetch;
    document.body.appendChild(el);
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 10));
    expect(el.fetchCount).toBe(0);
  });

  it('configure() sets identity', async () => {
    el = document.createElement('test-data-endpoint') as TestComponent;
    el.fetchFn = mockFetch;
    document.body.appendChild(el);
    el.configure({ endpoint: 'http://x', identity: { userId: 'u1', displayName: 'User', groups: [] } });
    expect(el.identity?.userId).toBe('u1');
  });
});
