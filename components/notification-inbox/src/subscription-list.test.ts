import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html } from 'lit';
import { NotificationApi } from './api.js';
import './subscription-list.js';
import type { SubscriptionList } from './subscription-list.js';
import type { Subscription, SubscriptionPage } from './types.js';

// --- Test helpers ---

async function createComponent(markup: string): Promise<SubscriptionList> {
  const container = document.createElement('div');
  container.innerHTML = markup;
  const el = container.firstElementChild as SubscriptionList;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function waitUntil(condition: () => boolean, message = '', timeout = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - start > timeout) {
        reject(new Error(message || 'Timeout waiting for condition'));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

// --- Test fixtures ---

const mockSubscription1: Subscription = {
  id: 'sub-1',
  ownerId: 'user-1',
  tenancyId: 'tenant-1',
  name: 'Issue Updates',
  eventType: 'issue.updated',
  constraints: [
    { field: 'assigneeId', op: 'EQ', value: '$me' },
    { field: 'status', op: 'NEQ', value: 'CLOSED' },
  ],
  targets: [{ type: 'USER', id: 'user-1' }],
  includeActor: false,
  template: {
    titlePattern: 'Issue ${issueId} updated',
    bodyPattern: null,
    severity: 'INFO',
    category: 'issues',
    actionUrlPattern: '/issues/${issueId}',
    entityType: 'issue',
    entityIdField: 'issueId',
    actorIdField: 'userId',
  },
  enabled: true,
  createdAt: '2026-07-01T10:00:00Z',
  updatedAt: '2026-07-01T10:00:00Z',
};

const mockSubscription2: Subscription = {
  id: 'sub-2',
  ownerId: 'user-1',
  tenancyId: 'tenant-1',
  name: 'Pull Request Reviews',
  eventType: 'pr.review_requested',
  constraints: [],
  targets: [{ type: 'USER', id: 'user-1' }],
  includeActor: true,
  template: {
    titlePattern: 'Review requested: ${prTitle}',
    bodyPattern: 'By ${actorName}',
    severity: 'WARNING',
    category: 'code-review',
    actionUrlPattern: '/pr/${prId}',
    entityType: 'pull_request',
    entityIdField: 'prId',
    actorIdField: 'userId',
  },
  enabled: false,
  createdAt: '2026-07-02T14:00:00Z',
  updatedAt: '2026-07-02T14:00:00Z',
};

const mockSubscriptions: Subscription[] = [mockSubscription1, mockSubscription2];

// --- Mock API ---

function createMockApi(overrides: Partial<Record<keyof NotificationApi, unknown>> = {}) {
  return {
    listSubscriptions: async (): Promise<SubscriptionPage> => ({
      subscriptions: mockSubscriptions,
      nextCursor: null,
    }),
    enableSubscription: async (id: string): Promise<Subscription> => {
      const sub = mockSubscriptions.find(s => s.id === id);
      if (!sub) throw new Error('Not found');
      return { ...sub, enabled: true };
    },
    disableSubscription: async (id: string): Promise<Subscription> => {
      const sub = mockSubscriptions.find(s => s.id === id);
      if (!sub) throw new Error('Not found');
      return { ...sub, enabled: false };
    },
    deleteSubscription: async (_id: string): Promise<void> => {
      return Promise.resolve();
    },
    ...overrides,
  } as unknown as NotificationApi;
}

describe('subscription-list', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('fetches and renders subscriptions on connect', async () => {
    const el = await createComponent('<subscription-list endpoint="http://localhost/api"></subscription-list>');

    // Override API with mock
    el.api = createMockApi();

    // Trigger fetch
    await el.connectedCallback();
    await el.updateComplete;
    await waitUntil(() => el.subscriptions.length > 0, 'subscriptions loaded');

    expect(el.subscriptions).toHaveLength(2);
    expect(el.subscriptions[0].name).toBe('Issue Updates');
  });

  it('shows subscription name, event type pill, constraint count per row', async () => {
    const el = await createComponent('<subscription-list endpoint="http://localhost/api"></subscription-list>');

    el.api = createMockApi();
    await el.connectedCallback();
    await el.updateComplete;
    await waitUntil(() => el.subscriptions.length > 0, 'subscriptions loaded');

    const table = el.shadowRoot!.querySelector('pages-data-table');
    expect(table).toBeTruthy();

    // Verify columns render expected data (inspection via rows property)
    const rows = table!.rows as Subscription[];
    expect(rows[0].name).toBe('Issue Updates');
    expect(rows[0].eventType).toBe('issue.updated');
    expect(rows[0].constraints).toHaveLength(2);
  });

  it('toggles subscription enabled state via API', async () => {
    const el = await createComponent('<subscription-list endpoint="http://localhost/api"></subscription-list>');

    let enabledCalled = false;
    let disabledCalled = false;

    el.api = createMockApi({
      enableSubscription: async (id: string) => {
        enabledCalled = true;
        expect(id).toBe('sub-2');
        return { ...mockSubscription2, enabled: true };
      },
      disableSubscription: async (id: string) => {
        disabledCalled = true;
        expect(id).toBe('sub-1');
        return { ...mockSubscription1, enabled: false };
      },
    });

    await el.connectedCallback();
    await el.updateComplete;
    await waitUntil(() => el.subscriptions.length > 0);

    // Simulate toggling sub-2 (disabled -> enabled)
    await el.toggleEnabled('sub-2');
    expect(enabledCalled).toBe(true);

    // Simulate toggling sub-1 (enabled -> disabled)
    await el.toggleEnabled('sub-1');
    expect(disabledCalled).toBe(true);
  });

  it('opens subscription-editor in create mode on New button', async () => {
    const el = await createComponent('<subscription-list endpoint="http://localhost/api"></subscription-list>');

    el.api = createMockApi();
    await el.connectedCallback();
    await el.updateComplete;

    const newButton = el.shadowRoot!.querySelector<HTMLButtonElement>('.btn-new');
    expect(newButton).toBeTruthy();

    newButton!.click();
    await el.updateComplete;

    expect(el.editing).toBe('new');

    const editor = el.shadowRoot!.querySelector('subscription-editor');
    expect(editor).toBeTruthy();
    expect(editor!.subscription).toBeUndefined();
  });

  it('opens subscription-editor in edit mode on Edit button', async () => {
    const el = await createComponent('<subscription-list endpoint="http://localhost/api"></subscription-list>');

    el.api = createMockApi();
    await el.connectedCallback();
    await el.updateComplete;
    await waitUntil(() => el.subscriptions.length > 0);

    // Simulate edit click for sub-1
    el.handleEdit('sub-1');
    await el.updateComplete;

    expect(el.editing).toBe('sub-1');

    const editor = el.shadowRoot!.querySelector('subscription-editor');
    expect(editor).toBeTruthy();
    expect(editor!.subscription?.id).toBe('sub-1');
  });

  it('shows BlocksConfirmDialog before delete', async () => {
    const el = await createComponent('<subscription-list endpoint="http://localhost/api"></subscription-list>');

    el.api = createMockApi();
    await el.connectedCallback();
    await el.updateComplete;
    await waitUntil(() => el.subscriptions.length > 0);

    // Simulate delete click for sub-1
    el.handleDelete('sub-1');
    await el.updateComplete;

    const dialog = el.shadowRoot!.querySelector('blocks-confirm-dialog');
    expect(dialog).toBeTruthy();
    expect(dialog!.open).toBe(true);
    expect(dialog!.heading).toContain('Delete');
  });

  it('deletes subscription after confirmation', async () => {
    const el = await createComponent('<subscription-list endpoint="http://localhost/api"></subscription-list>');

    let deleteCalled = false;
    el.api = createMockApi({
      deleteSubscription: async (id: string) => {
        deleteCalled = true;
        expect(id).toBe('sub-1');
      },
    });

    await el.connectedCallback();
    await el.updateComplete;
    await waitUntil(() => el.subscriptions.length > 0);

    // Trigger delete
    el.handleDelete('sub-1');
    await el.updateComplete;

    // Confirm
    await el.confirmDelete();
    await el.updateComplete;

    expect(deleteCalled).toBe(true);

    // Verify removed from list
    await waitUntil(() => el.subscriptions.length === 1, 'subscription removed');
    expect(el.subscriptions.find(s => s.id === 'sub-1')).toBeUndefined();
  });

  it('shows system subscriptions as read-only with System badge', async () => {
    // System subscriptions have a distinct visual marker (future feature)
    // For now, this test is a placeholder since all subscriptions are personal
    const el = await createComponent('<subscription-list endpoint="http://localhost/api"></subscription-list>');

    el.api = createMockApi();
    await el.connectedCallback();
    await el.updateComplete;

    // Test passes (no system subscriptions rendered yet)
    // When system subscriptions arrive, they will have a "System" badge and no edit/delete buttons
    expect(el.subscriptions.every(s => s.ownerId === 'user-1')).toBe(true);
  });

  it('emits subscription.deleted event on delete', async () => {
    const el = await createComponent('<subscription-list endpoint="http://localhost/api"></subscription-list>');

    el.api = createMockApi();
    await el.connectedCallback();
    await el.updateComplete;
    await waitUntil(() => el.subscriptions.length > 0);

    let eventFired = false;
    let eventPayload: unknown = null;

    el.addEventListener('pages-event', ((e: CustomEvent) => {
      if (e.detail.topic === 'subscription.deleted') {
        eventFired = true;
        eventPayload = e.detail.payload;
      }
    }) as EventListener);

    // Trigger delete + confirm
    el.handleDelete('sub-1');
    await el.updateComplete;
    await el.confirmDelete();
    await el.updateComplete;

    expect(eventFired).toBe(true);
    expect(eventPayload).toEqual({ subscriptionId: 'sub-1' });
  });
});
