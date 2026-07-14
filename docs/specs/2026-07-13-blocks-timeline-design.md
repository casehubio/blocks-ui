# blocks-timeline — Unified Pluggable Timeline

**Issue:** #55
**Date:** 2026-07-13

## Summary

Refactor `<case-timeline>` into `<blocks-timeline>` — a general-purpose timeline component with pluggable layout renderers and content strategies. Case event chronology and commitment state progression become configurations of the same component, not separate implementations.

## Architecture

Three layers, each independently replaceable:

```
┌─────────────────────────────────────────────┐
│  <blocks-timeline>                          │
│  - DataSourceMixin for data pipeline        │
│  - Orchestrates strategy + renderer         │
│  - Owns filter UI, keyboard nav, ARIA       │
├─────────────────────────────────────────────┤
│  TimelineStrategy                           │
│  - Maps domain data → TimelineNode[]        │
│  - Provides default renderers (overridable) │
│  - Declares preferred layout                │
├─────────────────────────────────────────────┤
│  LayoutRenderer                             │
│  - Renders nodes in vertical/horizontal/    │
│    compact arrangement                      │
│  - Owns connectors, spacing, animation      │
└─────────────────────────────────────────────┘
```

## Core Types

```typescript
interface TimelineNode {
  key: string;
  label: string;
  status: 'completed' | 'active' | 'pending' | 'failed' | 'skipped';
  timestamp?: string;
  actor?: string;
  detail?: unknown;
  category?: string;
}

type Layout = 'vertical' | 'horizontal' | 'compact';

interface TimelineStrategy<T = unknown> {
  toNodes(data: T): TimelineNode[];
  transformData?: (raw: unknown) => T;
  defaultLayout: Layout;
  renderNode?: (node: TimelineNode) => TemplateResult;
  renderDetail?: (node: TimelineNode) => TemplateResult;
  filterCategories?: string[];
}
```

`transformData` bridges the raw data shape (from `dataSet` or inline `data`) to the strategy's typed input `T`. When provided, the component calls `transformData(raw)` before passing to `toNodes`. When absent, the raw data is passed directly — the consumer must ensure the correct type.

Connectors are not part of the strategy interface. Connector rendering is entirely the layout renderer's responsibility — layout renderers style connectors based on adjacent node statuses. This separation exists because connector DOM structure differs fundamentally between layouts: vertical uses CSS `::before` pseudo-elements, horizontal uses explicit `<div>` elements, compact uses a background line. A strategy-level render callback cannot produce CSS pseudo-elements.

### Render Resolution Order

For each render point (node, detail):

1. **Component callback** — consumer passes `renderNode` etc. on the element → wins
2. **Strategy renderer** — strategy provides `renderNode` etc. → used if component doesn't override
3. **Built-in default** — baseline rendering (see Layout Renderers)

## Component API

```typescript
class BlocksTimeline extends DataSourceMixin(LiveRegionMixin(LitElement)) {
  // Data
  @property({ attribute: false }) strategy: TimelineStrategy;
  @property({ attribute: false }) data?: unknown;       // inline data (alternative to endpoint)

  // Layout
  @property() layout?: Layout;                          // overrides strategy.defaultLayout

  // Render callbacks (override strategy defaults)
  @property({ attribute: false }) renderNode?: (node: TimelineNode) => TemplateResult;
  @property({ attribute: false }) renderDetail?: (node: TimelineNode) => TemplateResult;

  // Filter
  @property({ attribute: false }) activeFilters?: Set<string> | string[];

  // Transport
  @property({ attribute: false }) headers?: Record<string, string> | (() => Record<string, string>);

  // DataSourceMixin inherited: endpoint, loading, error, configure()
}
```

### Data Flow

**Precedence:** `data` takes precedence over `dataSet`. When `data` is set (non-null/undefined), the component uses it. When `data` is not set, the component uses `dataSet` from the DataSourceMixin fetch.

**Transform and compute:** The component resolves nodes in `willUpdate`:

```typescript
private _lastDataSet: unknown = undefined;

override willUpdate(changed: PropertyValues): void {
  super.willUpdate(changed);

  const dataChanged = changed.has('data') || changed.has('strategy')
    || this.dataSet !== this._lastDataSet;
  this._lastDataSet = this.dataSet;

  if (dataChanged && this.strategy) {
    const raw = this.data ?? this.dataSet;
    if (raw != null) {
      const transformed = this.strategy.transformData
        ? this.strategy.transformData(raw)
        : raw;
      this._nodes = this.strategy.toNodes(transformed);
    } else {
      this._nodes = [];
    }
  }
}
```

**Reactivity:** `data` is `@property({ attribute: false })` — Lit tracks reference changes and triggers re-render. When `data` changes, nodes are recomputed. `dataSet` is a getter on the mixin (not a reactive property), so the component tracks the last reference to detect changes.

**Loading/error states:** When `data` is set, the component renders from it regardless of `loading` or `error` state. Setting `endpoint` alongside `data` still triggers a fetch (the result lands in `dataSet`), but `data` takes precedence for rendering. This allows a consumer to provide initial inline data while a background refresh loads updated data from the endpoint.

### Headers

The `headers` property flows through to `fetchSource` in the component's `createSourceFactory()`:

```typescript
override createSourceFactory(): SourceFactory {
  return (url) => fetchSource(url, {
    headers: () => {
      const h = typeof this.headers === 'function' ? this.headers() : this.headers;
      return h ?? {};
    },
  });
}
```

Headers are evaluated lazily on each `connect()` — a `dataSource.refresh()` re-evaluates the header function, picking up changed state (e.g., rotated tokens). For multi-tenant deployments, consumers pass tenancy headers:

```typescript
<blocks-timeline
  .headers=${{ 'X-Tenancy-ID': identity?.tenancyId }}
  .strategy=${eventChronologyStrategy()}
  endpoint="/api/cases/123/events"
></blocks-timeline>
```

For `configure()` integration, components that receive `identity` via the host map it to headers:

```typescript
override configure(props: Record<string, unknown>): void {
  if (props.identity !== undefined) {
    const id = props.identity as WorkIdentity;
    this.headers = id?.tenancyId ? { 'X-Tenancy-ID': id.tenancyId } : undefined;
  }
  super.configure(props);
}
```

### Filter Behavior

**Initial state:** When `activeFilters` is not set but `strategy.filterCategories` is defined, all categories are shown (no filtering active). The filter UI renders with all categories toggled on.

**Missing categories:** Nodes with `category: undefined` are always visible regardless of active filters. Filters only hide nodes whose `category` is defined but not in the active set.

**Type flexibility:** `activeFilters` accepts both `Set<string>` and `string[]`. When an array is provided, the component wraps it in a `Set` internally.

### Events

The component emits `pages-event` CustomEvents for host integration. Events are generic — domain-specific routing belongs in the consumer.

| Topic | Trigger | Payload | Layouts |
|-------|---------|---------|---------|
| `timeline.node-selected` | Node click | `{ node: TimelineNode, index: number }` | vertical, horizontal |
| `timeline.expand-requested` | Compact strip click | `{}` | compact |

**`timeline.node-selected`** fires on any node click in vertical or horizontal layout. The consumer determines domain-specific actions from the node data:

```typescript
element.addEventListener('pages-event', (e) => {
  const { topic, payload } = e.detail;
  if (topic === 'timeline.node-selected') {
    const { node } = payload;
    if (node.category === 'task' && node.detail?.taskId) {
      emitPagesEvent(host, 'work-item.selected', { workItemId: node.detail.taskId });
    }
  }
});
```

**`timeline.expand-requested`** fires when the user clicks or activates (Enter/Space) the compact strip. The consumer responds by switching to full layout.

**Migration from case-timeline events:**
- `timeline.event-selected` → replaced by `timeline.node-selected` (same trigger, richer payload with full `TimelineNode`)
- `work-item.selected` → consumer routes from `timeline.node-selected` by checking `node.category` and `node.detail.taskId` (see example above)
- `timeline.expand-requested` → preserved as-is

**Clinical commitment-lifecycle:** The `commitment.stage-changed` event (emitted after data fetch) is not preserved. This was a data-arrival event, not a user-interaction event. Consumers listen for data changes via Lit property observation or DataSourceMixin lifecycle.

## Layout Renderers

Three built-in renderers, selected by `layout` property:

### Vertical
Current case-timeline full mode. Timestamp-anchored event list, left-aligned dot + content pattern, expandable detail sections. Best for variable-length chronological data.

### Horizontal
Current commitment-lifecycle pipeline. Connected nodes in a row, status colouring, actor/timestamp below each node. Best for fixed-stage state machines where "where are we now" matters.

### Compact
Current case-timeline compact mode. Dot strip with temporal weighting, click to expand to full view. Summary visualisation for embedding in cards or dashboards.

**Temporal weighting:** The compact renderer reads `TimelineNode.timestamp` on each node and computes proportional flex weights based on the time gap between consecutive events. Events clustered in time appear closer together; gaps in activity appear as larger spaces. This preserves the existing case-timeline `_temporalWeights()` behaviour. When timestamps are absent or all identical, nodes are evenly spaced.

**Truncation:** When more than 7 nodes are visible, the compact renderer shows the first 3 and last 2, with a "+N" indicator between them showing the hidden count. This preserves the existing case-timeline compact truncation (tested in case-timeline.test.ts lines 274-318). The threshold and split ratio are implementation constants — future configurability is not in scope.

### Connector Ownership

All three layout renderers own their connector rendering independently. Connectors are styled based on adjacent `TimelineNode.status` values — no external render callback is involved. Each layout uses the connector structure appropriate to its DOM:
- **Vertical:** CSS `::before` pseudo-element on the timeline container creates a continuous line
- **Horizontal:** `<div class="connector">` elements between stage nodes, coloured by completion status
- **Compact:** Single horizontal background line behind all dots

Layout renderers are internal — consumers select by name, not by providing renderer objects. Future layouts can be added without API changes.

## Shipped Strategies

### eventChronologyStrategy

Maps `CaseEvent[]` (or any `{ eventType, timestamp, payload, metadata }[]`) to timeline nodes.

```typescript
function eventChronologyStrategy(options?: {
  categorize?: (eventType: string) => string;
  streamTypes?: string[];
}): TimelineStrategy<CaseEvent[]>;
```

- Default layout: `vertical`
- Filter categories from `streamTypes` (CASE, WORKER, TIMER, SYSTEM, ORCHESTRATION)
- Default `renderNode`: category-coloured dot, event type badge, timestamp, optional worker/trust metadata
- Default `renderDetail`: `renderPropertyTree(payload)`
- Preserves current case-timeline rendering behaviour (visual output; event API is replaced — see §Events)
- `transformData`: handles both `CaseEvent[]` (inline / pre-extracted) and `PagedResponse<EventLogEntryResponse>` (raw backend response). When the input has a `.content` array property, extracts it; otherwise passes through as-is. This means consumers using `endpoint` don't need to pre-transform the paginated response — the strategy handles extraction.

### stateProgressionStrategy

Maps a state-machine shape to a pipeline of stages with current position.

```typescript
interface StageConfig {
  key: string;
  label: string;
  icon?: string;
  terminal?: 'success' | 'failure';
}

function stateProgressionStrategy(options?: {
  stages?: StageConfig[];
  resolveStatus?: (
    stage: StageConfig,
    currentState: string,
    transitions: Array<{ state: string; actor?: string; timestamp?: string }>,
    stages: readonly StageConfig[],
  ) => TimelineNode['status'];
}): TimelineStrategy<{ currentState: string; transitions?: Array<{ state: string; actor?: string; timestamp?: string }> }>;
```

- Default layout: `horizontal`
- Default stages: qhorus commitment states:
  ```typescript
  [
    { key: 'OPEN', label: 'Open' },
    { key: 'ACKNOWLEDGED', label: 'Acknowledged' },
    { key: 'FULFILLED', label: 'Fulfilled', terminal: 'success' },
    { key: 'DECLINED', label: 'Declined', terminal: 'failure' },
    { key: 'FAILED', label: 'Failed', terminal: 'failure' },
    { key: 'DELEGATED', label: 'Delegated' },
    { key: 'EXPIRED', label: 'Expired', terminal: 'failure' },
  ]
  ```
- Default `renderNode`: numbered circle with status colouring
- Default `renderDetail`: actor + timestamp below node
- Default `resolveStatus` derives status from transition history, not positional ordering:
  - **Stage is currentState:** `terminal: 'success'` → `'completed'`, `terminal: 'failure'` → `'failed'`, non-terminal → `'active'`
  - **Transitions provided and stage appears in transitions** → `'completed'`
  - **Transitions provided and stage not visited** → `'skipped'`
  - **No transitions provided** → `'pending'` (conservative — cannot determine visitation)
- No filter categories (fixed stage set)

The `terminal` field on `StageConfig` distinguishes success outcomes (FULFILLED → green/completed) from failure outcomes (DECLINED, FAILED, EXPIRED → red/failed). Non-terminal stages without `terminal` set behave as waypoints. The `resolveStatus` callback receives both transitions and the full `stages` array, giving custom implementations enough context to derive status from the actual state-machine path, positional ordering, or any combination. Callbacks with fewer parameters still compile — TypeScript allows assigning `(a, b, c) => R` to `(a, b, c, d) => R`.

**Linear pipeline helper:** The default `resolveStatus` is conservative — without transitions, all non-current stages show as "pending." This is correct for branching state machines (the primary use case) but produces a sparse UI for simple linear pipelines where the backend only provides `currentState`. For these cases, a companion function is shipped:

```typescript
function linearResolveStatus(
  stage: StageConfig,
  currentState: string,
  transitions: Array<{ state: string; actor?: string; timestamp?: string }>,
  stages: StageConfig[],
): TimelineNode['status'];
```

`linearResolveStatus` uses positional ordering: stages before `currentState` in the `stages` array are `'completed'`, `currentState` maps per its `terminal` field (same as the default), and stages after are `'pending'`. This is the pre-R1-01 algorithm — correct only when every stage before the current one was actually visited.

```typescript
// Branching state machine — use default (transitions recommended)
stateProgressionStrategy()

// Simple linear pipeline without transition data — opt-in positional
stateProgressionStrategy({ resolveStatus: linearResolveStatus })
```

Consumers should prefer providing `transitions` data rather than using `linearResolveStatus`. Even a minimal `transitions: [{ state: currentState }]` gives the default algorithm enough to show the current state correctly and everything else as skipped — more accurate than positional guessing.

## Data Pipeline Integration

The component extends `DataSourceMixin(LitElement)`:
- Set `endpoint` → mixin handles fetch lifecycle, loading/error states, refresh
- Set `data` → inline data takes precedence over endpoint-fetched `dataSet`
- `createSourceFactory()` can be overridden for custom fetch behaviour (see §Headers above)
- `headers` property provides request headers without requiring `createSourceFactory()` override

**Backend response handling:** The backend may return raw domain data or a transport envelope (e.g., `PagedResponse<EventLogEntryResponse>` with pagination fields). The component passes raw data to the strategy's `transformData` (when provided) before calling `toNodes`. Shipped strategies include `transformData` implementations that handle their known backend response shapes — `eventChronologyStrategy` extracts `.content` from paginated responses; `stateProgressionStrategy` passes through directly.

**Pagination:** The component fetches a single page and renders it. Load-more, infinite scroll, and multi-page aggregation are future enhancements (see #57).

## ARIA and Keyboard

Preserved from current case-timeline:
- `role="list"` / `role="listitem"` for vertical
- `role="img"` with summary label for compact
- Enter/Space to expand detail
- `aria-expanded` on expandable nodes
- `aria-live="polite"` announcements via LiveRegionMixin

Added for horizontal:
- `role="list"` with `aria-label="Commitment lifecycle"` and `aria-orientation="horizontal"`
- Nodes are `role="listitem"` within the list

**Arrow key direction per layout:**
- **Vertical:** ArrowUp/ArrowDown moves focus between nodes (preserves current case-timeline behaviour)
- **Horizontal:** ArrowLeft/ArrowRight moves focus between nodes (matches `aria-orientation="horizontal"`)
- **Compact:** No arrow key navigation — compact is `role="img"` with a single focusable element; Enter/Space triggers `timeline.expand-requested`

## File Structure

```
components/blocks-timeline/
  src/
    blocks-timeline.ts          # component
    types.ts                    # TimelineNode, Layout, TimelineStrategy
    strategies/
      event-chronology.ts       # eventChronologyStrategy
      state-progression.ts      # stateProgressionStrategy
    renderers/
      vertical.ts               # vertical layout render functions
      horizontal.ts             # horizontal layout render functions
      compact.ts                # compact layout render functions
    index.ts                    # public exports
  package.json
  tsconfig.json
  vitest.config.ts
```

## Migration

### Departure from issue #55 backward compatibility

Issue #55 requested that case-timeline's existing API continue working. This spec removes `<case-timeline>` entirely instead. The platform has no end users — breaking changes cost nothing externally, and a clean replacement forces every consumer to adopt the new strategy-based model explicitly rather than running two parallel implementations. The migration is mechanical (see patterns below).

### Element replacement

`components/case-timeline/` is replaced by `components/blocks-timeline/`. The `<case-timeline>` custom element tag is removed — consumers switch to `<blocks-timeline>` with `eventChronologyStrategy()`.

Before:
```typescript
<case-timeline case-id="123" endpoint="/api" mode="full"></case-timeline>
```

After:
```typescript
<blocks-timeline
  endpoint="/api/cases/123/events"
  .strategy=${eventChronologyStrategy()}
  .headers=${{ 'X-Tenancy-ID': identity?.tenancyId }}
  layout="vertical"
></blocks-timeline>
```

**`caseId` removal:** The existing case-timeline derives the URL from `endpoint + /cases/${caseId}/events` via `resolveEndpoint()`. The new component requires the full URL. Consumers constructing URLs from `caseId` do so in the template or host. Hosts that call `configure({ caseId, endpoint, identity })` must change to `configure({ endpoint: \`${endpoint}/cases/${caseId}/events\` })` and map identity to headers (see §Headers).

### Commitment lifecycle (replaces clinical's local component)

```typescript
<blocks-timeline
  endpoint="/api/commitments/456"
  .strategy=${stateProgressionStrategy()}
></blocks-timeline>
```

## Testing

- Unit tests for each strategy: `toNodes()` mapping, status resolution, edge cases (empty data, unknown states)
- Unit tests for each renderer: snapshot tests for vertical/horizontal/compact output
- Integration tests: component with each strategy + layout combination
- Keyboard navigation tests: arrow keys, expand/collapse
- ARIA tests: role attributes, live region announcements
- Existing case-timeline test coverage migrated and adapted

## What's Not In Scope

- SSE/streaming updates (DataSourceMixin handles refresh; real-time push is a future enhancement)
- Custom layout renderers (consumers select from the three built-ins; extensible later if needed)
- Gantt/parallel-track rendering (future strategy + layout, not this iteration)
