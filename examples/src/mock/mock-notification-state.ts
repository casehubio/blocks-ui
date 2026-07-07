import type {
  Notification,
  NotificationPage,
  Subscription,
  SubscriptionPage,
  SubscriptionInput,
  SubscriptionUpdate,
  NotificationPreferences,
  Snooze,
  SnoozeInput,
} from '@casehubio/blocks-ui-notification-inbox';
import { MockSSESource } from './mock-sse.js';

interface EventTypeFieldDescriptor {
  name: string;
  type: string;
  description: string;
  enumValues: string[] | null;
}

interface EventTypeDescriptor {
  eventType: string;
  displayName: string;
  description: string;
  fields: EventTypeFieldDescriptor[];
}

interface SSEScriptEntry {
  delaySeconds: number;
  eventName: string;
  data: unknown;
}

const SSE_URL = '/notifications/stream';

export class MockNotificationState {
  private notifications: Notification[];
  private subscriptions: Subscription[];
  private eventTypes: EventTypeDescriptor[];
  private script: SSEScriptEntry[];
  private scriptTimers: ReturnType<typeof setTimeout>[] = [];
  private snooze: Snooze | null = null;
  private restoreFetch: (() => void) | null = null;
  private originalEventSource: typeof EventSource | null = null;

  // Snapshots for reset
  private readonly initialNotifications: Notification[];
  private readonly initialSubscriptions: Subscription[];

  constructor(
    notifications: Notification[],
    subscriptions: Subscription[],
    eventTypes: EventTypeDescriptor[],
    script: SSEScriptEntry[],
  ) {
    this.notifications = notifications.map(n => ({ ...n }));
    this.subscriptions = subscriptions.map(s => ({ ...s }));
    this.eventTypes = eventTypes;
    this.script = script;

    this.initialNotifications = notifications.map(n => ({ ...n }));
    this.initialSubscriptions = subscriptions.map(s => ({ ...s }));
  }

  // --- Public API ---

  start(): void {
    this.originalEventSource = (window as any).EventSource ?? null;
    (window as any).EventSource = MockSSESource;
    this.installMockFetch();
  }

  startAutoScript(): void {
    this.startScript();
  }

  stop(): void {
    this.stopScript();
    if (this.restoreFetch != null) {
      this.restoreFetch();
      this.restoreFetch = null;
    }
    if (this.originalEventSource != null) {
      (window as any).EventSource = this.originalEventSource;
      this.originalEventSource = null;
    }
    MockSSESource.resetAll();
  }

  reset(): void {
    this.stopScript();
    this.notifications = this.initialNotifications.map(n => ({ ...n }));
    this.subscriptions = this.initialSubscriptions.map(s => ({ ...s }));
    this.snooze = null;
  }

  /** Push an ad-hoc SSE event for interactive demo controls */
  pushSSEEvent(eventName: string, data: unknown): void {
    // If it's a new notification, also add to internal state
    if (eventName === 'notification') {
      const notif = data as Notification;
      if (notif.id != null) {
        const existing = this.notifications.findIndex(n => n.id === notif.id);
        if (existing === -1) {
          this.notifications = [notif, ...this.notifications];
        }
      }
    }
    MockSSESource.pushNamedEvent(SSE_URL, eventName, data);
  }

  getNotifications(): readonly Notification[] {
    return this.notifications;
  }

  getSubscriptions(): readonly Subscription[] {
    return this.subscriptions;
  }

  // --- Mock fetch installation ---

  private installMockFetch(): void {
    const realFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method?.toUpperCase() ?? 'GET';
      const body = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : undefined;

      const mock = this.resolveMock(url, method, body);
      if (mock != null) return mock;
      return realFetch(input, init);
    };

    this.restoreFetch = () => {
      window.fetch = realFetch;
    };
  }

  // --- Route resolution ---

  resolveMock(
    url: string,
    method: string,
    body?: Record<string, unknown>,
  ): Response | null {
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const params = new URLSearchParams(path.split('?')[1] ?? '');

    // --- Notification routes ---

    // GET /notifications/unread-count
    if (method === 'GET' && /\/notifications\/unread-count$/.test(path)) {
      const count = this.notifications.filter(n => n.status === 'UNREAD').length;
      return json({ count });
    }

    // POST /notifications/mark-all-read
    if (method === 'POST' && /\/notifications\/mark-all-read$/.test(path)) {
      let count = 0;
      this.notifications = this.notifications.map(n => {
        if (n.status === 'UNREAD') {
          count++;
          return { ...n, status: 'READ' as const, readAt: new Date().toISOString() };
        }
        return n;
      });
      return json({ count });
    }

    // PATCH /notifications/{id}/read
    const readMatch = path.match(/\/notifications\/([^/?]+)\/read$/);
    if (method === 'PATCH' && readMatch) {
      const id = readMatch[1]!;
      const idx = this.notifications.findIndex(n => n.id === id);
      if (idx === -1) return notFound();
      const n = this.notifications[idx]!;
      if (n.status === 'READ' || n.status === 'DISMISSED') {
        return json(n);
      }
      const updated: Notification = { ...n, status: 'READ', readAt: new Date().toISOString() };
      this.notifications = [...this.notifications.slice(0, idx), updated, ...this.notifications.slice(idx + 1)];
      return json(updated);
    }

    // PATCH /notifications/{id}/dismiss
    const dismissMatch = path.match(/\/notifications\/([^/?]+)\/dismiss$/);
    if (method === 'PATCH' && dismissMatch) {
      const id = dismissMatch[1]!;
      const idx = this.notifications.findIndex(n => n.id === id);
      if (idx === -1) return notFound();
      const n = this.notifications[idx]!;
      const updated: Notification = {
        ...n,
        status: 'DISMISSED',
        readAt: n.readAt ?? new Date().toISOString(),
        dismissedAt: new Date().toISOString(),
      };
      this.notifications = [...this.notifications.slice(0, idx), updated, ...this.notifications.slice(idx + 1)];
      return json(updated);
    }

    // GET /notifications (with filters + cursor pagination)
    if (method === 'GET' && /\/notifications(\?|$)/.test(path) && !/\/notifications\//.test(path)) {
      return this.handleListNotifications(params);
    }

    // --- Snooze routes ---

    // DELETE /notifications/snooze (must be before GET /snooze to avoid path conflicts)
    if (method === 'DELETE' && /\/notifications\/snooze$/.test(path)) {
      this.snooze = null;
      return new Response(null, { status: 204 });
    }

    // POST /notifications/snooze
    if (method === 'POST' && /\/notifications\/snooze$/.test(path)) {
      if (body == null) return new Response(null, { status: 400 });
      this.snooze = {
        userId: 'demo-user',
        tenancyId: 'tenant-001',
        until: body.until as string,
        createdAt: new Date().toISOString(),
      };
      return json(this.snooze);
    }

    // GET /notifications/snooze
    if (method === 'GET' && /\/notifications\/snooze$/.test(path)) {
      if (this.snooze == null) return notFound();
      return json(this.snooze);
    }

    // GET /notifications/mute
    if (method === 'GET' && /\/notifications\/mute$/.test(path)) {
      return json([]);
    }

    // GET /notifications/preferences
    if (method === 'GET' && /\/notifications\/preferences$/.test(path)) {
      const prefs: NotificationPreferences = {
        userId: 'demo-user',
        tenancyId: 'tenant-001',
        channelDefaults: {
          in_app: {
            enabled: true,
            minSeverity: 'INFO',
            digestSchedule: null,
          },
          email: {
            enabled: true,
            minSeverity: 'WARNING',
            digestSchedule: { type: 'daily_at', time: '09:00', timezone: 'Europe/London' },
          },
        },
        quietHours: null,
        updatedAt: '2026-06-15T14:30:00Z',
      };
      return json(prefs);
    }

    // --- Subscription routes ---

    // GET /subscriptions/event-types
    if (method === 'GET' && /\/subscriptions\/event-types$/.test(path)) {
      return json(this.eventTypes);
    }

    // PATCH /subscriptions/{id}/enable
    const enableMatch = path.match(/\/subscriptions\/([^/?]+)\/enable$/);
    if (method === 'PATCH' && enableMatch) {
      return this.handleToggleSubscription(enableMatch[1]!, true);
    }

    // PATCH /subscriptions/{id}/disable
    const disableMatch = path.match(/\/subscriptions\/([^/?]+)\/disable$/);
    if (method === 'PATCH' && disableMatch) {
      return this.handleToggleSubscription(disableMatch[1]!, false);
    }

    // DELETE /subscriptions/{id}
    const deleteSubMatch = path.match(/\/subscriptions\/([^/?]+)$/);
    if (method === 'DELETE' && deleteSubMatch) {
      const id = deleteSubMatch[1]!;
      const idx = this.subscriptions.findIndex(s => s.id === id);
      if (idx === -1) return notFound();
      this.subscriptions = [...this.subscriptions.slice(0, idx), ...this.subscriptions.slice(idx + 1)];
      return new Response(null, { status: 204 });
    }

    // PATCH /subscriptions/{id}
    const patchSubMatch = path.match(/\/subscriptions\/([^/?]+)$/);
    if (method === 'PATCH' && patchSubMatch) {
      const id = patchSubMatch[1]!;
      const idx = this.subscriptions.findIndex(s => s.id === id);
      if (idx === -1) return notFound();
      const existing = this.subscriptions[idx]!;
      const update = body as unknown as SubscriptionUpdate;
      const updated: Subscription = {
        ...existing,
        ...(update.name !== undefined ? { name: update.name } : {}),
        ...(update.eventType !== undefined ? { eventType: update.eventType } : {}),
        ...(update.constraints !== undefined ? { constraints: update.constraints } : {}),
        ...(update.targets !== undefined ? { targets: update.targets } : {}),
        ...(update.includeActor !== undefined ? { includeActor: update.includeActor } : {}),
        ...(update.template !== undefined ? { template: update.template } : {}),
        ...(update.enabled !== undefined ? { enabled: update.enabled } : {}),
        updatedAt: new Date().toISOString(),
      };
      this.subscriptions = [...this.subscriptions.slice(0, idx), updated, ...this.subscriptions.slice(idx + 1)];
      return json(updated);
    }

    // POST /subscriptions
    if (method === 'POST' && /\/subscriptions(\?|$)/.test(path) && !/\/subscriptions\//.test(path)) {
      if (body == null) return new Response(null, { status: 400 });
      const input = body as unknown as SubscriptionInput;
      const now = new Date().toISOString();
      const created: Subscription = {
        id: `sub-${Date.now()}`,
        ownerId: input.ownerId,
        tenancyId: input.tenancyId,
        name: input.name,
        eventType: input.eventType,
        constraints: input.constraints,
        targets: input.targets,
        includeActor: input.includeActor,
        template: input.template,
        enabled: input.enabled,
        createdAt: now,
        updatedAt: now,
      };
      this.subscriptions = [...this.subscriptions, created];
      return json(created);
    }

    // GET /subscriptions
    if (method === 'GET' && /\/subscriptions(\?|$)/.test(path) && !/\/subscriptions\//.test(path)) {
      return this.handleListSubscriptions(params);
    }

    return null;
  }

  // --- List handlers ---

  private handleListNotifications(params: URLSearchParams): Response {
    let filtered = [...this.notifications];

    // Status filter (comma-separated)
    const statusParam = params.get('status');
    if (statusParam != null) {
      const statuses = new Set(statusParam.split(','));
      filtered = filtered.filter(n => statuses.has(n.status));
    }

    // Category filter
    const categoryParam = params.get('category');
    if (categoryParam != null) {
      filtered = filtered.filter(n => n.category === categoryParam);
    }

    // Sort by createdAt descending
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Cursor pagination (page size 10 for demo)
    const pageSize = 10;
    const cursor = params.get('cursor');
    let startIdx = 0;
    if (cursor != null) {
      const cursorIdx = filtered.findIndex(n => n.id === cursor);
      if (cursorIdx !== -1) {
        startIdx = cursorIdx + 1;
      }
    }

    const page = filtered.slice(startIdx, startIdx + pageSize);
    const hasMore = startIdx + pageSize < filtered.length;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    const result: NotificationPage = {
      notifications: page,
      nextCursor,
    };

    return json(result);
  }

  private handleListSubscriptions(params: URLSearchParams): Response {
    let filtered = [...this.subscriptions];

    const enabledParam = params.get('enabled');
    if (enabledParam != null) {
      const wantEnabled = enabledParam === 'true';
      filtered = filtered.filter(s => s.enabled === wantEnabled);
    }

    const result: SubscriptionPage = {
      subscriptions: filtered,
      nextCursor: null,
    };

    return json(result);
  }

  private handleToggleSubscription(id: string, enabled: boolean): Response {
    const idx = this.subscriptions.findIndex(s => s.id === id);
    if (idx === -1) return notFound();
    const updated: Subscription = {
      ...this.subscriptions[idx]!,
      enabled,
      updatedAt: new Date().toISOString(),
    };
    this.subscriptions = [...this.subscriptions.slice(0, idx), updated, ...this.subscriptions.slice(idx + 1)];
    return json(updated);
  }

  // --- SSE script ---

  private startScript(): void {
    let cumulative = 0;
    for (const entry of this.script) {
      cumulative += entry.delaySeconds * 1000;
      const timer = setTimeout(() => {
        // Add new notifications to internal state
        if (entry.eventName === 'notification') {
          const notif = entry.data as Notification;
          if (notif.id != null) {
            const existing = this.notifications.findIndex(n => n.id === notif.id);
            if (existing === -1) {
              this.notifications = [notif, ...this.notifications];
            }
          }
        } else if (entry.eventName === 'notification-updated') {
          const updated = entry.data as Notification;
          if (updated.id != null) {
            const idx = this.notifications.findIndex(n => n.id === updated.id);
            if (idx !== -1) {
              this.notifications = [...this.notifications.slice(0, idx), updated, ...this.notifications.slice(idx + 1)];
            }
          }
        }
        MockSSESource.pushNamedEvent(SSE_URL, entry.eventName, entry.data);
      }, cumulative);
      this.scriptTimers.push(timer);
    }
  }

  private stopScript(): void {
    for (const timer of this.scriptTimers) clearTimeout(timer);
    this.scriptTimers = [];
  }
}

// --- Helpers ---

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function notFound(): Response {
  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

// --- Factory ---

export async function initMockNotificationState(): Promise<MockNotificationState> {
  const [notifications, subscriptions, eventTypes, script] = await Promise.all([
    fetch('/mock-data/notifications.json').then(r => r.json()),
    fetch('/mock-data/subscriptions.json').then(r => r.json()),
    fetch('/mock-data/event-types.json').then(r => r.json()),
    fetch('/mock-data/notification-sse-script.json').then(r => r.json()),
  ]);

  const state = new MockNotificationState(notifications, subscriptions, eventTypes, script);

  // Install EventSource mock and start
  (window as any).EventSource = MockSSESource;
  state.start();

  return state;
}
