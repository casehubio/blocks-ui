import type {
  WorkItemResponse, InboxSummary,
  WorkItemLifecycleEvent, QueueView, BulkItemResult,
} from '@casehubio/blocks-ui-core';
import { isActiveStatus } from '@casehubio/blocks-ui-core';
import { MockSSESource } from './mock-sse.js';
import { installMockFetch } from './mock-fetch.js';

type EventHandler = (event: WorkItemLifecycleEvent) => void;

// Activity events are stored as full WorkItemLifecycleEvent objects
// from activity.json, keyed by workItemId

interface RelationSet {
  workItemId: string;
  parent: { id: string; title: string; status: string } | null;
  children: Array<{ id: string; title: string; status: string }>;
  linked: Array<{ id: string; title: string; status: string }>;
}

interface RelationData {
  workItemId: string;
  parent: string | null;
  children: string[];
  linked: string[];
}

interface ScriptEntry {
  delaySeconds: number;
  event: WorkItemLifecycleEvent;
}

export class MockState {
  private items: Map<string, WorkItemResponse>;
  private queues: QueueView[];
  private activityTemplate: unknown[];
  private relations: RelationData[];
  private script: ScriptEntry[];
  private handlers: Set<EventHandler> = new Set();
  private scriptTimers: ReturnType<typeof setTimeout>[] = [];

  constructor(
    items: WorkItemResponse[],
    queues: QueueView[],
    activityTemplate: unknown[],
    relations: Record<string, { parents: string[]; children: string[]; linked: string[] }>,
    script: ScriptEntry[],
  ) {
    this.items = new Map(items.map(item => [item.id, { ...item }]));
    this.queues = queues;
    this.activityTemplate = activityTemplate;
    // Transform relations object to array
    this.relations = Object.entries(relations).map(([workItemId, rel]) => ({
      workItemId,
      parent: rel.parents[0] ?? null,
      children: rel.children,
      linked: rel.linked,
    }));
    this.script = script;
  }

  getItems(): WorkItemResponse[] {
    return Array.from(this.items.values());
  }

  getItem(id: string): WorkItemResponse | undefined {
    return this.items.get(id);
  }

  getSummary(): InboxSummary {
    const items = this.getItems();
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let overdue = 0;
    let claimDeadlineBreached = 0;
    const now = Date.now();

    for (const item of items) {
      byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
      byPriority[item.priority] = (byPriority[item.priority] ?? 0) + 1;
      if (item.expiresAt && new Date(item.expiresAt).getTime() < now && isActiveStatus(item.status)) overdue++;
      if (item.claimDeadline && new Date(item.claimDeadline).getTime() < now && item.status === 'PENDING') claimDeadlineBreached++;
    }

    return { total: items.length, byStatus, byPriority, overdue, claimDeadlineBreached };
  }

  getQueues(): QueueView[] {
    return this.queues;
  }

  getQueueItems(queueId: string): WorkItemResponse[] {
    const queue = this.queues.find(q => q.id === queueId);
    if (!queue) return [];
    const [key, value] = queue.labelPattern.split('=');
    if (!key || !value) return [];
    return this.getItems().filter(item =>
      item.labels.some(l => l.name === key && l.value === value)
    );
  }

  getQueueSummaries(): Array<{ queueId: string; count: number; breachCount: number }> {
    const now = Date.now();
    return this.queues.map(q => {
      const items = this.getQueueItems(q.id);
      const breachCount = items.filter(item =>
        item.expiresAt && new Date(item.expiresAt).getTime() < now && isActiveStatus(item.status)
      ).length;
      return { queueId: q.id, count: items.length, breachCount };
    });
  }

  getActivity(itemId: string): WorkItemLifecycleEvent[] {
    const item = this.items.get(itemId);
    if (!item) return [];

    // Filter activity events for this item, or generate a minimal
    // "created" event if no matching events exist in the template
    const matching = this.activityTemplate.filter(
      (e: any) => e.workItemId === itemId,
    ) as unknown as WorkItemLifecycleEvent[];

    if (matching.length > 0) return matching;

    // Fallback: generate a single "created" event from the item's createdAt
    return [{
      type: 'CREATED',
      source: 'mock',
      subject: itemId,
      workItemId: itemId,
      status: 'PENDING' as WorkItemResponse['status'],
      occurredAt: item.createdAt,
      actor: item.createdBy ?? 'system',
      detail: 'Work item created',
      rationale: null,
      planRef: null,
      outcome: null,
      callerRef: null,
      assigneeId: null,
      resolution: null,
      candidateGroups: item.candidateGroups,
    }];
  }

  getRelations(itemId: string): RelationSet | undefined {
    const rel = this.relations.find(r => r.workItemId === itemId);
    if (!rel) return undefined;

    // Transform item IDs into full item details
    const parent = rel.parent ? this.items.get(rel.parent) : null;
    const children = rel.children.map(id => this.items.get(id)).filter(Boolean) as WorkItemResponse[];
    const linked = rel.linked.map(id => this.items.get(id)).filter(Boolean) as WorkItemResponse[];

    return {
      workItemId: itemId,
      parent: parent ? { id: parent.id, title: parent.title, status: parent.status } : null,
      children: children.map(c => ({ id: c.id, title: c.title, status: c.status })),
      linked: linked.map(l => ({ id: l.id, title: l.title, status: l.status })),
    };
  }

  applyAction(itemId: string, action: string, body?: Record<string, unknown>): WorkItemResponse | null {
    const item = this.items.get(itemId);
    if (!item) return null;

    const statusMap: Record<string, string> = {
      claim: 'ASSIGNED', start: 'IN_PROGRESS', complete: 'COMPLETED',
      reject: 'REJECTED', suspend: 'SUSPENDED', resume: item.priorStatus ?? 'IN_PROGRESS',
      cancel: 'CANCELLED', release: 'PENDING', delegate: 'DELEGATED',
      escalate: 'ESCALATED', 'accept-delegation': 'ASSIGNED',
      'decline-delegation': 'PENDING', fault: 'FAULTED', obsolete: 'OBSOLETE',
    };

    const eventTypeMap: Record<string, string> = {
      claim: 'ASSIGNED', start: 'STARTED', complete: 'COMPLETED',
      reject: 'REJECTED', suspend: 'SUSPENDED', resume: 'RESUMED',
      cancel: 'CANCELLED', release: 'RELEASED', delegate: 'DELEGATED',
      escalate: 'ESCALATED', 'accept-delegation': 'DELEGATION_ACCEPTED',
      'decline-delegation': 'DELEGATION_DECLINED', fault: 'FAULTED', obsolete: 'OBSOLETE',
    };

    const newStatus = statusMap[action];
    if (!newStatus) return null;

    const updated: WorkItemResponse = {
      ...item,
      priorStatus: item.status,
      status: newStatus as WorkItemResponse['status'],
      assigneeId: action === 'claim' ? (body?.actor as string ?? item.assigneeId) : item.assigneeId,
      outcome: action === 'complete' ? (body?.outcome as string ?? null) : item.outcome,
      resolution: action === 'complete' ? (body?.resolution as string ?? null) : item.resolution,
      updatedAt: new Date().toISOString(),
    };

    this.items.set(itemId, updated);

    const event: WorkItemLifecycleEvent = {
      type: eventTypeMap[action] ?? action.toUpperCase(),
      source: 'mock',
      subject: itemId,
      workItemId: itemId,
      status: updated.status,
      occurredAt: new Date().toISOString(),
      actor: (body?.actor as string) ?? 'demo-user',
      detail: null,
      rationale: (body?.reason as string) ?? null,
      planRef: null,
      outcome: updated.outcome,
      callerRef: null,
      assigneeId: updated.assigneeId,
      resolution: updated.resolution,
      candidateGroups: updated.candidateGroups,
    };

    this.emit(event);
    return updated;
  }

  applyBulk(operation: string, itemIds: string[], actorId: string): BulkItemResult[] {
    return itemIds.map(id => {
      const result = this.applyAction(id, operation, { actor: actorId });
      return result
        ? { id, status: 'SUCCESS', error: null }
        : { id, status: 'FAILED', error: `Item ${id} not found` };
    });
  }

  onEvent(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit(event: WorkItemLifecycleEvent): void {
    for (const handler of this.handlers) handler(event);
  }

  startScript(): void {
    this.runScriptLoop();
  }

  stopScript(): void {
    for (const timer of this.scriptTimers) clearTimeout(timer);
    this.scriptTimers = [];
  }

  private runScriptLoop(): void {
    let cumulative = 0;
    for (const entry of this.script) {
      cumulative += entry.delaySeconds * 1000;
      const jitter = (Math.random() - 0.5) * 4000; // ±2s
      const timer = setTimeout(() => {
        // Apply the scripted event to state if the item exists
        if (entry.event.workItemId) {
          const item = this.items.get(entry.event.workItemId);
          if (item) {
            const updated = { ...item, status: entry.event.status, updatedAt: new Date().toISOString() };
            this.items.set(entry.event.workItemId, updated);
          }
        }
        this.emit({ ...entry.event, occurredAt: new Date().toISOString() });
      }, cumulative + jitter);
      this.scriptTimers.push(timer);
    }
    // Loop after all events
    const loopTimer = setTimeout(() => this.runScriptLoop(), cumulative + 5000);
    this.scriptTimers.push(loopTimer);
  }
}

export async function initMockState(): Promise<MockState> {
  const [items, queues, activity, relations, script] = await Promise.all([
    fetch('/mock-data/work-items.json').then(r => r.json()),
    fetch('/mock-data/queues.json').then(r => r.json()),
    fetch('/mock-data/activity.json').then(r => r.json()),
    fetch('/mock-data/relations.json').then(r => r.json()),
    fetch('/mock-data/sse-script.json').then(r => r.json()),
  ]);

  const state = new MockState(items, queues, activity, relations, script);

  // Install mock layer AFTER loading data (data was loaded via real fetch)
  (window as any).EventSource = MockSSESource;
  installMockFetch(state);

  // Wire SSE: state events → MockSSESource
  state.onEvent(event => {
    MockSSESource.pushEvent('/workitems/events', event);
  });

  state.startScript();
  return state;
}
