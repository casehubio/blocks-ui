## D1: Layout orientation

**Choice:** Configurable `layout: 'split' | 'stacked'` property, defaulting to `'split'`
**Alternatives:**
- Fixed split-workbench only — simpler but forces one layout on all consumers
- Fixed vertical stack only — doesn't match established workbench patterns
**Rationale:** Consumer decides based on their viewport and use case. Split-workbench handles responsive collapse internally, so both paths get mobile support.
**Trade-offs:** Two template paths. Reviewer noted split-workbench already handles responsive collapse, so the stacked variant may see limited use — but the user explicitly requested configurability.
**Sources:** work-item-workbench composition pattern, channel-activity wrapper pattern
**Exploration:** quick
**Status:** captured

## D2: Detail section display modes

**Choice:** CSS custom properties for section sizing (`--worker-task-context-min-height`, `--worker-task-workspace-min-height`), plus boolean visibility properties (`showContext`, `showWorkspace`) for hide/show
**Alternatives:**
- Generic section visibility config object — over-engineered for what's a styling concern
- Fixed layout with all sections always visible — rigid, wastes space
**Rationale:** Section sizing is a CSS concern, not a structural concern. CSS custom properties follow the `--pages-*` token pattern. Boolean props handle the rarer case of completely hiding a section.
**Trade-offs:** Less structured than a config object, but simpler and more composable
**Sources:** `--pages-*` CSS custom property convention, reviewer feedback (R1-07)
**Exploration:** quick
**Status:** revised (R1-07)

## D3: Workspace registry API

**Choice:** Declarative `workspaces: WorkspaceDefinition[]` property (typed config)
**Alternatives:**
- Imperative `registerWorkspace(tag, elementName)` — inconsistent with existing patterns, requires element reference
- Named slot (`workspace`) as in issue #152 — violates PP-20260713-8ea1af: slots are for layout shells only
**Rationale:** Matches detail-pane's `TabDefinition[]` pattern. Consistent with component-customisation-pattern protocol (mechanism 1: typed config properties). Component creates elements internally via `document.createElement()`, sets `taskContext` on them, and manages visibility by capability tag. Issue #152's slot-based approach is explicitly overridden by the protocol.
**Trade-offs:** Less flexible for truly dynamic registration, but no consumer has needed that
**Sources:** detail-pane TabDefinition pattern, component-customisation-pattern protocol (PP-20260713-8ea1af)
**Exploration:** quick
**Status:** revised (R1-04 — added explicit slot rejection rationale, workspace-result communication addressed in D8)

## D4: Investigation context data flow

**Choice:** Component-owned fetch with internal item lookup on selection. Investigation context comes from the original `WorkerTaskResponse` stored in the component's internal items array — not from TypedRow extraction.
**Alternatives:**
- Fetch-on-select via separate detail endpoint — adds latency and another endpoint contract
- Inline from TypedRow on selection — TypedDataSet extraction loses nested objects (R1-02/R1-12)
**Rationale:** DataSourceMixin's TypedDataSet pipeline flattens nested objects. list-pane emits TypedRow on selection, losing `investigationSummary`. The component must hold the original response array and look up by taskId on selection. Investigation summary is typed as `Record<string, unknown>` — opaque to the component, rendered by consumer-provided context tabs or render callbacks. No AML-specific field names in the generic component.
**Trade-offs:** Component manages its own items array alongside the derived TypedDataSet for list-pane display
**Depends on:** D5 (fetch ownership)
**Sources:** work-item-inbox internal items pattern, case-explorer EntityReader pattern, reviewer feedback (R1-02, R1-05, R1-12)
**Exploration:** quick
**Status:** revised (R1-02, R1-05, R1-12)

## D5: Data fetching and live updates

**Choice:** Component extends DataSourceMixin itself. Stores original `WorkerTaskResponse[]` items, derives TypedDataSet for list-pane display. Optional `pushController?: PushController` property for SSE-driven live updates (channel-activity pattern). When absent, falls back to manual refresh via `{selectionTopic}:refresh`.
**Alternatives:**
- DataSourceMixin on list-pane only — loses nested object data on extraction
- Direct fetch + SSE always — SSE contract becomes mandatory API surface
- No SSE support — pushes live update wiring onto every consumer for a use case that's core to task queues
**Rationale:** DataSourceMixin gives endpoint-driven lifecycle (loading, error, refresh) at the pane level. PushController is progressive enhancement — channel-activity established this pattern. Task queues receiving async COMMAND dispatches need live updates as a first-class capability.
**Trade-offs:** More complex than pure list-pane delegation, but preserves full response data and supports live updates
**Sources:** channel-activity pushController pattern, work-item-inbox SSE pattern, ARC42STORIES §6 (SSE and DataSource are orthogonal), reviewer feedback (R1-03)
**Exploration:** quick
**Status:** revised (R1-02, R1-03)

## D6: Component granularity

**Choice:** Single component with inline rendering (Approach A)
**Alternatives:**
- Convenience wrapper + extracted sub-components — more wiring, speculative reuse
- Thin shell + render callbacks only — pushes all scaffold work onto every consumer
**Rationale:** Matches channel-activity precedent. Workspace container is managed via WorkspaceDefinition[] (D3). Response form is notable complexity (~100-120 lines including claim, decline, submit) but still internal to this component's domain. YAGNI — extraction possible later.
**Trade-offs:** Larger single component file. Response form is the most likely extraction candidate if a second consumer appears.
**Sources:** channel-activity convenience wrapper pattern, work-item-workbench composition, reviewer feedback (R1-08)
**Exploration:** quick
**Status:** revised (R1-08 — acknowledged response form complexity)

## D7: Response submission and event model

**Choice:** Events-first with optional REST submission. Component always emits structured events (`worker-task:respond`, `worker-task:decline`). When `respondEndpoint` is provided, also POSTs the submission. Consumer can intercept events and prevent default POST if needed.
**Alternatives:**
- REST-only submission — couples component to specific REST contract
- Events-only — consumer always handles submission, even for the common case
**Rationale:** Event-driven approach is consistent with platform architecture. Optional REST is convenience for the common case. `WorkerTaskSubmission` response type is generic (not AML-specific): `{ type, result?, declineReason?, declineDetail? }`.
**Trade-offs:** Dual pathway (events + optional REST) is slightly more complex than either alone
**Sources:** work-item-inbox event patterns, platform event-driven architecture, reviewer feedback (R1-10)
**Exploration:** quick
**Status:** captured

## D8: Task assignment model (claim lifecycle)

**Choice:** Configurable — optional claim step. When `claimEndpoint` is provided, component shows a Claim button before the response form. When absent, tasks are assumed pre-assigned and the response form appears immediately. Claim emits `worker-task:claimed` event and optionally POSTs (same dual model as D7).
**Alternatives:**
- Pre-assigned only — can't handle competitive queues
- Competitive only — unnecessary overhead for pre-assigned tasks
**Rationale:** Different CaseHub applications have different dispatch models. AML may use competitive queues for some specialist types and pre-assigned for others. The claim step is a progressive enhancement, not a mode switch.
**Trade-offs:** Response form template has conditional claim state
**Depends on:** D7 (event model)
**Sources:** work-item-inbox claim/assign pattern, reviewer feedback (R1-11)
**Exploration:** quick
**Status:** captured

## D9: Workspace result communication

**Choice:** Component listens for `workspace-result` CustomEvent directly on the workspace element instance (not on document). The workspace element is created internally (D3), so the component holds a direct reference and can `addEventListener` on it. No shadow boundary concern — the listener is on the element, not relying on event bubbling through shadow DOM.
**Alternatives:**
- Property-based result collection (`workspace.getResult()`) — type-safe but requires polling or explicit trigger
- `composed: true` event bubbling through shadow DOM — fragile, leaks implementation detail
- Render callback for result collection — over-engineered for what's a simple event
**Rationale:** Direct addEventListener on the managed element is the simplest and most reliable approach. The component already holds the element reference from `document.createElement()`. Type safety is provided by the `WorkspaceResultEvent` interface.
**Trade-offs:** Workspace elements must dispatch `workspace-result` CustomEvent — this is a contract on workspace implementors
**Depends on:** D3 (workspace element lifecycle)
**Sources:** detail-pane element management pattern, reviewer feedback (R1-04 point 3)
**Exploration:** quick
**Status:** captured
