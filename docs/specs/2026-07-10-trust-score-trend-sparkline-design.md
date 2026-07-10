# Trust Score Trend Sparkline Design

**Issue:** casehubio/blocks-ui#45
**Date:** 2026-07-10
**Status:** Approved

## Problem

The trust-score-panel's trend section shows a hardcoded placeholder:
"Trend data requires backend endpoint." The DataSource pipeline
(`simulated()`, `inlineSource()`, `ScenarioController`) from pages-data
is designed for exactly this — providing synthetic or live data without a
backend.

## Decision Summary

- Extract `renderSparkline()` from kpi-metric-row into blocks-ui-core as
  a shared utility
- Create `TrendSourceMixin` in blocks-ui-core — standardises the
  "primary data + time-series trend" pattern for dashboard components
- Add `TrendSourceMixin` to trust-score-panel's class hierarchy
- Replace the placeholder with a trust-level-colored SVG sparkline
- Examples page uses `simulated()` for live-updating demo and `trendData`
  for static historical import

## Data Model

### TrendPoint

```typescript
export interface TrendPoint {
  readonly timestamp: number;  // epoch ms
  readonly score: number;      // 0–1
}
```

Simple, serializable, no platform-specific types. Common currency between
the mixin, sparkline renderer, and consumers.

### TypedDataSet extraction

When `trendSource` delivers a `TypedDataSet` (from `inlineSource()` or
`simulated()`), the mixin extracts `TrendPoint[]` via a named extraction
function:

```typescript
function extractTrendPoints(dataSet: TypedDataSet): TrendPoint[] {
  const tsCol = dataSet.columns.find(c => c.name === 'timestamp');
  const scoreCol = dataSet.columns.find(c => c.name === 'score');
  if (!tsCol || !scoreCol) return [];
  const points: TrendPoint[] = [];
  for (const row of dataSet.rows) {
    const tsCell = row.cell(tsCol.id);
    const scoreCell = row.cell(scoreCol.id);
    if (tsCell.type === 'NULL' || scoreCell.type === 'NULL') continue;
    if (tsCell.type !== ColumnType.NUMBER || scoreCell.type !== ColumnType.NUMBER) continue;
    points.push({ timestamp: tsCell.value, score: scoreCell.value });
  }
  return points;
}
```

- **Column lookup:** by `Column.name` property (not positional index),
  case-sensitive match against the convention names `timestamp` and `score`.
- **Missing columns:** returns empty array — no `trendError`. The data
  arrived successfully; column mismatch is a developer configuration issue
  that surfaces as "no trend data" rather than a runtime error.
- **Safe cell access:** uses `row.cell()` (returns `CellValue` discriminated
  union, never throws) instead of `row.number()` (throws `DataSetError` on
  NULL or type mismatch). Invalid rows are silently skipped — a single
  malformed row must not crash the component.
- **`ColumnId` resolution:** `tsCol.id` and `scoreCol.id` provide the
  branded `ColumnId` values needed by `row.cell()`.

### Precedence

`trendData` (direct import) wins over `trendSource` (DataSource). If
both are set, `trendData` is used.

**Adapter lifecycle:** the adapter always connects when `trendSource` is
set, regardless of whether `trendData` is present. Precedence affects only
the `trendPoints` getter, not the adapter lifecycle. This ensures adapter
data is immediately available when `trendData` is cleared.

## TrendSourceMixin

**Location:** `packages/blocks-ui-core/src/data-source/trend-source-mixin.ts`

### Public API

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `trendSource` | `DataSource` | `undefined` | Programmatic DataSource (simulated, inline, REST, SSE) |
| `trendData` | `TrendPoint[]` | `undefined` | Direct import path — historical data, demos, examples |
| `maxTrendPoints` | `number` | `30` | Rolling window cap |
| `trendPoints` | `TrendPoint[]` (readonly) | `[]` | Resolved array, capped to maxTrendPoints |
| `trendLoading` | `boolean` (readonly) | `false` | Adapter loading state |
| `trendError` | `string` (readonly) | `""` | Adapter error state |

### Behavior

- Creates a `DataSourceAdapter` in the constructor — Lit's
  `ReactiveController` protocol handles connect/disconnect lifecycle.
  The adapter's `onChange` callback triggers extraction and caching.
- When `trendSource` changes → sets adapter's `source`. Adapter connects,
  receives `TypedDataSet` snapshots/appends. On each onChange, the mixin
  runs `extractTrendPoints()`, sorts by timestamp ascending, and stores
  the result in `_adapterTrendPoints`.
- When `trendData` changes → sorts in `willUpdate`, stores in
  `_directTrendPoints`. Adapter not involved.
- **Two separate cache fields** prevent precedence violation:
  - `_adapterTrendPoints: TrendPoint[]` — populated by adapter onChange,
    always runs regardless of `trendData` state (adapter stays connected
    per the adapter lifecycle rule).
  - `_directTrendPoints: TrendPoint[]` — populated in willUpdate when
    `trendData` changes.
- `trendPoints` getter resolves precedence and applies `maxTrendPoints`:
  ```typescript
  get trendPoints(): TrendPoint[] {
    const source = this.trendData !== undefined
      ? this._directTrendPoints
      : this._adapterTrendPoints;
    return source.slice(-this.maxTrendPoints);
  }
  ```
  Extraction and sorting are cached (expensive). Slicing happens in the
  getter (cheap, O(n) for ≤50 points) so it always reflects the current
  `maxTrendPoints` value without cache invalidation.
- `trendLoading`/`trendError` delegate to adapter (always `false`/`""`
  when using `trendData`).
- No `trendEndpoint` attribute — trend data comes via `DataSource` objects
  or direct import.

## Shared Sparkline Renderer

**Location:** `packages/blocks-ui-core/src/sparkline/render-sparkline.ts`

### API

```typescript
export interface SparklineOptions {
  readonly width?: number;    // default 80
  readonly height?: number;   // default 24
  readonly color?: string;    // stroke/fill color, default 'currentColor'
  readonly domain?: [number, number];  // fixed Y-axis range, default auto-scale
}

export function renderSparkline(
  data: readonly number[],
  options?: SparklineOptions,
): TemplateResult;
```

### Rendering

SVG polyline for the stroke, polygon for the filled area beneath with a
gradient fade. Pure template — no DOM, no state.

**Y-axis scaling:** when `domain` is provided, uses the fixed range for
Y-axis mapping. When omitted, auto-scales from data min/max (with
`range = max - min || 1` fallback). Trust-score-panel passes
`domain: [0, 1]` for absolute magnitude display consistent with the gauge;
kpi-metric-row omits domain and auto-scales for generic metrics.

**Edge cases:**
- **empty array** → empty TemplateResult (no SVG emitted)
- **single point** → empty TemplateResult (can't draw a line)
- **two points** → valid SVG with a single line segment

### Gradient ID uniqueness

Generates a unique ID per invocation (simple counter) to avoid collisions
when multiple sparklines render on the same page.

### kpi-metric-row migration

Replace local `renderSparkline()` with import from
`@casehubio/blocks-ui-core`. Pass `{ width: 48, height: 20 }` to
preserve current dimensions.

**Bug fix:** the shared renderer generates unique gradient IDs per
invocation, fixing an existing gradient collision in kpi-metric-row.
The current hardcoded `id="spark-fill"` collides when multiple cards
within the same shadow root have sparklines — only the first gradient
definition applies. This is a behavioral improvement, not a no-op
migration.

## Trust-Score-Panel Changes

### Class hierarchy

```typescript
export class TrustScorePanel extends
  TrendSourceMixin(DataSourceMixin(LiveRegionMixin(LitElement)))
```

### Render

Replace the trend placeholder in `_renderFullMode()` with
`_renderTrendSection()`:

- `trendLoading` → loading spinner
- `trendError` → error message with `role="alert"`
- `trendPoints.length < 2` → existing placeholder (graceful degradation)
- Otherwise → `renderSparkline(scores, { width: 200, height: 48, color, domain: [0, 1] })`
  where `color` maps from current trust level via `TRUST_LEVEL_COLORS`

### Trust-level colors

```typescript
const TRUST_LEVEL_COLORS = {
  high: 'var(--color-success, #28a745)',
  adequate: 'var(--color-warning, #ffc107)',
  low: 'var(--color-error, #dc3545)',
  none: 'var(--color-neutral, #ccc)',
};
```

Single shared constant — replaces the inline color map in the existing
`_renderScoreGauge()` and provides the sparkline color. CSS custom
properties with hex fallbacks, consistent with the component's existing
CSS (`.score-bar-fill` classes use the same custom property names).

**Single sparkline color by design.** The entire sparkline renders in the
color of the *current* trust level. This is deliberate: the sparkline's
shape tells the trend story (rising, falling, stable), while its color
provides current-status context. At 200×48px, a per-point gradient would
be noisy and hard to read. The color ties the sparkline visually to the
adjacent gauge, reinforcing "this trend belongs to this status."

### ARIA

Sparkline SVG gets `role="img"` and `aria-label` describing the trend
(e.g. "Trust score trend: 30 data points, current 0.87").

### No API breakage

Existing properties (`endpoint`, `actorId`, `mode`, `score`,
`trustLevel`) are untouched. The mixin adds trend properties
orthogonally.

## Examples Page

### Live demo (simulated source)

1. `createScenarioController()` — one per page, controls scenario time.
2. `inlineSource()` with ~10 historical data points as
   `[{id, timestamp, score}]`. Columns: `id` (TEXT, key), `timestamp`
   (NUMBER), `score` (NUMBER).
3. `simulated()` wrapping the inline initial, with `addRow` mutation
   appending a new score point every few seconds (jittered around
   current global score). The controller's internal dataSet grows
   unboundedly via append events — the `addRow` mutation does not
   currently support `maxRows`. The mixin's cached extraction is
   bounded by `maxTrendPoints`, so rendering cost stays constant.
   Controller growth is acceptable for demo pages (~36KB/hour at
   5-second intervals). See casehubio/pages#TBD for adding `maxRows`
   support to the `addRow` mutation.
4. `.trendSource` set on the full-mode panel. `maxTrendPoints` caps
   rendering.
5. Play/pause control wired to `scenarioController.play()`/`pause()`.

### Static demo (trendData import)

Second panel instance using `.trendData` with a hardcoded `TrendPoint[]`
array, showing the direct import path.

## Testing Strategy

### blocks-ui-core — renderSparkline

- Valid SVG for normal data (3+ points)
- Edge cases: empty array → empty TemplateResult, single point →
  empty TemplateResult, two points → valid SVG with single line segment
- Respects width, height, color options
- `domain: [0, 1]` → Y-axis maps to fixed range (not auto-scaled)
- No domain → auto-scales from data min/max
- Unique gradient IDs (no collisions across multiple invocations)

### blocks-ui-core — TrendSourceMixin

- `trendData` set → `trendPoints` returns data capped to
  `maxTrendPoints`
- `trendSource` set → adapter connects, snapshot → `trendPoints`
  populated
- `trendSource` with append events → accumulates, respects window
- Precedence: `trendData` wins over `trendSource`
- `trendData` cleared → falls back to adapter data
- Adapter lifecycle: `trendSource` set when `trendData` present →
  adapter connects (data available when trendData cleared)
- `trendLoading`/`trendError` reflect adapter state when `trendSource`
  active
- Disconnect lifecycle: new `trendSource` disconnects previous
- `extractTrendPoints`: missing columns → empty array, no error
- `extractTrendPoints`: NULL cells → row skipped silently
- `extractTrendPoints`: type mismatch cells → row skipped silently
- `trendPoints` sorted by timestamp ascending
- Non-chronological data → sorted correctly in output
- Cached extraction: trendPoints not recomputed across multiple renders
  without data change
- Precedence with both sources active: trendData set + adapter snapshot
  arrives → trendPoints returns trendData, not adapter data
- trendData cleared after adapter received data → trendPoints returns
  adapter data immediately (no delay, no re-fetch)
- maxTrendPoints changed at runtime → trendPoints reflects new cap
  without requiring data change

### trust-score-panel

- With `trendData` → renders sparkline, correct trust-level color
- Without trend data → placeholder shown
- With `trendSource` → sparkline updates on data events
- Loading/error states render correctly
- ARIA label reflects trend data
- Compact mode unaffected

### kpi-metric-row

- Existing tests pass after extracting renderSparkline
- Gradient ID collision fix: verify multiple cards with sparklines each
  get independent gradient references

### examples page

Manual verification — run dev server, confirm live-updating sparkline,
play/pause, static import.

## File Inventory

| File | Action |
|------|--------|
| `packages/blocks-ui-core/src/sparkline/render-sparkline.ts` | New — shared sparkline renderer |
| `packages/blocks-ui-core/src/sparkline/index.ts` | New — barrel export |
| `packages/blocks-ui-core/src/data-source/trend-source-mixin.ts` | New — TrendSourceMixin |
| `packages/blocks-ui-core/src/data-source/trend-types.ts` | New — TrendPoint type |
| `packages/blocks-ui-core/src/index.ts` | Update — export sparkline + trend |
| `components/kpi-metric-row/src/kpi-metric-row.ts` | Update — import shared renderSparkline |
| `components/trust-score-panel/src/trust-score-panel.ts` | Update — add TrendSourceMixin, render sparkline |
| `examples/src/pages/trust-score-page.ts` | Update — live + static trend demos |
| Test files for each of the above | New/update |
