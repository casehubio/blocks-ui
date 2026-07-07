import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationApi, ApiError } from './api.js';
import type {
  Notification,
  NotificationPage,
  Subscription,
  SubscriptionPage,
  MuteRule,
  Snooze,
  NotificationPreferences,
  DeliveryChannelDescriptor,
} from './types.js';

describe('NotificationApi', () => {
  let api: NotificationApi;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    api = new NotificationApi('https://api.test', mockFetch);
  });

  describe('listNotifications', () => {
    it('calls correct endpoint with query params', async () => {
      const mockPage: NotificationPage = {
        notifications: [],
        nextCursor: null,
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPage,
      });

      await api.listNotifications({ status: 'UNREAD', limit: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test/notifications?status=UNREAD&limit=10',
      );
    });

    it('validates response shape', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ invalid: 'shape' }),
      });

      await expect(api.listNotifications({})).rejects.toThrow(ApiError);
    });
  });

  describe('unreadCount', () => {
    it('returns count from response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ count: 42 }),
      });

      const count = await api.unreadCount();

      expect(count).toBe(42);
      expect(mockFetch).toHaveBeenCalledWith('https://api.test/notifications/unread-count');
    });

    it('throws on invalid response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ invalid: 'shape' }),
      });

      await expect(api.unreadCount()).rejects.toThrow(ApiError);
    });
  });

  describe('markRead', () => {
    it('calls correct endpoint', async () => {
      const mockNotification: Notification = {
        id: 'n1',
        userId: 'u1',
        tenancyId: 't1',
        title: 'Test',
        body: null,
        category: 'test',
        severity: 'INFO',
        actionUrl: null,
        source: { eventId: 'e1', entityType: 'test', entityId: 'ent1', actorId: 'a1' },
        status: 'READ',
        createdAt: '2026-01-01T00:00:00Z',
        readAt: '2026-01-01T00:01:00Z',
        dismissedAt: null,
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockNotification,
      });

      await api.markRead('n1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test/notifications/n1/read',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  describe('dismiss', () => {
    it('calls correct endpoint', async () => {
      const mockNotification: Notification = {
        id: 'n1',
        userId: 'u1',
        tenancyId: 't1',
        title: 'Test',
        body: null,
        category: 'test',
        severity: 'INFO',
        actionUrl: null,
        source: { eventId: 'e1', entityType: 'test', entityId: 'ent1', actorId: 'a1' },
        status: 'DISMISSED',
        createdAt: '2026-01-01T00:00:00Z',
        readAt: null,
        dismissedAt: '2026-01-01T00:02:00Z',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockNotification,
      });

      await api.dismiss('n1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test/notifications/n1/dismiss',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  describe('markAllRead', () => {
    it('returns updated count', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ count: 5 }),
      });

      const count = await api.markAllRead();

      expect(count).toBe(5);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test/notifications/mark-all-read',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('listSubscriptions', () => {
    it('calls correct endpoint with params', async () => {
      const mockPage: SubscriptionPage = {
        subscriptions: [],
        nextCursor: null,
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPage,
      });

      await api.listSubscriptions({ enabled: true });

      expect(mockFetch).toHaveBeenCalledWith('https://api.test/subscriptions?enabled=true');
    });
  });

  describe('createSubscription', () => {
    it('posts to subscriptions endpoint', async () => {
      const input = {
        ownerId: 'u1',
        tenancyId: 't1',
        name: 'Test Sub',
        eventType: 'test.event',
        constraints: [],
        targets: [],
        includeActor: false,
        template: {
          titlePattern: '{title}',
          bodyPattern: null,
          severity: 'INFO' as const,
          category: 'test',
          actionUrlPattern: null,
          entityType: 'test',
          entityIdField: 'id',
          actorIdField: 'actorId',
        },
        enabled: true,
      };
      const mockSub: Subscription = {
        id: 's1',
        ...input,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSub,
      });

      await api.createSubscription(input);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test/subscriptions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }),
      );
    });
  });

  describe('updateSubscription', () => {
    it('patches subscription', async () => {
      const update = { name: 'Updated' };
      const mockSub: Subscription = {
        id: 's1',
        ownerId: 'u1',
        tenancyId: 't1',
        name: 'Updated',
        eventType: 'test',
        constraints: [],
        targets: [],
        includeActor: false,
        template: {
          titlePattern: '{title}',
          bodyPattern: null,
          severity: 'INFO',
          category: 'test',
          actionUrlPattern: null,
          entityType: 'test',
          entityIdField: 'id',
          actorIdField: 'actorId',
        },
        enabled: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:01:00Z',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSub,
      });

      await api.updateSubscription('s1', update);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test/subscriptions/s1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(update),
        }),
      );
    });
  });

  describe('deleteSubscription', () => {
    it('deletes subscription', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
      });

      await api.deleteSubscription('s1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test/subscriptions/s1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('enableSubscription', () => {
    it('posts to enable endpoint', async () => {
      const mockSub: Subscription = {
        id: 's1',
        ownerId: 'u1',
        tenancyId: 't1',
        name: 'Test',
        eventType: 'test',
        constraints: [],
        targets: [],
        includeActor: false,
        template: {
          titlePattern: '{title}',
          bodyPattern: null,
          severity: 'INFO',
          category: 'test',
          actionUrlPattern: null,
          entityType: 'test',
          entityIdField: 'id',
          actorIdField: 'actorId',
        },
        enabled: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:01:00Z',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSub,
      });

      await api.enableSubscription('s1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test/subscriptions/s1/enable',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('disableSubscription', () => {
    it('posts to disable endpoint', async () => {
      const mockSub: Subscription = {
        id: 's1',
        ownerId: 'u1',
        tenancyId: 't1',
        name: 'Test',
        eventType: 'test',
        constraints: [],
        targets: [],
        includeActor: false,
        template: {
          titlePattern: '{title}',
          bodyPattern: null,
          severity: 'INFO',
          category: 'test',
          actionUrlPattern: null,
          entityType: 'test',
          entityIdField: 'id',
          actorIdField: 'actorId',
        },
        enabled: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:01:00Z',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSub,
      });

      await api.disableSubscription('s1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test/subscriptions/s1/disable',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('getPreferences', () => {
    it('returns preferences or null', async () => {
      const mockPrefs: NotificationPreferences = {
        userId: 'u1',
        tenancyId: 't1',
        channelDefaults: {},
        quietHours: null,
        updatedAt: '2026-01-01T00:00:00Z',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPrefs,
      });

      const result = await api.getPreferences();

      expect(result).toEqual(mockPrefs);
      expect(mockFetch).toHaveBeenCalledWith('https://api.test/preferences');
    });

    it('returns null on 404', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await api.getPreferences();

      expect(result).toBeNull();
    });
  });

  describe('updatePreferences', () => {
    it('patches preferences', async () => {
      const update = { channelDefaults: {} };
      const mockPrefs: NotificationPreferences = {
        userId: 'u1',
        tenancyId: 't1',
        channelDefaults: {},
        quietHours: null,
        updatedAt: '2026-01-01T00:01:00Z',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPrefs,
      });

      await api.updatePreferences(update);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test/preferences',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(update),
        }),
      );
    });
  });

  describe('addMuteRule', () => {
    it('posts mute rule', async () => {
      const input = {
        userId: 'u1',
        tenancyId: 't1',
        scope: 'ENTITY' as const,
        scopeId: 'ent1',
        entityType: 'work-item',
      };
      const mockRule: MuteRule = {
        id: 'm1',
        ...input,
        createdAt: '2026-01-01T00:00:00Z',
        expiresAt: null,
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockRule,
      });

      await api.addMuteRule(input);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test/mutes',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(input),
        }),
      );
    });
  });

  describe('listMuteRules', () => {
    it('lists mute rules', async () => {
      const mockRules: MuteRule[] = [];
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockRules,
      });

      await api.listMuteRules();

      expect(mockFetch).toHaveBeenCalledWith('https://api.test/mutes');
    });
  });

  describe('removeMuteRule', () => {
    it('deletes mute rule', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
      });

      await api.removeMuteRule('m1');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test/mutes/m1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('activateSnooze', () => {
    it('posts snooze', async () => {
      const until = '2026-01-02T00:00:00Z';
      const mockSnooze: Snooze = {
        userId: 'u1',
        tenancyId: 't1',
        until,
        createdAt: '2026-01-01T00:00:00Z',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSnooze,
      });

      await api.activateSnooze(until);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test/snooze',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ until }),
        }),
      );
    });
  });

  describe('getSnooze', () => {
    it('returns snooze or null', async () => {
      const mockSnooze: Snooze = {
        userId: 'u1',
        tenancyId: 't1',
        until: '2026-01-02T00:00:00Z',
        createdAt: '2026-01-01T00:00:00Z',
      };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSnooze,
      });

      const result = await api.getSnooze();

      expect(result).toEqual(mockSnooze);
      expect(mockFetch).toHaveBeenCalledWith('https://api.test/snooze');
    });

    it('returns null on 404', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await api.getSnooze();

      expect(result).toBeNull();
    });
  });

  describe('cancelSnooze', () => {
    it('deletes snooze', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
      });

      await api.cancelSnooze();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test/snooze',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('getChannels', () => {
    it('lists delivery channels', async () => {
      const mockChannels: DeliveryChannelDescriptor[] = [];
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockChannels,
      });

      await api.getChannels();

      expect(mockFetch).toHaveBeenCalledWith('https://api.test/channels');
    });
  });

  describe('error handling', () => {
    it('throws ApiError on non-2xx response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' }),
      });

      await expect(api.listNotifications({})).rejects.toThrow(ApiError);
    });

    it('includes response message in ApiError', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Invalid input' }),
      });

      try {
        await api.listNotifications({});
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).message).toContain('Invalid input');
      }
    });
  });
});
