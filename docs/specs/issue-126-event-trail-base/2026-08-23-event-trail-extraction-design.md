# Event Trail Extraction Design

**Issue:** casehubio/blocks-ui#126
**Date:** 2026-08-23
**Covers:** blocks-ui#126, casehub-pages#354

## Problem

`blocks-audit-trail-viewer` (695 lines) is saturated with ledger-specific concerns at every layer: LedgerEntry data model, Merkle verification banner, attestation UI, hardcoded `/api/v1/ledger/` endpoints. IoT #103 needs a filterable event table with expandable details but can't reuse this component.

Stripping the ledger concerns reveals two reusable patterns:
1. A **filter bar UX** (type chips, entity dropdown, date range) — domain-agnostic, operates on column values
2. An **event trail composition** (filter bar + pages-table + data lifecycle + detail expansion) — domain-aware, shared by event-viewing use cases

## Architecture

Two components at two platform layers, built in order:

```
casehub-pages (layer 1 — UI primitives)
└── pages-filter-bar          ← new: standalone filter bar

blocks-ui (layer 2 — domain-aware shared components)
└── blocks-event-trail        ← new: composes pages-filter-bar + pages-table
└── blocks-audit-trail-viewer ← refactored: composes blocks-event-trail
```

---

## Part 1: `<pages-filter-bar>` (casehub-pages#354)

A standalone filter bar component in casehub-pages that composes above any `pages-table`.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `dataSet` | `TypedDataSet` | Dataset to extract unique values from (for entity dropdown) |
| `chipField` | `ColumnId` | Column whose values populate type chips |
| `chipValues` | `string[]` | Explicit chip labels (overrides auto-extraction from dataSet) |
| `entityField` | `ColumnId` | Column whose unique values populate the entity dropdown |
| `entityLabel` | `string` | Dropdown label (e.g. "Actor", "Device"). Defaults to column name. |
| `showDateRange` | `boolean` | Show from/to date inputs. Default false. |
| `dateFromLabel` | `string` | Label for "from" input. Default "From". |
| `dateToLabel` | `string` | Label for "to" input. Default "To". |

Each filter type is activated by setting its field property. Omitting `chipField` hides chips; omitting `entityField` hides the dropdown; `showDateRange=false` hides dates.

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `filter-change` | `FilterState` | Emitted on any filter interaction |

```typescript
interface FilterState {
  selectedChips: Set<string>;        // empty = no chip filter
  selectedEntity: string | null;     // null = all entities
  dateFrom: string;                  // '' = no lower bound
  dateTo: string;                    // '' = no upper bound
}
```

### Internal state

- `_selectedChips: Set<string>` — toggle on click, ARIA checkbox pattern
- `_selectedEntity: string | null` — custom dropdown (NOT native `<select>` — shadow root positioning bugs per ARC42STORIES.MD §6 and channel-nav precedent)
- `_dateFrom: string`, `_dateTo: string` — date inputs

### Entity dropdown

Use the custom dropdown pattern from `channel-nav` (keyboard navigation, `position: absolute`, focus management). Extract unique values from `dataSet` column `entityField`. Show "All {entityLabel}" as default option.

### Rendering

```
┌─────────────────────────────────────────────────────────┐
│ [CHIP1] [CHIP2] [CHIP3]  │  Actor: [▼ All ]  │  From: [____] To: [____] │
└─────────────────────────────────────────────────────────┘
```

Horizontal flex layout with sections separated by gaps. Wraps on narrow viewports. Styled with `--pages-*` CSS custom properties.

### ARIA

- Host: `role="toolbar"`, `aria-label="Filters"`
- Chips: `role="checkbox"`, `aria-checked`
- Entity dropdown: `role="listbox"` with `aria-expanded`, `aria-activedescendant`
- Date inputs: standard `<input type="date">` with `<label>`

### Styling

Uses `--pages-*` CSS custom properties. Chip styles match the established pattern (neutral background, accent when selected, 16px border-radius). Filter sections flex-wrap on narrow viewports.

---

## Part 2: `<blocks-event-trail>` (blocks-ui#126)

A concrete Web Component composing `pages-filter-bar` + `pages-table` with DataSourceMixin lifecycle.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `endpoint` | `string` | Base URL for fetching entries (DataSourceMixin) |
| `data` | `unknown[]` | Inline data for dual data mode (demos/testing) |
| `columnDefs` | `ColDef[]` | Column definitions for `fromRows` conversion |
| `columnConfig` | `TableColumnConfig[]` | pages-table column visibility/sort config |
| `columnRenderers` | `Map<ColumnId, ColumnRenderer>` | Per-column render callbacks |
| `chipField` | `ColumnId` | Forwarded to pages-filter-bar |
| `chipValues` | `string[]` | Forwarded to pages-filter-bar |
| `entityField` | `ColumnId` | Forwarded to pages-filter-bar |
| `entityLabel` | `string` | Forwarded to pages-filter-bar |
| `showDateRange` | `boolean` | Forwarded to pages-filter-bar |
| `getRowDetail` | `(row: TypedRow) => TemplateResult \| undefined` | Expandable detail render callback |
| `getRowKey` | `(row: TypedRow) => string` | Row identity for expansion tracking |

### Data lifecycle

Uses DataSourceMixin with two overrides:

**`createSourceFactory()`** — custom fetch that stores raw entries alongside TypedDataSet:
```typescript
override createSourceFactory(): SourceFactory {
  return (url) => {
    let abort: AbortController | undefined;
    return {
      connect: (sink) => {
        abort = new AbortController();
        const signal = abort.signal;
        globalThis.fetch(url, { signal })
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then((entries: unknown[]) => {
            if (signal.aborted) return;
            this._rawEntries = entries;
            const dataset = fromRows(entries, this.columnDefs);
            sink.apply({ type: 'snapshot', dataset });
          })
          .catch(err => {
            if (signal.aborted || err.name === 'AbortError') return;
            sink.error({ message: err instanceof Error ? err.message : String(err), permanent: true });
          });
      },
      disconnect: () => { abort?.abort(); abort = undefined; },
    };
  };
}
```

**`resolveEndpoint()`** — adds date range params, supports dual data mode:
```typescript
override resolveEndpoint(): string | undefined {
  if (this.data) return undefined; // dual data mode: inline data wins
  if (!this.endpoint) return undefined;
  const url = new URL(this.endpoint, globalThis.location?.origin ?? 'http://localhost');
  if (this._dateFrom) url.searchParams.set('from', this._dateFrom);
  if (this._dateTo) url.searchParams.set('to', this._dateTo);
  return url.toString();
}
```

Consumer sets `endpoint` to the full domain URL including domain-specific params. blocks-event-trail only adds its own generic params (date range).

When `data` is set (dual data mode), `resolveEndpoint()` returns undefined (disabling fetch) and `willUpdate` converts the inline array via `fromRows`.

### Filter integration

Listens for `filter-change` from pages-filter-bar. Applies client-side filtering on `_rawEntries`, then re-creates the TypedDataSet via `fromRows`:

```typescript
private _handleFilterChange(e: CustomEvent<FilterState>): void {
  this._filterState = e.detail;
  this._applyFilters();
}

private _applyFilters(): void {
  const chipGetter = this.chipField
    ? this.columnDefs.find(c => c.id === this.chipField)?.getValue
    : undefined;
  const entityGetter = this.entityField
    ? this.columnDefs.find(c => c.id === this.entityField)?.getValue
    : undefined;

  const filtered = this._rawEntries.filter(entry => {
    if (this._filterState.selectedChips.size > 0 && chipGetter) {
      if (!this._filterState.selectedChips.has(String(chipGetter(entry)))) return false;
    }
    if (this._filterState.selectedEntity && entityGetter) {
      if (String(entityGetter(entry)) !== this._filterState.selectedEntity) return false;
    }
    return true;
  });
  this._filteredDataSet = fromRows(filtered, this.columnDefs);
}
```

Date range filtering is server-side (via `resolveEndpoint` query params). Chip and entity filtering are client-side (applied to raw entries).

### Detail expansion

Passthrough to pages-table:
- `detailMode="single"` always
- `expandedDetailKeys` managed internally (single string or empty array)
- `getRowDetail` forwarded directly
- `getRowKey` forwarded directly
- `detail-change` event forwarded to consumers

### Rendering

```typescript
render() {
  if (this.loading) return html`<div class="loading">Loading...</div>`;
  if (this.error) return html`<div class="error" role="alert">...</div>`;

  return html`
    <pages-filter-bar
      .dataSet=${this.dataSet}
      .chipField=${this.chipField}
      .chipValues=${this.chipValues}
      .entityField=${this.entityField}
      .entityLabel=${this.entityLabel}
      ?showDateRange=${this.showDateRange}
      @filter-change=${this._handleFilterChange}
    ></pages-filter-bar>
    <pages-table
      .dataSet=${this._filteredDataSet ?? this.dataSet}
      .columnConfig=${this.columnConfig}
      .columnRenderers=${this.columnRenderers}
      .getRowKey=${this.getRowKey}
      .getRowDetail=${this.getRowDetail}
      detailMode="single"
      .expandedDetailKeys=${this._expandedKey ? [this._expandedKey] : []}
      client-sort
      @detail-change=${this._handleDetailChange}
    ></pages-table>
  `;
}
```

### configure()

Standard hostPanel integration:
```typescript
configure(props: Record<string, unknown>): void {
  if (props.endpoint !== undefined) this.endpoint = props.endpoint as string;
  if (props.data !== undefined) this.data = props.data as unknown[];
  // Forward all filter-related props
  queueMicrotask(() => this.refresh());
}
```

### ARIA

- Host: `role="region"`, `aria-label="Event trail"`
- Loading: `aria-busy="true"`
- Error: `role="alert"`
- Filter bar and table provide their own ARIA

---

## Part 3: `blocks-audit-trail-viewer` refactor

Refactored to compose `<blocks-event-trail>` internally. Drops from 695 lines to ~200.

### What stays in audit-trail-viewer

- **Verification banner** — second DataSourceAdapter for `/api/v1/ledger/verify` endpoint. Renders Merkle chain status (verified/redacted/failed) with tree root hash.
- **Attestation detail** — `getRowDetail` callback that renders ledger entry details (digest, traceId, causedByEntryId, payload) plus attestation badges (SOUND/FLAGGED/ENDORSED/CHALLENGED) fetched on demand.
- **Ledger column definitions** — `ENTRY_COL_DEFS`, `ENTRY_COL_CONFIG`, `ENTRY_RENDERERS` with ledger-specific formatting (timestamp, actor+type badge, entry type, truncated digest).
- **Domain types** — `LedgerEntry`, `VerificationResult`, `Attestation`, `EntryTypeFilter` stay in `types.ts`.
- **Endpoint construction** — builds the full ledger URL with `subjectId`, `tenancyId` and sets it on blocks-event-trail's `endpoint` property.

### What moves to blocks-event-trail

- Filter state management (selected actor, selected types, date range)
- Filter bar rendering (actor dropdown, type chips, date range inputs) → now in pages-filter-bar
- DataSourceAdapter lifecycle for entries (loading, error, refresh)
- `fromRows` conversion
- Detail expansion state (`expandedDetailKeys`, single-expansion logic)
- Generic CSS (filter controls, chips, loading/error states)

### What moves to pages-filter-bar

- Filter bar HTML rendering (actor dropdown, type chips, date range inputs)
- Chip toggle logic
- Actor dropdown rendering
- Date range input handling
- Filter bar CSS (filter-controls, filter-section, chip styles)

### Refactored structure

```typescript
@customElement('blocks-audit-trail-viewer')
export class AuditTrailViewer extends LiveRegionMixin(LitElement) {
  @property({ type: String }) endpoint?: string;
  @property({ type: Object }) identity?: WorkIdentity;
  @property({ type: String, attribute: 'subject-id' }) subjectId?: string;
  @property({ type: Object }) renderEntryPayload?: (entry: LedgerEntry) => TemplateResult | undefined;

  // Verification — own DataSourceAdapter (ledger-specific)
  readonly verify = new DataSourceAdapter(this, {
    sourceFactory: (url) => this._createVerifySource(url),
  });

  @state() private _verification: VerificationResult | null = null;
  @state() private _attestations: Map<string, Attestation[]> = new Map();

  // Builds full ledger URL, sets on blocks-event-trail
  private _buildLedgerEndpoint(): string | undefined { ... }

  // getRowDetail callback with attestation rendering
  private _getRowDetail = (row: TypedRow): TemplateResult | undefined => { ... };

  render() {
    return html`
      ${this._renderVerificationBanner()}
      <blocks-event-trail
        .endpoint=${this._buildLedgerEndpoint()}
        .columnDefs=${ENTRY_COL_DEFS}
        .columnConfig=${ENTRY_COL_CONFIG}
        .columnRenderers=${ENTRY_RENDERERS}
        .chipField=${ENTRY_TYPE_COL}
        .chipValues=${['COMMAND', 'EVENT', 'ATTESTATION']}
        .entityField=${ACTOR_ID_COL}
        entityLabel="Actor"
        showDateRange
        .getRowDetail=${this._getRowDetail}
        .getRowKey=${(row: TypedRow) => row.text(ID_COL)}
        @detail-change=${this._handleDetailChange}
      ></blocks-event-trail>
    `;
  }
}
```

---

## Package structure

### casehub-pages
- `packages/pages-filter-bar/` — new package
  - `src/pages-filter-bar.ts` — component
  - `src/types.ts` — FilterState interface
  - `src/index.ts` — exports
  - `package.json`, `tsconfig.json`

### blocks-ui
- `components/event-trail/` — new package
  - `src/event-trail.ts` — component
  - `src/index.ts` — exports
  - `package.json`, `tsconfig.json`
- `components/audit-trail-viewer/` — refactored (no new files, no removed files)

## Build order (slot execution)

1. **casehub-pages:** Create `pages-filter-bar`, build, `yarn build && mvn install` to publish SNAPSHOT
2. **blocks-ui:** Add casehub-pages SNAPSHOT dependency (if not already present), create `event-trail` component consuming `pages-filter-bar`
3. **blocks-ui:** Refactor `audit-trail-viewer` to compose `blocks-event-trail`
4. **blocks-ui:** Update tests, run `yarn build && yarn test && yarn typecheck`

## Testing

### pages-filter-bar
- Renders chips from `chipValues`
- Renders entity dropdown from `dataSet` unique values
- Renders date range inputs when `showDateRange=true`
- Emits `filter-change` on chip toggle with correct FilterState
- Emits `filter-change` on entity selection
- Emits `filter-change` on date input
- Hides each filter section when its field property is omitted
- ARIA: role="toolbar", chips have role="checkbox" + aria-checked
- Custom dropdown keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)

### blocks-event-trail
- Fetches from endpoint and renders table
- Applies chip filter (client-side)
- Applies entity filter (client-side)
- Date range params appear in fetch URL
- Dual data mode: renders from `data` property when set
- getRowDetail callback renders expanded content
- Single expansion: only one row expanded at a time
- configure() sets properties and triggers refresh
- ARIA: role="region", aria-label, aria-busy during loading

### audit-trail-viewer (regression)
- Verification banner still renders (verified/redacted/failed)
- Attestations still load on detail expand
- Filters still work (type chips, actor dropdown, date range)
- All existing external API (endpoint, identity, subjectId, renderEntryPayload) unchanged

## References

- casehubio/blocks-ui#126 — primary issue
- casehubio/casehub-pages#354 — pages-filter-bar issue
- casehubio/iot#103 — first external consumer (future)
- casehubio/iot#95 — decision review that identified the extraction opportunity
- PP-20260713-8ea1af — component customisation pattern (typed config + render callbacks)
- GE-20260712-7250c5 — DataSourceMixin extraction pipeline destroys non-tabular responses
- GE-20260810-9264db — LedgerEntry metadata/payload field name mismatch
- ARC42STORIES.MD §6 — native `<select>` shadow root positioning bugs
- Decision review R1-02 — standalone filter-bar alternative (adopted)
- Decision review R1-04 — buildQueryParams has zero precedent (D4 revised)
