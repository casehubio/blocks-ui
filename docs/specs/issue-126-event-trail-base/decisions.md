# Decisions — #126 Event Trail Extraction

## D1: Component architecture

**Choice:** Concrete `<blocks-event-trail>` web component configured via typed properties and render callbacks (per PP-20260713-8ea1af). Consumers compose it internally — no subclassing needed.
**Alternatives:**
- EventTrailMixin — more flexible via subclassing but requires `extends EventTrailMixin(LitElement)`, violates protocol preference for composition over inheritance
- Thin wrapper helpers (createFilterBar, createTypeChips) — lightest touch but most duplication across consumers
**Rationale:** Follows the established protocol for domain customisation. Composition keeps consumers decoupled from the base component's internals. Both known consumers (ledger, IoT) wrap it with domain-specific chrome.
**Trade-offs:** Less flexibility than a mixin for consumers that want radically different layouts. Acceptable because both known consumers share the same layout pattern (filter bar → table → expandable detail).
**Sources:** PP-20260713-8ea1af (component-customisation-pattern), audit-trail-viewer.ts, iot#103
**Exploration:** quick
**Status:** captured

## D2: Filter architecture (REVISED after decision review)

**Choice:** Filters are a standalone `<pages-filter-bar>` component in casehub-pages, not built into blocks-event-trail. blocks-event-trail composes pages-filter-bar + pages-table. The filter bar is a pages-level primitive usable by any table consumer.
**Alternatives:**
- All three filters built into blocks-event-trail — original D2 choice. Works but puts domain-agnostic UI infrastructure at the wrong platform layer and requires re-extraction later.
- Only type chips built-in — same layering problem, less API surface but more boilerplate.
- All filters via renderFilters callback — maximum flexibility but loses cohesive filter bar and pushes state management to every consumer.
**Rationale:** Decision review R1-02 identified that the filter bar UX pattern (type chips + entity dropdown + date range) operates on column values, not domain concepts. It belongs at the same level as pages-table, client-sort, and client-filter. Building it in pages from the start avoids the extract-now-re-extract-later cycle.
**Trade-offs:** Requires cross-repo work (slot). pages-filter-bar must be designed as a general-purpose primitive, not just for event trails — slightly more design effort upfront.
**Sources:** Decision review R1-02 (standalone filter-bar alternative), casehub-pages#354
**Depends on:** D1
**Exploration:** quick → revised after light decision review
**Status:** revised

## D3: Detail expansion model

**Choice:** Single `getRowDetail` callback (same API as pages-table). Consumer manages any secondary fetches (attestations, correlation data) internally. blocks-event-trail wires single-expansion state and forwards to pages-table.
**Alternatives:**
- getRowDetail + onDetailExpand callback pair — more structured notification of expansion events, but adds API surface for a concern consumers can handle internally
- Built-in detail sections with per-section render callbacks (renderPayload, renderMetadata, renderExtra) — most opinionated, constrains layout unnecessarily
**Rationale:** Reuses pages-table's existing `getRowDetail` contract. No new concepts for consumers already familiar with pages-table. Audit-trail-viewer's attestation fetch is an internal concern that doesn't need component-level API support.
**Trade-offs:** Consumer must track expansion state if it needs to trigger side effects on expand. The `detail-change` event from pages-table is available for this.
**Sources:** audit-trail-viewer.ts lines 181-197, pages-table getRowDetail API
**Exploration:** quick
**Status:** captured

## D4: Data source pattern (REVISED after decision review)

**Choice:** blocks-event-trail uses DataSourceMixin with `createSourceFactory()` override. Consumer sets `endpoint` to the full domain-specific URL (including domain query params). blocks-event-trail adds date range params via `resolveEndpoint()` override. Raw entries stored alongside TypedDataSet for getRowDetail access. Dual data mode via `data` property (resolveEndpoint returns undefined when data is set).
**Alternatives:**
- endpoint + buildQueryParams callback — REJECTED: zero codebase precedent, invents a fourth data pattern (decision review R1-04)
- Data property only (no fetch) — simpler but pushes fetch lifecycle to every consumer
- Full DataSourceAdapter delegation via sourceFactory callback — re-exposes GE-20260712-7250c5 complexity
**Rationale:** Uses established Pattern 1 (DataSourceMixin + resolveEndpoint) for lifecycle and URL construction, with Pattern 2 (createSourceFactory override) for the raw-entry-alongside-TypedDataSet concern. Both patterns have multiple precedents in the codebase.
**Trade-offs:** Consumer must build the full domain URL before setting endpoint (no callback for domain-specific params). Acceptable because URL construction is the consumer's responsibility — blocks-event-trail only adds its own generic params (date range).
**Sources:** Decision review R1-04, GE-20260712-7250c5, routing-rationale resolveEndpoint pattern, similarity-panel dual data mode
**Depends on:** D1
**Exploration:** quick → revised after light decision review
**Status:** revised

## D5: Build order and cross-repo execution

**Choice:** Slot-based cross-repo execution: (1) pages-filter-bar in casehub-pages, (2) blocks-event-trail in blocks-ui consuming pages-filter-bar, (3) audit-trail-viewer refactor. All in one slot to avoid redoing filter implementation.
**Alternatives:**
- Build filter bar inside blocks-event-trail now, extract to pages later — works but creates throwaway code and a re-extraction task
- Sequential branches (pages first, then blocks-ui) — correct ordering but loses session context between branches
**Rationale:** Building in the right order (pages → blocks-ui) with a slot avoids the extract-now-re-extract-later cycle. Both repos are modified in a single session with shared context.
**Trade-offs:** Slot setup overhead. Acceptable for a 2-repo change with clear ordering dependency.
**Sources:** casehub-pages#354, blocks-ui#126
**Depends on:** D2
**Exploration:** quick
**Status:** captured
