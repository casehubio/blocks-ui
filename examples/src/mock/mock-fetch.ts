import type { MockState } from './mock-state.js';

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

  // GET /workitems/{id}/relations
  const relMatch = path.match(/\/workitems\/([^/]+)\/relations$/);
  if (method === 'GET' && relMatch) {
    return json(state.getRelations(relMatch[1]!) ?? { parent: null, children: [], linked: [] });
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

  return null;
}

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
