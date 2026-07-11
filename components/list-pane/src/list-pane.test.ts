import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { emitPagesEvent } from '@casehubio/blocks-ui-core';
import type { ColumnDef } from '@casehubio/pages-data-table';
import './list-pane.js';

type ListPaneEl = HTMLElement & {
  endpoint: string;
  columns: ColumnDef<any>[];
  getRowKey: (row: any) => string;
  getRowClass: (row: any) => string;
  selectionTopic: string;
  emptyMessage: string;
  pageSize: number;
  loading: boolean;
  error: string;
  dataSet: unknown;
  refresh(): void;
  updateComplete: Promise<boolean>;
};

const testColumns: ColumnDef<any>[] = [
  { id: 'name', header: 'Name', cell: (row: any) => row.name },
  { id: 'status', header: 'Status', cell: (row: any) => row.status },
];

const testRows = [
  { id: '1', name: 'Case A', status: 'open' },
  { id: '2', name: 'Case B', status: 'closed' },
];

function mockFetch(data: unknown = testRows): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function mockFetchFail(status: number): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
  });
}

let originalFetch: typeof globalThis.fetch;

function createElement(opts: Partial<{ endpoint: string; topic: string }> = {}): ListPaneEl {
  const el = document.createElement('list-pane') as ListPaneEl;
  if (opts.endpoint !== undefined) el.endpoint = opts.endpoint;
  else el.endpoint = '/api/items';
  el.selectionTopic = opts.topic ?? 'test';
  el.columns = testColumns;
  el.getRowKey = (row: any) => row.id;
  return el;
}

async function flush(): Promise<void> {
  await new Promise(r => setTimeout(r, 20));
}

describe('list-pane', () => {
  let el: ListPaneEl;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = mockFetch() as unknown as typeof fetch;
  });

  afterEach(() => {
    el?.remove();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('data fetching', () => {
    it('fetches from endpoint on connect', async () => {
      const fetchFn = mockFetch();
      globalThis.fetch = fetchFn as unknown as typeof fetch;
      el = createElement();
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      expect(fetchFn).toHaveBeenCalledWith('/api/items', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });

    it('handles array response', async () => {
      globalThis.fetch = mockFetch(testRows) as unknown as typeof fetch;
      el = createElement();
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      await el.updateComplete;
      const table = el.shadowRoot!.querySelector('pages-data-table') as any;
      expect(table?.rows?.length).toBe(2);
    });

    it('handles { items, total } response', async () => {
      globalThis.fetch = mockFetch({ items: testRows, total: 100 }) as unknown as typeof fetch;
      el = createElement();
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      await el.updateComplete;
      const table = el.shadowRoot!.querySelector('pages-data-table') as any;
      expect(table?.rows?.length).toBe(2);
      expect(table?.totalRows).toBe(100);
    });

    it('does not fetch when endpoint is not set', async () => {
      const fetchFn = mockFetch();
      globalThis.fetch = fetchFn as unknown as typeof fetch;
      el = document.createElement('list-pane') as ListPaneEl;
      el.columns = testColumns;
      el.getRowKey = (row: any) => row.id;
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('shows empty message when no data', async () => {
      globalThis.fetch = mockFetch([]) as unknown as typeof fetch;
      el = createElement();
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      await el.updateComplete;
      expect(el.shadowRoot!.textContent).toContain('No items found');
    });

    it('shows custom empty message', async () => {
      globalThis.fetch = mockFetch([]) as unknown as typeof fetch;
      el = createElement();
      el.emptyMessage = 'Nothing here';
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      await el.updateComplete;
      expect(el.shadowRoot!.textContent).toContain('Nothing here');
    });

    it('sets error on fetch failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
      el = createElement();
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      expect(el.error).toContain('network down');
    });

    it('sets error on non-ok response', async () => {
      globalThis.fetch = mockFetchFail(500) as unknown as typeof fetch;
      el = createElement();
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      expect(el.error).toContain('500');
    });
  });

  describe('selection events', () => {
    it('emits topic:selected on row activation', async () => {
      globalThis.fetch = mockFetch() as unknown as typeof fetch;
      el = createElement();
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      await el.updateComplete;

      const events: any[] = [];
      document.addEventListener('pages-event', ((e: CustomEvent) => {
        if (e.detail?.topic === 'test:selected') events.push(e.detail);
      }) as EventListener);

      const table = el.shadowRoot!.querySelector('pages-data-table') as HTMLElement;
      table.dispatchEvent(new CustomEvent('row-activate', {
        bubbles: true,
        detail: { row: testRows[0], index: 0 },
      }));

      expect(events.length).toBe(1);
      expect(events[0].payload).toEqual(testRows[0]);
    });

    it('does not emit when no selection-topic is set', async () => {
      globalThis.fetch = mockFetch() as unknown as typeof fetch;
      el = createElement();
      el.selectionTopic = '';
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      await el.updateComplete;

      const events: any[] = [];
      document.addEventListener('pages-event', ((e: CustomEvent) => {
        events.push(e.detail);
      }) as EventListener);

      const table = el.shadowRoot!.querySelector('pages-data-table') as HTMLElement;
      table?.dispatchEvent(new CustomEvent('row-activate', {
        bubbles: true,
        detail: { row: testRows[0], index: 0 },
      }));

      expect(events.length).toBe(0);
    });
  });

  describe('refresh', () => {
    it('refresh() re-fetches data', async () => {
      const fetchFn = mockFetch();
      globalThis.fetch = fetchFn as unknown as typeof fetch;
      el = createElement();
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();

      fetchFn.mockClear();
      el.refresh();
      await flush();
      expect(fetchFn).toHaveBeenCalled();
    });

    it('responds to topic:refresh event', async () => {
      const fetchFn = mockFetch();
      globalThis.fetch = fetchFn as unknown as typeof fetch;
      el = createElement();
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();

      fetchFn.mockClear();
      emitPagesEvent(document, 'test:refresh', {});
      await flush();
      expect(fetchFn).toHaveBeenCalled();
    });
  });

  describe('table configuration', () => {
    it('configures data-table with selection=single and mode=paginated', async () => {
      globalThis.fetch = mockFetch() as unknown as typeof fetch;
      el = createElement();
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      await el.updateComplete;

      const table = el.shadowRoot!.querySelector('pages-data-table') as any;
      expect(table?.getAttribute('selection')).toBe('single');
      expect(table?.getAttribute('mode')).toBe('paginated');
    });

    it('enables client-sort and client-filter on data-table', async () => {
      globalThis.fetch = mockFetch() as unknown as typeof fetch;
      el = createElement();
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      await el.updateComplete;

      const table = el.shadowRoot!.querySelector('pages-data-table') as any;
      expect(table?.hasAttribute('client-sort')).toBe(true);
      expect(table?.hasAttribute('client-filter')).toBe(true);
    });

    it('passes page-size to data-table', async () => {
      globalThis.fetch = mockFetch() as unknown as typeof fetch;
      el = createElement();
      el.pageSize = 10;
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      await el.updateComplete;

      const table = el.shadowRoot!.querySelector('pages-data-table') as any;
      expect(table?.pageSize).toBe(10);
    });

    it('passes columns and row key to data-table', async () => {
      globalThis.fetch = mockFetch() as unknown as typeof fetch;
      el = createElement();
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      await el.updateComplete;

      const table = el.shadowRoot!.querySelector('pages-data-table') as any;
      expect(table?.columns).toBe(testColumns);
      expect(table?.getRowKey).toBe(el.getRowKey);
    });
  });

  describe('accessibility', () => {
    it('host has tabindex -1 for programmatic focus', async () => {
      globalThis.fetch = mockFetch() as unknown as typeof fetch;
      el = createElement();
      document.body.appendChild(el);
      await el.updateComplete;
      expect(el.getAttribute('tabindex')).toBe('-1');
    });

    it('empty state has role=status', async () => {
      globalThis.fetch = mockFetch([]) as unknown as typeof fetch;
      el = createElement();
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      await el.updateComplete;
      const status = el.shadowRoot!.querySelector('[role="status"]');
      expect(status).toBeTruthy();
    });
  });

  describe('re-fetch on endpoint change', () => {
    it('re-fetches when endpoint property changes', async () => {
      const fetchFn = mockFetch();
      globalThis.fetch = fetchFn as unknown as typeof fetch;
      el = createElement();
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();

      fetchFn.mockClear();
      el.endpoint = '/api/other';
      await el.updateComplete;
      await flush();
      expect(fetchFn).toHaveBeenCalledWith('/api/other', expect.anything());
    });
  });
});
