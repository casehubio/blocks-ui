## D1: Push mechanism unification

**Choice:** All push goes through EventStreamController (Lit ReactiveController wrapping EventStream/EventConnection). SSEManager is fully eliminated from blocks-ui — all 8 consumers migrate. PushPool handles connection sharing.
**Alternatives:**
- Raw EventConnection per component — no lifecycle management, no connection sharing, eventTarget inaccessible (R1-01)
- Keep SSEManager alongside EventStreamController — two push mechanisms, duplicated concepts
**Rationale:** EventStreamController is the platform's intended push abstraction (ARC42 §6). It wraps EventConnection with Lit lifecycle (hostConnected/hostDisconnected), automatic requestUpdate, typed event access. EventStreamPool provides ref-counted connection sharing. These solve every problem raw EventConnection leaves open (R1-01, R1-09).
**Trade-offs:** None — EventStreamController already exists. The cost is adoption, not creation.
**Sources:** EventStreamController (pages-component), EventStreamPool (pages-data), ARC42 §6, R1-01, R1-04
**Exploration:** quick
**Status:** revised (from EventConnection to EventStreamController after R1-01, R1-04)

## D2: DataSourceMixin stays unchanged — orthogonal composition

**Choice:** No DataSourceMixin modification. Components compose DataSourceMixin (fetch) + EventStreamController (push) independently. list-pane adds EventStreamController as a separate ReactiveController alongside its existing DataSourceMixin.
**Alternatives:**
- Add eventSource to DataSourceMixin — merges push into fetch abstraction, contradicts ARC42 §6 orthogonality (R1-07), mixin can't access getRowKey (R1-02), DataSetManager uses keyColumn not getRowKey (R1-03)
**Rationale:** ARC42 §6: "SSE and DataSource are orthogonal. Components compose both, not choose one." The mixin doesn't have getRowKey, column definitions, or knowledge of the host's data identity concept. Push event handling needs host-specific logic. No prerequisite pages PR needed.
**Trade-offs:** Each Pattern A consumer writes its own push-to-dataset translation (~20 lines). Acceptable — only list-pane needs this today.
**Depends on:** D1 (EventStreamController as the push mechanism)
**Sources:** DataSourceMixin (pages-component), ARC42 §6, R1-02, R1-03, R1-07, R1-11
**Exploration:** quick
**Status:** revised (dropped DataSourceMixin change after review R1-02, R1-03, R1-07)

## D3: Event-to-row matching

**Choice:** Pattern A (list-pane): component uses its own `getRowKey` and column definitions — not the mixin's. Pattern B (domain consumers): each component matches by its own domain key (workItemId, executionId, etc.).
**Alternatives:**
- Separate eventKey property — adds a second key concept
- getRowKey on the mixin — mixin doesn't have it (R1-02)
**Rationale:** Two patterns need different matching. Pattern A translates event payloads to TypedRow via the component's column definitions, then matches with getRowKey. Pattern B routes by event type/topic, not row matching. One-size-fits-all doesn't fit either well (R1-05).
**Trade-offs:** Pattern A translation (event JSON → TypedRow → key match) is load-bearing code on the component, not a generic mixin concern
**Depends on:** D2 (no mixin change)
**Sources:** list-pane getRowKey, DataSetManager keyColumn vs getRowKey (R1-03), R1-05
**Exploration:** quick
**Status:** revised (split into two patterns after R1-05)

## D4: Scope — full SSEManager elimination

**Choice:** All 8 SSE consumers (work-item-inbox, execution-monitor, session-detail, topology-viewer, reconciliation-status, notification-inbox, notification-bell, plus new push on list-pane and kpi-metric-row) migrate to EventStreamController. SSEManager imports removed from blocks-ui.
**Alternatives:**
- Migrate 3 only (original issue scope) — leaves 5 consumers on the old mechanism
- Phased epic — risks never completing
**Rationale:** Full elimination in one branch. SSEManager has zero advantages over EventStreamController. Each migration is mechanical — domain logic stays, transport changes.
**Trade-offs:** Larger branch (9 component changes). Backend EventBroadcaster wiring deferred to prerequisite PRs.
**Sources:** SSEManager consumer audit (8 found including notification-bell, R1-06)
**Exploration:** quick
**Status:** revised (8 consumers, not 6 — R1-06 found notification-bell)

## D5: Zero-regression sequencing

**Choice:** Backend EventBroadcaster PRs land before this blocks-ui branch. Each backend service wires `broadcaster.publish(topic, payload)` alongside/replacing `SseEventSink.send()`. Same payload, different channel.
**Alternatives:**
- Ship frontend first, accept regression — components lose live updates temporarily
- SSEManager fallback — contradicts full-migration intent
**Rationale:** Backend wiring is mechanical. One small PR per service. Landing these first means events are on the WebSocket channel before the frontend switches.
**Trade-offs:** Cross-repo sequencing
**Sources:** NotificationSseResource (SSE endpoint), EventBroadcaster API
**Exploration:** quick
**Status:** captured

## D6: Connection sharing via PushPool

**Choice:** Components receive `pushPool: PushPool` from the consuming application. PushPool (EventStreamPool) manages ref-counted WebSocket connections — one WebSocket per URL, shared across all components on the page. No component calls close().
**Alternatives:**
- Each component creates its own EventConnection — N WebSockets per page
- Pass raw EventConnection — consumer must manage lifecycle and sharing
**Rationale:** PushPool solves creation, sharing, and cleanup (R1-09). Consumer creates one pool, passes to all components. Ref-counted topic subscriptions — auto-closes when last consumer disconnects.
**Trade-offs:** Components depend on consumer providing the pool. When pushPool is null, fall back to pull-only (no regression for components that didn't have push before).
**Sources:** EventStreamPool (pages-data), R1-09
**Exploration:** quick
**Status:** captured
