# TypedDataSet Native — Unified Data Pipeline

**Issue:** [#49](https://github.com/casehubio/blocks-ui/issues/49)
**Date:** 2026-07-11

## Problem

The pages data layer provides `TypedDataSet` — a rich, type-safe data model with branded `ColumnId`, discriminated `CellValue` union, and typed row accessors (`cell()`, `number()`, `text()`, `date()`). But Lit-based components never see it.

The type safety is lost at `DataReceiver.dataSet: unknown` — the interface-level declaration in pages-component. `DataSourceController` handles TypedDataSet internally (append/replace/remove all cast to it, `SnapshotEvent.dataset` is typed `TypedDataSet`), but exposes the property as `unknown`. Everything downstream inherits the loss: `DataSourceAdapter`, `DataSourceMixin`, every consumer.

Separately, `fetchSource` (blocks-ui) bypasses the pages extraction pipeline entirely — it does `r.json()` then `sink.apply({ type: "snapshot", dataset: data as never })`. No tabulation, no type conversion, no `TypedRow` construction. Raw JSON masquerades as `TypedDataSet`.

Meanwhile, `pages-data-table` has its own parallel type system: `ColumnDef<R>` with `getValue: (row: R) => unknown` and `render: (value, row) => TemplateResult`. This exists solely because the pipeline wasn't producing TypedDataSet — consumers needed extractors to reach into untyped domain objects.

## Core Insight

A fetch is just a single-event push. The only difference between HTTP fetch, WebSocket push, SSE stream, inline YAML, and simulated data is the **originator** — the trigger that causes data to appear. Once data arrives, the processing is identical: extract → tabulate → convert → TypedDataSet → propagate through the state machine.

The pages resolver already does this: `provider.fetch()` → `extractDataSet()` → `manager.apply(id, { type: "snapshot", dataset })`. `fetchSource` should follow the same pattern instead of bypassing the pipeline.

### Why ColumnDef\<R\> is superseded

The approved data-table spec (2026-07-06) chose `ColumnDef<R>` over TypedDataSet with the rationale: "TypedDataSet is a data interchange format (columnar cells). ColumnDef\<R\> is a rendering contract — it tells the table how to project any shape into cells. The table doesn't need to know about the data's origin."

That reasoning was correct when `fetchSource` bypassed extraction — data arrived as raw JSON (`unknown`), and consumers needed `getValue` extractors to project domain shapes into cells. `ColumnDef<R>.getValue` served as the missing extraction step that the pipeline should have provided.

With the pipeline unification, the premise changes:

1. All data flows through `extractDataSet` → arrives as TypedDataSet with typed cells
2. The "projection from any shape into cells" happens in the extraction pipeline, not in getValue
3. `ColumnDef<R>.getValue` becomes redundant for pipeline data — cells are already projected

The rendering contract splits into focused, independently-varying concerns:

- **Data schema** — from TypedDataSet.columns (Column with ColumnId, name, ColumnType). Determined by the pipeline/source.
- **Cell rendering** — via `columnRenderers` (ColumnId → render function). Determined by the consumer.
- **Presentation config** — via TableColumnConfig (label override, width, sortable). Determined by layout.

This separation is architecturally cleaner than ColumnDef's bundled approach. Each concern varies independently: data schema is set by the pipeline, rendering by the consumer, presentation by layout preferences.

For in-memory domain data (not pipeline-produced), the `fromRows()` factory absorbs `getValue`'s extraction role at construction time — domain-typed extractors produce TypedDataSet, which the table then renders uniformly.

## Design

### Unified pipeline model

All data sources — regardless of originator — produce TypedDataSet through the same extraction pipeline:

```
originator (HTTP / WS / SSE / inline / simulated)
  → raw data arrives
  → extraction pipeline (parse → navigate → tabulate → convert)
  → TypedDataSet
  → sink.apply({ type: "snapshot", dataset })
  → DataSourceController.dataSet: TypedDataSet | undefined
  → consumers
```

The requestor (component) declares the schema it expects via `ExternalColumnDef[]`. The pipeline uses declared columns for tabulation; when absent, it infers from the data shape.

### Pages-data type changes (prerequisite)

**ExtractionDef — narrowed type for extractDataSet:**

`extractDataSet` currently takes `ExternalDataSetDef` which requires `uuid: DataSetId`. The function never uses `uuid` — it only uses extraction-relevant fields (`dataPath`, `type`, `expression`, `columns`, `url`, `content`, `accumulate`). Extract these into a focused type:

```typescript
export interface ExtractionDef {
  readonly url?: string;
  readonly content?: string;
  readonly dataPath?: string;
  readonly type?: string;
  readonly expression?: string;
  readonly columns?: readonly ExternalColumnDef[];
  readonly accumulate?: boolean;
}
```

`ExternalDataSetDef` extends `ExtractionDef`, adding identity (`uuid`, `name`) and request fields (`method`, `headers`, etc.). `extractDataSet` changes its parameter type from `ExternalDataSetDef` to `ExtractionDef`.

**SnapshotEvent — pagination metadata:**

```typescript
export interface SnapshotEvent {
  readonly type: "snapshot";
  readonly dataset: TypedDataSet;
  readonly totalRows?: number;
}
```

The optional `totalRows` carries server-reported pagination totals through the event system. Backwards-compatible — existing snapshot emitters don't set it and existing handlers ignore unknown fields.

**fromRows() — in-memory domain data construction:**

Components that work with in-memory domain objects (not URL-fetched data) need a path to construct TypedDataSet:

```typescript
export function fromRows<R>(
  rows: readonly R[],
  columns: readonly {
    readonly id: ColumnId;
    readonly name?: string;
    readonly type: ColumnType;
    readonly getValue: (row: R) => unknown;
  }[],
): TypedDataSet
```

Extracts values from each row via `getValue`, converts to `CellValue`, and produces TypedDataSet with proper `TypedRow` instances (with working `cell()`, `number()`, `text()`, `date()` accessors).

Example — trust-score-panel building from capability data:
```typescript
const capabilities = Object.entries(this._trustData.capabilityScores)
  .map(([tag, score]) => ({ tag, score }));

const dataset = fromRows(capabilities, [
  { id: columnId("tag"), name: "Capability", type: ColumnType.TEXT, getValue: c => c.tag },
  { id: columnId("score"), name: "Score", type: ColumnType.NUMBER, getValue: c => c.score },
]);
```

This preserves domain-typed ergonomics (compile-time safety on `c.tag`, `c.score` with IDE autocomplete) while producing TypedDataSet as the universal table input. The extraction concern is resolved at construction time, not at render time.

### Changes by layer

#### Layer 1 — Fix the contract (pages-component)

`DataReceiver.dataSet` changes from `unknown` to `TypedDataSet | undefined`:

```typescript
export interface DataReceiver {
  loading: boolean;
  dataSet: TypedDataSet | undefined;
  error: string;
}
```

`DataSourceController._dataSet` follows: `private _dataSet: TypedDataSet | undefined = undefined`.

The getter/setter pair types correctly. No runtime change — the value is already TypedDataSet.

#### Layer 2 — Extend SourceFactory (pages-component)

`SourceFactory` gains column declarations so the requestor can declare the expected schema:

```typescript
export interface SourceFactoryOptions {
  readonly columns?: readonly ExternalColumnDef[];
  readonly dataPath?: string;
  readonly totalPath?: string;
}

export type SourceFactory = (
  url: string,
  id: DataSetId,
  options?: SourceFactoryOptions,
) => DataSource;
```

`DataSourceControllerOptions` adds `columns?: readonly ExternalColumnDef[]`, `dataPath?: string`, and `totalPath?: string`. The controller passes them to the factory when creating a source from a URL.

`DataSourceController.handleEvent` for "snapshot" propagates totalRows:

```typescript
case "snapshot":
  this.dataSet = event.dataset;
  if (event.totalRows !== undefined) this.totalRows = event.totalRows;
  break;
```

#### Layer 3 — Fix fetchSource (blocks-ui → blocks-ui-core)

`fetchSource` uses the extraction pipeline on the response. `FetchSourceOptions` gains `columns?: readonly ExternalColumnDef[]`:

```typescript
export interface FetchSourceOptions {
  readonly method?: string;
  readonly headers?: Record<string, string> | (() => Record<string, string>);
  readonly body?: string;
  readonly fetchFn?: typeof globalThis.fetch;
  readonly columns?: readonly ExternalColumnDef[];
  readonly dataPath?: string;
  readonly totalPath?: string;
}
```

On response, instead of `dataset: data as never`:

```typescript
const contentType = r.headers.get("content-type") ?? undefined;
const result: FetchResult = { data, contentType };
const def: ExtractionDef = { columns: options?.columns, dataPath: options?.dataPath };

// Extract pagination metadata before extraction navigates into the data array
let totalRows: number | undefined;
if (options?.totalPath) {
  totalRows = navigatePath(data, options.totalPath);
}

try {
  const { dataset } = await extractDataSet(result, def, emptyPresetRegistry);
  sink.apply({ type: "snapshot", dataset, totalRows });
} catch (err) {
  sink.error({
    message: err instanceof Error ? err.message : String(err),
    permanent: true,
  });
}
```

`navigatePath` is a utility that walks dot-separated paths (e.g., `"total"` or `"meta.totalCount"`) on a JSON object. Trivial implementation shared with the extraction pipeline's own path navigation.

`extractDataSet` takes a `PresetRegistry` for expression-based extraction presets. `fetchSource` passes an empty registry — it doesn't use expression presets. A shared `emptyPresetRegistry` constant avoids allocations.

Extraction errors (malformed JSON, unrecognized data shape) are caught and routed to `sink.error()` — they surface as the component's `error` state rather than producing unhandled rejections.

This means `fetchSource` needs access to `extractDataSet` and `ExtractionDef` from `@casehubio/pages-data`. Since blocks-ui-core already depends on `@casehubio/pages-data` (for `DataSource`, `DataSink`, `TypedDataSet`, `createTypedRow`), this is a natural extension.

The `as never` cast is deleted. The sink receives real TypedDataSet with working `TypedRow` accessors.

#### Layer 4 — Fix the table (pages-data-table → pages-table)

**Package rename:** `@casehubio/pages-data-table` → `@casehubio/pages-table`
**Element rename:** `<pages-data-table>` → `<pages-table>`
**Class rename:** `PagesDataTable` → `PagesTable`

**Primary API — TypedDataSet:**

```typescript
@property({ attribute: false }) dataSet?: TypedDataSet;
```

Columns come from `dataSet.columns`. Rows come from `dataSet.rows`. The table reads cell values via `TypedRow.cell(columnId)`. Default formatting driven by `ColumnType`:
- `NUMBER` → `toLocaleString()`
- `DATE` → `toLocaleDateString()`
- `TEXT` / `LABEL` → raw string

**Custom cell rendering:**

```typescript
@property({ attribute: false }) columnRenderers?: ReadonlyMap<
  ColumnId,
  (cell: CellValue, row: TypedRow, column: Column) => TemplateResult | string
>;
```

Replaces `ColumnDef.render`. The renderer receives the typed cell value and the full row for cross-column access (`row.text(otherCol)`).

**Column configuration:**

```typescript
export interface TableColumnConfig {
  readonly id: ColumnId;
  readonly label?: string;        // override Column.name for display
  readonly sortable?: boolean;
  readonly visible?: boolean;
  readonly width?: string;
  readonly minWidth?: string;
  readonly align?: ColumnAlign;
  readonly filterable?: boolean;
  readonly compare?: (a: CellValue, b: CellValue) => number;
}
```

```typescript
@property({ attribute: false }) columnConfig?: readonly TableColumnConfig[];
```

This separates data schema (from TypedDataSet) from column-level configuration (from the consumer). When absent, all columns render with defaults derived from Column metadata.

`compare` provides custom sort ordering per column. When absent, the table dispatches on `CellValue.type`: TEXT → `localeCompare`, NUMBER → numeric subtraction, DATE → timestamp comparison, NULL → nulls last. This covers the same use cases as the old `ColumnDef.compare` (e.g., priority ordering where "critical" > "high" > "medium") but operates on `CellValue` rather than raw `unknown`.

**Client-side sort and filter with TypedDataSet:**

With TypedDataSet as input, `clientSort` and `clientFilter` change their internal implementation:

- **Value extraction:** `col.getValue(row)` → `row.cell(columnId)`. Returns `CellValue` (discriminated union with `.type` and `.value`).
- **Sort comparison:** `col.compare ?? resolveByType(col.type)` → `config.compare ?? resolveByType(cell.type)`. The type dispatch moves from the column declaration to the cell's own type discriminant. `createMultiComparator` takes `TableColumnConfig[]` (for `compare` overrides) instead of `ColumnDef[]`.
- **Filter text extraction:** `col.filterValue?.(row) ?? String(col.getValue(row))` → `String(cell.value)`. The `filterValue` custom extractor from ColumnDef is dropped — it has zero usages in the codebase (declared in the type but never provided by any consumer). The default `String(cell.value)` suffices.

The sort module (`sort.ts`) is updated: `createComparator` takes `TableColumnConfig` instead of `ColumnDef`; `createMultiComparator` extracts values via `row.cell(columnId)` instead of `col.getValue(row)`.

**ColumnDef is deleted.** The parallel type system goes away. `types.ts` retains `DisplayMode`, `SelectionMode`, `SortDirection`, event detail types, and adds `TableColumnConfig`.

**Retained properties:** `mode`, `selection`, `selectedKeys`, `getRowKey`, `loading`, `emptyMessage`, `rowHeight`, `bufferSize`, `pageSize`, `currentPage`, `totalRows`, `hasMore`, `clientSort`, `clientFilter`, `filterText`, sort properties, tree-table support (`getChildren`).

**getRowKey:** Changes from `(row: unknown) => string` to `(row: TypedRow) => string`. Consumers typically use a key column: `(row) => row.text(idColumn)`.

**getChildren (tree-table):** Changes to `(row: TypedRow) => readonly TypedRow[]`. Components that use tree-table must provide children as TypedRow instances.

#### Layer 5 — Propagate types through blocks-ui

`DataSourceAdapter.dataSet` → `TypedDataSet | undefined` (mirrors the controller).

`DataSourceMixin.dataSet` → `TypedDataSet | undefined` (mirrors the adapter).

`DataSourceMixin.createSourceFactory()` passes declared columns, dataPath, and totalPath through to `fetchSource`:

```typescript
createSourceFactory(): SourceFactory {
  return (url, _id, options) => fetchSource(url, {
    columns: options?.columns,
    dataPath: options?.dataPath,
    totalPath: options?.totalPath,
  });
}
```

Components declare their columns in `DataSourceControllerOptions`:

```typescript
readonly dataSource = new DataSourceAdapter(this, {
  sourceFactory: this.createSourceFactory(),
  columns: [
    { id: columnId("tag"), type: ColumnType.TEXT },
    { id: columnId("score"), type: ColumnType.NUMBER },
  ],
});
```

#### Layer 6 — Migrate consumers (blocks-ui)

Each consumer that currently extracts from `unknown` and builds `ColumnDef[]` migrates:

| Consumer | Current pattern | After |
|----------|----------------|-------|
| `list-pane` | `this.dataSet as any`, `Array.isArray()` check, separate `columns: ColumnDef[]` prop | passes `dataSet` to table; configures `dataPath`/`totalPath` for paginated endpoints; replaces `columns` prop with `columnConfig` and `columnRenderers` |
| `trust-score-panel` | builds capability array, wrong ColumnDef field names (`key`/`header`) | uses `fromRows()` to build TypedDataSet from capability data, uses `columnRenderers` for score bars |
| `audit-trail-viewer` | `entries.dataSet as LedgerEntry[]`, passes `.data=` (wrong prop name) | pipeline delivers TypedDataSet; uses `columnRenderers` for timestamps/badges; domain filtering operates on TypedRow |
| `work-item-inbox` | direct fetch, `ColumnDef<WorkItemRootResponse>` with `getValue` extractors | declares columns, pipeline produces TypedDataSet, uses `columnRenderers` |
| `notification-inbox` | `ColumnDef` with custom renderers | same pattern as work-item-inbox |
| `subscription-list` | `ColumnDef` with custom renderers | same pattern |

**list-pane public API migration:**

- **Removed:** `columns: ColumnDef<any>[]` — no longer needed; data schema comes from TypedDataSet
- **Added:** `columnConfig?: readonly TableColumnConfig[]` — presentation overrides (label, width, sortable)
- **Added:** `columnRenderers?: ReadonlyMap<ColumnId, ...>` — custom cell rendering

For paginated endpoints returning `{ items: [...], total: N }`, list-pane configures `dataPath: "items"` and `totalPath: "total"` in its DataSourceAdapter options. The pipeline navigates to `items` for extraction; `fetchSource` separately extracts `total` and delivers it via `SnapshotEvent.totalRows` → `DataSourceController.totalRows`.

Consumers currently providing ColumnDef arrays from outside:
```typescript
// Before:
<list-pane .columns=${[
  { id: 'title', label: 'Title', getValue: r => r.title, sortable: true },
  { id: 'status', label: 'Status', render: v => statusBadge(v) },
]} endpoint="...">

// After:
<list-pane
  .columnConfig=${[
    { id: columnId('title'), label: 'Title', sortable: true },
    { id: columnId('status'), label: 'Status' },
  ]}
  .columnRenderers=${new Map([
    [columnId('status'), (cell) => statusBadge(cell.value)],
  ])}
  endpoint="..."
>
```

**Note:** `trust-score-panel` and `audit-trail-viewer` have existing bugs (wrong ColumnDef property names, wrong element property). These are fixed as part of migration, not separately.

### VizTarget cascade

The type change `DataReceiver.dataSet: unknown → TypedDataSet | undefined` cascades through `VizTarget`:

| Affected | Change | Runtime impact |
|----------|--------|----------------|
| `VizTarget extends DataReceiver` (pages-component) | `dataSet: TypedDataSet \| undefined` | Type-only — already TypedDataSet at runtime |
| `DataSourceController implements VizTarget` (pages-component) | `_dataSet: TypedDataSet \| undefined` | None — already stores TypedDataSet internally |
| `createHostPanelProxy()` (pages-runtime activation.ts:74) | Proxy getter/setter types update | None — passes through unchanged |
| `PagesElement` subclasses (pages-viz) | Inherit typed `dataSet` | None — receive TypedDataSet from pipeline |
| `DataSourceAdapter.dataSet` (blocks-ui-core) | Mirrors controller type | None — pass-through |
| `DataSourceMixin.dataSet` (blocks-ui-core) | Mirrors adapter type | None — pass-through |

All VizTarget implementors already receive TypedDataSet at runtime. The type change makes the compile-time contract match the runtime reality.

**DataSourceController.handleEvent structural compliance:** The append/replace/remove handlers construct `{ columns: ds.columns, rows }`. These satisfy `TypedDataSet` structurally because `TypedDataSet` is an interface (not a class). The `rows` arrays contain existing `TypedRow` instances (spread/filtered from the current dataset), so `TypedRow` methods (`cell()`, `number()`, `text()`, `date()`) are preserved. No runtime change needed.

### Cross-repo scope and sequencing

| Change | Repo | Package |
|--------|------|---------|
| ExtractionDef type, extractDataSet signature | pages | pages-data |
| SnapshotEvent.totalRows | pages | pages-data |
| fromRows() factory | pages | pages-data |
| DataReceiver.dataSet type (Layer 1) | pages | pages-component |
| SourceFactory signature (Layer 2) | pages | pages-component |
| DataSourceController totalRows propagation | pages | pages-component |
| Table redesign (Layer 4) | pages | pages-data-table → pages-table |
| fetchSource pipeline integration (Layer 3) | blocks-ui | blocks-ui-core |
| DataSourceAdapter/Mixin types (Layer 5) | blocks-ui | blocks-ui-core |
| Consumer migration (Layer 6) | blocks-ui | components/* |

**PR sequencing:**
1. **Pages PR 1** — Type foundations: ExtractionDef, fromRows(), SnapshotEvent.totalRows, DataReceiver type change, SourceFactory extension. Publish new pages-data and pages-component versions.
2. **Pages PR 2** — Table redesign: pages-data-table → pages-table, ColumnDef deletion, TypedDataSet primary API. Publish.
3. **Blocks-ui PR** — Pipeline integration and consumer migration: Layers 3, 5, 6. Depends on both published pages versions.

### What doesn't change

- `TypedDataSet`, `TypedRow`, `CellValue`, `Column`, `ColumnType` — unchanged
- `toTypedDataSet()`, `createTypedRow()` — unchanged, just called from more places
- The extraction pipeline (`extractDataSet`, `tabulate`) — unchanged logic; signature narrows from `ExternalDataSetDef` to `ExtractionDef`
- `DataSetEvent` types (append/replace/remove) — unchanged. SnapshotEvent gains optional `totalRows`
- `DataSourceController` lifecycle (connect/disconnect/refresh) — unchanged
- The pages-runtime data pipeline (`data-pipeline.ts`) — unchanged
- pages-runtime activation for `type: "table"` — creates `pages-table` element, sets `dataSet` (already the right pattern; the element rename registers a real component for this tag name — currently unregistered since the old PagesTable was already removed)

### Activation system integration

`activation.ts` creates elements via `pages-${component.type}`. For `type: "table"`, this produces `<pages-table>`. Currently no `pages-table` custom element is registered — the old `PagesTable` in pages-viz has already been removed, so `document.createElement("pages-table")` creates an unregistered (dead) element.

The rename from `pages-data-table` to `pages-table` **fixes** activation: registering the Lit `PagesTable` as the `pages-table` custom element gives the activation system a real component to resolve to. This is functionally necessary, not cosmetic — without it, `type: "table"` panels have no working element. No activation code changes needed; the element registration is the fix.

### Design notes (garden entries to be created)

These observations should be captured as garden entries during implementation:

- `HTMLElement.dataset` is reserved. The table property is `dataSet` (camelCase), not `dataset`. No conflict — but document the naming hazard.
- `TypedRow.cell()` is safe (discriminated union), `.number()` throws on NULL/mismatch. Custom renderers should use `cell()` and check the discriminant, not call `.number()` blindly.
- Two-cache-field pattern for multi-source mixins. Relevant if DataSourceMixin caches both the TypedDataSet and derived state.
- TS strict-mode setter contravariance. May apply if `PagesTable` explicitly implements an interface with a `dataSet` setter.

## Scope

**In scope:** Layers 1–6 above. The pipeline unification, contract fix, table redesign, and consumer migration.

**Out of scope (follow-up issues):**
- Recovering 43 old PagesTable tests for TypedDataSet integration ([#50](https://github.com/casehubio/blocks-ui/issues/50))
- `kpi-metric-row` and `case-timeline` TypedDataSet migration (they don't use data-table; separate issue)
- Row/column spanning (#26) — orthogonal feature
