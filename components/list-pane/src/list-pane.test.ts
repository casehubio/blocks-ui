import { describe, it, expect, vi, afterEach } from 'vitest';
import { emitPagesEvent } from '@casehubio/blocks-ui-core';
import type { ColumnDef } from '@casehubio/blocks-ui-data-table';
import './list-pane.js';

type ListPaneEl = HTMLElement & {
  endpoint: string;
  columns: ColumnDef<any>[];
  getRowKey: (row: any) => string;
  getRowClass: (row: any) => string;
  selectionTopic: string;
  emptyMessage: string;
  pageSize: number;
  fetchFn: typeof fetch;
  loading: boolean;
  error: string | null;
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

function mockFetch(data: unknown = testRows): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  }) as unknown as typeof fetch;
}

function createElement(opts: Partial<{ endpoint: string; topic: string; fetchFn: typeof fetch }> = {}): ListPaneEl {
  const el = document.createElement('list-pane') as ListPaneEl;
  el.endpoint = opts.endpoint ?? '/api/items';
  el.selectionTopic = opts.topic ?? 'test';
  el.columns = testColumns;
  el.getRowKey = (row: any) => row.id;
  el.fetchFn = opts.fetchFn ?? mockFetch();
  return el;
}

async function flush(): Promise<void> {
  await new Promise(r => setTimeout(r, 10));
}

describe('list-pane', () => {
  let el: ListPaneEl;

  afterEach(() => {
    el?.remove();
    vi.restoreAllMocks();
  });

  describe('data fetching', () => {
    it('fetches from endpoint on connect', async () => {
      const fetchFn = mockFetch();
      el = createElement({ fetchFn });
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      expect(fetchFn).toHaveBeenCalledWith('/api/items', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });

    it('handles array response', async () => {
      el = createElement({ fetchFn: mockFetch(testRows) });
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      await el.updateComplete;
      const table = el.shadowRoot!.querySelector('pages-data-table') as any;
      expect(table?.rows?.length).toBe(2);
    });

    it('handles { items, total } response', async () => {
      el = createElement({ fetchFn: mockFetch({ items: testRows, total: 100 }) });
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
      el = document.createElement('list-pane') as ListPaneEl;
      el.columns = testColumns;
      el.getRowKey = (row: any) => row.id;
      el.fetchFn = fetchFn;
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('shows empty message when no data', async () => {
      el = createElement({ fetchFn: mockFetch([]) });
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      await el.updateComplete;
      expect(el.shadowRoot!.textContent).toContain('No items found');
    });

    it('shows custom empty message', async () => {
      el = createElement({ fetchFn: mockFetch([]) });
      el.emptyMessage = 'Nothing here';
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      await el.updateComplete;
      expect(el.shadowRoot!.textContent).toContain('Nothing here');
    });

    it('sets error on fetch failure', async () => {
      const failFetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
      el = createElement({ fetchFn: failFetch });
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      expect(el.error).toContain('network down');
    });

    it('sets error on non-ok response', async () => {
      const failFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
      el = createElement({ fetchFn: failFetch });
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      expect(el.error).toContain('500');
    });
  });

  describe('selection events', () => {
    it('emits topic:selected on row activation', async () => {
      el = createElement({ fetchFn: mockFetch() });
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
      el = createElement({ fetchFn: mockFetch() });
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
      el = createElement({ fetchFn });
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();

      (fetchFn as ReturnType<typeof vi.fn>).mockClear();
      el.refresh();
      await flush();
      expect(fetchFn).toHaveBeenCalled();
    });

    it('responds to topic:refresh event', async () => {
      const fetchFn = mockFetch();
      el = createElement({ fetchFn });
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();

      (fetchFn as ReturnType<typeof vi.fn>).mockClear();
      emitPagesEvent(document, 'test:refresh', {});
      await flush();
      expect(fetchFn).toHaveBeenCalled();
    });
  });

  describe('table configuration', () => {
    it('configures data-table with selection=single and mode=paginated', async () => {
      el = createElement({ fetchFn: mockFetch() });
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      await el.updateComplete;

      const table = el.shadowRoot!.querySelector('pages-data-table') as any;
      expect(table?.getAttribute('selection')).toBe('single');
      expect(table?.getAttribute('mode')).toBe('paginated');
    });

    it('enables client-sort and client-filter on data-table', async () => {
      el = createElement({ fetchFn: mockFetch() });
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      await el.updateComplete;

      const table = el.shadowRoot!.querySelector('pages-data-table') as any;
      expect(table?.hasAttribute('client-sort')).toBe(true);
      expect(table?.hasAttribute('client-filter')).toBe(true);
    });

    it('passes page-size to data-table', async () => {
      el = createElement({ fetchFn: mockFetch() });
      el.pageSize = 10;
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();
      await el.updateComplete;

      const table = el.shadowRoot!.querySelector('pages-data-table') as any;
      expect(table?.pageSize).toBe(10);
    });

    it('passes columns and row key to data-table', async () => {
      el = createElement({ fetchFn: mockFetch() });
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
      el = createElement({ fetchFn: mockFetch() });
      document.body.appendChild(el);
      await el.updateComplete;
      expect(el.getAttribute('tabindex')).toBe('-1');
    });

    it('empty state has role=status', async () => {
      el = createElement({ fetchFn: mockFetch([]) });
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
      el = createElement({ fetchFn });
      document.body.appendChild(el);
      await el.updateComplete;
      await flush();

      (fetchFn as ReturnType<typeof vi.fn>).mockClear();
      el.endpoint = '/api/other';
      await el.updateComplete;
      await flush();
      expect(fetchFn).toHaveBeenCalledWith('/api/other', expect.anything());
    });
  });
});
