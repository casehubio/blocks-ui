# trust-workbench — composite trust visibility component

**Issue:** casehubio/blocks-ui#89
**Date:** 2026-07-20
**Status:** Design approved

## Problem

Three trust-related components exist independently — `trust-score-panel`, `routing-rationale`, and `trust-feedback-display`. Every app using trust-weighted routing (devtown, clinical, AML) needs the same composed view with the same event wiring. Without a composite, each app rebuilds layout and coordination independently.

## Prerequisites

1. **Migrate trust-score-panel event topic to colon separator.** `trust-score-panel` currently emits `trust.capability-selected` (dot separator) in `_handleCapabilityClick`. Per the generic workbench spec (2026-07-08), all blocks-ui event topics use colon separators. Migrate to `trust:capability-selected` — one-line constant change.

2. **Backend routing-history endpoints.** The routing history list and detail endpoints are new backend work. No endpoint exists yet — the routing-rationale spec (2026-07-16) notes the same for single routing decisions. The component is fully functional via inline data mode; endpoint mode requires the backend endpoints. See §Deferred issues.

3. **Export `PHASE_STYLES` from routing-rationale.** `PHASE_STYLES` is currently module-private in `routing-rationale.ts`. The trust-workbench Phase column renderer reuses the same phase badge styles (§Routing history column definitions). Add `PHASE_STYLES` to `routing-rationale/src/index.ts` exports — one-line change, no behavior change.

## Design

### Layout

`trust-workbench` composes `split-workbench` with inline state management (same pattern as `work-item-workbench`).

**Internal selection-topic:** The workbench uses `selection-topic="trust-routing"` on its internal `split-workbench` and `list-pane`. Selection events flow as `trust-routing:selected` and `trust-routing:deselected` on `document`. Tier 3 consumers composing directly must use the same topic value.

**Left panel (list slot):**
- `trust-score-panel` (full mode) — orientation and context. Shows SVG gauge, per-capability breakdown table, trend sparkline.
- `list-pane` — routing decision summaries (timestamp, capability, selected worker, final score, phase badge). Filtered by the selected capability from the score panel. Configured with `getRowKey = (row) => row.text(ID_COL)` for stable row identity across re-fetches.

**Right panel (detail slot):**
- `routing-rationale` — full detail of the selected routing decision (score header, candidates table, policy summary). Existing component, consumed unchanged.
- Feedback section — `trust-feedback-display` instances (compact mode) stacked below the rationale. Shows gate decisions downstream of the routing decision.

The feedback entries stack below the rationale rather than using tabs because they are causally downstream — "we routed to this worker, here's what happened." They are not independent facets competing for space.

**Detail error rendering:** When a detail fetch fails, the workbench renders an inline error message in the detail pane area (replacing the routing-rationale and feedback section), with `role="alert"` for immediate screen reader announcement. The error includes a retry action. This is a workbench-level concern — separate from routing-rationale's internal error handling.

**Detail loading state:** When `_detailLoading` is true, the detail pane area shows a loading indicator with `role="status"`.

### Component API

```typescript
@customElement('trust-workbench')
class TrustWorkbench extends LiveRegionMixin(LitElement) {
  // Tier 1 — drop-in
  @property({ type: String }) endpoint = '';
  @property({ type: String, attribute: 'actor-id' }) actorId = '';

  // Tier 2 — custom renderers for routing history list-pane
  @property({ attribute: false }) routingColumns?: readonly TableColumnConfig[];
  @property({ attribute: false }) routingColumnRenderers?: ReadonlyMap<ColumnId, ColumnRenderer>;
  @property({ attribute: false }) renderCandidate?: (candidate: CandidateScore) => TemplateResult | undefined;

  // Inline data mode (demos/tests)
  @property({ attribute: false }) routingHistory?: readonly RoutingDecisionSummary[];
  @property({ attribute: false }) routingDetailResolver?: (id: string) => Promise<RoutingDecisionDetail>;

  // Internal state
  @state() _selectedCapability: string | null = null;
  @state() _selectedDecisionId: string | null = null;
  @state() _routingDetail: RoutingRationaleData | null = null;
  @state() _feedbackEntries: readonly GateDecision[] = [];
  @state() _detailLoading = false;
  @state() _detailError: string | null = null;
}
```

`routingColumns` and `routingColumnRenderers` configure the **routing history list-pane** (left panel). They override the default column definitions described in §Routing history column definitions. They do NOT configure routing-rationale's alternatives table, which uses hardcoded `TABLE_CONFIG` internally.

### Data contracts

`endpoint` is the **API root** (e.g., `/api`), not a trust-specific path. The workbench derives all sub-endpoints from `endpoint` + `actorId`:

| Surface | Resolved URL | Constructed by | Response type |
|---------|-------------|----------------|---------------|
| Trust score panel | `{endpoint}/trust/{actorId}` | trust-score-panel internally (via `resolveEndpoint()`) | `TrustScoreResponse` (existing) |
| Routing history list | `{endpoint}/trust/{actorId}/routing-history[?capability={tag}]` | workbench | `RoutingDecisionSummary[]` |
| Routing detail + feedback | `{endpoint}/trust/{actorId}/routing-history/{decisionId}` | workbench | `RoutingDecisionDetail` |

The workbench passes `endpoint` to trust-score-panel as-is — the panel's `resolveEndpoint()` adds `/trust/{actorId}` internally. The workbench constructs the routing-history URLs directly using the same `/trust/` path prefix.

**New types:**

```typescript
interface RoutingDecisionSummary {
  readonly id: string;
  readonly timestamp: string;           // ISO-8601
  readonly capabilityTag: string;
  readonly selectedWorkerId: string;
  readonly finalScore: number;
  readonly phase: CandidateScore['phase'];
}

interface RoutingDecisionDetail {
  readonly rationale: RoutingRationaleData;
  readonly feedback: readonly GateDecision[];
}
```

The detail response embeds feedback alongside the rationale — one fetch for the entire right panel. This reflects the causal relationship and avoids a second request.

#### Routing history column definitions

The workbench provides default column definitions for the routing history list-pane. These are overridden when Tier 2's `routingColumns` and `routingColumnRenderers` are set.

```typescript
const ID_COL = columnId('id');
const TIMESTAMP_COL = columnId('timestamp');
const CAPABILITY_COL = columnId('capabilityTag');
const WORKER_COL = columnId('selectedWorkerId');
const SCORE_COL = columnId('finalScore');
const PHASE_COL = columnId('phase');

const ROUTING_HISTORY_COLUMNS = [
  { id: ID_COL, name: 'ID', type: ColumnType.TEXT, getValue: (s: RoutingDecisionSummary) => s.id },
  { id: TIMESTAMP_COL, name: 'Time', type: ColumnType.TEXT, getValue: (s: RoutingDecisionSummary) => s.timestamp },
  { id: CAPABILITY_COL, name: 'Capability', type: ColumnType.TEXT, getValue: (s: RoutingDecisionSummary) => s.capabilityTag },
  { id: WORKER_COL, name: 'Worker', type: ColumnType.TEXT, getValue: (s: RoutingDecisionSummary) => s.selectedWorkerId },
  { id: SCORE_COL, name: 'Score', type: ColumnType.NUMBER, getValue: (s: RoutingDecisionSummary) => s.finalScore },
  { id: PHASE_COL, name: 'Phase', type: ColumnType.TEXT, getValue: (s: RoutingDecisionSummary) => s.phase },
];

// ID_COL is in ROUTING_HISTORY_COLUMNS (available in TypedRow) but excluded
// from TABLE_CONFIG (not rendered as a visible column). This ensures
// row.text(ID_COL) works for decision selection in both endpoint and inline mode.
const ROUTING_HISTORY_TABLE_CONFIG: readonly TableColumnConfig[] = [
  { id: TIMESTAMP_COL, sortable: true },
  { id: CAPABILITY_COL, sortable: true },
  { id: WORKER_COL, sortable: true },
  { id: SCORE_COL, sortable: true },
  { id: PHASE_COL, sortable: true },
];
```

**Default column renderers:**

| Column | Renderer |
|--------|----------|
| Time | Formatted timestamp (relative for recent, absolute for older) |
| Capability | Plain text |
| Worker | Plain text |
| Score | Inline-styled score bar (0–1 range), same pattern as routing-rationale's `FINAL_COL` renderer |
| Phase | Inline-styled badge, reusing `PHASE_STYLES` from routing-rationale |

Column renderers use inline styles for cross-shadow-DOM correctness (same as routing-rationale — lesson from #67).

### Event wiring

```
trust-score-panel               list-pane                   detail section
       │                            │                             │
       │ trust:capability-selected  │                             │
       ├───────────────────────────>│                             │
       │                            │ (endpoint updated,          │
       │                            │  refetches with             │
       │                            │  ?capability=tag)           │
       │                            │                             │
       │                            │ trust-routing:selected      │
       │                            ├────────────────────────────>│
       │                            │                             │ (fetch detail,
       │                            │                             │  render rationale
       │                            │                             │  + feedback)
```

**State transitions:**

1. **Capability selected** — `trust:capability-selected` event from score panel. Compares incoming `tag` with `_selectedCapability` for toggle semantics (see #2). If different: sets `_selectedCapability`, clears `_selectedDecisionId` (resets detail pane). In endpoint mode, updates list-pane endpoint with `?capability={tag}` (server-side filter). In inline data mode, the reactive `_selectedCapability` change triggers `willUpdate` which rebuilds the dataset with a client-side filter (see §Inline data mode mechanism). Announces "Filtered to {tag}".

2. **Capability deselected** — toggle logic in the `trust:capability-selected` handler. `trust-score-panel` always emits `trust:capability-selected` with the clicked tag — there is no separate deselection event. The workbench implements toggle semantics:

```typescript
// In trust:capability-selected handler:
if (detail.tag === this._selectedCapability) {
  this._selectedCapability = null;  // toggle off
} else {
  this._selectedCapability = detail.tag;  // select new
}
```

When toggled off: sets `_selectedCapability = null`, list-pane shows all decisions. Announces "Showing all routing decisions".

3. **Decision selected** — `trust-routing:selected` from list-pane. The event payload is a `TypedRow`. Extracts `decisionId = row.text(ID_COL)`, sets `_selectedDecisionId`, fetches `RoutingDecisionDetail`, sets `_routingDetail` and `_feedbackEntries`. Announces "Loading routing detail" on fetch start, "Routing detail loaded for {workerId}" on success.

4. **Decision deselected** — `trust-routing:deselected` from split-workbench responsive collapse. Clears detail state.

5. **Actor ID change** — resets all state: `_selectedCapability`, `_selectedDecisionId`, `_routingDetail`, `_feedbackEntries`. Trust-score-panel re-fetches via its own DataSourceMixin. Announces "Trust data reset".

**Detail fetching:** Plain `fetch` with `AbortController` — cancelled on rapid selection changes. Not DataSourceMixin — the workbench coordinates data, it doesn't display it.

### Consumption tiers

**Tier 1 — drop in:**
```html
<trust-workbench endpoint="/api" actor-id="worker-42"></trust-workbench>
```

**Tier 2 — custom renderers:**
```typescript
wb.routingColumns = customColumnConfig;          // overrides routing history list-pane columns
wb.routingColumnRenderers = customRenderers;      // overrides routing history list-pane renderers
wb.renderCandidate = (candidate) => html`...`;   // passed through to routing-rationale
```

**Tier 3 — direct composition:**
```html
<split-workbench selection-topic="trust-routing">
  <div slot="list">
    <trust-score-panel endpoint="/api" actor-id="worker-42"></trust-score-panel>
    <list-pane endpoint="/api/trust/worker-42/routing-history"
               selection-topic="trust-routing"
               .columnConfig=${ROUTING_HISTORY_TABLE_CONFIG}
               .columnRenderers=${routingRenderers}
               .getRowKey=${(row) => row.text(ID_COL)}></list-pane>
  </div>
  <div slot="detail">
    <routing-rationale .data=${rationaleData}></routing-rationale>
    <!-- custom feedback rendering -->
  </div>
</split-workbench>
```

**Inline data mode** for demos and tests:
```typescript
wb.routingHistory = [...summaries];
wb.routingDetailResolver = async (id) => ({ rationale: {...}, feedback: [...] });
```

**Inline data mode mechanism:** When `routingHistory` is set, the workbench converts `RoutingDecisionSummary[]` to a `TypedDataSet` via `fromRows()` using `ROUTING_HISTORY_COLUMNS`, then sets `list-pane.dataSet` directly. No `endpoint` is set on list-pane, so `DataSourceMixin.resolveEndpoint()` returns `undefined` and no fetch occurs. This is the same dual-data pattern used by routing-rationale (`data` property suppresses endpoint fetch).

**Capability filtering is mode-dependent:**
- **Endpoint mode:** state transition #1 appends `?capability={tag}` to the list-pane endpoint URL. The server applies the filter.
- **Inline data mode:** the workbench applies a client-side filter when rebuilding the dataset. The `willUpdate` runs when either `routingHistory` or `_selectedCapability` changes:

```typescript
// In willUpdate, when routingHistory or _selectedCapability changes:
const source = this.routingHistory;
const filtered = this._selectedCapability
  ? source.filter(s => s.capabilityTag === this._selectedCapability)
  : source;
const dataset = fromRows(filtered, ROUTING_HISTORY_COLUMNS);
listPaneRef.dataSet = dataset;
listPaneRef.columnConfig = this.routingColumns ?? ROUTING_HISTORY_TABLE_CONFIG;
listPaneRef.columnRenderers = this.routingColumnRenderers ?? DEFAULT_ROUTING_RENDERERS;
```

When `routingDetailResolver` is set, the workbench calls the resolver instead of fetching from the endpoint. Same pattern: property presence suppresses the fetch path.

### Package structure

```
components/trust-workbench/
  package.json            @casehubio/blocks-ui-trust-workbench
  tsconfig.json
  vitest.config.ts
  src/
    trust-workbench.ts
    types.ts              RoutingDecisionSummary, RoutingDecisionDetail, config types
    columns.ts            ROUTING_HISTORY_COLUMNS, ROUTING_HISTORY_TABLE_CONFIG, default renderers
    index.ts
    trust-workbench.test.ts
```

**Dependencies:** `blocks-ui-core`, `blocks-ui-split-workbench`, `blocks-ui-trust-score-panel`, `blocks-ui-list-pane`, `blocks-ui-routing-rationale`, `blocks-ui-trust-feedback-display`, `pages-primitives`, `pages-data`. No new external dependencies.

**No changes to existing components** beyond the prerequisites (§Prerequisites #1 and #3). All three trust components are consumed as-is. `trust-score-panel` emits `trust:capability-selected` (after migration) with `{ tag, score, actorId }`.

### Accessibility

| State transition | Announcement | Method |
|-----------------|--------------|--------|
| Capability selected | "Filtered to {tag}" | `announce()` via LiveRegionMixin |
| Capability deselected | "Showing all routing decisions" | `announce()` via LiveRegionMixin |
| Decision selected, loading | "Loading routing detail" | `announce()` via LiveRegionMixin |
| Decision loaded | "Routing detail loaded for {workerId}" | `announce()` via LiveRegionMixin |
| Detail fetch error | "Failed to load routing detail: {error}" | `announce()` via LiveRegionMixin |
| Actor ID change | "Trust data reset" | `announce()` via LiveRegionMixin |

**Inherited accessibility from child components:**
- `trust-score-panel`: score gauge `role="img"` with aria-label, capability table via pages-table ARIA, trend sparkline `role="img"`
- `list-pane`: `role="grid"` from pages-table, `role="status"` for empty state
- `routing-rationale`: score bars `role="img"`, phase badges with aria-label, LiveRegionMixin for state changes
- `trust-feedback-display`: decision/attestation badges with semantic text
- `split-workbench`: panel regions, divider `role="separator"`, mobile panel switch announcements

**Error state:** Inline error message with `role="alert"` in the detail pane area.
**Loading state:** Loading indicator with `role="status"` in the detail pane area.

### Testing

1. **Rendering states** — score panel + list-pane in left slot; empty detail when no selection; routing-rationale + feedback when decision selected; error state on fetch failure; loading state during fetch.
2. **Event wiring** — capability selection updates list-pane endpoint (endpoint mode); capability selection in inline data mode applies client-side filter and rebuilds dataset; capability toggle deselects when same tag clicked; decision selection triggers detail fetch.
3. **Data flow** — `RoutingDecisionDetail` correctly splits into routing-rationale `.data` and trust-feedback-display instances.
4. **Column definitions** — default columns render with correct types, renderers produce phase badges and score bars.
5. **Edge cases** — empty routing history for selected capability; fetch error on detail (renders inline error with retry); actor ID change resets state; rapid selection changes cancel in-flight requests (AbortController).
6. **Inline data mode** — `routingHistory` and `routingDetailResolver` bypass endpoint fetching; `fromRows()` conversion produces correct `TypedDataSet`.
7. **Accessibility** — `announce()` called on each state transition; error state has `role="alert"`; loading state has `role="status"`.
8. **Tier 2 overrides** — `routingColumns` and `routingColumnRenderers` override defaults on list-pane.

All tests use inline data — no real endpoints.

### Domain customisation protocol compliance

Per PP-20260713-8ea1af:
- Typed config properties: `routingColumns`, `routingColumnRenderers`
- Optional render callbacks: `renderCandidate` (passed through to routing-rationale)
- No slots for content customisation — split-workbench slots are layout-only (score panel and list in left, rationale and feedback in right)
- Render callback output uses inline styles (existing routing-rationale and trust-score-panel already follow this)

## Deferred issues

| Issue | Repo | Description |
|-------|------|-------------|
| TBD | casehub-engine | REST endpoint for routing history — exposes `RoutingDecisionSummary[]` at `GET /trust/{actorId}/routing-history[?capability={tag}]` and `RoutingDecisionDetail` at `GET /trust/{actorId}/routing-history/{decisionId}`. Related to the deferred routing-rationale endpoint (routing-rationale spec §Deferred Issues). Blocks endpoint mode of this component. |
| #89 AC update | blocks-ui | Update issue #89 acceptance criterion #3: replace `inlineSource()` / `simulated()` with property-based inline data (`routingHistory`, `routingDetailResolver`). These factory functions do not exist in the codebase — the spec uses direct property assignment, consistent with routing-rationale and trust-score-panel. |
