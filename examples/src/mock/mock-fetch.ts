import type { MockState } from './mock-state.js';
import caseEvents from '../../mock-data/case-events.json';
import ledgerEntries from '../../mock-data/ledger-entries.json';
import trustScores from '../../mock-data/trust-scores.json';

const realFetch = window.fetch.bind(window);

export function installMockFetch(state: MockState): void {
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method?.toUpperCase() ?? 'GET';
    const body = init?.body ? JSON.parse(init.body as string) as Record<string, unknown> : undefined;

    const mock = resolveMock(url, method, body, state);
    if (mock) return mock;
    return realFetch(input, init);
  };
}

function resolveMock(
  url: string,
  method: string,
  body: Record<string, unknown> | undefined,
  state: MockState,
): Response | null {
  // Strip origin if present
  const path = url.replace(/^https?:\/\/[^/]+/, '');

  // GET /workitems/inbox/summary
  if (method === 'GET' && path.match(/\/workitems\/inbox\/summary/)) {
    return json(state.getSummary());
  }

  // GET /workitems/inbox
  if (method === 'GET' && path.match(/\/workitems\/inbox/)) {
    const items = state.getItems().map(item => ({
      item, childCount: 0, completedCount: null, requiredCount: null, groupStatus: null,
    }));
    return json(items);
  }

  // POST /workitems/bulk
  if (method === 'POST' && path.match(/\/workitems\/bulk$/)) {
    if (!body) return json([]);
    const results = state.applyBulk(
      body.operation as string,
      body.workItemIds as string[],
      body.actorId as string,
    );
    return json(results);
  }

  // PUT /workitems/{id}/{action}
  const actionMatch = path.match(/\/workitems\/([^/]+)\/(claim|start|complete|reject|delegate|escalate|suspend|resume|cancel|release|accept-delegation|decline-delegation|fault|obsolete)/);
  if (method === 'PUT' && actionMatch) {
    const [, id, action] = actionMatch;
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    const actionBody = { ...body, actor: params.get('actor') ?? params.get('claimant') ?? body?.actor ?? 'demo-user' };
    const result = state.applyAction(id!, action!, actionBody);
    return result ? json(result) : new Response(null, { status: 404 });
  }

  // GET /workitems/{id}/events
  const eventsMatch = path.match(/\/workitems\/([^/]+)\/events$/);
  if (method === 'GET' && eventsMatch) {
    return json(state.getActivity(eventsMatch[1]!));
  }

  // GET /workitems/{id}/relations/incoming
  const relIncomingMatch = path.match(/\/workitems\/([^/]+)\/relations\/incoming$/);
  if (method === 'GET' && relIncomingMatch) {
    const raw = state.getRelations(relIncomingMatch[1]!) as any;
    const parents = raw?.parents ?? [];
    return json(parents.map((id: string) => ({
      workItemId: relIncomingMatch[1], relatedWorkItemId: id, relationType: 'CHILD_OF',
    })));
  }

  // GET /workitems/{id}/relations (outgoing)
  const relMatch = path.match(/\/workitems\/([^/]+)\/relations$/);
  if (method === 'GET' && relMatch) {
    const raw = state.getRelations(relMatch[1]!) as any;
    const children = raw?.children ?? [];
    const linked = raw?.linked ?? [];
    return json([
      ...children.map((id: string) => ({
        workItemId: relMatch[1], relatedWorkItemId: id, relationType: 'PARENT_OF',
      })),
      ...linked.map((id: string) => ({
        workItemId: relMatch[1], relatedWorkItemId: id, relationType: 'RELATED_TO',
      })),
    ]);
  }

  // GET /workitems/{id}
  const itemMatch = path.match(/\/workitems\/([^/]+)$/);
  if (method === 'GET' && itemMatch) {
    const item = state.getItem(itemMatch[1]!);
    if (!item) return new Response(null, { status: 404 });
    return json({ item, childCount: 0, completedCount: null, requiredCount: null, groupStatus: null });
  }

  // GET /queues/summary
  if (method === 'GET' && path.match(/\/queues\/summary$/)) {
    return json(state.getQueueSummaries());
  }

  // GET /queues/{id}/items
  const queueItemsMatch = path.match(/\/queues\/([^/]+)\/items$/);
  if (method === 'GET' && queueItemsMatch) {
    return json(state.getQueueItems(queueItemsMatch[1]!));
  }

  // GET /queues/{id}
  const queueMatch = path.match(/\/queues\/([^/]+)$/);
  if (method === 'GET' && queueMatch) {
    return json(state.getQueueItems(queueMatch[1]!));
  }

  // GET /queues
  if (method === 'GET' && path.match(/\/queues$/)) {
    return json(state.getQueues());
  }

  // GET /cases/{id}/events (case-timeline)
  const caseEventsMatch = path.match(/\/cases\/[^/]+\/events$/);
  if (method === 'GET' && caseEventsMatch) {
    return json({ content: caseEvents, page: 0, size: 20, totalElements: caseEvents.length, totalPages: 1 });
  }

  // GET /api/v1/ledger/entries/{id}/attestations (audit-trail-viewer)
  const attestMatch = path.match(/\/ledger\/entries\/([^/]+)\/attestations$/);
  if (method === 'GET' && attestMatch) {
    return json([{
      id: `att-${attestMatch[1]}-1`, ledgerEntryId: attestMatch[1], subjectId: 'case-123',
      attestorId: 'attestor-001', attestorType: 'PEER', verdict: 'SOUND',
      evidence: { score: 0.95 }, confidence: 0.9, capabilityTag: 'FRAUD_ANALYSIS',
      occurredAt: new Date().toISOString(),
    }]);
  }

  // GET /api/v1/ledger/entries (audit-trail-viewer)
  if (method === 'GET' && path.match(/\/ledger\/entries/)) {
    return json(ledgerEntries);
  }

  // GET /api/v1/ledger/verify (audit-trail-viewer)
  if (method === 'GET' && path.match(/\/ledger\/verify/)) {
    return json({ subjectId: 'case-123', treeRoot: 'f7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2', verified: true, redactedCount: 1 });
  }

  // GET /trust/{actorId} (trust-score-panel)
  const trustMatch = path.match(/\/trust\/([^/?]+)/);
  if (method === 'GET' && trustMatch) {
    const actors = (trustScores as any).actors as any[];
    const actor = actors.find((a: any) => a.actorId === trustMatch[1]);
    if (actor) return json(actor);
    return new Response(JSON.stringify({ error: 'Actor not found' }), { status: 404 });
  }

  return null;
}

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
