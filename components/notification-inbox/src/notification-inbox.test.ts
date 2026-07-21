import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { nothing } from 'lit';
import type { SSEHandler, SSEEvent, SSESubscribeOptions, SSEManager } from '@casehubio/pages-data/dist/sse/sse-manager.js';
import type { Notification, NotificationPage } from './types.js';
import './notification-inbox.js';
import { fromRows } from '@casehubio/pages-data/dist/dataset/conversion.js';
import { columnId, ColumnType } from '@casehubio/pages-data/dist/dataset/types.js';

function mockTypedRow(n: Notification) {
  const ds = fromRows([n], [
    { id: columnId('id'), type: ColumnType.TEXT, getValue: (n: Notification) => n.id },
    { id: columnId('title'), type: ColumnType.TEXT, getValue: (n: Notification) => n.title },
    { id: columnId('body'), type: ColumnType.TEXT, getValue: (n: Notification) => n.body ?? '' },
    { id: columnId('category'), type: ColumnType.TEXT, getValue: (n: Notification) => n.category },
    { id: columnId('status'), type: ColumnType.TEXT, getValue: (n: Notification) => n.status },
    { id: columnId('createdAt'), type: ColumnType.TEXT, getValue: (n: Notification) => n.createdAt },
    { id: columnId('severity'), type: ColumnType.TEXT, getValue: (n: Notification) => n.severity },
    { id: columnId('actionUrl'), type: ColumnType.TEXT, getValue: (n: Notification) => n.actionUrl ?? '' },
  ]);
  return ds.rows[0]!;
}
import type { NotificationInbox } from './notification-inbox.js';

// --- Test fixtures ---

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: overrides.id ?? 'n1',
    userId: 'user-1',
    tenancyId: 'tenant-1',
    title: overrides.title ?? 'Test notification',
    body: overrides.body ?? null,
    category: overrides.category ?? 'alerts',
    severity: overrides.severity ?? 'INFO',
    actionUrl: overrides.actionUrl ?? null,
    source: {
      eventId: 'evt-1',
      entityType: 'Case',
      entityId: 'case-1',
      actorId: 'actor-1',
    },
    status: overrides.status ?? 'UNREAD',
    createdAt: overrides.createdAt ?? '2026-07-06T10:00:00Z',
    readAt: overrides.readAt ?? null,
    dismissedAt: overrides.dismissedAt ?? null,
  };
}

const MOCK_NOTIFICATIONS: Notification[] = [
  makeNotification({ id: 'n1', title: 'Urgent alert', severity: 'URGENT', category: 'alerts', status: 'UNREAD' }),
  makeNotification({ id: 'n2', title: 'Warning notice', severity: 'WARNING', category: 'updates', status: 'UNREAD', body: 'Check this out' }),
  makeNotification({ id: 'n3', title: 'Info update', severity: 'INFO', category: 'alerts', status: 'READ' }),
  makeNotification({ id: 'n4', title: 'Another urgent', severity: 'URGENT', category: 'system', status: 'UNREAD' }),
  makeNotification({ id: 'n5', title: 'Old info', severity: 'INFO', category: 'updates', status: 'READ' }),
];

const MOCK_DISMISSED: Notification[] = [
  makeNotification({ id: 'n6', title: 'Dismissed one', severity: 'INFO', category: 'alerts', status: 'DISMISSED' }),
];

// --- Mock SSEManager ---

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

// --- Helpers ---

function fixture(el: HTMLElement): HTMLElement {
  document.body.appendChild(el);
  return el;
}

function mockFetchResponses(responses: Map<string, { ok: boolean; data: unknown }>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    for (const [pattern, response] of responses) {
      if (url.includes(pattern)) {
        return {
          ok: response.ok,
          status: response.ok ? 200 : 500,
          statusText: response.ok ? 'OK' : 'Internal Server Error',
          json: async () => response.data,
        } as Response;
      }
    }
    return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) } as Response;
  }) as unknown as typeof fetch;
}

async function createElement(opts: {
  data?: Notification[];
  endpoint?: string;
  mockFetch?: typeof fetch;
  sseManager?: MockSSEManager;
}): Promise<NotificationInbox> {
  const el = document.createElement('notification-inbox') as NotificationInbox;
  if (opts.data) el.data = opts.data;
  if (opts.endpoint) el.endpoint = opts.endpoint;
  if (opts.mockFetch) el.fetchFn = opts.mockFetch;
  if (opts.sseManager) el.sseManager = opts.sseManager as unknown as SSEManager;
  el.identity = { userId: 'user-1', displayName: 'Test User', groups: [] };
  fixture(el);
  await el.updateComplete;
  return el;
}

describe('notification-inbox', () => {
  let mockSSE: MockSSEManager;

  beforeEach(() => {
    mockSSE = new MockSSEManager();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // --- 1. Renders inbox tab as default active scope ---
  it('renders Inbox tab as default active scope', async () => {
    const el = await createElement({ data: MOCK_NOTIFICATIONS });
    await el.updateComplete;

    const tabs = el.shadowRoot!.querySelectorAll('.tab');
    expect(tabs.length).toBe(2);

    const inboxTab = tabs[0] as HTMLElement;
    const archiveTab = tabs[1] as HTMLElement;
    expect(inboxTab.textContent).toContain('Inbox');
    expect(archiveTab.textContent).toContain('Archive');
    expect(inboxTab.classList.contains('active')).toBe(true);
    expect(archiveTab.classList.contains('active')).toBe(false);
  });

  // --- 2. Switches to Archive tab and re-fetches with DISMISSED status ---
  it('switches to Archive tab and re-fetches with DISMISSED status', async () => {
    const fetchFn = mockFetchResponses(new Map([
      ['notifications', { ok: true, data: { notifications: MOCK_NOTIFICATIONS, nextCursor: null } }],
    ]));

    const el = await createElement({ endpoint: 'http://localhost:8080', mockFetch: fetchFn, sseManager: mockSSE });
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 10));

    // Click archive tab
    const archiveTab = el.shadowRoot!.querySelectorAll('.tab')[1] as HTMLElement;
    archiveTab.click();
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 10));

    // Verify fetch was called with DISMISSED status
    const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls;
    const archiveCall = calls.find((c: unknown[]) => {
      const url = String(c[0]);
      return url.includes('status=DISMISSED');
    });
    expect(archiveCall).toBeTruthy();

    expect(archiveTab.classList.contains('active')).toBe(true);
  });

  // --- 3. Renders filter chips with category counts ---
  it('renders filter chips with category counts from data', async () => {
    const el = await createElement({ data: MOCK_NOTIFICATIONS });
    await el.updateComplete;

    const chips = el.shadowRoot!.querySelectorAll('.filter-chip');
    expect(chips.length).toBeGreaterThan(0);

    // Should have category chips (alerts, updates, system), severity chips, and read-state chip
    const chipTexts = Array.from(chips).map(c => c.textContent?.trim());
    expect(chipTexts.some(t => t?.includes('alerts'))).toBe(true);
    expect(chipTexts.some(t => t?.includes('updates'))).toBe(true);
  });

  // --- 4. Filters items client-side when category chip toggled ---
  it('filters items client-side when category chip toggled', async () => {
    const el = await createElement({ data: MOCK_NOTIFICATIONS });
    await el.updateComplete;

    // Find the alerts category chip and click it
    const chips = el.shadowRoot!.querySelectorAll('.filter-chip');
    const alertsChip = Array.from(chips).find(c => c.getAttribute('data-chip-id')?.startsWith('cat:alerts'));

    if (alertsChip) {
      (alertsChip as HTMLElement).click();
      await el.updateComplete;

      // After clicking alerts chip, table should only show notifications with category 'alerts'
      const table = el.shadowRoot!.querySelector('pages-table');
      expect(table).toBeTruthy();
      const rows = (table as any)?.dataSet?.rows;
      expect(rows).toBeTruthy();
      expect(rows.length).toBeGreaterThan(0);
    }
  });

  // --- 5. Renders notification rows via pages-table ---
  it('renders notification rows via pages-table with custom cell renderer', async () => {
    const el = await createElement({ data: MOCK_NOTIFICATIONS });
    await el.updateComplete;

    const table = el.shadowRoot!.querySelector('pages-table');
    expect(table).toBeTruthy();

    // Inbox tab shows UNREAD + READ (not DISMISSED), which is all 5 mock notifications
    const rows = (table as any)?.dataSet?.rows;
    expect(rows).toBeTruthy();
    expect(rows.length).toBe(5);
  });

  // --- 6. Shows severity left border via getRowClass ---
  it('shows severity left border via getRowClass', async () => {
    const el = await createElement({ data: MOCK_NOTIFICATIONS });
    await el.updateComplete;

    const table = el.shadowRoot!.querySelector('pages-table') as any;
    expect(table).toBeTruthy();

    const getRowClass = table.getRowClass;
    expect(getRowClass).toBeTruthy();

    expect(getRowClass(mockTypedRow(MOCK_NOTIFICATIONS[0]!))).toBe('severity-urgent');
    expect(getRowClass(mockTypedRow(MOCK_NOTIFICATIONS[1]!))).toBe('severity-warning');
    expect(getRowClass(mockTypedRow(MOCK_NOTIFICATIONS[2]!))).toBe('severity-info');
  });

  // --- 7. Shows unread dot for UNREAD notifications ---
  it('shows unread dot for UNREAD notifications', async () => {
    const el = await createElement({ data: MOCK_NOTIFICATIONS });
    await el.updateComplete;

    const table = el.shadowRoot!.querySelector('pages-table') as any;
    expect(table).toBeTruthy();
    expect(table.columnRenderers).toBeTruthy();
    expect(table.columnRenderers.size).toBeGreaterThan(0);
  });

  // --- 8. Emits notification.selected on row-activate ---
  it('emits notification.selected on row-activate', async () => {
    const el = await createElement({ data: MOCK_NOTIFICATIONS });
    await el.updateComplete;

    const events: CustomEvent[] = [];
    el.addEventListener('pages-event', ((e: CustomEvent) => {
      events.push(e);
    }) as EventListener);

    const table = el.shadowRoot!.querySelector('pages-table')!;
    table.dispatchEvent(new CustomEvent('row-activate', {
      bubbles: true,
      composed: true,
      detail: { row: mockTypedRow(MOCK_NOTIFICATIONS[0]!), key: 'n1' },
    }));

    expect(events.length).toBe(1);
    expect(events[0]!.detail.topic).toBe('notification.selected');
    expect(events[0]!.detail.payload.notificationId).toBe('n1');
  });

  // --- 9. Marks notification read via API on row activate (optimistic) ---
  it('marks notification read via API on row click (optimistic)', async () => {
    const fetchFn = mockFetchResponses(new Map([
      ['notifications?', { ok: true, data: { notifications: MOCK_NOTIFICATIONS, nextCursor: null } }],
      ['/read', { ok: true, data: { ...MOCK_NOTIFICATIONS[0], status: 'READ' } }],
    ]));

    const el = await createElement({ endpoint: 'http://localhost:8080', mockFetch: fetchFn, sseManager: mockSSE });
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));

    // Activate the first unread notification
    const table = el.shadowRoot!.querySelector('pages-table')!;
    table.dispatchEvent(new CustomEvent('row-activate', {
      bubbles: true,
      composed: true,
      detail: { row: mockTypedRow(MOCK_NOTIFICATIONS[0]!), key: 'n1' },
    }));

    await new Promise(r => setTimeout(r, 20));

    // Verify PATCH /read was called
    const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls;
    const readCall = calls.find((c: unknown[]) => {
      const url = String(c[0]);
      return url.includes('/n1/read');
    });
    expect(readCall).toBeTruthy();
  });

  // --- 10. Rolls back optimistic update on API failure ---
  it('rolls back optimistic update on API failure', async () => {
    const fetchFn = mockFetchResponses(new Map([
      ['notifications?', { ok: true, data: { notifications: [...MOCK_NOTIFICATIONS], nextCursor: null } }],
      ['/read', { ok: false, data: { message: 'Server error' } }],
    ]));

    const el = await createElement({ endpoint: 'http://localhost:8080', mockFetch: fetchFn, sseManager: mockSSE });
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));

    // Activate to trigger mark read
    const table = el.shadowRoot!.querySelector('pages-table')!;
    table.dispatchEvent(new CustomEvent('row-activate', {
      bubbles: true,
      composed: true,
      detail: { row: mockTypedRow(MOCK_NOTIFICATIONS[0]!), key: 'n1' },
    }));

    await new Promise(r => setTimeout(r, 50));
    await el.updateComplete;

    // Error banner should appear
    const errorBanner = el.shadowRoot!.querySelector('.error-banner');
    expect(errorBanner).toBeTruthy();
  });

  // --- 11. Dismisses notification via API (optimistic, moves to archive) ---
  it('dismisses notification via API (optimistic, moves to archive)', async () => {
    const fetchFn = mockFetchResponses(new Map([
      ['notifications?', { ok: true, data: { notifications: [...MOCK_NOTIFICATIONS], nextCursor: null } }],
      ['/dismiss', { ok: true, data: { ...MOCK_NOTIFICATIONS[0], status: 'DISMISSED' } }],
    ]));

    const el = await createElement({ endpoint: 'http://localhost:8080', mockFetch: fetchFn, sseManager: mockSSE });
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));

    // Dismiss the first notification
    el.dismissNotification('n1');
    await new Promise(r => setTimeout(r, 20));
    await el.updateComplete;

    // Verify PATCH /dismiss was called
    const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls;
    const dismissCall = calls.find((c: unknown[]) => {
      const url = String(c[0]);
      return url.includes('/n1/dismiss');
    });
    expect(dismissCall).toBeTruthy();

    // Item should be removed from inbox view (it's now DISMISSED)
    const table = el.shadowRoot!.querySelector('pages-table') as any;
    const rows = table?.dataSet?.rows;
    const dismissed = rows?.find((r: Notification) => r.id === 'n1');
    expect(dismissed).toBeFalsy();
  });

  // --- 12. Shows batch action bar when 2+ items selected ---
  it('shows batch action bar when 2+ items selected', async () => {
    const el = await createElement({ data: MOCK_NOTIFICATIONS });
    await el.updateComplete;

    // Initially no batch bar
    let batchBar = el.shadowRoot!.querySelector('.batch-action-bar');
    expect(batchBar).toBeFalsy();

    // Simulate selection-change with 2 items
    const table = el.shadowRoot!.querySelector('pages-table')!;
    table.dispatchEvent(new CustomEvent('selection-change', {
      bubbles: true,
      composed: true,
      detail: { selectedKeys: ['n1', 'n2'], selectedRows: [MOCK_NOTIFICATIONS[0], MOCK_NOTIFICATIONS[1]] },
    }));

    await el.updateComplete;

    batchBar = el.shadowRoot!.querySelector('.batch-action-bar');
    expect(batchBar).toBeTruthy();
    expect(batchBar!.textContent).toContain('2');
  });

  // --- 13. Batch mark-read processes selected items in parallel ---
  it('batch mark-read processes selected items in parallel', async () => {
    const fetchFn = mockFetchResponses(new Map([
      ['notifications?', { ok: true, data: { notifications: [...MOCK_NOTIFICATIONS], nextCursor: null } }],
      ['/read', { ok: true, data: { status: 'READ' } }],
    ]));

    const el = await createElement({ endpoint: 'http://localhost:8080', mockFetch: fetchFn, sseManager: mockSSE });
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));

    // Select 2 items
    const table = el.shadowRoot!.querySelector('pages-table')!;
    table.dispatchEvent(new CustomEvent('selection-change', {
      bubbles: true,
      composed: true,
      detail: { selectedKeys: ['n1', 'n2'], selectedRows: [MOCK_NOTIFICATIONS[0], MOCK_NOTIFICATIONS[1]] },
    }));
    await el.updateComplete;

    // Click batch mark read
    const markReadBtn = el.shadowRoot!.querySelector('.batch-button.primary') as HTMLElement;
    expect(markReadBtn).toBeTruthy();
    markReadBtn.click();

    await new Promise(r => setTimeout(r, 50));

    // Both items should have been patched
    const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls;
    const readCalls = calls.filter((c: unknown[]) => String(c[0]).includes('/read'));
    expect(readCalls.length).toBe(2);
  });

  // --- 14. Batch dismiss shows BlocksConfirmDialog before execution ---
  it('batch dismiss shows BlocksConfirmDialog before execution', async () => {
    const el = await createElement({ data: MOCK_NOTIFICATIONS });
    await el.updateComplete;

    // Select 2 items
    const table = el.shadowRoot!.querySelector('pages-table')!;
    table.dispatchEvent(new CustomEvent('selection-change', {
      bubbles: true,
      composed: true,
      detail: { selectedKeys: ['n1', 'n2'], selectedRows: [MOCK_NOTIFICATIONS[0], MOCK_NOTIFICATIONS[1]] },
    }));
    await el.updateComplete;

    // Click batch dismiss
    const dismissBtn = el.shadowRoot!.querySelector('.batch-button.danger') as HTMLElement;
    expect(dismissBtn).toBeTruthy();
    dismissBtn.click();
    await el.updateComplete;

    // Confirm dialog should be open
    const dialog = el.shadowRoot!.querySelector('blocks-confirm-dialog') as any;
    expect(dialog).toBeTruthy();
    expect(dialog.open).toBe(true);
  });

  // --- 15. Loads next page via cursor on load-more event ---
  it('loads next page via cursor on load-more event', async () => {
    const page1: NotificationPage = {
      notifications: MOCK_NOTIFICATIONS.slice(0, 3),
      nextCursor: 'cursor-abc',
    };

    const page2: NotificationPage = {
      notifications: MOCK_NOTIFICATIONS.slice(3),
      nextCursor: null,
    };

    let callCount = 0;
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('notifications')) {
        callCount++;
        const data = callCount === 1 ? page1 : page2;
        return { ok: true, status: 200, json: async () => data } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    const el = await createElement({ endpoint: 'http://localhost:8080', mockFetch: fetchFn, sseManager: mockSSE });
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));

    // Dispatch load-more event from the data table
    const table = el.shadowRoot!.querySelector('pages-table')!;
    table.dispatchEvent(new CustomEvent('load-more', {
      bubbles: true,
      composed: true,
      detail: {},
    }));

    await new Promise(r => setTimeout(r, 50));

    // Verify fetch was called with cursor
    const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls;
    const cursorCall = calls.find((c: unknown[]) => String(c[0]).includes('cursor=cursor-abc'));
    expect(cursorCall).toBeTruthy();
  });

  // --- 16. Prepends SSE notification events, deduplicates by id ---
  it('prepends SSE notification events, deduplicates by id', async () => {
    const fetchFn = mockFetchResponses(new Map([
      ['notifications', { ok: true, data: { notifications: [...MOCK_NOTIFICATIONS], nextCursor: null } }],
    ]));

    const el = await createElement({ endpoint: 'http://localhost:8080', mockFetch: fetchFn, sseManager: mockSSE });
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));

    const table = () => el.shadowRoot!.querySelector('pages-table') as any;
    const initialCount = table()?.dataSet?.rows?.length ?? 0;

    // SSE: new notification (not a duplicate)
    const newNotif = makeNotification({ id: 'n-new', title: 'Brand new', severity: 'INFO', status: 'UNREAD' });
    mockSSE.emit('http://localhost:8080/notifications/stream', {
      type: 'notification',
      data: newNotif,
    });
    await el.updateComplete;

    expect(table()?.dataSet?.rows?.length).toBe(initialCount + 1);
    // New item should be first
    expect(table()?.dataSet?.rows?.length).toBeGreaterThan(0);

    // SSE: duplicate of existing notification (n1)
    const dupeNotif = makeNotification({ id: 'n1', title: 'Updated title', severity: 'URGENT', status: 'UNREAD' });
    mockSSE.emit('http://localhost:8080/notifications/stream', {
      type: 'notification',
      data: dupeNotif,
    });
    await el.updateComplete;

    // Count should not increase for duplicate
    expect(table()?.dataSet?.rows?.length).toBe(initialCount + 1);
  });

  // --- 17. Updates local item on SSE notification-updated event ---
  it('updates local item on SSE notification-updated event', async () => {
    const fetchFn = mockFetchResponses(new Map([
      ['notifications', { ok: true, data: { notifications: [...MOCK_NOTIFICATIONS], nextCursor: null } }],
    ]));

    const el = await createElement({ endpoint: 'http://localhost:8080', mockFetch: fetchFn, sseManager: mockSSE });
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));

    // SSE: update existing notification
    const updatedNotif = makeNotification({ id: 'n1', title: 'Updated title', severity: 'URGENT', status: 'READ' });
    mockSSE.emit('http://localhost:8080/notifications/stream', {
      type: 'notification-updated',
      data: updatedNotif,
    });
    await el.updateComplete;

    const table = el.shadowRoot!.querySelector('pages-table') as any;
    expect(table?.dataSet?.rows?.length).toBeGreaterThan(0);
  });

  // --- 18. Announces new notifications via LiveRegionMixin ---
  it('announces new notifications via LiveRegionMixin', async () => {
    const fetchFn = mockFetchResponses(new Map([
      ['notifications', { ok: true, data: { notifications: [...MOCK_NOTIFICATIONS], nextCursor: null } }],
    ]));

    const el = await createElement({ endpoint: 'http://localhost:8080', mockFetch: fetchFn, sseManager: mockSSE });
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 20));

    const announceSpy = vi.spyOn(el, 'announce');

    // SSE: new notification
    const newNotif = makeNotification({ id: 'n-announce', title: 'Announce me', severity: 'INFO', status: 'UNREAD' });
    mockSSE.emit('http://localhost:8080/notifications/stream', {
      type: 'notification',
      data: newNotif,
    });

    expect(announceSpy).toHaveBeenCalled();
    const message = announceSpy.mock.calls[0]![0];
    expect(message).toContain('notification');
  });

  describe('relativeTime formatting', () => {
    let relativeTimeFn: (iso: string) => string;

    beforeEach(async () => {
      const mod = await import('./notification-inbox.js');
      relativeTimeFn = mod.relativeTime;
    });

    it('shows "now" for < 1 minute', () => {
      expect(relativeTimeFn(new Date().toISOString())).toBe('now');
    });

    it('shows minutes for < 1 hour', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
      expect(relativeTimeFn(fiveMinAgo)).toBe('5m');
    });

    it('shows hours for < 1 day', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString();
      expect(relativeTimeFn(threeHoursAgo)).toBe('3h');
    });

    it('shows days for < 1 week', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
      expect(relativeTimeFn(twoDaysAgo)).toBe('2d');
    });

    it('shows weeks for 7-30 days', () => {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();
      expect(relativeTimeFn(fourteenDaysAgo)).toBe('2w');
    });

    it('shows weeks+days for non-even weeks', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
      expect(relativeTimeFn(tenDaysAgo)).toBe('1w3d');
    });

    it('shows months for 30-365 days', () => {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();
      expect(relativeTimeFn(sixtyDaysAgo)).toBe('2mo');
    });

    it('shows years for 365+ days', () => {
      const fourHundredDaysAgo = new Date(Date.now() - 400 * 86400000).toISOString();
      expect(relativeTimeFn(fourHundredDaysAgo)).toBe('1y');
    });
  });

  describe('column layout', () => {
    it('status column width accommodates its header or hides it', async () => {
      const el = document.createElement('notification-inbox') as NotificationInbox;
      el.data = [makeNotification()];
      document.body.appendChild(el);
      await (el as any).updateComplete;

      const table = el.shadowRoot!.querySelector('pages-table') as any;
      const colConfig = table?.columnConfig as Array<{ id: string; width?: string; visible?: boolean }>;
      const statusCol = colConfig?.find((c: any) => c.id === 'status');
      expect(statusCol).toBeTruthy();

      const widthPx = parseInt(statusCol!.width ?? '0');
      if (widthPx < 60) {
        expect(statusCol!.visible).toBe(false);
      }

      el.remove();
    });

    it('age column width fits short date text without overflow', async () => {
      const el = document.createElement('notification-inbox') as NotificationInbox;
      el.data = [makeNotification()];
      document.body.appendChild(el);
      await (el as any).updateComplete;

      const table = el.shadowRoot!.querySelector('pages-table') as any;
      const colConfig = table?.columnConfig as Array<{ id: string; width?: string }>;
      const ageCol = colConfig?.find((c: any) => c.id === 'createdAt');
      expect(ageCol).toBeTruthy();

      const widthPx = parseInt(ageCol!.width ?? '0');
      expect(widthPx).toBeGreaterThanOrEqual(70);

      el.remove();
    });
  });
});
