import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockNotificationState } from './mock-notification-state.js';
import notifications from '../../mock-data/notifications.json';
import subscriptions from '../../mock-data/subscriptions.json';
import eventTypes from '../../mock-data/event-types.json';
import sseScript from '../../mock-data/notification-sse-script.json';

describe('notification page init flow', () => {
  let state: MockNotificationState;

  beforeEach(() => {
    state = new MockNotificationState(
      notifications as any,
      subscriptions as any,
      eventTypes as any,
      sseScript as any,
    );
  });

  afterEach(() => {
    state.stop();
  });

  it('constructs MockNotificationState from JSON data', () => {
    expect(state).toBeDefined();
    expect(state.getNotifications().length).toBeGreaterThan(0);
    expect(state.getSubscriptions().length).toBeGreaterThan(0);
  });

  it('start() installs mock fetch and stop() restores it', () => {
    state.start();
    // Mock fetch intercepts our routes
    const mockFetch = window.fetch;
    state.stop();
    // After stop, fetch is restored (may be .bind(window) wrapper, so just verify it changed)
    expect(window.fetch).not.toBe(mockFetch);
  });

  it('mock fetch resolves GET /notifications', async () => {
    state.start();
    const resp = await fetch('/notifications');
    expect(resp.ok).toBe(true);
    const data = await resp.json();
    expect(data.notifications).toBeDefined();
    expect(Array.isArray(data.notifications)).toBe(true);
    expect(data.notifications.length).toBeGreaterThan(0);
  });

  it('mock fetch resolves GET /notifications/unread-count', async () => {
    state.start();
    const resp = await fetch('/notifications/unread-count');
    expect(resp.ok).toBe(true);
    const data = await resp.json();
    expect(typeof data.count).toBe('number');
    expect(data.count).toBeGreaterThan(0);
  });

  it('mock fetch resolves GET /subscriptions', async () => {
    state.start();
    const resp = await fetch('/subscriptions');
    expect(resp.ok).toBe(true);
    const data = await resp.json();
    expect(data.subscriptions).toBeDefined();
    expect(Array.isArray(data.subscriptions)).toBe(true);
  });

  it('mock fetch resolves PATCH /notifications/{id}/read', async () => {
    state.start();
    const notifs = state.getNotifications();
    const unread = notifs.find(n => n.status === 'UNREAD');
    expect(unread).toBeDefined();

    const resp = await fetch(`/notifications/${unread!.id}/read`, { method: 'PATCH' });
    expect(resp.ok).toBe(true);
    const data = await resp.json();
    expect(data.status).toBe('READ');
  });

  it('mock fetch resolves PATCH /notifications/{id}/dismiss', async () => {
    state.start();
    const notifs = state.getNotifications();
    const unread = notifs.find(n => n.status === 'UNREAD');
    expect(unread).toBeDefined();

    const resp = await fetch(`/notifications/${unread!.id}/dismiss`, { method: 'PATCH' });
    expect(resp.ok).toBe(true);
    const data = await resp.json();
    expect(data.status).toBe('DISMISSED');
  });

  it('mock fetch resolves POST /notifications/mark-all-read', async () => {
    state.start();
    const resp = await fetch('/notifications/mark-all-read', { method: 'POST' });
    expect(resp.ok).toBe(true);
    const data = await resp.json();
    expect(typeof data.count).toBe('number');

    const countResp = await fetch('/notifications/unread-count');
    const countData = await countResp.json();
    expect(countData.count).toBe(0);
  });

  it('mock fetch resolves GET /subscriptions/event-types', async () => {
    state.start();
    const resp = await fetch('/subscriptions/event-types');
    expect(resp.ok).toBe(true);
    const data = await resp.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].eventType).toBeDefined();
    expect(data[0].fields).toBeDefined();
  });

  it('mock fetch resolves snooze lifecycle', async () => {
    state.start();

    // No snooze initially
    const getResp1 = await fetch('/notifications/snooze');
    expect(getResp1.status).toBe(404);

    // Activate snooze
    const postResp = await fetch('/notifications/snooze', {
      method: 'POST',
      body: JSON.stringify({ until: new Date(Date.now() + 3600000).toISOString() }),
    });
    expect(postResp.ok).toBe(true);

    // Now has snooze
    const getResp2 = await fetch('/notifications/snooze');
    expect(getResp2.ok).toBe(true);
    const snooze = await getResp2.json();
    expect(snooze.until).toBeDefined();

    // Cancel snooze
    const delResp = await fetch('/notifications/snooze', { method: 'DELETE' });
    expect(delResp.status).toBe(204);

    // No snooze again
    const getResp3 = await fetch('/notifications/snooze');
    expect(getResp3.status).toBe(404);
  });

  it('mock fetch resolves subscription enable/disable', async () => {
    state.start();
    const subs = state.getSubscriptions();
    const sub = subs[0]!;

    const disableResp = await fetch(`/subscriptions/${sub.id}/disable`, { method: 'PATCH' });
    expect(disableResp.ok).toBe(true);
    const disabled = await disableResp.json();
    expect(disabled.enabled).toBe(false);

    const enableResp = await fetch(`/subscriptions/${sub.id}/enable`, { method: 'PATCH' });
    expect(enableResp.ok).toBe(true);
    const enabled = await enableResp.json();
    expect(enabled.enabled).toBe(true);
  });

  it('mock fetch resolves DELETE /subscriptions/{id}', async () => {
    state.start();
    const subs = state.getSubscriptions();
    const sub = subs[0]!;
    const initialCount = subs.length;

    const delResp = await fetch(`/subscriptions/${sub.id}`, { method: 'DELETE' });
    expect(delResp.status).toBe(204);
    expect(state.getSubscriptions().length).toBe(initialCount - 1);
  });

  it('reset() restores original data', async () => {
    state.start();
    await fetch('/notifications/mark-all-read', { method: 'POST' });
    const countBefore = (await (await fetch('/notifications/unread-count')).json()).count;
    expect(countBefore).toBe(0);

    state.reset();
    const countAfter = (await (await fetch('/notifications/unread-count')).json()).count;
    expect(countAfter).toBeGreaterThan(0);
  });

  it('pushSSEEvent adds notification to internal state', () => {
    state.start();
    const before = state.getNotifications().length;
    state.pushSSEEvent('notification', {
      id: 'test-push-1',
      userId: 'demo-user',
      tenancyId: 'tenant-001',
      title: 'Test push',
      body: null,
      category: 'test',
      severity: 'INFO',
      actionUrl: null,
      source: { eventId: 'e1', entityType: 'test', entityId: 't1', actorId: 'a1' },
      status: 'UNREAD',
      createdAt: new Date().toISOString(),
      readAt: null,
      dismissedAt: null,
    });
    expect(state.getNotifications().length).toBe(before + 1);
  });
});
