import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockNotificationState } from '../mock/mock-notification-state.js';
import notifications from '../../mock-data/notifications.json';
import subscriptions from '../../mock-data/subscriptions.json';
import eventTypes from '../../mock-data/event-types.json';
import sseScript from '../../mock-data/notification-sse-script.json';
import './notification-page.js';

function flush(ms = 100): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function mockJsonFetches(): void {
  const originalFetch = window.fetch;
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('notifications.json')) return new Response(JSON.stringify(notifications));
    if (url.includes('subscriptions.json')) return new Response(JSON.stringify(subscriptions));
    if (url.includes('event-types.json')) return new Response(JSON.stringify(eventTypes));
    if (url.includes('notification-sse-script.json')) return new Response(JSON.stringify(sseScript));
    return originalFetch(input, init);
  }) as typeof fetch;
}

describe('notification-page', () => {
  let el: HTMLElement;

  beforeEach(() => {
    mockJsonFetches();
  });

  afterEach(() => {
    el?.remove();
  });

  it('renders past loading state and shows inbox content', async () => {
    el = document.createElement('notification-page');
    document.body.appendChild(el);

    // The component's connectedCallback calls initMockState() which does:
    // 1. dynamic import('../mock/mock-notification-state.js')
    // 2. four fetch() calls for JSON data
    // 3. sets this.mockState = new MockNotificationState(...)
    // 4. Lit @state() triggers re-render
    // Wait for all of that to complete
    for (let i = 0; i < 10; i++) {
      await flush(50);
      const shadow = el.shadowRoot;
      if (shadow?.querySelector('.toolbar')) break;
    }

    const shadow = el.shadowRoot;
    expect(shadow).not.toBeNull();

    // Diagnostic: what did we actually render?
    const hasToolbar = shadow!.querySelector('.toolbar') != null;
    const hasError = (shadow!.textContent ?? '').includes('Error');
    const hasLoading = (shadow!.textContent ?? '').includes('Loading mock data');

    // It should not be stuck on loading or show an error
    expect(hasError).toBe(false);
    expect(hasLoading && !hasToolbar).toBe(false);

    expect(shadow!.querySelector('.toolbar')).not.toBeNull();
    expect(shadow!.querySelector('.controls')).not.toBeNull();
    expect(shadow!.querySelector('notification-inbox')).not.toBeNull();
  });

  it('shows error message when init fails', async () => {
    window.fetch = vi.fn().mockRejectedValue(new Error('network down')) as typeof fetch;

    el = document.createElement('notification-page');
    document.body.appendChild(el);

    await flush();
    await flush();
    await flush();

    const text = el.shadowRoot!.textContent ?? '';
    expect(text).toContain('Error');
  });

  it('renders demo control buttons including Subscriptions', async () => {
    el = document.createElement('notification-page');
    document.body.appendChild(el);

    await flush();
    await flush();
    await flush();

    const buttons = Array.from(el.shadowRoot!.querySelectorAll('.demo-btn'));
    const labels = buttons.map(b => b.textContent?.trim());

    expect(labels).toContain('Simulate notification');
    expect(labels).toContain('Simulate SLA breach');
    expect(labels).toContain('Reset data');
    expect(labels).toContain('Subscriptions');
  });

  it('opens subscription dialog when Subscriptions button clicked', async () => {
    el = document.createElement('notification-page');
    document.body.appendChild(el);

    await flush();
    await flush();
    await flush();

    const shadow = el.shadowRoot!;
    expect(shadow.querySelector('.dialog-panel')).toBeNull();

    const subBtn = Array.from(shadow.querySelectorAll('.demo-btn'))
      .find(b => b.textContent?.trim() === 'Subscriptions') as HTMLButtonElement;
    expect(subBtn).not.toBeNull();
    subBtn.click();
    await flush();

    expect(shadow.querySelector('.dialog-panel')).not.toBeNull();
    expect(shadow.querySelector('.dialog-title')?.textContent?.trim()).toBe('Subscriptions');
    expect(shadow.querySelector('subscription-list')).not.toBeNull();
  });

  it('closes subscription dialog when close button clicked', async () => {
    el = document.createElement('notification-page');
    document.body.appendChild(el);

    await flush();
    await flush();
    await flush();

    const shadow = el.shadowRoot!;

    const subBtn = Array.from(shadow.querySelectorAll('.demo-btn'))
      .find(b => b.textContent?.trim() === 'Subscriptions') as HTMLButtonElement;
    subBtn.click();
    await flush();
    expect(shadow.querySelector('.dialog-panel')).not.toBeNull();

    (shadow.querySelector('.dialog-close') as HTMLButtonElement).click();
    await flush();
    expect(shadow.querySelector('.dialog-panel')).toBeNull();
  });

  it('closes subscription dialog when backdrop clicked', async () => {
    el = document.createElement('notification-page');
    document.body.appendChild(el);

    await flush();
    await flush();
    await flush();

    const shadow = el.shadowRoot!;

    const subBtn = Array.from(shadow.querySelectorAll('.demo-btn'))
      .find(b => b.textContent?.trim() === 'Subscriptions') as HTMLButtonElement;
    subBtn.click();
    await flush();
    expect(shadow.querySelector('.dialog-panel')).not.toBeNull();

    (shadow.querySelector('.dialog-backdrop') as HTMLElement).click();
    await flush();
    expect(shadow.querySelector('.dialog-panel')).toBeNull();
  });

  it('has vertical separator before Subscriptions button', async () => {
    el = document.createElement('notification-page');
    document.body.appendChild(el);

    await flush();
    await flush();
    await flush();

    expect(el.shadowRoot!.querySelector('.controls-divider')).not.toBeNull();
  });

  it('simulate notification button adds a new notification row', async () => {
    el = document.createElement('notification-page');
    document.body.appendChild(el);

    for (let i = 0; i < 10; i++) {
      await flush(50);
      if (el.shadowRoot?.querySelector('.toolbar')) break;
    }

    const shadow = el.shadowRoot!;
    const inbox = shadow.querySelector('notification-inbox') as any;
    expect(inbox).not.toBeNull();

    // Wait for inbox to load its initial data
    await flush();
    await flush();

    const inboxShadow = inbox.shadowRoot;
    const initialRows = inboxShadow?.querySelectorAll('.row, [role="row"]:not(.header)') ?? [];
    const initialCount = initialRows.length;

    // Click simulate notification
    const simBtn = Array.from(shadow.querySelectorAll('.demo-btn'))
      .find(b => b.textContent?.trim() === 'Simulate notification') as HTMLButtonElement;
    expect(simBtn).not.toBeNull();

    const clickTime = performance.now();
    simBtn.click();

    // Wait for SSE event delivery + Lit re-render
    await flush();
    await flush();

    const elapsed = performance.now() - clickTime;

    // The mock state should have a new notification
    const page = el as any;
    const stateNotifs = page.mockState?.getNotifications();
    expect(stateNotifs.length).toBeGreaterThan(notifications.length);

    // Response time should be under 500ms
    expect(elapsed).toBeLessThan(500);
  });

  it('simulate SLA breach button adds an URGENT notification to mock state', async () => {
    el = document.createElement('notification-page');
    document.body.appendChild(el);

    for (let i = 0; i < 10; i++) {
      await flush(50);
      if (el.shadowRoot?.querySelector('.toolbar')) break;
    }

    const shadow = el.shadowRoot!;

    const slaBtn = Array.from(shadow.querySelectorAll('.demo-btn'))
      .find(b => b.textContent?.trim() === 'Simulate SLA breach') as HTMLButtonElement;
    expect(slaBtn).not.toBeNull();

    const page = el as any;
    const countBefore = page.mockState?.getNotifications().length;

    const clickTime = performance.now();
    slaBtn.click();
    await flush();

    const elapsed = performance.now() - clickTime;
    const countAfter = page.mockState?.getNotifications().length;

    expect(countAfter).toBe(countBefore + 1);

    // The new notification should be URGENT
    const newest = page.mockState.getNotifications()[0];
    expect(newest.severity).toBe('URGENT');
    expect(newest.category).toBe('sla.breached');

    expect(elapsed).toBeLessThan(500);
  });

  it('reset button restores original notification count', async () => {
    el = document.createElement('notification-page');
    document.body.appendChild(el);

    for (let i = 0; i < 10; i++) {
      await flush(50);
      if (el.shadowRoot?.querySelector('.toolbar')) break;
    }

    const shadow = el.shadowRoot!;
    const page = el as any;

    // Add a notification first
    const simBtn = Array.from(shadow.querySelectorAll('.demo-btn'))
      .find(b => b.textContent?.trim() === 'Simulate notification') as HTMLButtonElement;
    simBtn.click();
    await flush();

    const countAfterAdd = page.mockState?.getNotifications().length;
    expect(countAfterAdd).toBeGreaterThan(notifications.length);

    // Click reset
    const resetBtn = Array.from(shadow.querySelectorAll('.demo-btn'))
      .find(b => b.textContent?.trim() === 'Reset data') as HTMLButtonElement;
    expect(resetBtn).not.toBeNull();

    const clickTime = performance.now();
    resetBtn.click();
    await flush();

    const elapsed = performance.now() - clickTime;
    const countAfterReset = page.mockState?.getNotifications().length;

    expect(countAfterReset).toBe(notifications.length);
    expect(elapsed).toBeLessThan(500);
  });

  it('unread notifications show a visible dot indicator in the table', async () => {
    el = document.createElement('notification-page');
    document.body.appendChild(el);

    for (let i = 0; i < 10; i++) {
      await flush(50);
      if (el.shadowRoot?.querySelector('.toolbar')) break;
    }

    const shadow = el.shadowRoot!;
    const inbox = shadow.querySelector('notification-inbox') as any;
    expect(inbox).not.toBeNull();

    await flush(200);
    await flush(200);

    const table = inbox.shadowRoot?.querySelector('pages-data-table') as any;
    expect(table).not.toBeNull();

    const tableShadow = table?.shadowRoot;
    expect(tableShadow).not.toBeNull();

    const dots = tableShadow?.querySelectorAll('[aria-label="Unread"]') ?? [];
    expect(dots.length).toBeGreaterThan(0);

    const dot = dots[0] as HTMLElement;
    expect(dot.style.width).toBe('8px');
    expect(dot.style.height).toBe('8px');
    expect(dot.style.borderRadius).toBe('50%');
  });

  it('notification inbox table has column picker (⋮) button', async () => {
    el = document.createElement('notification-page');
    document.body.appendChild(el);

    for (let i = 0; i < 10; i++) {
      await flush(50);
      if (el.shadowRoot?.querySelector('.toolbar')) break;
    }

    const shadow = el.shadowRoot!;
    const inbox = shadow.querySelector('notification-inbox') as any;
    expect(inbox).not.toBeNull();

    await flush();
    await flush();

    const inboxShadow = inbox?.shadowRoot;
    expect(inboxShadow).not.toBeNull();

    const table = inboxShadow?.querySelector('pages-data-table') as any;
    expect(table).not.toBeNull();

    const tableShadow = table?.shadowRoot;
    expect(tableShadow).not.toBeNull();

    const picker = tableShadow?.querySelector('.column-picker-trigger');
    expect(picker).not.toBeNull();
    expect(picker?.textContent?.trim()).toBe('⋮');
  });

  it('simulate notification button adds a visible row to the inbox table', async () => {
    el = document.createElement('notification-page');
    document.body.appendChild(el);

    for (let i = 0; i < 10; i++) {
      await flush(50);
      if (el.shadowRoot?.querySelector('.toolbar')) break;
    }

    const shadow = el.shadowRoot!;
    const inbox = shadow.querySelector('notification-inbox') as any;
    expect(inbox).not.toBeNull();

    // Wait for inbox to fetch and render initial data
    await flush(200);
    await flush(200);

    const inboxShadow = inbox.shadowRoot!;
    const table = inboxShadow.querySelector('pages-data-table') as any;
    expect(table).not.toBeNull();

    // Count initial rows in the table
    const initialRowCount = table.rows?.length ?? 0;

    // Click simulate notification
    const simBtn = Array.from(shadow.querySelectorAll('.demo-btn'))
      .find(b => b.textContent?.trim() === 'Simulate notification') as HTMLButtonElement;
    simBtn.click();

    // Wait for SSE event → inbox state update → table re-render
    await flush(200);
    await flush(200);

    // The table should now have more rows
    const newRowCount = table.rows?.length ?? 0;
    expect(newRowCount).toBeGreaterThan(initialRowCount);

    // Also check the inbox component's internal items array grew
    const inboxItems = (inbox as any).items;
    expect(inboxItems.length).toBeGreaterThan(initialRowCount);
  });

  it('reset button restores inbox table row count after adding notifications', async () => {
    el = document.createElement('notification-page');
    document.body.appendChild(el);

    for (let i = 0; i < 10; i++) {
      await flush(50);
      if (el.shadowRoot?.querySelector('.toolbar')) break;
    }

    const shadow = el.shadowRoot!;
    const inbox = shadow.querySelector('notification-inbox') as any;
    expect(inbox).not.toBeNull();

    await flush(200);
    await flush(200);

    const table = inbox.shadowRoot!.querySelector('pages-data-table') as any;
    expect(table).not.toBeNull();

    const initialRowCount = table.rows?.length ?? 0;
    expect(initialRowCount).toBeGreaterThan(0);

    // Add two notifications via simulate buttons
    const simBtn = Array.from(shadow.querySelectorAll('.demo-btn'))
      .find(b => b.textContent?.trim() === 'Simulate notification') as HTMLButtonElement;
    simBtn.click();
    await flush(200);
    simBtn.click();
    await flush(200);

    const afterAddCount = table.rows?.length ?? 0;
    expect(afterAddCount).toBeGreaterThan(initialRowCount);

    // Verify mock state has the extra notifications
    const page = el as any;
    const stateCountBeforeReset = page.mockState.getNotifications().length;
    expect(stateCountBeforeReset).toBeGreaterThan(notifications.length);

    // Click reset — page's resetData() calls mockState.reset() + inbox.refresh()
    const resetBtn = Array.from(shadow.querySelectorAll('.demo-btn'))
      .find(b => b.textContent?.trim() === 'Reset data') as HTMLButtonElement;
    expect(resetBtn).not.toBeNull();
    resetBtn.click();

    // Wait for fetchItems() → mock fetch → Lit re-render
    for (let i = 0; i < 10; i++) {
      await flush(100);
      if ((table.rows?.length ?? 0) <= initialRowCount) break;
    }

    // After reset + refresh, inbox should have re-fetched from mock state
    // which was restored to the original data
    expect(inbox.error).toBeNull();
    expect(inbox.items.length).toBe(initialRowCount);

    // Wait for Lit to propagate inbox.items → inbox re-render → table.rows → table re-render
    await inbox.updateComplete;
    await table.updateComplete;
    await flush(50);

    // Re-query table rows after render propagation
    const finalTable = inbox.shadowRoot!.querySelector('pages-data-table') as any;
    expect(finalTable.rows?.length).toBe(initialRowCount);
  });

  it('simulate button fires exactly one event — no background script interference', async () => {
    el = document.createElement('notification-page');
    document.body.appendChild(el);

    for (let i = 0; i < 10; i++) {
      await flush(50);
      if (el.shadowRoot?.querySelector('.toolbar')) break;
    }

    const shadow = el.shadowRoot!;
    const page = el as any;
    const countBefore = page.mockState.getNotifications().length;

    // Click simulate once
    const simBtn = Array.from(shadow.querySelectorAll('.demo-btn'))
      .find(b => b.textContent?.trim() === 'Simulate notification') as HTMLButtonElement;
    simBtn.click();

    // Immediately check — should be exactly +1
    const countAfter = page.mockState.getNotifications().length;
    expect(countAfter).toBe(countBefore + 1);

    // Wait 3 seconds — no additional notifications should appear from background script
    await flush(3000);
    const countLater = page.mockState.getNotifications().length;
    expect(countLater).toBe(countBefore + 1);
  });

  it('EventSource mock is installed so SSE events reach components', async () => {
    el = document.createElement('notification-page');
    document.body.appendChild(el);

    for (let i = 0; i < 10; i++) {
      await flush(50);
      if (el.shadowRoot?.querySelector('.toolbar')) break;
    }

    // After page init, EventSource should be MockSSESource
    const ES = (window as any).EventSource;
    expect(ES).toBeDefined();
    expect(ES.name).toBe('MockSSESource');
  });
});
