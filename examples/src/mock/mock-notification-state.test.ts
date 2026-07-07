import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockNotificationState } from './mock-notification-state.js';
import { MockSSESource } from './mock-sse.js';
import type { Notification, Subscription } from '@casehubio/blocks-ui-notification-inbox';

// --- Fixtures ---

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n-001',
    userId: 'demo-user',
    tenancyId: 'tenant-001',
    title: 'Test notification',
    body: null,
    category: 'work-item.created',
    severity: 'INFO',
    actionUrl: null,
    source: { eventId: 'e-001', entityType: 'work-item', entityId: 'WI-001', actorId: 'system' },
    status: 'UNREAD',
    createdAt: '2026-07-06T08:00:00Z',
    readAt: null,
    dismissedAt: null,
    ...overrides,
  };
}

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-001',
    ownerId: 'demo-user',
    tenancyId: 'tenant-001',
    name: 'Test subscription',
    eventType: 'io.casehub.work.workitem.created',
    constraints: [],
    targets: [{ type: 'USER', id: 'demo-user' }],
    includeActor: false,
    template: {
      titlePattern: '${entityId} created',
      bodyPattern: null,
      severity: 'INFO',
      category: 'work-item.created',
      actionUrlPattern: '/workitems/${entityId}',
      entityType: 'work-item',
      entityIdField: 'workItemId',
      actorIdField: 'actorId',
    },
    enabled: true,
    createdAt: '2026-06-01T10:00:00Z',
    updatedAt: '2026-06-01T10:00:00Z',
    ...overrides,
  };
}

const EVENT_TYPES = [
  {
    eventType: 'io.casehub.work.workitem.created',
    displayName: 'Work Item Created',
    description: 'Fired when a new work item is created',
    fields: [{ name: 'workItemId', type: 'string', description: 'Work item ID', enumValues: null }],
  },
];

// --- Helper to parse mock Response ---

async function parseResponse<T>(resp: Response): Promise<T> {
  return resp.json() as Promise<T>;
}

// --- Tests ---

describe('MockNotificationState', () => {
  let state: MockNotificationState;

  const notifications: Notification[] = [
    makeNotification({ id: 'n-001', status: 'UNREAD', category: 'work-item.created', severity: 'INFO', createdAt: '2026-07-06T08:00:00Z' }),
    makeNotification({ id: 'n-002', status: 'UNREAD', category: 'sla.breached', severity: 'URGENT', createdAt: '2026-07-06T07:00:00Z' }),
    makeNotification({ id: 'n-003', status: 'READ', category: 'comment.added', severity: 'INFO', readAt: '2026-07-06T06:30:00Z', createdAt: '2026-07-06T06:00:00Z' }),
    makeNotification({ id: 'n-004', status: 'DISMISSED', category: 'assignment.changed', severity: 'WARNING', readAt: '2026-07-06T05:15:00Z', dismissedAt: '2026-07-06T05:30:00Z', createdAt: '2026-07-06T05:00:00Z' }),
    makeNotification({ id: 'n-005', status: 'UNREAD', category: 'work-item.created', severity: 'WARNING', createdAt: '2026-07-06T04:00:00Z' }),
  ];

  const subscriptions: Subscription[] = [
    makeSubscription({ id: 'sub-001', name: 'My assignments', enabled: true }),
    makeSubscription({ id: 'sub-002', name: 'SLA breaches', enabled: true }),
    makeSubscription({ id: 'sub-003', name: 'Disabled sub', enabled: false }),
  ];

  beforeEach(() => {
    state = new MockNotificationState(notifications, subscriptions, EVENT_TYPES, []);
  });

  afterEach(() => {
    state.stop();
    MockSSESource.resetAll();
  });

  // =============================================
  // REST handler tests — Notifications
  // =============================================

  describe('GET /notifications', () => {
    it('returns filtered results by status', async () => {
      const resp = state.resolveMock('/notifications?status=UNREAD', 'GET')!;
      expect(resp.status).toBe(200);
      const page = await parseResponse<{ notifications: Notification[]; nextCursor: string | null }>(resp);
      expect(page.notifications.every(n => n.status === 'UNREAD')).toBe(true);
      expect(page.notifications).toHaveLength(3);
    });

    it('returns filtered results by category', async () => {
      const resp = state.resolveMock('/notifications?category=sla.breached', 'GET')!;
      const page = await parseResponse<{ notifications: Notification[] }>(resp);
      expect(page.notifications).toHaveLength(1);
      expect(page.notifications[0]!.category).toBe('sla.breached');
    });

    it('supports cursor pagination', async () => {
      // Create 15 notifications to force pagination (page size = 10)
      const manyNotifs: Notification[] = [];
      for (let i = 0; i < 15; i++) {
        manyNotifs.push(makeNotification({
          id: `pg-${String(i).padStart(3, '0')}`,
          status: 'UNREAD',
          createdAt: `2026-07-06T${String(8 + i).padStart(2, '0')}:00:00Z`,
        }));
      }
      const bigState = new MockNotificationState(manyNotifs, [], EVENT_TYPES, []);

      // First page
      const resp1 = bigState.resolveMock('/notifications', 'GET')!;
      const page1 = await parseResponse<{ notifications: Notification[]; nextCursor: string | null }>(resp1);
      expect(page1.notifications).toHaveLength(10);
      expect(page1.nextCursor).not.toBeNull();

      // Second page
      const resp2 = bigState.resolveMock(`/notifications?cursor=${page1.nextCursor}`, 'GET')!;
      const page2 = await parseResponse<{ notifications: Notification[]; nextCursor: string | null }>(resp2);
      expect(page2.notifications).toHaveLength(5);
      expect(page2.nextCursor).toBeNull();

      bigState.stop();
    });

    it('combines status and category filters', async () => {
      const resp = state.resolveMock('/notifications?status=UNREAD&category=work-item.created', 'GET')!;
      const page = await parseResponse<{ notifications: Notification[] }>(resp);
      expect(page.notifications).toHaveLength(2);
      expect(page.notifications.every(n => n.status === 'UNREAD' && n.category === 'work-item.created')).toBe(true);
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('returns correct count', async () => {
      const resp = state.resolveMock('/notifications/unread-count', 'GET')!;
      const data = await parseResponse<{ count: number }>(resp);
      expect(data.count).toBe(3); // n-001, n-002, n-005
    });
  });

  describe('PATCH /notifications/{id}/read', () => {
    it('transitions UNREAD to READ and sets readAt', async () => {
      const resp = state.resolveMock('/notifications/n-001/read', 'PATCH')!;
      expect(resp.status).toBe(200);
      const updated = await parseResponse<Notification>(resp);
      expect(updated.status).toBe('READ');
      expect(updated.readAt).not.toBeNull();
    });

    it('returns unchanged on already-READ notification', async () => {
      const resp = state.resolveMock('/notifications/n-003/read', 'PATCH')!;
      const result = await parseResponse<Notification>(resp);
      expect(result.status).toBe('READ');
      expect(result.id).toBe('n-003');
    });

    it('returns 404 for nonexistent notification', () => {
      const resp = state.resolveMock('/notifications/nonexistent/read', 'PATCH')!;
      expect(resp.status).toBe(404);
    });
  });

  describe('PATCH /notifications/{id}/dismiss', () => {
    it('transitions UNREAD to DISMISSED', async () => {
      const resp = state.resolveMock('/notifications/n-001/dismiss', 'PATCH')!;
      const updated = await parseResponse<Notification>(resp);
      expect(updated.status).toBe('DISMISSED');
      expect(updated.dismissedAt).not.toBeNull();
      expect(updated.readAt).not.toBeNull();
    });

    it('transitions READ to DISMISSED', async () => {
      const resp = state.resolveMock('/notifications/n-003/dismiss', 'PATCH')!;
      const updated = await parseResponse<Notification>(resp);
      expect(updated.status).toBe('DISMISSED');
      expect(updated.dismissedAt).not.toBeNull();
    });

    it('returns 404 for nonexistent notification', () => {
      const resp = state.resolveMock('/notifications/nonexistent/dismiss', 'PATCH')!;
      expect(resp.status).toBe(404);
    });
  });

  describe('POST /notifications/mark-all-read', () => {
    it('marks all UNREAD as READ', async () => {
      const resp = state.resolveMock('/notifications/mark-all-read', 'POST')!;
      const data = await parseResponse<{ count: number }>(resp);
      expect(data.count).toBe(3);

      // Verify count is now 0
      const countResp = state.resolveMock('/notifications/unread-count', 'GET')!;
      const countData = await parseResponse<{ count: number }>(countResp);
      expect(countData.count).toBe(0);
    });

    it('returns 0 when none unread', async () => {
      // First mark all as read
      state.resolveMock('/notifications/mark-all-read', 'POST');

      // Then try again
      const resp = state.resolveMock('/notifications/mark-all-read', 'POST')!;
      const data = await parseResponse<{ count: number }>(resp);
      expect(data.count).toBe(0);
    });
  });

  // =============================================
  // REST handler tests — Subscriptions
  // =============================================

  describe('GET /subscriptions', () => {
    it('returns all subscriptions', async () => {
      const resp = state.resolveMock('/subscriptions', 'GET')!;
      const page = await parseResponse<{ subscriptions: Subscription[] }>(resp);
      expect(page.subscriptions).toHaveLength(3);
    });

    it('filters by enabled=true', async () => {
      const resp = state.resolveMock('/subscriptions?enabled=true', 'GET')!;
      const page = await parseResponse<{ subscriptions: Subscription[] }>(resp);
      expect(page.subscriptions).toHaveLength(2);
      expect(page.subscriptions.every(s => s.enabled)).toBe(true);
    });

    it('filters by enabled=false', async () => {
      const resp = state.resolveMock('/subscriptions?enabled=false', 'GET')!;
      const page = await parseResponse<{ subscriptions: Subscription[] }>(resp);
      expect(page.subscriptions).toHaveLength(1);
      expect(page.subscriptions[0]!.enabled).toBe(false);
    });
  });

  describe('POST /subscriptions', () => {
    it('creates with generated id', async () => {
      const input = {
        ownerId: 'demo-user',
        tenancyId: 'tenant-001',
        name: 'New sub',
        eventType: 'io.casehub.work.workitem.created',
        constraints: [],
        targets: [{ type: 'USER', id: 'demo-user' }],
        includeActor: false,
        template: {
          titlePattern: '${entityId} created',
          bodyPattern: null,
          severity: 'INFO',
          category: 'work-item.created',
          actionUrlPattern: null,
          entityType: 'work-item',
          entityIdField: 'workItemId',
          actorIdField: 'actorId',
        },
        enabled: true,
      };
      const resp = state.resolveMock('/subscriptions', 'POST', input as any)!;
      expect(resp.status).toBe(200);
      const created = await parseResponse<Subscription>(resp);
      expect(created.id).toBeTruthy();
      expect(created.name).toBe('New sub');
      expect(created.createdAt).toBeTruthy();

      // Verify it's in the list
      const listResp = state.resolveMock('/subscriptions', 'GET')!;
      const page = await parseResponse<{ subscriptions: Subscription[] }>(listResp);
      expect(page.subscriptions).toHaveLength(4);
    });
  });

  describe('PATCH /subscriptions/{id}', () => {
    it('partial update preserves unchanged fields', async () => {
      const resp = state.resolveMock('/subscriptions/sub-001', 'PATCH', { name: 'Renamed' } as any)!;
      const updated = await parseResponse<Subscription>(resp);
      expect(updated.name).toBe('Renamed');
      expect(updated.eventType).toBe('io.casehub.work.workitem.created'); // unchanged
      expect(updated.enabled).toBe(true); // unchanged
    });

    it('returns 404 for nonexistent subscription', () => {
      const resp = state.resolveMock('/subscriptions/nonexistent', 'PATCH', { name: 'X' } as any)!;
      expect(resp.status).toBe(404);
    });
  });

  describe('DELETE /subscriptions/{id}', () => {
    it('removes subscription', async () => {
      const resp = state.resolveMock('/subscriptions/sub-001', 'DELETE')!;
      expect(resp.status).toBe(204);

      const listResp = state.resolveMock('/subscriptions', 'GET')!;
      const page = await parseResponse<{ subscriptions: Subscription[] }>(listResp);
      expect(page.subscriptions).toHaveLength(2);
      expect(page.subscriptions.find(s => s.id === 'sub-001')).toBeUndefined();
    });

    it('returns 404 for nonexistent subscription', () => {
      const resp = state.resolveMock('/subscriptions/nonexistent', 'DELETE')!;
      expect(resp.status).toBe(404);
    });
  });

  describe('PATCH /subscriptions/{id}/enable', () => {
    it('sets enabled=true', async () => {
      const resp = state.resolveMock('/subscriptions/sub-003/enable', 'PATCH')!;
      const updated = await parseResponse<Subscription>(resp);
      expect(updated.enabled).toBe(true);
    });
  });

  describe('PATCH /subscriptions/{id}/disable', () => {
    it('sets enabled=false', async () => {
      const resp = state.resolveMock('/subscriptions/sub-001/disable', 'PATCH')!;
      const updated = await parseResponse<Subscription>(resp);
      expect(updated.enabled).toBe(false);
    });
  });

  describe('GET /subscriptions/event-types', () => {
    it('returns event type descriptors', async () => {
      const resp = state.resolveMock('/subscriptions/event-types', 'GET')!;
      const types = await parseResponse<Array<{ eventType: string; fields: unknown[] }>>(resp);
      expect(types).toHaveLength(1);
      expect(types[0]!.eventType).toBe('io.casehub.work.workitem.created');
      expect(types[0]!.fields.length).toBeGreaterThan(0);
    });
  });

  // =============================================
  // SSE script tests
  // =============================================

  describe('SSE script', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('pushes named events at correct delays', () => {
      const pushSpy = vi.spyOn(MockSSESource, 'pushNamedEvent');

      const script = [
        { delaySeconds: 3, eventName: 'notification', data: makeNotification({ id: 'sse-1' }) },
        { delaySeconds: 5, eventName: 'unread-count', data: { count: 10 } },
      ];

      const scriptState = new MockNotificationState([], [], EVENT_TYPES, script);
      scriptState.start();
      scriptState.startAutoScript();

      // At 3s: first event fires (cumulative 3s)
      vi.advanceTimersByTime(3000);
      expect(pushSpy).toHaveBeenCalledTimes(1);
      expect(pushSpy).toHaveBeenCalledWith('/notifications/stream', 'notification', expect.objectContaining({ id: 'sse-1' }));

      // At 8s: second event fires (cumulative 3+5=8s)
      vi.advanceTimersByTime(5000);
      expect(pushSpy).toHaveBeenCalledTimes(2);
      expect(pushSpy).toHaveBeenCalledWith('/notifications/stream', 'unread-count', { count: 10 });

      scriptState.stop();
      pushSpy.mockRestore();
    });

    it('new notification SSE event adds to internal state', () => {
      const newNotif = makeNotification({ id: 'sse-new', title: 'SSE notification' });
      const script = [
        { delaySeconds: 1, eventName: 'notification', data: newNotif },
      ];

      const scriptState = new MockNotificationState([], [], EVENT_TYPES, script);
      scriptState.start();
      scriptState.startAutoScript();

      vi.advanceTimersByTime(1000);

      const allNotifs = scriptState.getNotifications();
      expect(allNotifs.find(n => n.id === 'sse-new')).toBeTruthy();

      scriptState.stop();
    });

    it('unread count reflects state after SSE mutations', async () => {
      const existingNotif = makeNotification({ id: 'existing', status: 'UNREAD' });
      const newNotif = makeNotification({ id: 'sse-added', status: 'UNREAD' });
      const script = [
        { delaySeconds: 1, eventName: 'notification', data: newNotif },
      ];

      const scriptState = new MockNotificationState([existingNotif], [], EVENT_TYPES, script);
      scriptState.start();
      scriptState.startAutoScript();

      // Before script fires: 1 unread
      const resp1 = scriptState.resolveMock('/notifications/unread-count', 'GET')!;
      const data1 = await parseResponse<{ count: number }>(resp1);
      expect(data1.count).toBe(1);

      // After script fires: 2 unread
      vi.advanceTimersByTime(1000);

      const resp2 = scriptState.resolveMock('/notifications/unread-count', 'GET')!;
      const data2 = await parseResponse<{ count: number }>(resp2);
      expect(data2.count).toBe(2);

      scriptState.stop();
    });

    it('stop() clears all pending timers', () => {
      const pushSpy = vi.spyOn(MockSSESource, 'pushNamedEvent');

      const script = [
        { delaySeconds: 5, eventName: 'notification', data: makeNotification({ id: 'will-not-fire' }) },
      ];

      const scriptState = new MockNotificationState([], [], EVENT_TYPES, script);
      scriptState.start();
      scriptState.stop();

      vi.advanceTimersByTime(10000);
      expect(pushSpy).not.toHaveBeenCalled();

      pushSpy.mockRestore();
    });
  });

  // =============================================
  // Snooze tests
  // =============================================

  describe('Snooze', () => {
    it('GET /notifications/snooze returns 404 when no snooze', () => {
      const resp = state.resolveMock('/notifications/snooze', 'GET')!;
      expect(resp.status).toBe(404);
    });

    it('POST /notifications/snooze activates snooze', async () => {
      const until = '2026-07-06T18:00:00Z';
      const resp = state.resolveMock('/notifications/snooze', 'POST', { until } as any)!;
      expect(resp.status).toBe(200);
      const snooze = await parseResponse<{ until: string; userId: string }>(resp);
      expect(snooze.until).toBe(until);
      expect(snooze.userId).toBe('demo-user');
    });

    it('GET /notifications/snooze returns active snooze', async () => {
      // Activate first
      state.resolveMock('/notifications/snooze', 'POST', { until: '2026-07-06T18:00:00Z' } as any);

      // Then get
      const resp = state.resolveMock('/notifications/snooze', 'GET')!;
      expect(resp.status).toBe(200);
      const snooze = await parseResponse<{ until: string }>(resp);
      expect(snooze.until).toBe('2026-07-06T18:00:00Z');
    });

    it('DELETE /notifications/snooze clears snooze', () => {
      // Activate first
      state.resolveMock('/notifications/snooze', 'POST', { until: '2026-07-06T18:00:00Z' } as any);

      // Delete
      const resp = state.resolveMock('/notifications/snooze', 'DELETE')!;
      expect(resp.status).toBe(204);

      // Verify gone
      const getResp = state.resolveMock('/notifications/snooze', 'GET')!;
      expect(getResp.status).toBe(404);
    });
  });

  // =============================================
  // Preferences and mutes
  // =============================================

  describe('GET /notifications/preferences', () => {
    it('returns default preferences', async () => {
      const resp = state.resolveMock('/notifications/preferences', 'GET')!;
      expect(resp.status).toBe(200);
      const prefs = await parseResponse<{ userId: string; channelDefaults: Record<string, unknown> }>(resp);
      expect(prefs.userId).toBe('demo-user');
      expect(prefs.channelDefaults).toBeTruthy();
    });
  });

  describe('GET /notifications/mute', () => {
    it('returns empty array', async () => {
      const resp = state.resolveMock('/notifications/mute', 'GET')!;
      const mutes = await parseResponse<unknown[]>(resp);
      expect(mutes).toEqual([]);
    });
  });

  // =============================================
  // Route miss
  // =============================================

  describe('unmatched routes', () => {
    it('returns null for unknown paths', () => {
      const resp = state.resolveMock('/unknown/path', 'GET');
      expect(resp).toBeNull();
    });
  });

  // =============================================
  // pushSSEEvent (ad-hoc demo controls)
  // =============================================

  describe('pushSSEEvent', () => {
    it('adds new notification to internal state', () => {
      const notif = makeNotification({ id: 'pushed-001', title: 'Pushed' });
      state.pushSSEEvent('notification', notif);

      const allNotifs = state.getNotifications();
      expect(allNotifs.find(n => n.id === 'pushed-001')).toBeTruthy();
    });

    it('does not duplicate existing notification', () => {
      state.pushSSEEvent('notification', makeNotification({ id: 'n-001', title: 'Duplicate' }));
      const allNotifs = state.getNotifications();
      const matches = allNotifs.filter(n => n.id === 'n-001');
      expect(matches).toHaveLength(1);
    });
  });

  // =============================================
  // reset()
  // =============================================

  describe('reset', () => {
    it('restores original data after mutations', async () => {
      // Mutate
      state.resolveMock('/notifications/n-001/read', 'PATCH');
      state.resolveMock('/subscriptions/sub-001', 'DELETE');

      // Reset
      state.reset();

      // Verify notifications restored
      const countResp = state.resolveMock('/notifications/unread-count', 'GET')!;
      const countData = await parseResponse<{ count: number }>(countResp);
      expect(countData.count).toBe(3); // original 3 unread

      // Verify subscriptions restored
      const subsResp = state.resolveMock('/subscriptions', 'GET')!;
      const subsData = await parseResponse<{ subscriptions: Subscription[] }>(subsResp);
      expect(subsData.subscriptions).toHaveLength(3);
    });
  });
});
