# Component Consolidation Design Spec

**Date:** 2026-07-07
**Branch:** issue-29-component-consolidation
**Covers:** #29, #24, #25, #18, #9, #10, #11
**Closed as resolved:** #32 (inbox already uses pages-data-table), #19 (queue-board never built, SSE is correct in inbox)

---

## Relationship to HANDOFF Consolidation Roadmap

The HANDOFF (2026-07-06) defines a phased consolidation roadmap: Phase 1 (#21 token migration), Phase 2 (table parity #29/#30/#31), Phase 3 (component fixes #18/#24/#25), Phase 5 (stub implementations #9/#10/#11). This spec intentionally reorders and groups work across those phases because:

1. **#21 (token migration) is independent.** It is a mechanical rename (561 var occurrences across 15 files) with no design decisions. It proceeds on its own branch without blocking or being blocked by anything in this spec.
2. **DataEndpointMixin must land before the new components.** The mixin is cross-cutting infrastructure that #9, #10, #11 all consume — building it alongside them ensures the abstraction fits its consumers.
3. **#9, #10, #11 are full implementations, not stubs.** The HANDOFF labelled them "Stub implementations" because the existing stubs were 2-line placeholders. This spec designs the real components. The stub label reflected what existed, not what was planned.

### Table parity gaps

This spec addresses #29 (text filter). #30 (tree/expandable rows) and #31 (CSV export) remain as separate work items. The new components (#9, #10, #11) do not require tree rows or CSV export as prerequisites — #9 uses expandable row detail (handled by the component's own expand/collapse, not data-table tree mode), #10 is a custom timeline (not table-based), and #11's per-capability table is flat. When #30 and #31 land, the components can adopt them where beneficial.

---

## Cross-Cutting: DataEndpointMixin

New mixin in `blocks-ui-core/src/data-endpoint/data-endpoint.ts`. Provides the shared infrastructure for all data-fetching components.

> **Placement rationale:** The `mixins/` directory in blocks-ui-core contains exclusively a11y mixins (RovingTabindex, FocusTrap, LiveRegion, KeyboardShortcut). DataEndpointMixin is data-fetching infrastructure — a different concern. It lives in its own `data-endpoint/` directory alongside `timers/` and `confirm-dialog/`, consistent with blocks-ui-core's post-#21 structure (domain types + SharedTimerController + blocks-confirm-dialog + DataEndpointMixin).

### What it provides

| Member | Type | Purpose |
|--------|------|---------|
| `endpoint` | `@property String` | REST base URL |
| `identity` | `@property WorkIdentity` | Current user context |
| `loading` | `@state boolean` | Fetch in progress |
| `error` | `@state string \| null` | Last error message |
| `fetchFn` | `typeof fetch` | Injectable for testing |
| `sseManager` | `SSEManager` | Injectable for testing |

### Lifecycle

- `willUpdate`: auto-calls `fetchData()` when `endpoint` changes **and no `configure()` microtask is pending**. Aborts any in-flight fetch before starting a new one — the AbortController is replaced on each trigger, not just on disconnect. Consumers add their own `willUpdate` to watch component-specific trigger properties (see configure() contract below).
- `connectedCallback`: does NOT subscribe SSE (component-specific properties like `caseId` may not be set yet). Lifecycle setup only.
- `disconnectedCallback`: unsubscribes SSE, aborts in-flight fetch via AbortController
- `configure(props)`: standard pages integration contract — sets endpoint, identity, and any extra props. **Defers `fetchData()` via `queueMicrotask`** so that all properties (from both the consumer override and super) are set before the fetch fires — regardless of whether super is called first or last. If `sseUrl()` returns a URL, subscribes SSE in the same microtask.
- SSE subscribes after `configure()` completes (not in `connectedCallback`), ensuring all properties are available for URL construction. Resubscribes on endpoint change via `willUpdate`.

### configure() contract

```typescript
// DataEndpointMixin provides:
configure(props: Record<string, unknown>): void {
  if (props.endpoint !== undefined) this.endpoint = props.endpoint as string;
  if (props.identity !== undefined) this.identity = props.identity as WorkIdentity;
  this._configurePending = true;
  queueMicrotask(() => {
    this._configurePending = false;
    this.fetchData();
    if (this.sseUrl?.()) this._subscribeSSE();
  });
}

// willUpdate skips auto-fetch when configure() has a pending microtask:
willUpdate(changed: PropertyValues): void {
  if (!this._configurePending && changed.has('endpoint') && this.endpoint) {
    this.fetchData();
  }
}
```

**Super call order doesn't matter.** Both orderings produce the same result — the microtask runs after `configure()` returns, by which time all properties are set:

```typescript
// Either ordering works:
override configure(props: Record<string, unknown>): void {
  super.configure(props);  // safe — fetchData is deferred, not synchronous
  if (props.subjectId !== undefined) this.subjectId = props.subjectId as string;
}
// or:
override configure(props: Record<string, unknown>): void {
  if (props.subjectId !== undefined) this.subjectId = props.subjectId as string;
  super.configure(props);
}
```

**No double-fetch.** The `_configurePending` flag suppresses `willUpdate`'s auto-fetch during the same cycle. Setting `endpoint` in `configure()` triggers a Lit update where `willUpdate` sees the change, but `_configurePending` is true so it skips. The microtask fires after the Lit update, producing exactly one fetch.

**Reactive property changes** outside `configure()` (e.g., via attribute binding) are handled by `willUpdate` — the flag is false, so the auto-fetch fires normally. Consumers add their own `willUpdate` for component-specific triggers:

```typescript
override willUpdate(changed: PropertyValues): void {
  super.willUpdate(changed);  // handles endpoint changes
  if (changed.has('subjectId') && this.subjectId && this.endpoint) {
    this.fetchData();
  }
}
```

### Abstract methods the consumer implements

```typescript
abstract fetchData(): Promise<void>;        // what to fetch
sseUrl?(): string;                          // optional: SSE endpoint URL
handleSSEEvent?(event: SSEEvent): void;     // optional: SSE event handler
```

### Error handling

On fetch failure, `this.error` is set and a `<div class="error">` renders with the error message and a **Retry button** that calls `fetchData()`. No automatic retry or backoff — the user controls retry timing. This matches the current behaviour of kpi-metric-row and work-item-detail, which also set error state without retry.

### Scope

New components (#9, #10, #11) use this mixin. Existing components are NOT migrated — they adopt it when touched for other reasons. This is intentional: the existing components have meaningfully different fetch patterns (work-item-detail fetches two endpoints + listens for selection events; work-item-inbox uses SSE directly for real-time updates; notification-inbox has its own API abstraction). Forcing them through a single-endpoint mixin would either require making the mixin overly generic or introducing unnecessary wrappers.

---

## #29 — Data-Table Text Filter

Built-in to `pages-data-table`, following the same pattern as `clientSort`.

### New properties on pages-data-table

| Property | Type | Attribute | Default |
|----------|------|-----------|---------|
| `clientFilter` | `boolean` | `client-filter` | `false` |
| `filterText` | `string` | `filter-text` | `''` |

### New fields on ColumnDef

| Field | Type | Default |
|-------|------|---------|
| `filterable` | `boolean?` | `true` for text/untyped columns, `false` for number/date |
| `filterValue` | `(row: R) => string` | Optional. Custom text extraction for filtering. If defined, used instead of `String(getValue(row))` |

### Behavior

- When `clientFilter` is true, renders a text input in the toolbar alongside the column picker
- For each filterable column: uses `column.filterValue(row)` if defined, otherwise `String(column.getValue(row))`. Tests against filter text (case-insensitive substring) — row matches if ANY column matches
- Pipeline order: raw rows → **filter** → sort → paginate/virtualise
- Resets `currentPage` to 0 when filter text changes
- Empty filter text = no filtering

### Server-paginated constraint

`clientFilter` is only valid when `totalRows` is NOT set (client-side data mode). When `totalRows` is set (server-side pagination), the data-table renders only the current page's rows — client-side filtering would silently search only that page, giving misleading results. In server-paginated mode, `clientFilter` is ignored and the filter input is not rendered. Server-side filtering is the consumer's responsibility (query parameter on the data endpoint).

### New event

`filter-change` with `FilterChangeDetail { text: string, matchCount: number }` — debounced ~150ms on input.

### No per-column filter UI

This is a global text search. Per-column filters are a separate feature.

---

## #25 — KPI Metric Row: Reactive Endpoint

Replace `connectedCallback`-only fetch with `willUpdate` reactivity.

```typescript
override willUpdate(changed: PropertyValues): void {
  if (changed.has('endpoint') && this.endpoint) {
    this._fetchMetrics();
  }
}
```

Remove fetch from `connectedCallback` — `willUpdate` fires on initial set too.

---

## #24 — KPI Metric Row: Density

New reflected property:

```typescript
@property({ type: String, reflect: true }) density: 'comfortable' | 'compact' | 'dense' = 'comfortable';
```

### Grid impact

| Density | minmax | Card padding | Value font size |
|---------|--------|-------------|-----------------|
| `comfortable` | `160px` | `--pages-space-4` (16px) | `--pages-font-size-2xl` (24px) |
| `compact` | `120px` | `--pages-space-3` (12px) | `--pages-font-size-xl` (20px) |
| `dense` | `90px` | `--pages-space-2` (8px) | `--pages-font-size-lg` (16px) |

Applied via CSS `:host([density="compact"])` and `:host([density="dense"])` selectors — no JavaScript branching, pure CSS. The `reflect: true` puts the attribute on the DOM element.

---

## #18 — Work-Item-Detail Relations

### New type

```typescript
interface WorkItemRelation {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;       // PART_OF, BLOCKS, RELATES_TO, etc.
  direction: 'outgoing' | 'incoming';
  createdBy: string;
  createdAt: string;
  title?: string;             // resolved via secondary fetch
  status?: string;            // resolved via secondary fetch
}
```

Replaces the current oversimplified `RelatedItem` type.

### Backend endpoints (existing in casehub-work-rest, work#292 closed)

- `GET /workitems/{id}/relations` — outgoing relations
- `GET /workitems/{id}/relations/incoming` — incoming relations

### Changes to work-item-detail.ts

Add to `_loadWorkItem()`:
```typescript
const [outgoing, incoming] = await Promise.all([
  fetch(`${this.endpoint}/workitems/${this.workItemId}/relations`),
  fetch(`${this.endpoint}/workitems/${this.workItemId}/relations/incoming`),
]);
```

Map with `direction: 'outgoing'`/`'incoming'`, apply semantic inverses for incoming display labels. Inverse map defined in blocks-ui as a constant (mirroring casehub-work's `WorkItemRelationType` inverses):

```typescript
const RELATION_INVERSES: Record<string, string> = {
  'BLOCKS': 'BLOCKED_BY',
  'BLOCKED_BY': 'BLOCKS',
  'PART_OF': 'HAS_PART',
  'HAS_PART': 'PART_OF',
  'RELATES_TO': 'RELATES_TO',  // symmetric
};
```

> **Duplication note:** This constant duplicates backend truth. A tracked issue (blocks-ui#XX filed against casehub-work) requests that the relation response include `inverseType` or `displayLabel` in the payload, eliminating the need for client-side inverse mapping. Until then, the constant + "(incoming)" fallback for unknown types is defensive and sufficient. The vocabulary is small (5 types) and stable.

Incoming relations display using the inverse label. Unknown types display as-is with "(incoming)" suffix.

### Changes to detail-relations-tab.ts

- Accept `WorkItemRelation[]` instead of `RelatedItem[]`
- Group relations by type
- Each row shows related item title + status
- Click emits `pages-event` with `work-item.selected` for navigation

### Title/status resolution

Related item titles and statuses are fetched via individual `GET /workitems/{id}` calls parallelised with `Promise.all()`. No batch endpoint exists in casehub-work-rest.

**Cache:** Component-instance `Map<string, { title: string, status: string }>` keyed by work item ID. Populated on first load, cleared on `disconnectedCallback`. Re-populated on `_loadWorkItem()` (which runs when the work item changes or on manual refresh). No cross-component sharing, no TTL-based eviction — the cache lives and dies with the component instance.

**Typical cardinality:** Work items have 1–5 relations (parent, children, linked). This is 1–5 parallel GET requests, not hundreds — the cardinality is bounded by domain constraints, not by data volume.

---

## #9 — Audit Trail Viewer

New component at `components/audit-trail-viewer/`.

### Properties

Via DataEndpointMixin: `endpoint`, `identity`

Component-specific:
- `subjectId: string` — entity whose audit trail to display (required)
- `actorId?: string` — optional actor filter
- `renderEntryPayload?: (entry: LedgerEntry) => TemplateResult | undefined` — optional domain-specific payload renderer callback

### Data flow

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /api/v1/ledger/entries?subjectId={id}&tenancyId={tid}` | Entry list, supports `from`/`to` date range, pagination | casehub-ledger-rest (ledger#162, closed) |
| `GET /api/v1/ledger/entries/{id}/attestations` | Attestations per entry | casehub-ledger-rest (ledger#162, closed) |
| `GET /api/v1/ledger/verify?subjectId={id}` | Merkle chain verification | casehub-ledger-rest (ledger#162, closed) |

### Structure

1. **Entry list** — `pages-data-table` with columns: timestamp (relative), actor (with actorType badge), entryType (COMMAND/EVENT/ATTESTATION), digest (truncated, monospace). `clientFilter` enabled.

2. **Entry detail** — expandable: full digest, traceId, causal chain (causedByEntryId → predecessor), attestations with verdict badges (SOUND/FLAGGED/ENDORSED/CHALLENGED).

3. **Payload renderer** — `renderEntryPayload` callback property: `(entry: LedgerEntry) => TemplateResult | undefined`. The component calls this function when rendering an expanded entry's payload section. If the callback returns a `TemplateResult`, it replaces the default rendering. If undefined or not set, the component renders raw JSON payload as formatted `<pre>` block. This is the same pattern as `ColumnDef.render` — a callback, not a slot — because the entry data changes as the user expands different rows, and Web Component slots cannot receive data from the host.

   ```typescript
   // Consumer provides domain-specific rendering:
   html`<audit-trail-viewer
     .renderEntryPayload=${(entry) => {
       if (entry.entryType === 'AML_INVESTIGATION')
         return html`<aml-evidence-view .evidence=${entry.payload}></aml-evidence-view>`;
       return undefined; // fall back to default JSON rendering
     }}
   ></audit-trail-viewer>`
   ```

4. **Verification banner** — top-level chain integrity indicator. Green checkmark if verified, red warning if broken. Shows tree root hash.

### Filter controls

Actor dropdown, entry type chips (COMMAND/EVENT/ATTESTATION), date range from/to.

### GDPR erasure

The ledger uses a domain-agnostic leaf hash computed from entry metadata (timestamp, actor, entryType, sequence number) — not from the payload content. GDPR Art.17 token-severing erasure nullifies the payload and pseudonymises the actor identity without breaking the Merkle chain, because the leaf hash is content-independent (see PLATFORM.md §Ledger subclasses: "domain-agnostic leaf hash").

Entries with null/redacted payload render "Content redacted" placeholder. The verification banner distinguishes three states:
- **Fully verified** (green checkmark) — chain intact, no redacted entries
- **Verified with redactions** (green checkmark + amber note) — chain intact, N entries have redacted payloads. Shows "Chain verified — N entries redacted"
- **Verification failed** (red warning) — chain integrity broken

### Events

`pages-event` with topic `audit.entry-selected` on row activation.

### Accessibility

Extends `LiveRegionMixin(DataEndpointMixin(LitElement))`.

| Element | ARIA | Keyboard |
|---------|------|----------|
| Verification banner | `role="status"`, `aria-live="polite"`. Screen reader text: "Chain verified", "Chain verified, N entries redacted", or "Chain verification failed" | — |
| Entry list | Inherits `pages-data-table` ARIA (`role="grid"`, row/cell roles, sort announcements) | Inherits data-table keyboard: arrow keys, Enter to activate row |
| Expandable entry detail | Trigger row: `aria-expanded="true/false"`. Detail panel: `role="region"`, `aria-labelledby` pointing to the trigger row | Enter/Space on row toggles expand. Focus moves into detail panel on expand |
| Filter controls | Actor dropdown: standard `<select>` semantics. Entry type chips: `role="group"` with `aria-label="Entry type filter"`, each chip `role="checkbox"` with `aria-checked`. Date range: `<input type="date">` with `<label>` | Tab between filter controls. Space toggles chips |
| Loading state | `announce('Loading audit trail')` via LiveRegionMixin | — |
| Error state | `announce('Failed to load audit trail: {message}', 'assertive')` | Tab to Retry button |
| Data loaded | `announce('{count} entries loaded')` | — |

### No SSE

Provides `refresh()` method for manual reload.

### Export/print (deferred)

Export and print affordances for compliance workflows are tracked as a separate issue (blocks-ui#XX). The component's data-table foundation supports this — when #31 (CSV export) lands in pages-data-table, the audit-trail-viewer inherits it automatically.

---

## #10 — Case Timeline

Replaces stub at `components/case-timeline/`.

### Properties

Via DataEndpointMixin: `endpoint`, `identity`

Component-specific:
- `caseId: string` — case to display (required)
- `mode: 'full' | 'compact'` — detail timeline vs summary strip

### Data flow

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /api/v1/cases/{caseId}/events` | Paginated, filtered by `eventType` and `streamType` | Currently in scaffold (flow); migrating to casehub-engine-rest (engine#657, open) |

Response: `PagedResponse<EventLogEntryResponse>` with `eventType`, `streamType`, `timestamp`, `payload`, `metadata`.

> **Backend dependency:** The case events endpoint currently lives in the scaffold (flow). engine#657 is extracting it to casehub-engine-rest. The component works with either location — it uses `endpoint` as a configurable base URL. No blocking dependency, but consumers must deploy with a scaffold or engine-rest instance that exposes the events API.

### Full mode — vertical CSS timeline

Vertical line with connected node cards. CSS `::before` for line and dots — no SVG/canvas.

Node type mapping from `CaseHubEventType`:
- **Case lifecycle** (STARTED, COMPLETED, FAULTED, CANCELLED) — prominent, status-coloured
- **Tasks** (TASK_CREATED, TASK_COMPLETED, TASK_FAILED) — link to work item
- **Agent activity** (AGENT_ROUTED, DISPATCHED, COMPLETED, FAILED) — shows worker name, trust score from metadata
- **Milestones** (REACHED, ACTIVATED, COMPLETED, SLA_VIOLATED) — diamond markers
- **Action gates** (PENDING, APPROVED, REJECTED) — decision points
- **Orchestration** (STARTED, COMPLETED, ESCALATED) — grouped containers

Each node: timestamp, type badge, payload summary. Expandable for full payload.

### Compact mode — horizontal summary strip

Horizontal strip for dashboard embedding. Fits within a single row height (~48px).

| Aspect | Specification |
|--------|--------------|
| **Layout** | Horizontal flexbox with overflow-x: auto and scroll-snap |
| **Nodes shown** | Lifecycle events + milestones only (tasks, agent activity, orchestration filtered out) |
| **Truncation** | Show first 3 and last 2 nodes; ellipsis indicator ("...+N") for hidden middle nodes when >7 |
| **Interaction** | Display-only — no click, no expand. Click on the strip emits `timeline.expand-requested` to signal the host to switch to full mode |
| **Node rendering** | 12px coloured dot. Colour maps: lifecycle → status colours (green/red/amber), milestones → `--pages-accent-9` |
| **Container sizing** | `min-width: 200px`, adapts to container width. Dots spaced evenly via `justify-content: space-between` |
| **Tooltip** | On hover: event type + timestamp in a CSS-only tooltip (no JS positioning) |

### Branching/parallel layout (deferred)

Issue #10 acceptance criteria include "Supports both linear (simple) and branching (parallel stages) timeline layouts." This spec covers linear layout only. Branching layout for CMMN parallel stages is tracked as a separate issue (blocks-ui#XX). #10 can be partially closed with linear layout; the branching acceptance criterion remains open until the follow-up lands.

### Filter bar

Event type chips grouped by stream type (CASE, WORKER, ORCHESTRATION, TIMER, SYSTEM).

### Events

- `timeline.event-selected` on node click
- `work-item.selected` for task nodes (with work item ID from payload)
- `timeline.expand-requested` on compact strip click

### Accessibility

Extends `LiveRegionMixin(DataEndpointMixin(LitElement))`.

**Full mode:**

| Element | ARIA | Keyboard |
|---------|------|----------|
| Timeline container | `role="list"`, `aria-label="Case timeline"` | — |
| Timeline node | `role="listitem"`. Each node has `aria-label` summarising: event type, timestamp, status (e.g., "Task completed: Review PR, 2 hours ago") | Arrow Up/Down to navigate between nodes |
| Expandable payload | Trigger: `aria-expanded="true/false"`. Detail: `role="region"` | Enter/Space toggles expand |
| Task link nodes | `role="link"` with `aria-label` including work item title | Enter activates navigation (emits `work-item.selected`) |
| Filter chips | `role="group"` with `aria-label="Event type filter"`. Each chip: `role="checkbox"`, `aria-checked` | Tab into group, arrow keys between chips, Space toggles |
| Loading state | `announce('Loading timeline')` | — |
| Error state | `announce('Failed to load timeline: {message}', 'assertive')` | Tab to Retry button |

**Compact mode:**

| Element | ARIA | Keyboard |
|---------|------|----------|
| Strip container | `role="img"`, `aria-label` summarising the timeline (e.g., "Case timeline: Started, 3 milestones, Completed") | — |
| Dots | `aria-hidden="true"` — the container's label provides the accessible summary. CSS tooltips are decorative | — |
| Click target | `role="button"`, `aria-label="Expand timeline"` on the strip | Enter/Space emits `timeline.expand-requested` |

### SSE (deferred)

`refresh()` method for manual reload. Issue #10 acceptance criteria require "Real-time updates via SSE — new events append to the timeline without refresh." The DataEndpointMixin provides SSE infrastructure (`sseUrl()` + `handleSSEEvent()`), but the backend endpoint (casehub-engine-rest, engine#657) is still being extracted and does not yet expose SSE. Tracked as blocks-ui#XX — when engine#657 lands and provides SSE streaming for case events, the timeline enables it by implementing `sseUrl()`.

---

## #11 — Trust Score Panel

Replaces stub at `components/trust-score-panel/`.

### Properties

Via DataEndpointMixin: `endpoint`, `identity`

Component-specific:
- `actorId: string` — entity whose trust to display (required for full mode; optional in compact mode if `score` is provided)
- `mode: 'full' | 'compact'` — detailed panel vs inline badge
- `score?: number` — pre-fetched score for compact display-only mode (0.0–1.0)
- `trustLevel?: 'high' | 'adequate' | 'low' | 'none'` — pre-fetched trust level for compact mode colour

### Data flow

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /api/v1/ledger/trust/{actorId}` | Global + per-capability + dimension scores | casehub-ledger-rest (ledger#162, closed) |
| `GET /api/v1/ledger/trust/{actorId}/capability/{tag}` | Per-capability detail with decisionCount | casehub-ledger-rest (ledger#162, closed) |
| `GET /api/v1/ledger/trust/{actorId}/trend?window={7d\|30d\|90d\|all}` | Pre-aggregated trend data | See note below |

> **Trend endpoint:** The original design derived trend data client-side from raw attestation entries (O(N) requests for entries + per-entry attestation fetch). This is redesigned as a dedicated backend aggregation endpoint `GET /api/v1/ledger/trust/{actorId}/trend` that returns pre-computed `{ timestamp, cumulativeScore, flagged: boolean }[]` for the requested time window. If this endpoint does not yet exist in casehub-ledger-rest, a tracked issue (ledger#XX) requests it. Client-side computation from raw entries is not a viable design for actors with hundreds of observations.

### Full mode — three sections

1. **Overall score** — inline SVG arc/ring gauge. Colour-coded: green (≥0.7), amber (0.4–0.7), red (<0.4), grey (no data). Numerical value centred. **Confidence interval** displayed as a lighter arc band behind the primary score arc, spanning the 90% credible interval of the Beta posterior (computed from α and β parameters in the trust response). Text below the score shows the interval as "±X.XX" or "[low – high]". This conveys uncertainty — 0.85 from 5 observations shows a wide band (~0.65–0.95), while 0.85 from 5000 shows a tight band (~0.84–0.86).

2. **Per-capability breakdown** — `pages-data-table` with columns: capability tag, score (coloured bar), decision count, quality dimensions. Click fetches per-capability detail.

   Maturity phase from `decisionCount`: bootstrap (<10), calibrating (10–50), mature (>50). Badge next to score.

3. **Trend line** — `pages-line-chart` (pages-viz). Component consumes pre-aggregated trend data from the backend endpoint (not client-side computation). Time window: 7d / 30d / 90d / all. FLAGGED attestations as point annotations.

### Compact mode

Coloured badge with global score value (e.g. "0.85") and background matching trust level. For inline use in table cells, timeline nodes, etc.

**Two data paths** for compact mode:

1. **Pre-fetched (display-only):** When `score` and `trustLevel` are provided directly, the component renders immediately without fetching. No `endpoint` or `actorId` required. This is the path for mass rendering — a data-table column's `render` function passes pre-fetched scores from the row data, avoiding N parallel fetches.

   ```typescript
   // In a ColumnDef render function — no fetch, pure display:
   render: (value, row) => html`<trust-score-panel
     mode="compact" score=${row.trustScore} trustLevel=${row.trustLevel}
   ></trust-score-panel>`
   ```

2. **Self-fetching:** When only `actorId` + `endpoint` are provided (no `score`), the component fetches via DataEndpointMixin. This is the path for standalone use outside tables.

### Accessibility

Extends `LiveRegionMixin(DataEndpointMixin(LitElement))`.

**Full mode:**

| Element | ARIA | Keyboard |
|---------|------|----------|
| SVG arc gauge | `role="img"`, `aria-label` describing score, interval, and maturity (e.g., "Trust score 0.85, confidence interval 0.76 to 0.91, calibrating phase, 42 observations") | — |
| Maturity badge | Visually hidden text duplicating the badge content for screen readers (the badge is decorative; the gauge `aria-label` carries the information) | — |
| Per-capability table | Inherits `pages-data-table` ARIA | Inherits data-table keyboard. Enter on capability row emits `trust.capability-selected` |
| Capability detail fetch | `announce('Loading capability details for {tag}')` on click, `announce('Capability {tag}: score {score}, {count} observations')` on load | — |
| Trend chart | `role="img"`, `aria-label` summarising trend direction and time window (e.g., "Trust trend over 30 days: improving from 0.72 to 0.85, 2 flagged incidents"). `pages-line-chart` is SVG-based (not canvas), so the role/label provides the accessible summary | — |
| Loading state | `announce('Loading trust scores')` | — |
| Error state | `announce('Failed to load trust scores: {message}', 'assertive')` | Tab to Retry button |

**Compact mode:**

| Element | ARIA | Keyboard |
|---------|------|----------|
| Badge | `role="img"`, `aria-label` describing score and trust level (e.g., "Trust score 0.85, high trust") | — |

### Events

`pages-event` with topic `trust.capability-selected` on capability row click.

---

## Dependency summary

| Component | Depends on |
|-----------|-----------|
| DataEndpointMixin | `@casehubio/pages-data` (SSEManager), `@casehubio/blocks-ui-core` (WorkIdentity) |
| #29 text filter | No new dependencies |
| #24/#25 kpi density/reactive | No new dependencies |
| #18 relations | No new dependencies |
| #9 audit-trail-viewer | DataEndpointMixin, `@casehubio/blocks-ui-data-table` |
| #10 case-timeline | DataEndpointMixin |
| #11 trust-score-panel | DataEndpointMixin, `@casehubio/blocks-ui-data-table`, `@casehubio/pages-viz` (line chart) |

## Backend dependencies

| Endpoint | Provider | Status |
|----------|---------|--------|
| Ledger entries, attestations, verification, trust scores | casehub-ledger-rest | Available (ledger#162, closed) |
| Trust trend aggregation | casehub-ledger-rest | New — requires ledger issue for aggregated trend endpoint |
| Work item relations | casehub-work-rest | Available (work#292, closed) |
| Case events | scaffold (flow) → casehub-engine-rest | In progress (engine#657, open) — endpoint exists in scaffold |

## Tracked deferred items

| Item | Issue | Blocks |
|------|-------|--------|
| Case timeline SSE real-time updates | blocks-ui#XX | engine#657 (engine-rest extraction) |
| Case timeline branching/parallel layout | blocks-ui#XX | — |
| Audit trail export/print affordance | blocks-ui#XX | — |
| Relation inverse type in backend response | casehub-work#XX | — |
| Trust trend aggregation endpoint | casehub-ledger#XX | — |

> Issue numbers are placeholders — file actual GitHub issues before implementation begins.

## Implementation order

1. DataEndpointMixin (unblocks #9, #10, #11)
2. #25 (kpi reactive — 3-line fix)
3. #24 (kpi density — CSS-only after property add)
4. #29 (text filter — data-table enhancement)
5. #18 (relations — detail component + tab rework)
6. #9 (audit-trail-viewer — new component)
7. #10 (case-timeline — new component)
8. #11 (trust-score-panel — new component, depends on pages-viz chart)
