# Push Unification via EventStreamController — Design Spec

**Issue:** casehubio/blocks-ui#153
**Date:** 2026-09-04
**Branch:** issue-153-push-update-support

## Summary

Unify all push updates in blocks-ui on `EventStreamController` — the existing Lit ReactiveController for event-driven state, documented in ARC42 but never adopted. Replace SSEManager (6 consumers) and polling timers (1 consumer) with EventStreamController + EventStreamPool. Remove SSEManager imports from blocks-ui entirely. Add push support to list-pane and kpi-metric-row. No cross-repo prerequisite — EventStreamController already exists in casehub-pages.

## Context: Why EventStreamController, not raw EventConnection

The codebase has three layers of push abstraction, each wrapping the one below:

```
EventConnection (WebSocket transport — topic subscriptions, cursor recovery, dedup)
    └─ EventStream (wraps EventConnection — own EventTarget, topic matching, buffer)
        └─ EventStreamController (Lit ReactiveController — lifecycle, requestUpdate)
            └─ EventStreamPool (connection sharing — ref-counted, one WebSocket per URL)
```

ARC42 §6 states: "SSE and DataSource are orthogonal. DataSourceMixin delivers dataset snapshots via HTTP fetch. EventStreamController handles event-driven state with domain-specific routing. Components compose both, not choose one."

All 6 current SSE consumers bypassed this architecture and used raw SSEManager. This migration adopts the intended architecture rather than replicating the bypass with a different transport.

## Prerequisites

None. EventStreamController, EventStream, and EventStreamPool already exist in casehub-pages. Backend EventBroadcaster wiring (one small PR per service) must land before this branch to ensure events are published on the WebSocket channel.

## Two push patterns

| Pattern | Components | What events do | Abstraction |
|---------|-----------|----------------|-------------|
| **A — Dataset mutations** | list-pane | Events ARE the data — append/replace/remove rows in TypedDataSet | EventStreamController → DataSetManager push ops |
| **B — Domain event notifications** | work-item-inbox, execution-monitor, session-detail, topology-viewer, reconciliation-status, notification-inbox, notification-bell | Events TRIGGER domain logic (fetch-on-event, visibility rules, state transitions) | EventStreamController → domain handler methods |

### Pattern A — Dataset mutations (list-pane)

list-pane composes DataSourceMixin (fetch) + EventStreamController (push). They're independent — DataSourceMixin fetches the initial dataset, EventStreamController handles incremental updates. No DataSourceMixin modification needed.

```typescript
// list-pane adds EventStreamController as a ReactiveController
private _eventStream = new EventStreamController(this, {
  onEvent: (topic, payload) => this._applyPushEvent(payload),
});

// Consumer provides connection via property
@property({ attribute: false }) pushPool: PushPool | null = null;
@property({ attribute: false }) pushTopics: string[] = [];

// On event: translate to DataSetManager ops
private _applyPushEvent(payload: unknown): void {
  const record = payload as Record<string, unknown>;
  const key = this._resolveKeyFromPayload(record);
  if (record._deleted) {
    // remove row from dataSet
  } else if (this._findRowByKey(key)) {
    // replace row in dataSet
  } else {
    // append row to dataSet
  }
}
```

Row matching uses the component's own `getRowKey` and column definitions — not the mixin's. The translation from event payload to TypedRow uses the same `fromRows` column definitions already on list-pane.

### Pattern B — Domain event notifications (all SSE consumers)

Each component adds an EventStreamController and routes events to its existing domain handlers. The domain logic is unchanged — only the transport layer switches.

```typescript
// work-item-inbox
private _eventStream = new EventStreamController(this, {
  onEvent: (topic, payload) => this._handlePushEvent(topic, payload),
});

@property({ attribute: false }) pushPool: PushPool | null = null;
@property({ attribute: false }) pushTopics: string[] = [];

// Same domain handlers as before
private _handlePushEvent(topic: string, payload: unknown): void {
  const data = payload as WorkItemLifecycleEvent;
  switch (data.type) {
    case 'CREATED': case 'ASSIGNED':
      this.handleItemAppears(data.workItemId); break;
    case 'COMPLETED': case 'CANCELLED':
      this.handleItemDisappears(data.workItemId); break;
    default:
      this.handleItemUpdated(data.workItemId); break;
  }
}
```

## Connection sharing via PushPool

Components receive a `pushPool: PushPool` from the consuming application. PushPool (EventStreamPool) manages ref-counted WebSocket connections — one WebSocket per URL, shared across all components on the page.

```typescript
// Consuming application creates one pool
const pool = createPushPool('/api/push');

// All components share it
html`
  <blocks-list-pane
    endpoint="/api/investigations"
    .pushPool=${pool}
    .pushTopics=${['investigations:*']}>
  </blocks-list-pane>
  <blocks-work-item-inbox
    endpoint="/api/workitems"
    .pushPool=${pool}
    .pushTopics=${['work-items:lifecycle:*']}>
  </blocks-work-item-inbox>
  <blocks-kpi-metric-row
    .pushPool=${pool}
    .pushTopics=${['kpi:metrics:*']}>
  </blocks-kpi-metric-row>
`;
```

No component calls `close()` — PushPool ref-counts and auto-closes when the last consumer disconnects. This solves the connection lifecycle problem that raw EventConnection leaves to the consumer.

## Component-specific details

### list-pane (Pattern A — new push support)

**Properties added:**
- `pushPool: PushPool | null` — shared connection pool
- `pushTopics: string[]` — topics to subscribe to

**Push event handling:**
- Convert event payload to TypedRow via existing column definitions
- Match by `getRowKey` against current dataset
- Apply: append (no match), replace (match), remove (`_deleted: true`)

**Interaction with DataSourceMixin:** Independent. DataSourceMixin handles initial fetch and refresh. EventStreamController handles incremental push. Both update `dataSet` — DataSourceMixin via `sink.apply()`, push events via direct DataSetManager ops.

### work-item-inbox (Pattern B — SSEManager migration)

**Removed:** `SSEManager`, `sseManager`, `sseHandler`, `subscribeSSE()`, `unsubscribeSSE()`

**Added:** `pushPool`, `pushTopics` properties + EventStreamController

**Domain handlers unchanged:** `handleItemAppears`, `handleItemDisappears`, `handleItemUpdated`, `handleSSEEvent` (renamed to `_handlePushEvent`). Same fetch-on-event pattern, same visibility rules.

**Queue-scoped push:** Currently uses `_subscribeQueueSSE(queueId)` with a separate SSEManager URL. With EventStreamController, dynamic topic changes:
- On queue scope change: `unlisten(oldTopics)`, `listen(['work-items:queue:{queueId}:*'])`
- PushPool handles the WebSocket — no new connection needed

### kpi-metric-row (Pattern A — replace polling with push)

**Properties added:** `pushPool`, `pushTopics`

**When pushPool is set:**
- `_stopRefreshTimer()` — disable polling
- EventStreamController subscribes to metric update topics
- On event: find matching `MetricDefinition` by `key`, merge updated fields

**When pushPool is null:**
- Existing behaviour — polling timer via `refreshInterval`

### execution-monitor (Pattern B — SSEManager migration)

**Topics:** `['execution:{executionId}:*']`

Replace SSEManager with EventStreamController. The execution state badge, pattern badge, agent roster, and staleness detection continue via the same event payload.

### session-detail (Pattern B — SSEManager migration)

**Topics:** `['session:{sessionId}:*']`

Tab lifecycle manages EventStreamController subscriptions. SSE connection replaced by PushPool topic subscription.

### topology-viewer (Pattern B — SSEManager migration)

**Topics:** `['topology:*']`

SSE-driven status-coloured nodes and replica badges now driven by EventStreamController events.

### reconciliation-status (Pattern B — SSEManager migration)

**Topics:** `['reconciliation:*']`

Per-cluster per-node status grid updated via push events instead of SSE.

### notification-inbox + notification-bell (Pattern B — SSEManager migration)

**Topics:** `['notifications:{userId}:*']`

Both components share the same PushPool. notification-bell listens for unread count updates; notification-inbox listens for the full notification event stream.

## Deletion convention

Events signalling row removal include `{ _deleted: true }` (underscore prefix — wire protocol reserved field). This aligns with the DataSetManager `remove` op convention.

## ARIA

| Event type | Announcement |
|-----------|-------------|
| New row appended (Pattern A) | `this.announce('New item received')` |
| Row removed (Pattern A) | `this.announce('Item removed')` if selected |
| Metric updated (kpi) | `this.announce('{metric label} updated to {value}')` |
| Connection status change | `aria-busy` on component during reconnect |
| Reconnect with gaps | `this.announce('Reconnected — refreshing data')` + trigger DataSourceMixin refresh |

## Testing strategy

| Test | What it verifies |
|------|-----------------|
| **list-pane** | |
| Push event appends new row | Event with no matching key → row prepended |
| Push event replaces row | Event with matching key → row updated in-place |
| Push event removes row | Event with `_deleted: true` → row removed |
| Push + fetch coexist | DataSourceMixin refresh doesn't break push state |
| No-op when pushPool is null | Pull-only mode works unchanged |
| **work-item-inbox** | |
| SSEManager removed | No SSEManager import or instantiation |
| EventStreamController wired | Connected lifecycle calls listen/unlisten |
| Domain handlers produce same state | handleItemAppears/Disappears/Updated identical behaviour |
| Queue-scoped topic changes | Dynamic unlisten/listen on scope change |
| **kpi-metric-row** | |
| Polling disabled when pushPool set | Timer stopped, events drive updates |
| Metric update via push | Event updates matching MetricDefinition |
| Fallback to polling | No pushPool → existing behaviour |
| **All 8 migrated components** | |
| Zero SSEManager imports | grep confirms no SSEManager references in blocks-ui |
| PushPool shared correctly | Components don't close shared connections |
| **Error/reconnection** | |
| WebSocket disconnect → reconnect | Component receives events after reconnect |
| Gap recovery | Reconnect with cursor triggers refresh for missed events |

## File changes

| File | Change |
|------|--------|
| `components/list-pane/src/list-pane.ts` | Add EventStreamController, pushPool, pushTopics, push event handler |
| `components/work-item-inbox/src/work-item-inbox.ts` | Remove SSEManager, add EventStreamController + pushPool/pushTopics |
| `components/kpi-metric-row/src/kpi-metric-row.ts` | Add EventStreamController + pushPool/pushTopics, disable timer when push active |
| `components/execution-monitor/src/execution-monitor.ts` | SSEManager → EventStreamController |
| `components/session-detail/src/session-detail.ts` | SSEManager → EventStreamController |
| `components/topology-viewer/src/topology-viewer.ts` | SSEManager → EventStreamController |
| `components/reconciliation-status/src/reconciliation-status.ts` | SSEManager → EventStreamController |
| `components/notification-inbox/src/notification-inbox.ts` | SSEManager → EventStreamController |
| `components/notification-inbox/src/notification-bell.ts` | SSEManager → EventStreamController |

## Design decisions

See `decisions.md` for the full log. Key revisions after spec review:

- **D1:** All push unifies on EventStreamController (not raw EventConnection)
- **D2 (revised):** No DataSourceMixin change. Components compose DataSourceMixin (fetch) + EventStreamController (push) independently. Follows ARC42 §6 orthogonality.
- **D3:** Row matching uses component's own `getRowKey` and column definitions (Pattern A). Domain handlers use their own key logic (Pattern B).
- **D4:** Full SSEManager elimination — all 8 consumers (including notification-bell) migrate.
- **D5:** Backend EventBroadcaster PRs land first. Zero regression window.
- **D6:** Connection sharing via PushPool — one WebSocket per URL, ref-counted, consumer-provided.

## References

- [EventStreamController](/Users/mdproctor/claude/casehub/blocks-ui/.casehub-packages/packages/pages-component/src/controller/) — Lit ReactiveController for push events
- [EventStream](/Users/mdproctor/claude/casehub/blocks-ui/.casehub-packages/packages/pages-data/src/event-stream/event-stream.ts) — EventConnection wrapper with EventTarget, topic matching, buffer
- [EventStreamPool / PushPool](/Users/mdproctor/claude/casehub/blocks-ui/.casehub-packages/packages/pages-data/src/event-stream/event-stream-pool.ts) — ref-counted connection sharing
- [EventConnection](/Users/mdproctor/claude/casehub/blocks-ui/.casehub-packages/packages/pages-data/src/dataset/external/sources/event-connection.ts) — WebSocket transport (lowest level)
- [DataSetManager push ops](/Users/mdproctor/claude/casehub/blocks-ui/.casehub-packages/packages/pages-data/src/dataset/manager.ts) — append/replace/remove
- [SSEManager](/Users/mdproctor/claude/casehub/blocks-ui/.casehub-packages/packages/pages-data/src/sse/sse-manager.ts) — being eliminated
- [ARC42STORIES.MD §6](/Users/mdproctor/claude/casehub/blocks-ui/ARC42STORIES.MD) — "SSE and DataSource are orthogonal"
- [work-item-inbox SSE handlers](/Users/mdproctor/claude/casehub/blocks-ui/components/work-item-inbox/src/work-item-inbox.ts:472-623) — domain logic preserved
- [Spec review R1](/Users/mdproctor/reviews/casehub-blocks-ui/issue-153-push-update-support-spec-20260904-151403/responses/reviewer-1.md) — 13 findings, revised architecture
- [Issue #153](https://github.com/casehubio/blocks-ui/issues/153) — original issue
