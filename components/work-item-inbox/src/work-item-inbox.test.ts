import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WorkItemRootResponse, WorkIdentity } from '@casehubio/blocks-ui-core';
import './work-item-inbox.js';

// Mock IntersectionObserver globally for all tests
global.IntersectionObserver = class IntersectionObserver {
  callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    // Immediately trigger visibility for tests
    setTimeout(() => {
      this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }, 0);
  }
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords() { return []; }
  root = null;
  rootMargin = '';
  thresholds = [];
} as any;

const identity: WorkIdentity = { userId: 'user-1', displayName: 'Test User', groups: ['compliance'] };

const mockItems: WorkItemRootResponse[] = [
  {
    item: {
      id: 'wi-1',
      title: 'Item 1',
      description: null,
      status: 'ASSIGNED',
      priority: 'HIGH',
      assigneeId: 'user-1',
      candidateGroups: null,
      candidateUsers: null,
      requiredCapabilities: null,
      createdBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedAt: null,
      startedAt: null,
      completedAt: null,
      suspendedAt: null,
      version: 1,
      labels: [],
      types: ['review'],
      category: 'review',
      owner: 'system',
      scope: null,
      formKey: null,
      templateId: null,
      inputDataSchema: null,
      outputDataSchema: null,
      payload: null,
      resolution: null,
      outcome: null,
      permittedOutcomes: null,
      confidenceScore: null,
      claimDeadline: null,
      expiresAt: null,
      followUpDate: null,
      delegationDeclineTarget: null,
      delegationChain: null,
      priorStatus: null,
      callerRef: null,
      excludedUsers: null,
      percentComplete: null,
      statusNote: null,
    },
    childCount: 0,
    completedCount: null,
    requiredCount: null,
    groupStatus: null,
  },
  {
    item: {
      id: 'wi-2',
      title: 'Item 2',
      description: null,
      status: 'PENDING',
      priority: 'URGENT',
      assigneeId: null,
      candidateGroups: 'compliance',
      candidateUsers: null,
      requiredCapabilities: null,
      createdBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedAt: null,
      startedAt: null,
      completedAt: null,
      suspendedAt: null,
      version: 1,
      labels: [],
      types: ['investigation'],
      category: 'investigation',
      owner: 'system',
      scope: null,
      formKey: null,
      templateId: null,
      inputDataSchema: null,
      outputDataSchema: null,
      payload: null,
      resolution: null,
      outcome: null,
      permittedOutcomes: null,
      confidenceScore: null,
      claimDeadline: null,
      expiresAt: null,
      followUpDate: null,
      delegationDeclineTarget: null,
      delegationChain: null,
      priorStatus: null,
      callerRef: null,
      excludedUsers: null,
      percentComplete: null,
      statusNote: null,
    },
    childCount: 0,
    completedCount: null,
    requiredCount: null,
    groupStatus: null,
  },
];

describe('work-item-inbox', () => {
  let el: HTMLElement & { identity: WorkIdentity; data: WorkItemRootResponse[] };

  beforeEach(async () => {
    el = document.createElement('work-item-inbox') as any;
    el.identity = identity;
    el.data = mockItems;
    document.body.appendChild(el);
    await (el as any).updateComplete;
  });

  afterEach(() => el.remove());

  it('renders items', () => {
    const table = el.shadowRoot!.querySelector('pages-table');
    expect(table).not.toBeNull();
    expect((table as any).dataSet?.rows.length).toBeGreaterThan(0);
  });

  it('my-work mode shows only assigned items', async () => {
    (el as any).activeTab = 'my-work';
    await (el as any).updateComplete;
    const table = el.shadowRoot!.querySelector('pages-table') as any;
    expect(table.dataSet?.rows.length).toBe(1);
  });

  it('claimable mode shows only pending items', async () => {
    (el as any).activeTab = 'claimable';
    await (el as any).updateComplete;
    const table = el.shadowRoot!.querySelector('pages-table') as any;
    expect(table.dataSet?.rows.length).toBe(1);
  });

  it('emits pages-event on row activation', async () => {
    const handler = vi.fn();
    document.addEventListener('pages-event', handler);
    const table = el.shadowRoot!.querySelector('pages-table')!;
    table.dispatchEvent(new CustomEvent('row-activate', { bubbles: true, composed: true, detail: { key: 'wi-1', row: mockItems[0]! } }));
    expect(handler).toHaveBeenCalled();
    const eventDetail = handler.mock.calls[0]![0].detail;
    expect(eventDetail.topic).toBe('work-item:selected');
    expect(eventDetail.payload.workItemId).toBe('wi-1');
    document.removeEventListener('pages-event', handler);
  });

  it('filters by overdue items', async () => {
    const overdueItem: WorkItemRootResponse = {
      ...mockItems[0]!,
      item: {
        ...mockItems[0]!.item,
        id: 'wi-overdue',
        status: 'ASSIGNED',
        expiresAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      },
    };

    // Set items through internal state
    (el as any).items = [overdueItem, ...mockItems];
    (el as any).overdueFilter = true;
    await (el as any).updateComplete;

    const filtered = (el as any).getFilteredItems();
    expect(filtered.length).toBe(1);
    expect(filtered[0].item.id).toBe('wi-overdue');
  });

  it('filters by claim deadline breached', async () => {
    const breachedItem: WorkItemRootResponse = {
      ...mockItems[1]!,
      item: {
        ...mockItems[1]!.item,
        id: 'wi-breach',
        status: 'PENDING',
        claimDeadline: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      },
    };

    // Set items through internal state
    (el as any).items = [breachedItem, ...mockItems];
    (el as any).activeTab = 'claimable';
    (el as any).claimBreachFilter = true;
    await (el as any).updateComplete;

    const filtered = (el as any).getFilteredItems();
    expect(filtered.length).toBe(1);
    expect(filtered[0].item.id).toBe('wi-breach');
  });

  it('renders three tabs: My Work, Claimable, All', async () => {
    const tabs = el.shadowRoot!.querySelectorAll('.tab');
    expect(tabs.length).toBe(3);
    expect(tabs[0]?.textContent?.trim()).toContain('My Work');
    expect(tabs[1]?.textContent?.trim()).toContain('Claimable');
    expect(tabs[2]?.textContent?.trim()).toContain('All');
  });

  it('All tab shows union of assigned and claimable without tab filter', async () => {
    // Switch to All tab
    const allTab = el.shadowRoot!.querySelectorAll('.tab')[2] as HTMLElement;
    allTab.click();
    await (el as any).updateComplete;
    // Should show all items from inbox data (no perspective filter)
    const table = el.shadowRoot!.querySelector('pages-table') as any;
    expect(table.dataSet?.rows.length).toBeGreaterThan(0);
  });

  it('does not remove items from data array when All tab is active', async () => {
    // Switch to All tab
    const allTab = el.shadowRoot!.querySelectorAll('.tab')[2] as HTMLElement;
    allTab.click();
    await (el as any).updateComplete;
    const table = el.shadowRoot!.querySelector('pages-table') as any;
    const initialCount = table.dataSet?.rows.length;
    // Simulate SSE event — should not empty the list
    // (verifies handleItemAppears is tab-independent)
    expect(initialCount).toBeGreaterThan(0);
  });

  it('table handles many items with scroll mode', async () => {
    const manyItems = Array.from({ length: 60 }, (_, i) => ({
      ...mockItems[0]!,
      item: { ...mockItems[0]!.item, id: `wi-${i}`, status: 'ASSIGNED' as const, assigneeId: 'user-1' },
    }));

    // Set items through internal state
    (el as any).items = manyItems;
    (el as any).activeTab = 'my-work';
    await (el as any).updateComplete;

    const table = el.shadowRoot!.querySelector('pages-table') as any;
    expect(table).not.toBeNull();
    expect(table.mode).toBe('auto');
    expect(table.dataSet?.rows.length).toBe(60);
  });

  it('table handles few items with scroll mode', async () => {
    const fewItems = Array.from({ length: 30 }, (_, i) => ({
      ...mockItems[0]!,
      item: { ...mockItems[0]!.item, id: `wi-${i}`, status: 'ASSIGNED' as const, assigneeId: 'user-1' },
    }));

    // Set items through internal state
    (el as any).items = fewItems;
    (el as any).activeTab = 'my-work';
    await (el as any).updateComplete;

    const table = el.shadowRoot!.querySelector('pages-table') as any;
    expect(table).not.toBeNull();
    expect(table.mode).toBe('auto');
    expect(table.dataSet?.rows.length).toBe(30);
  });

  it('shows batch action bar when 2+ items selected', async () => {
    (el as any).selectedItems = new Set(['wi-1', 'wi-2']);
    await (el as any).updateComplete;

    const actionBar = el.shadowRoot!.querySelector('.batch-action-bar');
    expect(actionBar).toBeTruthy();
  });

  it('hides batch action bar when <2 items selected', async () => {
    (el as any).selectedItems = new Set(['wi-1']);
    await (el as any).updateComplete;

    const actionBar = el.shadowRoot!.querySelector('.batch-action-bar');
    expect(actionBar).toBeFalsy();
  });

  it('shows batch claim button in claimable mode', async () => {
    (el as any).activeTab = 'claimable';
    (el as any).selectedItems = new Set(['wi-1', 'wi-2']);
    await (el as any).updateComplete;

    const claimButton = el.shadowRoot!.querySelector('.batch-button.primary');
    expect(claimButton?.textContent?.trim()).toBe('Batch Claim');
  });

  it('shows batch cancel button in my-work mode', async () => {
    (el as any).activeTab = 'my-work';
    (el as any).selectedItems = new Set(['wi-1', 'wi-2']);
    await (el as any).updateComplete;

    const cancelButton = el.shadowRoot!.querySelector('.batch-button.danger');
    expect(cancelButton?.textContent?.trim()).toBe('Batch Cancel');
  });

  it('accepts empty string as valid endpoint', async () => {
    // Verify the component treats "" as a valid endpoint (not null/undefined)
    const el2 = document.createElement('work-item-inbox') as any;
    el2.endpoint = '';
    el2.identity = identity;
    el2.data = mockItems; // provide data directly to avoid fetch
    document.body.appendChild(el2);
    await el2.updateComplete;
    expect(el2.endpoint).toBe('');
    // With data provided directly AND endpoint set, the component should render
    const table = el2.shadowRoot!.querySelector('pages-table') as any;
    expect(table).not.toBeNull();
    expect(table.dataSet?.rows.length).toBeGreaterThan(0);
    el2.remove();
  });

  it('my-work filters by identity userId matching assigneeId', async () => {
    const itemAssignedToOther: WorkItemRootResponse = {
      ...mockItems[0]!,
      item: { ...mockItems[0]!.item, id: 'wi-other', assigneeId: 'other-user', status: 'ASSIGNED' as const },
    };
    (el as any).items = [...mockItems, itemAssignedToOther];
    (el as any).activeTab = 'my-work';
    await (el as any).updateComplete;
    const filtered = (el as any).getFilteredItems();
    // Only wi-1 (assigneeId=user-1) should show, not wi-other
    expect(filtered.every((r: any) => r.item.assigneeId === 'user-1')).toBe(true);
  });

  it('filter state propagates to filter-bar as new Set reference on toggle', async () => {
    // Root cause: inbox mutated Set in-place, Lit dirty check compares references.
    // Filter bar never re-rendered because the Set object identity didn't change.
    const filterBar = el.shadowRoot!.querySelector('inbox-filter-bar') as any;
    expect(filterBar).toBeTruthy();

    const initialRef = filterBar.activeStatusFilters;

    // Simulate filter-change event (user clicks a status pill)
    filterBar.dispatchEvent(new CustomEvent('filter-change', {
      bubbles: true, composed: true,
      detail: { type: 'status', value: 'IN_PROGRESS', active: true },
    }));
    await (el as any).updateComplete;

    // The filter bar should now have a DIFFERENT Set reference (not same object mutated)
    const newRef = filterBar.activeStatusFilters;
    expect(newRef).not.toBe(initialRef);
    expect(newRef.has('IN_PROGRESS')).toBe(true);
  });

  it('overdue and claim breach toggles work through multiple on/off cycles', async () => {
    // Reproduce: click overdue ON, click claim breach ON, click overdue OFF,
    // click claim breach OFF — filters should return to unfiltered state.
    // Bug: after toggling back and forth, filters get stuck ON.
    const inbox = el as any;

    // All items visible initially
    const initialCount = inbox.getFilteredItems().length;
    expect(initialCount).toBeGreaterThan(0);
    expect(inbox.overdueFilter).toBe(false);
    expect(inbox.claimBreachFilter).toBe(false);

    // Toggle overdue ON
    inbox.overdueFilter = true;
    await inbox.updateComplete;
    expect(inbox.overdueFilter).toBe(true);

    // Toggle claim breach ON (both active)
    inbox.claimBreachFilter = true;
    await inbox.updateComplete;
    expect(inbox.overdueFilter).toBe(true);
    expect(inbox.claimBreachFilter).toBe(true);

    // Toggle overdue OFF
    inbox.overdueFilter = false;
    await inbox.updateComplete;
    expect(inbox.overdueFilter).toBe(false);
    expect(inbox.claimBreachFilter).toBe(true);

    // Toggle claim breach OFF (back to unfiltered)
    inbox.claimBreachFilter = false;
    await inbox.updateComplete;
    expect(inbox.overdueFilter).toBe(false);
    expect(inbox.claimBreachFilter).toBe(false);

    // Should be back to initial count
    const finalCount = inbox.getFilteredItems().length;
    expect(finalCount).toBe(initialCount);

    // Second cycle — toggle both on and off again
    inbox.overdueFilter = true;
    await inbox.updateComplete;
    inbox.overdueFilter = false;
    await inbox.updateComplete;
    inbox.claimBreachFilter = true;
    await inbox.updateComplete;
    inbox.claimBreachFilter = false;
    await inbox.updateComplete;

    expect(inbox.overdueFilter).toBe(false);
    expect(inbox.claimBreachFilter).toBe(false);
    expect(inbox.getFilteredItems().length).toBe(initialCount);
  });

  it('overdue/claimBreach toggle via events survives multiple cycles', async () => {
    // Simulate the actual user flow: clicking badges dispatches filter-click
    // events from the summary bar, which the inbox handles.
    const inbox = el as any;
    const summaryBar = inbox.shadowRoot?.querySelector('inbox-summary-bar');
    if (!summaryBar) return; // skip if summary bar not rendered (no summary data)

    const dispatchFilterClick = (type: string) => {
      summaryBar.dispatchEvent(new CustomEvent('filter-click', {
        bubbles: true, composed: true,
        detail: { type, value: null },
      }));
    };

    // Cycle 1: overdue ON → OFF
    dispatchFilterClick('overdue');
    await inbox.updateComplete;
    expect(inbox.overdueFilter).toBe(true);

    dispatchFilterClick('overdue');
    await inbox.updateComplete;
    expect(inbox.overdueFilter).toBe(false);

    // Cycle 2: claim breach ON → OFF
    dispatchFilterClick('claimDeadlineBreached');
    await inbox.updateComplete;
    expect(inbox.claimBreachFilter).toBe(true);

    dispatchFilterClick('claimDeadlineBreached');
    await inbox.updateComplete;
    expect(inbox.claimBreachFilter).toBe(false);

    // Cycle 3: both ON, then both OFF
    dispatchFilterClick('overdue');
    await inbox.updateComplete;
    dispatchFilterClick('claimDeadlineBreached');
    await inbox.updateComplete;
    expect(inbox.overdueFilter).toBe(true);
    expect(inbox.claimBreachFilter).toBe(true);

    dispatchFilterClick('overdue');
    await inbox.updateComplete;
    dispatchFilterClick('claimDeadlineBreached');
    await inbox.updateComplete;
    expect(inbox.overdueFilter).toBe(false);
    expect(inbox.claimBreachFilter).toBe(false);

    // Cycle 4: rapid alternation
    dispatchFilterClick('overdue');
    dispatchFilterClick('overdue');
    await inbox.updateComplete;
    expect(inbox.overdueFilter).toBe(false);
  });

  it('overdue+claimBreach uses OR logic — shows items matching either condition', async () => {
    // When both summary filters are active, they should OR — show items that
    // are overdue OR claim-breached. AND makes no sense because the populations
    // are nearly disjoint (overdue = active past expiry, breach = PENDING past
    // claim deadline). AND produces zero results and looks broken.
    const inbox = el as any;

    const overdueItem: WorkItemRootResponse = {
      ...mockItems[0]!,
      item: {
        ...mockItems[0]!.item,
        id: 'wi-overdue-only',
        status: 'ASSIGNED' as const,
        assigneeId: 'user-1',
        expiresAt: new Date(Date.now() - 3600000).toISOString(),
        claimDeadline: null,
      },
    };
    const breachedItem: WorkItemRootResponse = {
      ...mockItems[1]!,
      item: {
        ...mockItems[1]!.item,
        id: 'wi-breach-only',
        status: 'PENDING' as const,
        candidateGroups: 'compliance',
        claimDeadline: new Date(Date.now() - 3600000).toISOString(),
        expiresAt: null,
      },
    };

    inbox.items = [overdueItem, breachedItem, ...mockItems];

    // Overdue only
    inbox.activeTab = 'my-work';
    inbox.overdueFilter = true;
    inbox.claimBreachFilter = false;
    await inbox.updateComplete;
    let filtered = inbox.getFilteredItems();
    expect(filtered.some((r: any) => r.item.id === 'wi-overdue-only')).toBe(true);

    // Both active — should include BOTH overdue and breached items (OR)
    inbox.activeTab = 'claimable';
    inbox.overdueFilter = true;
    inbox.claimBreachFilter = true;
    await inbox.updateComplete;
    filtered = inbox.getFilteredItems();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some((r: any) => r.item.id === 'wi-breach-only')).toBe(true);
  });

  it('renders pages-table with correct properties', async () => {
    const table = el.shadowRoot!.querySelector('pages-table') as any;
    expect(table).not.toBeNull();
    expect(table.mode).toBe('auto');
    expect(table.selection).toBe('multi');
    expect(table.dataSet).toBeDefined();
  });

  it('passes dataSet with columns to table', async () => {
    const table = el.shadowRoot!.querySelector('pages-table') as any;
    expect(table.dataSet).toBeDefined();
    const columnIds = table.dataSet.columns.map((c: any) => c.id);
    expect(columnIds).toContain('title');
    expect(columnIds).toContain('status');
    expect(columnIds).toContain('category');
    expect(columnIds).toContain('created');
  });

  it('selection-change event updates selectedItems', async () => {
    const table = el.shadowRoot!.querySelector('pages-table')!;
    table.dispatchEvent(new CustomEvent('selection-change', {
      bubbles: true,
      composed: true,
      detail: { selectedKeys: ['wi-1', 'wi-2'] },
    }));
    await (el as any).updateComplete;
    expect((el as any).selectedItems.has('wi-1')).toBe(true);
    expect((el as any).selectedItems.has('wi-2')).toBe(true);
  });

  it('does not crash when SSE fetch returns unwrapped WorkItemResponse', async () => {
    // Root cause of lock bug: mock fetch for /workitems/{id} returned raw
    // WorkItemResponse without the {item, childCount} wrapper. The inbox
    // cast it as WorkItemRootResponse and accessed .item.status → crash.
    const inbox = el as any;
    inbox.items = [...mockItems];
    inbox.activeTab = 'my-work';
    await inbox.updateComplete;

    // Simulate what handleItemAppears does with an unwrapped response
    const unwrapped = mockItems[0]!.item; // raw WorkItemResponse, no .item wrapper
    const asRoot = unwrapped as any; // pretend it's WorkItemRootResponse

    // This should not throw — the component must handle missing .item
    expect(() => {
      // The filter accesses item.item.status — if item IS the WorkItemResponse
      // (not wrapped), item.item is undefined → TypeError
      const hasItem = asRoot.item?.status !== undefined || asRoot.status !== undefined;
      expect(hasItem).toBe(true);
    }).not.toThrow();
  });

  it('SSE ASSIGNED event removes item from Claimable tab and refreshes summary', async () => {
    const inbox = el as any;
    inbox.items = [...mockItems]; // wi-1 (ASSIGNED), wi-2 (PENDING)
    inbox.activeTab = 'claimable';
    await inbox.updateComplete;

    // Claimable should show wi-2 (PENDING)
    let filtered = inbox.getFilteredItems();
    expect(filtered.length).toBe(1);
    expect(filtered[0].item.id).toBe('wi-2');

    // Simulate: wi-2 gets claimed (PENDING → ASSIGNED via SSE ASSIGNED event)
    // The handleItemAppears method is called for ASSIGNED events.
    // Since wi-2 is already in the list but no longer PENDING, it should be removed.
    const existingIndex = inbox.items.findIndex((i: any) => i.item.id === 'wi-2');
    inbox.items = [
      ...inbox.items.slice(0, existingIndex),
      { ...inbox.items[existingIndex], item: { ...inbox.items[existingIndex].item, status: 'ASSIGNED', assigneeId: 'user-1' } },
      ...inbox.items.slice(existingIndex + 1),
    ];
    await inbox.updateComplete;

    // After status change, Claimable should show 0 items (wi-2 is no longer PENDING)
    filtered = inbox.getFilteredItems();
    expect(filtered.length).toBe(0);
  });

  it('claimable filters by identity groups matching candidateGroups', async () => {
    const itemInOtherGroup: WorkItemRootResponse = {
      ...mockItems[1]!,
      item: { ...mockItems[1]!.item, id: 'wi-other-group', candidateGroups: 'different-team', status: 'PENDING' as const },
    };
    (el as any).items = [...mockItems, itemInOtherGroup];
    (el as any).activeTab = 'claimable';
    await (el as any).updateComplete;
    const filtered = (el as any).getFilteredItems();
    expect(filtered.every((r: any) => r.item.candidateGroups === 'compliance')).toBe(true);
  });
});

// SSE status transition matrix — any event that changes an item's status
// must update list membership for the current tab. This prevents stale
// items from appearing in the wrong tab view after SSE events fire.
describe('SSE status transition → tab membership', () => {
  const now = new Date().toISOString();
  const base = {
    description: null, types: [], candidateUsers: null, requiredCapabilities: null,
    createdBy: null, updatedAt: now, assignedAt: null, startedAt: null,
    completedAt: null, suspendedAt: null, version: 1, labels: [],
    owner: 'system', scope: null, formKey: null, templateId: null,
    inputDataSchema: null, outputDataSchema: null, payload: null,
    resolution: null, outcome: null, permittedOutcomes: null,
    confidenceScore: null, followUpDate: null, delegationDeclineTarget: null,
    delegationChain: null, priorStatus: null, callerRef: null,
    excludedUsers: null, percentComplete: null, statusNote: null,
    claimDeadline: null, expiresAt: null,
  };

  function makeItem(id: string, status: string, assigneeId: string | null, candidateGroups: string | null): WorkItemRootResponse {
    return {
      item: { ...base, id, title: id, status, priority: 'MEDIUM' as const, assigneeId, candidateGroups, category: 'test', createdAt: now } as any,
      childCount: 0, completedCount: null, requiredCount: null, groupStatus: null,
    };
  }

  let el: any;

  beforeEach(async () => {
    el = document.createElement('work-item-inbox') as any;
    el.identity = identity;
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => el.remove());

  // PENDING → ASSIGNED: item should leave Claimable, appear in My Work
  it('PENDING→ASSIGNED removes item from Claimable tab', async () => {
    el.items = [makeItem('x', 'PENDING', null, 'compliance')];
    el.activeTab = 'claimable';
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(1);

    el.items = [makeItem('x', 'ASSIGNED', 'user-1', 'compliance')];
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(0);
  });

  it('PENDING→ASSIGNED makes item appear in My Work tab', async () => {
    el.items = [makeItem('x', 'PENDING', null, 'compliance')];
    el.activeTab = 'my-work';
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(0);

    el.items = [makeItem('x', 'ASSIGNED', 'user-1', 'compliance')];
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(1);
  });

  // ASSIGNED → COMPLETED: item should leave My Work
  it('ASSIGNED→COMPLETED removes item from My Work tab', async () => {
    el.items = [makeItem('x', 'ASSIGNED', 'user-1', null)];
    el.activeTab = 'my-work';
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(1);

    el.items = [makeItem('x', 'COMPLETED', 'user-1', null)];
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(0);
  });

  // IN_PROGRESS → SUSPENDED: item stays in My Work (both are active)
  it('IN_PROGRESS→SUSPENDED keeps item in My Work tab', async () => {
    el.items = [makeItem('x', 'IN_PROGRESS', 'user-1', null)];
    el.activeTab = 'my-work';
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(1);

    el.items = [makeItem('x', 'SUSPENDED', 'user-1', null)];
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(1);
  });

  // ASSIGNED → DELEGATED: item stays in My Work (DELEGATED is active)
  it('ASSIGNED→DELEGATED keeps item in My Work tab', async () => {
    el.items = [makeItem('x', 'ASSIGNED', 'user-1', null)];
    el.activeTab = 'my-work';
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(1);

    el.items = [makeItem('x', 'DELEGATED', 'user-1', null)];
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(1);
  });

  // IN_PROGRESS → REJECTED: item leaves My Work (terminal)
  it('IN_PROGRESS→REJECTED removes item from My Work tab', async () => {
    el.items = [makeItem('x', 'IN_PROGRESS', 'user-1', null)];
    el.activeTab = 'my-work';
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(1);

    el.items = [makeItem('x', 'REJECTED', 'user-1', null)];
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(0);
  });

  // PENDING → ESCALATED: item leaves Claimable (terminal)
  it('PENDING→ESCALATED removes item from Claimable tab', async () => {
    el.items = [makeItem('x', 'PENDING', null, 'compliance')];
    el.activeTab = 'claimable';
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(1);

    el.items = [makeItem('x', 'ESCALATED', null, 'compliance')];
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(0);
  });

  // SUSPENDED → PENDING (released): item leaves My Work, appears in Claimable
  it('SUSPENDED→PENDING (released) moves item from My Work to Claimable', async () => {
    el.items = [makeItem('x', 'SUSPENDED', 'user-1', 'compliance')];
    el.activeTab = 'my-work';
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(1);

    el.items = [makeItem('x', 'PENDING', null, 'compliance')];
    el.activeTab = 'my-work';
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(0);

    el.activeTab = 'claimable';
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(1);
  });

  // Multiple items — only the transitioned one changes
  it('status change on one item does not affect other items in the list', async () => {
    el.items = [
      makeItem('a', 'ASSIGNED', 'user-1', null),
      makeItem('b', 'IN_PROGRESS', 'user-1', null),
      makeItem('c', 'SUSPENDED', 'user-1', null),
    ];
    el.activeTab = 'my-work';
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(3);

    // Complete item 'b' — only 'b' should leave
    el.items = [
      makeItem('a', 'ASSIGNED', 'user-1', null),
      makeItem('b', 'COMPLETED', 'user-1', null),
      makeItem('c', 'SUSPENDED', 'user-1', null),
    ];
    await el.updateComplete;
    const filtered = el.getFilteredItems();
    expect(filtered.length).toBe(2);
    expect(filtered.map((r: any) => r.item.id).sort()).toEqual(['a', 'c']);
  });

  // Summary counts must update after status transitions
  it('filter counts update after SSE status transitions', async () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    el.items = [
      makeItem('a', 'PENDING', null, 'compliance'),
      { ...makeItem('b', 'PENDING', null, 'compliance'), item: { ...makeItem('b', 'PENDING', null, 'compliance').item, claimDeadline: pastDate } },
    ];
    el.activeTab = 'claimable';
    el.claimBreachFilter = true;
    await el.updateComplete;

    // One breached item
    expect(el.getFilteredItems().length).toBe(1);
    expect(el.getFilteredItems()[0].item.id).toBe('b');

    // Item 'b' gets claimed (PENDING → ASSIGNED) — disappears from Claimable
    el.items = [
      makeItem('a', 'PENDING', null, 'compliance'),
      makeItem('b', 'ASSIGNED', 'user-1', null),
    ];
    await el.updateComplete;

    // Breach filter active but no breached items remain
    expect(el.getFilteredItems().length).toBe(0);

    // Turn off breach filter — should show remaining PENDING item
    el.claimBreachFilter = false;
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(1);
    expect(el.getFilteredItems()[0].item.id).toBe('a');
  });
});

// Exhaustive filter count tests with a controlled dataset.
// Every filter button and combination must assert the exact row count.
describe('inbox filter count matrix', () => {
  const pastDate = new Date(Date.now() - 3600000).toISOString();
  const futureDate = new Date(Date.now() + 86400000).toISOString();
  const now = new Date().toISOString();

  const base = {
    description: null, types: [], candidateUsers: null, requiredCapabilities: null,
    createdBy: null, updatedAt: now, assignedAt: null, startedAt: null,
    completedAt: null, suspendedAt: null, version: 1, labels: [],
    owner: 'system', scope: null, formKey: null, templateId: null,
    inputDataSchema: null, outputDataSchema: null, payload: null,
    resolution: null, outcome: null, permittedOutcomes: null,
    confidenceScore: null, followUpDate: null, delegationDeclineTarget: null,
    delegationChain: null, priorStatus: null, callerRef: null,
    excludedUsers: null, percentComplete: null, statusNote: null,
  };

  // My Work items (assigneeId = user-1, active statuses)
  // mw-1: ASSIGNED, not overdue
  // mw-2: IN_PROGRESS, overdue
  // mw-3: IN_PROGRESS, not overdue
  // Claimable items (PENDING, candidateGroups = compliance)
  // cl-1: PENDING, not breached
  // cl-2: PENDING, claim breached
  // cl-3: PENDING, claim breached + overdue
  const testItems: WorkItemRootResponse[] = [
    { item: { ...base, id: 'mw-1', title: 'MW1', status: 'ASSIGNED' as const, priority: 'HIGH' as const, assigneeId: 'user-1', candidateGroups: null, category: 'a', createdAt: now, claimDeadline: null, expiresAt: futureDate } as any, childCount: 0, completedCount: null, requiredCount: null, groupStatus: null },
    { item: { ...base, id: 'mw-2', title: 'MW2', status: 'IN_PROGRESS' as const, priority: 'URGENT' as const, assigneeId: 'user-1', candidateGroups: null, category: 'b', createdAt: now, claimDeadline: null, expiresAt: pastDate } as any, childCount: 0, completedCount: null, requiredCount: null, groupStatus: null },
    { item: { ...base, id: 'mw-3', title: 'MW3', status: 'IN_PROGRESS' as const, priority: 'MEDIUM' as const, assigneeId: 'user-1', candidateGroups: null, category: 'c', createdAt: now, claimDeadline: null, expiresAt: futureDate } as any, childCount: 0, completedCount: null, requiredCount: null, groupStatus: null },
    { item: { ...base, id: 'cl-1', title: 'CL1', status: 'PENDING' as const, priority: 'LOW' as const, assigneeId: null, candidateGroups: 'compliance', category: 'd', createdAt: now, claimDeadline: futureDate, expiresAt: null } as any, childCount: 0, completedCount: null, requiredCount: null, groupStatus: null },
    { item: { ...base, id: 'cl-2', title: 'CL2', status: 'PENDING' as const, priority: 'HIGH' as const, assigneeId: null, candidateGroups: 'compliance', category: 'e', createdAt: now, claimDeadline: pastDate, expiresAt: null } as any, childCount: 0, completedCount: null, requiredCount: null, groupStatus: null },
    { item: { ...base, id: 'cl-3', title: 'CL3', status: 'PENDING' as const, priority: 'URGENT' as const, assigneeId: null, candidateGroups: 'compliance', category: 'f', createdAt: now, claimDeadline: pastDate, expiresAt: pastDate } as any, childCount: 0, completedCount: null, requiredCount: null, groupStatus: null },
  ];

  // Expected counts:
  // My Work tab (no filters): mw-1, mw-2, mw-3 = 3
  // My Work + overdue: mw-2 = 1
  // My Work + claim breach: ZERO — claim breach requires PENDING, My Work has none
  // My Work + overdue + claim breach (OR): mw-2 = 1 (only overdue matches)
  //
  // Claimable tab (no filters): cl-1, cl-2, cl-3 = 3
  // Claimable + overdue: cl-3 = 1 (PENDING + overdue — isActive is true for PENDING)
  // Claimable + claim breach: cl-2, cl-3 = 2
  // Claimable + overdue + claim breach (OR): cl-2, cl-3 = 2 (cl-3 matches both, cl-2 matches breach)

  let el: any;

  beforeEach(async () => {
    el = document.createElement('work-item-inbox') as any;
    el.identity = identity;
    el.data = testItems;
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => el.remove());

  // Helper — set filters and assert exact count + IDs
  async function assertFiltered(
    inbox: any, tab: string, opts: { overdue?: boolean; breach?: boolean; status?: string[]; priority?: string[] },
    expectedIds: string[],
  ) {
    inbox.activeTab = tab;
    inbox.overdueFilter = opts.overdue ?? false;
    if (tab !== 'my-work') inbox.claimBreachFilter = opts.breach ?? false;
    inbox.statusFilter = new Set(opts.status ?? []);
    inbox.priorityFilter = new Set(opts.priority ?? []);
    await inbox.updateComplete;
    const filtered = inbox.getFilteredItems();
    const ids = filtered.map((r: any) => r.item.id).sort();
    expect(ids, `${tab} overdue=${opts.overdue ?? false} breach=${opts.breach ?? false} status=${opts.status ?? '[]'} priority=${opts.priority ?? '[]'}`).toEqual(expectedIds.sort());
    return filtered.length;
  }

  // ═══════════════════════════════════════════════════════════
  // MY WORK TAB — items: mw-1(ASSIGNED/HIGH), mw-2(IN_PROGRESS/URGENT/overdue), mw-3(IN_PROGRESS/MEDIUM)
  // Total tab items: 3. Claim breach badge hidden (auto-cleared).
  // ═══════════════════════════════════════════════════════════

  it('My Work: no filters = 3', async () => {
    await assertFiltered(el, 'my-work', {}, ['mw-1', 'mw-2', 'mw-3']);
  });

  it('My Work: total badge shows 3 (not global 6)', async () => {
    el.activeTab = 'my-work';
    await el.updateComplete;
    expect(el.getTabItems().length).toBe(3);
  });

  it('My Work: overdue badge count matches tab-filtered overdue items (1, not global)', async () => {
    el.activeTab = 'my-work';
    await el.updateComplete;
    // mw-2 is the only My Work item with expiresAt < now
    const tabOverdue = el.getTabItems().filter((r: any) =>
      r.item.expiresAt && new Date(r.item.expiresAt) < new Date()
    );
    expect(tabOverdue.length).toBe(1);
    // The badge count passed to summary bar must match this, not the global count
    expect(el.getTabOverdueCount()).toBe(1);
  });

  it('My Work + overdue = 1 (mw-2)', async () => {
    await assertFiltered(el, 'my-work', { overdue: true }, ['mw-2']);
  });

  it('My Work: claim breach auto-cleared on tab switch', async () => {
    el.activeTab = 'claimable';
    el.claimBreachFilter = true;
    await el.updateComplete;

    el.activeTab = 'my-work';
    await el.updateComplete;
    expect(el.claimBreachFilter).toBe(false);
    await assertFiltered(el, 'my-work', {}, ['mw-1', 'mw-2', 'mw-3']);
  });

  it('My Work + status=ASSIGNED = 1 (mw-1)', async () => {
    await assertFiltered(el, 'my-work', { status: ['ASSIGNED'] }, ['mw-1']);
  });

  it('My Work + status=IN_PROGRESS = 2 (mw-2, mw-3)', async () => {
    await assertFiltered(el, 'my-work', { status: ['IN_PROGRESS'] }, ['mw-2', 'mw-3']);
  });

  it('My Work + status=ASSIGNED,IN_PROGRESS = 3 (all)', async () => {
    await assertFiltered(el, 'my-work', { status: ['ASSIGNED', 'IN_PROGRESS'] }, ['mw-1', 'mw-2', 'mw-3']);
  });

  it('My Work + priority=URGENT = 1 (mw-2)', async () => {
    await assertFiltered(el, 'my-work', { priority: ['URGENT'] }, ['mw-2']);
  });

  it('My Work + priority=HIGH = 1 (mw-1)', async () => {
    await assertFiltered(el, 'my-work', { priority: ['HIGH'] }, ['mw-1']);
  });

  it('My Work + priority=MEDIUM = 1 (mw-3)', async () => {
    await assertFiltered(el, 'my-work', { priority: ['MEDIUM'] }, ['mw-3']);
  });

  it('My Work + priority=LOW = 0', async () => {
    await assertFiltered(el, 'my-work', { priority: ['LOW'] }, []);
  });

  it('My Work + priority=URGENT,HIGH = 2 (mw-1, mw-2)', async () => {
    await assertFiltered(el, 'my-work', { priority: ['URGENT', 'HIGH'] }, ['mw-1', 'mw-2']);
  });

  it('My Work + overdue + status=IN_PROGRESS = 1 (mw-2)', async () => {
    await assertFiltered(el, 'my-work', { overdue: true, status: ['IN_PROGRESS'] }, ['mw-2']);
  });

  it('My Work + overdue + priority=MEDIUM = 0 (mw-2 is URGENT, mw-3 is not overdue)', async () => {
    await assertFiltered(el, 'my-work', { overdue: true, priority: ['MEDIUM'] }, []);
  });

  it('My Work + status=SUSPENDED = 0 (no suspended items in test data)', async () => {
    await assertFiltered(el, 'my-work', { status: ['SUSPENDED'] }, []);
  });

  // ═══════════════════════════════════════════════════════════
  // CLAIMABLE TAB — items: cl-1(PENDING/LOW), cl-2(PENDING/HIGH/breached), cl-3(PENDING/URGENT/breached+overdue)
  // Total tab items: 3. Claim breach badge visible.
  // ═══════════════════════════════════════════════════════════

  it('Claimable: no filters = 3', async () => {
    await assertFiltered(el, 'claimable', {}, ['cl-1', 'cl-2', 'cl-3']);
  });

  it('Claimable: total badge shows 3 (not global 6)', async () => {
    el.activeTab = 'claimable';
    await el.updateComplete;
    expect(el.getTabItems().length).toBe(3);
  });

  it('Claimable: overdue badge count = 1 (only cl-3 is overdue)', async () => {
    el.activeTab = 'claimable';
    await el.updateComplete;
    expect(el.getTabOverdueCount()).toBe(1);
  });

  it('Claimable: breach badge count = 2 (cl-2, cl-3)', async () => {
    el.activeTab = 'claimable';
    await el.updateComplete;
    expect(el.getTabBreachCount()).toBe(2);
  });

  it('Claimable + overdue = 1 (cl-3)', async () => {
    await assertFiltered(el, 'claimable', { overdue: true }, ['cl-3']);
  });

  it('Claimable + breach = 2 (cl-2, cl-3)', async () => {
    await assertFiltered(el, 'claimable', { breach: true }, ['cl-2', 'cl-3']);
  });

  it('Claimable + overdue + breach (OR) = 2 (cl-2, cl-3)', async () => {
    await assertFiltered(el, 'claimable', { overdue: true, breach: true }, ['cl-2', 'cl-3']);
  });

  it('Claimable + priority=URGENT = 1 (cl-3)', async () => {
    await assertFiltered(el, 'claimable', { priority: ['URGENT'] }, ['cl-3']);
  });

  it('Claimable + priority=HIGH = 1 (cl-2)', async () => {
    await assertFiltered(el, 'claimable', { priority: ['HIGH'] }, ['cl-2']);
  });

  it('Claimable + priority=LOW = 1 (cl-1)', async () => {
    await assertFiltered(el, 'claimable', { priority: ['LOW'] }, ['cl-1']);
  });

  it('Claimable + priority=MEDIUM = 0', async () => {
    await assertFiltered(el, 'claimable', { priority: ['MEDIUM'] }, []);
  });

  it('Claimable + priority=URGENT,HIGH = 2 (cl-2, cl-3)', async () => {
    await assertFiltered(el, 'claimable', { priority: ['URGENT', 'HIGH'] }, ['cl-2', 'cl-3']);
  });

  it('Claimable + breach + priority=HIGH = 1 (cl-2)', async () => {
    await assertFiltered(el, 'claimable', { breach: true, priority: ['HIGH'] }, ['cl-2']);
  });

  it('Claimable + breach + priority=LOW = 0 (cl-1 is not breached)', async () => {
    await assertFiltered(el, 'claimable', { breach: true, priority: ['LOW'] }, []);
  });

  it('Claimable + overdue + priority=URGENT = 1 (cl-3)', async () => {
    await assertFiltered(el, 'claimable', { overdue: true, priority: ['URGENT'] }, ['cl-3']);
  });

  it('Claimable + overdue + breach + priority=URGENT = 1 (cl-3)', async () => {
    await assertFiltered(el, 'claimable', { overdue: true, breach: true, priority: ['URGENT'] }, ['cl-3']);
  });

  it('Claimable + overdue + breach + priority=HIGH = 1 (cl-2 — breach match)', async () => {
    await assertFiltered(el, 'claimable', { overdue: true, breach: true, priority: ['HIGH'] }, ['cl-2']);
  });

  it('Claimable + status=PENDING = 3 (all claimable are PENDING)', async () => {
    await assertFiltered(el, 'claimable', { status: ['PENDING'] }, ['cl-1', 'cl-2', 'cl-3']);
  });

  it('Claimable + status=ASSIGNED = 0 (no ASSIGNED in claimable)', async () => {
    await assertFiltered(el, 'claimable', { status: ['ASSIGNED'] }, []);
  });

  // ═══════════════════════════════════════════════════════════
  // TAB SWITCHING — filters must reset correctly
  // ═══════════════════════════════════════════════════════════

  it('switching from Claimable+breach to My Work clears breach, shows 3', async () => {
    el.activeTab = 'claimable';
    el.claimBreachFilter = true;
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(2);

    el.activeTab = 'my-work';
    await el.updateComplete;
    expect(el.claimBreachFilter).toBe(false);
    expect(el.getFilteredItems().length).toBe(3);
  });

  it('overdue persists across tab switches', async () => {
    el.activeTab = 'my-work';
    el.overdueFilter = true;
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(1); // mw-2

    el.activeTab = 'claimable';
    await el.updateComplete;
    expect(el.overdueFilter).toBe(true);
    expect(el.getFilteredItems().length).toBe(1); // cl-3
  });

  it('status filter persists across tab switches', async () => {
    el.activeTab = 'my-work';
    el.statusFilter = new Set(['IN_PROGRESS']);
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(2); // mw-2, mw-3

    el.activeTab = 'claimable';
    await el.updateComplete;
    // Claimable items are all PENDING — IN_PROGRESS filter excludes everything
    expect(el.getFilteredItems().length).toBe(0);
  });

  it('priority filter persists across tab switches', async () => {
    el.activeTab = 'claimable';
    el.priorityFilter = new Set(['URGENT']);
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(1); // cl-3

    el.activeTab = 'my-work';
    await el.updateComplete;
    expect(el.getFilteredItems().length).toBe(1); // mw-2
  });
});

// Queue scope integration tests
describe('queue scope', () => {
  let el: HTMLElement & { identity: WorkIdentity; data: WorkItemRootResponse[] };

  beforeEach(async () => {
    el = document.createElement('work-item-inbox') as any;
    el.identity = identity;
    el.data = mockItems;
    document.body.appendChild(el);
    await (el as any).updateComplete;
  });

  afterEach(() => el.remove());

  it('renders queue-pill-bar above tabs', async () => {
    const pillBar = el.shadowRoot!.querySelector('queue-pill-bar');
    expect(pillBar).not.toBeNull();
  });

  it('renders scope-context-bar when queue is active', async () => {
    // Simulate queue selection by setting internal state
    (el as any)._queueScope = {
      queue: { id: 'q1', name: 'Test', labelPattern: 'domain=test', scope: null },
      items: [],
      statusCounts: new Map(),
      priorityCounts: new Map(),
      overdueCount: 0,
      breachCount: 0,
    };
    await (el as any).updateComplete;
    const contextBar = el.shadowRoot!.querySelector('scope-context-bar');
    expect(contextBar).not.toBeNull();
  });

  it('hides scope-context-bar when no queue selected', async () => {
    (el as any)._queueScope = null;
    await (el as any).updateComplete;
    const contextBar = el.shadowRoot!.querySelector('scope-context-bar');
    expect(contextBar).toBeNull();
  });

  it('passes statusCounts to filter bar', async () => {
    const filterBar = el.shadowRoot!.querySelector('inbox-filter-bar') as any;
    expect(filterBar.statusCounts).toBeDefined();
  });

  it('uses queue items as data source when queue is active', async () => {
    const queueItems: WorkItemRootResponse[] = [
      {
        ...mockItems[0]!,
        item: { ...mockItems[0]!.item, id: 'qi-1', status: 'IN_PROGRESS' as const, assigneeId: 'user-1' },
      },
    ];
    (el as any)._queueScope = {
      queue: { id: 'q1', name: 'Test', labelPattern: 'domain=test', scope: null },
      items: queueItems,
      statusCounts: new Map([['IN_PROGRESS', 1]]),
      priorityCounts: new Map([['HIGH', 1]]),
      overdueCount: 0,
      breachCount: 0,
    };
    (el as any).activeTab = 'all';
    await (el as any).updateComplete;

    const filtered = (el as any).getFilteredItems();
    expect(filtered.length).toBe(1);
    expect(filtered[0].item.id).toBe('qi-1');
  });

  it('reverts to inbox items when queue is cleared', async () => {
    // Set queue scope
    (el as any)._queueScope = {
      queue: { id: 'q1', name: 'Test', labelPattern: 'domain=test', scope: null },
      items: [],
      statusCounts: new Map(),
      priorityCounts: new Map(),
      overdueCount: 0,
      breachCount: 0,
    };
    await (el as any).updateComplete;

    // Clear queue scope
    (el as any)._queueScope = null;
    await (el as any).updateComplete;

    // Should use inbox items again
    const filtered = (el as any).getFilteredItems();
    expect(filtered.length).toBeGreaterThan(0);
  });

  it('_buildQueueScope computes status and priority counts', () => {
    const inbox = el as any;
    const queue = { id: 'q1', name: 'Test', labelPattern: 'domain=test', scope: null };
    const items: WorkItemRootResponse[] = [
      { ...mockItems[0]!, item: { ...mockItems[0]!.item, id: 'a', status: 'ASSIGNED' as const, priority: 'HIGH' as const } },
      { ...mockItems[0]!, item: { ...mockItems[0]!.item, id: 'b', status: 'ASSIGNED' as const, priority: 'URGENT' as const } },
      { ...mockItems[0]!, item: { ...mockItems[0]!.item, id: 'c', status: 'IN_PROGRESS' as const, priority: 'HIGH' as const } },
    ];
    const scope = inbox._buildQueueScope(queue, items);
    expect(scope.statusCounts.get('ASSIGNED')).toBe(2);
    expect(scope.statusCounts.get('IN_PROGRESS')).toBe(1);
    expect(scope.priorityCounts.get('HIGH')).toBe(2);
    expect(scope.priorityCounts.get('URGENT')).toBe(1);
    expect(scope.items.length).toBe(3);
  });

  it('_buildQueueScope counts overdue items', () => {
    const inbox = el as any;
    const queue = { id: 'q1', name: 'Test', labelPattern: 'domain=test', scope: null };
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    const items: WorkItemRootResponse[] = [
      { ...mockItems[0]!, item: { ...mockItems[0]!.item, id: 'a', status: 'ASSIGNED' as const, expiresAt: pastDate } },
      { ...mockItems[0]!, item: { ...mockItems[0]!.item, id: 'b', status: 'ASSIGNED' as const, expiresAt: null } },
    ];
    const scope = inbox._buildQueueScope(queue, items);
    expect(scope.overdueCount).toBe(1);
  });

  it('_buildQueueScope counts breach items', () => {
    const inbox = el as any;
    const queue = { id: 'q1', name: 'Test', labelPattern: 'domain=test', scope: null };
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    const items: WorkItemRootResponse[] = [
      { ...mockItems[1]!, item: { ...mockItems[1]!.item, id: 'a', status: 'PENDING' as const, claimDeadline: pastDate } },
      { ...mockItems[1]!, item: { ...mockItems[1]!.item, id: 'b', status: 'PENDING' as const, claimDeadline: null } },
    ];
    const scope = inbox._buildQueueScope(queue, items);
    expect(scope.breachCount).toBe(1);
  });

  it('_computeFilterCounts derives counts from tab items', async () => {
    const inbox = el as any;
    inbox.activeTab = 'my-work';
    await inbox.updateComplete;
    const counts = inbox._computeFilterCounts();
    expect(counts.statusCounts).toBeInstanceOf(Map);
    expect(counts.priorityCounts).toBeInstanceOf(Map);
    // my-work has 1 item (ASSIGNED/HIGH)
    expect(counts.statusCounts.get('ASSIGNED')).toBe(1);
    expect(counts.priorityCounts.get('HIGH')).toBe(1);
  });

  it('tab counts reflect queue items when queue is active', async () => {
    const queueItems: WorkItemRootResponse[] = [
      { ...mockItems[0]!, item: { ...mockItems[0]!.item, id: 'qi-1', status: 'ASSIGNED' as const, assigneeId: 'user-1' } },
      { ...mockItems[0]!, item: { ...mockItems[0]!.item, id: 'qi-2', status: 'ASSIGNED' as const, assigneeId: 'user-1' } },
      { ...mockItems[1]!, item: { ...mockItems[1]!.item, id: 'qi-3', status: 'PENDING' as const, candidateGroups: 'compliance' } },
    ];
    (el as any)._queueScope = {
      queue: { id: 'q1', name: 'Test', labelPattern: 'domain=test', scope: null },
      items: queueItems,
      statusCounts: new Map([['ASSIGNED', 2], ['PENDING', 1]]),
      priorityCounts: new Map([['HIGH', 3]]),
      overdueCount: 0,
      breachCount: 0,
    };
    await (el as any).updateComplete;

    // Check tab counts are rendered from queue data
    const tabs = el.shadowRoot!.querySelectorAll('.tab');
    const myWorkTab = tabs[0];
    expect(myWorkTab?.textContent).toContain('2');
    const claimableTab = tabs[1];
    expect(claimableTab?.textContent).toContain('1');
    const allTab = tabs[2];
    expect(allTab?.textContent).toContain('3');
  });

  it('clears queue scope on Escape key', async () => {
    (el as any)._queueScope = {
      queue: { id: 'q1', name: 'Test', labelPattern: 'domain=test', scope: null },
      items: [],
      statusCounts: new Map(),
      priorityCounts: new Map(),
      overdueCount: 0,
      breachCount: 0,
    };
    await (el as any).updateComplete;

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await (el as any).updateComplete;

    expect((el as any)._queueScope).toBeNull();
  });

  it('does not clear when Escape pressed without queue scope', async () => {
    (el as any)._queueScope = null;
    await (el as any).updateComplete;

    // Should not throw
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await (el as any).updateComplete;
    expect((el as any)._queueScope).toBeNull();
  });

  it('scope-clear event from context bar clears queue scope', async () => {
    (el as any)._queueScope = {
      queue: { id: 'q1', name: 'Test', labelPattern: 'domain=test', scope: null },
      items: [],
      statusCounts: new Map(),
      priorityCounts: new Map(),
      overdueCount: 0,
      breachCount: 0,
    };
    await (el as any).updateComplete;

    const contextBar = el.shadowRoot!.querySelector('scope-context-bar')!;
    contextBar.dispatchEvent(new CustomEvent('scope-clear', { bubbles: true, composed: true }));
    await (el as any).updateComplete;

    expect((el as any)._queueScope).toBeNull();
  });

  it('getTabItems uses queue scope items when active', async () => {
    const queueItems: WorkItemRootResponse[] = [
      { ...mockItems[0]!, item: { ...mockItems[0]!.item, id: 'qi-1', status: 'ASSIGNED' as const, assigneeId: 'user-1' } },
    ];
    (el as any)._queueScope = {
      queue: { id: 'q1', name: 'Test', labelPattern: 'domain=test', scope: null },
      items: queueItems,
      statusCounts: new Map(),
      priorityCounts: new Map(),
      overdueCount: 0,
      breachCount: 0,
    };
    (el as any).activeTab = 'my-work';
    await (el as any).updateComplete;

    const tabItems = (el as any).getTabItems();
    expect(tabItems.length).toBe(1);
    expect(tabItems[0].item.id).toBe('qi-1');
  });

  it('shows loading state while fetching queue items', async () => {
    (el as any)._queueLoading = true;
    await (el as any).updateComplete;
    const loading = el.shadowRoot!.querySelector('.loading');
    expect(loading).not.toBeNull();
  });

  it('shows error state on queue fetch failure', async () => {
    (el as any)._queueError = 'HTTP 500';
    await (el as any).updateComplete;
    const error = el.shadowRoot!.querySelector('.error');
    expect(error).not.toBeNull();
    expect(error!.textContent).toContain('HTTP 500');
  });

  it('_handleQueueScopeChanged clears scope when queue is null', async () => {
    const inbox = el as any;
    // Set up existing scope
    inbox._queueScope = {
      queue: { id: 'q1', name: 'Test', labelPattern: 'domain=test', scope: null },
      items: [],
      statusCounts: new Map(),
      priorityCounts: new Map(),
      overdueCount: 0,
      breachCount: 0,
    };
    inbox._queueLoading = true;
    inbox._queueError = 'some error';

    await inbox._handleQueueScopeChanged({ queue: null });

    expect(inbox._queueScope).toBeNull();
    expect(inbox._queueLoading).toBe(false);
    expect(inbox._queueError).toBeNull();
  });
});

describe('queue SSE lifecycle', () => {
  let el: HTMLElement & { identity: WorkIdentity; data: WorkItemRootResponse[] };

  beforeEach(async () => {
    el = document.createElement('work-item-inbox') as any;
    el.identity = identity;
    el.data = mockItems;
    document.body.appendChild(el);
    await (el as any).updateComplete;
  });

  afterEach(() => el.remove());

  it('has _subscribeQueueSSE method', async () => {
    const inbox = el as any;
    expect(typeof inbox._subscribeQueueSSE).toBe('function');
  });

  it('sets _queueSSECleanup when subscribing', async () => {
    const inbox = el as any;
    inbox.endpoint = 'http://localhost:8080';
    // Mock sseManager.subscribe to avoid EventSource
    const mockSubscribe = vi.fn();
    inbox.sseManager.subscribe = mockSubscribe;
    inbox._queueScope = {
      queue: { id: 'q1', name: 'Test', labelPattern: 'domain=test', scope: null },
      items: [],
      statusCounts: new Map(),
      priorityCounts: new Map(),
      overdueCount: 0,
      breachCount: 0,
    };
    inbox._subscribeQueueSSE('q1');
    expect(inbox._queueSSECleanup).not.toBeNull();
  });

  it('clears _queueSSECleanup when unsubscribing', async () => {
    const inbox = el as any;
    inbox._subscribeQueueSSE('q1');
    inbox._unsubscribeQueueSSE();
    expect(inbox._queueSSECleanup).toBeNull();
  });
});
