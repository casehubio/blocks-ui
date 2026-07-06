# pages-data-table Design Spec

**Issue:** casehubio/blocks-ui#22
**Date:** 2026-07-06
**Status:** Approved

## Context

Tables are the most common UI pattern across CaseHub applications. Multiple apps need tables and will all converge on the same one. The current `work-item-inbox` has hardcoded virtual scrolling (fixed 72px rows, translateY, activates at >50 items) tightly coupled to the inbox domain. The existing `PagesTable` in pages-viz is a basic `<table>`-element renderer coupled to the pages-runtime data pipeline — no virtual scrolling, no standalone usage. Both are being superseded by this component.

Build trajectory: standalone Lit Web Component in blocks-ui → test against work-item-inbox → promote to pages-primitives → migrate PagesTable consumers incrementally.

### Feature Parity with PagesTable

The existing `PagesTable` in pages-viz has features beyond what this spec delivers initially. Parity is required before removing PagesTable — consumers migrate only when the replacement covers their usage.

| Feature | PagesTable | pages-data-table (this spec) | Status |
|---------|-----------|------------------------------|--------|
| Pagination | Yes | Yes | In scope |
| Column sorting | Two-state toggle | Three-state cycle (asc/desc/none) | In scope (intentional improvement) |
| Virtual scrolling | No | Yes | In scope |
| Selection (single/multi) | Cross-filter click | Checkbox + keyboard | In scope |
| Row styling | Expression-based (`evaluateExpression`) | `getRowClass` callback | In scope (simpler API, same power) |
| Column visibility | No | Yes (column picker) | In scope |
| Text filter | Yes (toolbar filter box) | No — consumer filters `rows` before providing | Deferred (#29) |
| Tree/expandable rows | Yes (`buildTreeIndex`, expand state) | No | Deferred (#30) |
| CSV export | Yes (`tableToCsv`, `downloadCsv`, `copyToClipboard`) | No | Deferred (#31) |
| Cell expressions | Yes (`resolveColumnExpression`, `applyCellExpression`) | No — `render` function handles all formatting | Not needed (ColumnDef `render` subsumes this) |
| Cross-filter protocol | Yes (`pages-filter` event) | No — consumer handles via `selection-change` | Not needed (different interaction model) |
| Column name overrides | Yes (via `ColumnSettings.name`) | Not applicable — `ColumnDef.label` is authoritative | Not needed |

PagesTable removal happens only after deferred items are delivered and all pages-viz examples are migrated. The two components coexist until then.

## Data Model: ColumnDef\<R\>

The table uses a generic row type with column definitions that carry value extractors and optional renderers:

```typescript
interface ColumnDef<R = unknown> {
  readonly id: string;
  readonly label: string;
  readonly type?: 'text' | 'number' | 'date';
  readonly getValue: (row: R) => unknown;
  readonly render?: (value: unknown, row: R) => TemplateResult | string;
  readonly compare?: (a: unknown, b: unknown) => number;
  readonly sortable?: boolean;     // default: false
  readonly visible?: boolean;      // default: true
  readonly width?: string;         // CSS Grid value: '200px', '1fr', 'minmax(100px, 1fr)'
  readonly minWidth?: string;
  readonly align?: 'start' | 'center' | 'end';
}
```

**Why not TypedDataSet:** TypedDataSet is a data interchange format (columnar cells). ColumnDef\<R\> is a rendering contract — it tells the table how to project any shape into cells. The table doesn't need to know about the data's origin.

**TypedDataSet bridge (pages-runtime, out of scope for this spec):** When pages-runtime uses this table, it constructs ColumnDefs from YAML config + TypedDataSet metadata. This bridge is a factory function that maps TypedDataSet columns to ColumnDef[], handling: branded `ColumnId` → plain string id, `ColumnType` enum → ColumnDef type (LABEL maps to 'text'), `row.cell(columnId).value` → getValue closures, `ColumnSettings.name` → label, and `ColumnSettings.expression` → render functions via the existing `applyCellExpression` pipeline. This is a meaningful piece of code in pages-runtime — not trivial, but fully contained in the runtime layer with no impact on this component's API.

## Component API

### Element

`<pages-data-table>` — registered with `pages-` prefix from the start since it's destined for pages-primitives.

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `rows` | `readonly unknown[]` | `[]` | Data to display |
| `columns` | `readonly ColumnDef[]` | `[]` | Column definitions with value extractors |
| `getRowKey` | `(row: unknown) => string` | — | Row identity for selection + keyed rendering |
| `getRowClass` | `(row: unknown) => string` | — | Per-row CSS part name for external styling (e.g., priority borders) |
| `mode` | `'auto' \| 'paginated' \| 'scroll'` | `'auto'` | Display mode |
| `pageSize` | `number` | `25` | Rows per page (paginated mode) |
| `currentPage` | `number` | `0` | Current page (paginated mode) |
| `totalRows` | `number \| undefined` | — | Total rows for server-side pagination |
| `rowHeight` | `number` | `48` | Row height in px (scroll mode and auto > 50) |
| `bufferSize` | `number` | `5` | Extra rows above/below viewport (scroll mode and auto > 50) |
| `hasMore` | `boolean` | `false` | Enables load-more events (scroll mode only) |
| `selection` | `'none' \| 'single' \| 'multi'` | `'none'` | Selection mode |
| `selectedKeys` | `readonly string[]` | — | Externally controlled selection (controlled mode) |
| `sortColumnId` | `string \| undefined` | — | Current sort column |
| `sortDirection` | `'asc' \| 'desc' \| 'none'` | `'none'` | Current sort direction |
| `clientSort` | `boolean` | `false` | Table sorts data internally |
| `loading` | `boolean` | `false` | Show loading state |
| `emptyMessage` | `string` | `'No data'` | Message when no rows |

### Events

| Event | Detail | When |
|-------|--------|------|
| `sort-change` | `{ columnId, direction }` | User clicks sortable column header |
| `page-change` | `{ page, pageSize }` | User navigates pages |
| `selection-change` | `{ selectedKeys, selectedRows, scope? }` | Selection changes (`scope: 'page'` on server-side paginated select-all) |
| `column-change` | `{ visibleColumns: string[] }` | User toggles column visibility |
| `load-more` | `{}` | Scroll mode, near bottom, `hasMore` is true |
| `row-activate` | `{ row, key? }` | Single-click in single-selection mode; double-click or Enter in all modes. `key` is present only when `getRowKey` is provided; `undefined` otherwise (valid in `none` mode where `getRowKey` is optional). |

All events: `bubbles: true, composed: true`.

## Display Modes

### `auto` (default)
Automatically selects rendering strategy based on row count:
- **≤ 50 rows**: renders all rows directly (no controls, no virtualization)
- **> 50 rows**: activates virtual scrolling with the configured `rowHeight` and `bufferSize`

The threshold (50) matches the existing work-item-inbox behavior. This prevents accidental DOM explosion when consumers pass large datasets without explicitly choosing a mode.

**Property applicability when auto activates virtual scrolling (> 50 rows):**
- `rowHeight` and `bufferSize`: **apply** — used by the virtual scroll engine
- `hasMore` / `load-more`: **do not apply** — infinite scroll requires explicit `mode="scroll"`. Auto mode renders a finite dataset; if the consumer has streaming data, they should choose scroll mode deliberately.
- `pageSize`, `currentPage`, `totalRows`: **ignored** — these are paginated-mode properties. Setting `pageSize` in auto mode has no effect.

### `paginated`
**Client-side** (default, `totalRows` not set): table receives all rows, slices internally by `currentPage * pageSize`. Page controls rendered.

**Server-side** (`totalRows` set): table receives only the current page's rows. Page controls use `totalRows` for page count. Emits `page-change` — consumer fetches the requested page and provides new rows.

**Page controls**: first/prev/next/last buttons, "Page N of M" display, rows-per-page selector, "Showing X–Y of Z" range.

### `scroll`
Virtual scrolling — renders only visible rows + buffer. Uses a pure-function scroll engine:

```
computeScrollWindow(scrollTop, containerHeight, rowHeight, rowCount, bufferSize)
  → { startIndex, endIndex, offsetY, totalHeight }
```

**Infinite scroll**: when `hasMore` is true and the user scrolls near the bottom, emits `load-more`. Consumer appends data to `rows`. Internal `loadingMore` state prevents duplicate events.

## Rendering Architecture

### CSS Grid (not `<table>`)

Each row is a CSS Grid container. Column widths derived from ColumnDef `width` properties:

```css
grid-template-columns: [40px] 1fr 120px minmax(100px, 1fr) 60px;
/*                     ^checkbox (multi only)                    */
```

CSS Grid enables:
- Virtual scroll via absolute positioning (impossible with `<tr>`)
- Future column spanning via `grid-column: span N`
- Future row spanning via `grid-row: span N`
- Dynamic column widths via `grid-template-columns`

### Structure

```
div.data-table[role="grid"]
  div.header[role="row"]           ← column headers with sort indicators
  div.body                         ← overflow-y: auto
    div.body-content               ← height: totalHeight (scroll mode spacer)
      div.row[role="row"]          ← transform: translateY (scroll mode)
        div.cell[role="gridcell"]
  div.footer                       ← pagination controls (paginated mode only)
```

### Row Styling via CSS `::part()`

Rows render inside the table's shadow DOM, so CSS class names are unreachable from outside the shadow boundary. The table exposes each body row with a `part` attribute for external styling:

```html
<div class="row" role="row" part="row priority-urgent">
<!--                              ^    ^               -->
<!--                       base part   getRowClass()   -->
```

Every body row has `part="row"`. If `getRowClass` is provided, its return value is appended as additional part names. Consumers style rows from outside the shadow DOM:

```css
pages-data-table::part(row) {
  /* base row styles */
}
pages-data-table::part(priority-urgent) {
  border-left: 3px solid var(--blocks-danger-9, #dc2626);
}
pages-data-table::part(priority-high) {
  border-left: 3px solid var(--blocks-warning-9, #d97706);
}
```

The header row is exposed as `part="header-row"`. Cells are not individually exposed as parts — cell-level styling is handled by `ColumnDef.render` returning styled TemplateResult.

### Cell Rendering Pipeline

1. `column.getValue(row)` → raw value
2. If `column.render` exists → `render(value, row)` → TemplateResult or string
3. Else format by `column.type`: `'date'` → toLocaleDateString, `'number'` → toLocaleString, `'text'`/unset → String coercion
4. `column.align` → `text-align` on cell

## Selection

**`none`**: no selection UI. `row-activate` still fires.

**`single`**: click selects one row and emits `selection-change`. No checkbox column. In single-selection mode, click both selects and activates — `selection-change` fires first, then `row-activate`. This matches the existing inbox pattern where clicking a row selects it and shows the detail view. Double-click and Enter also activate.

**`multi`**: checkbox column auto-prepended. Click checkbox to toggle. Click row body to select exclusively. Shift+click for range. Header checkbox for select-all with mixed state. In multi-selection mode, single-click does NOT fire `row-activate` — it only selects. Activation requires double-click or Enter. This prevents accidental navigation while building a multi-selection.

Selection state is a `Set<string>` of keys from `getRowKey`. Survives data re-provision (sort, filter changes).

**`getRowKey` is required when selection is enabled.** If `selection !== 'none'` and `getRowKey` is not provided, the component throws an Error at first render. Index-based identity causes data corruption with virtual scrolling and sort changes — selected indices would point to wrong rows after reordering. This is not a warning-worthy situation; it's a data integrity invariant.

### Select-All Behavior by Mode

**auto mode (≤ 50 rows):** Select-all toggles all rows in the `rows` array.

**auto mode (> 50 rows, virtual scrolling active):** Select-all iterates the full `rows` array, not just rendered elements. All rows are selected regardless of DOM presence.

**paginated mode (client-side):** Select-all selects all rows on the current page only. The header checkbox reflects current-page state.

**paginated mode (server-side, `totalRows` set):** Select-all selects all rows on the current page only. The table has no access to off-page data. The `selection-change` event includes a `scope: 'page'` field so consumers can distinguish page-level from full-dataset selection and show appropriate UI (e.g., "All N items on this page are selected").

**scroll mode:** Select-all iterates the full `rows` array, selecting all keys. DOM-resident rows update immediately; off-screen rows' keys are added to the selection Set.

**Controlled mode**: when `selectedKeys` is set, it's the source of truth. Table emits `selection-change`, consumer updates `selectedKeys`.

**Uncontrolled mode**: when `selectedKeys` is not set, table manages selection internally.

## Client-Side Sorting

When `clientSort` is true, the table sorts rows internally. When false (default), it emits `sort-change` and renders sort indicators only.

Click cycles: `none → asc → desc → none`.

Comparator resolution:
1. `column.compare` (custom) if provided
2. By `column.type`: number → numeric, date → Date.getTime(), text → localeCompare
3. Fallback: String coercion + localeCompare
4. Nulls sort last in all cases

Stable sort guaranteed (ES2019 spec). Single-column only.

## Column Visibility

Column picker: dropdown trigger button in header area showing all columns with checkboxes. Toggling emits `column-change` with new visible column IDs. At least one column must remain visible (last column's checkbox disabled).

Table does not persist visibility state — consumer stores and provides updated column definitions.

### Grid Template Computation

The `grid-template-columns` value is computed from **visible** ColumnDefs only. Hidden columns (those with `visible: false`) are excluded entirely from the template — not given `0fr`. The component generates the template string:

1. If `selection === 'multi'`, prepend `40px` for the checkbox column
2. For each visible ColumnDef (in definition order): use `width` if set, else `1fr`
3. Apply the resulting template to both the header row and all body rows

The component owns template generation — consumers never provide the template string directly.

## Responsive Behavior

The table uses horizontal scrolling as its default responsive strategy:

- The body container has `overflow-x: auto` — when columns exceed container width, a horizontal scrollbar appears
- The header row scrolls in sync with the body (shared scroll container)
- Cell content uses `text-overflow: ellipsis` with `white-space: nowrap` by default
- Column `minWidth` prevents columns from shrinking below a readable threshold

Responsive column hiding and alternative layouts are the consumer's responsibility — achieved by updating `visible` on ColumnDefs and re-providing the columns array. The table does not implement breakpoint-based column hiding internally.

## Keyboard Navigation

The table implements 2D grid navigation internally. RovingTabindexMixin (both the blocks-ui-core and pages-primitives versions) is 1D only — it navigates a flat element list linearly. Neither version supports row × column coordinate mapping required by WAI-ARIA grid pattern.

**Approach:** The table does NOT compose RovingTabindexMixin for cell navigation. Instead, it implements grid keyboard navigation directly using a `(rowIndex, colIndex)` coordinate pair as internal focus state. Row-level focus uses `rovingSelector` on row elements for tab-into-grid behavior (first tab into the grid focuses the active row). Cell-level navigation within a row is handled by the component's own keydown handler.

This grid navigation logic is a candidate for extraction into a `GridNavigationMixin` in pages-primitives once a second grid component needs it. For now, it lives in the data-table component.

| Key | Action |
|-----|--------|
| `ArrowDown` / `ArrowUp` | Focus same column in next/previous row |
| `ArrowRight` / `ArrowLeft` | Focus next/previous cell in current row |
| `Home` | Focus first cell in current row (`Ctrl+Home`: first cell of first row) |
| `End` | Focus last cell in current row (`Ctrl+End`: last cell of last row) |
| `Enter` | Activate focused row |
| `Space` | Multi mode: toggle selection |
| `Shift+ArrowDown/Up` | Multi mode: extend selection range |
| `Escape` | Clear selection |
| `Ctrl/Cmd+A` | Multi mode: select all |

Page change → focus first row of new page.

**Virtual scroll keyboard navigation:** When keyboard navigation targets a row outside the currently rendered window (e.g., ArrowDown at the last visible row), the component:
1. Updates the scroll container's `scrollTop` to bring the target row's position into view
2. The scroll event triggers `computeScrollWindow`, which renders the target row into the DOM
3. Focus moves to the target row's cell at the current `colIndex`

This scroll-into-view behavior is imperative — the keyboard handler sets `scrollTop` directly, then the reactive scroll pipeline handles rendering. The focus coordinate `(rowIndex, colIndex)` is maintained in component state independently of the DOM, so the focus target is always known even when the target row doesn't exist in the DOM yet.

## ARIA

| Element | Role | Key Attributes |
|---------|------|---------------|
| Container | `grid` | `aria-rowcount`, `aria-colcount`, `aria-label`, `aria-busy` |
| Header row | `row` | — |
| Header cell | `columnheader` | `aria-sort` |
| Body row | `row` | `aria-rowindex` (1-based, full dataset), `aria-selected` |
| Body cell | `gridcell` | — |
| Checkboxes | `checkbox` | `aria-checked` (including `mixed` on header) |
| Page controls | `navigation` | `aria-label="Table pagination"` |

## Package Structure

```
components/data-table/
  package.json            # @casehubio/blocks-ui-data-table
  tsconfig.json
  src/
    pages-data-table.ts
    pages-data-table.test.ts
    virtual-scroll-engine.ts
    virtual-scroll-engine.test.ts
    sort.ts
    sort.test.ts
    types.ts
    index.ts
```

Dependencies: `lit`, `@casehubio/blocks-ui-core`. No pages-runtime, pages-data, or domain dependencies.

## Motivating Example: Inbox Refactor

This section illustrates how the table component would be used by `work-item-inbox` — it is **not** a deliverable of this spec. The actual inbox refactor is tracked in #32 and depends on this component being stable.

The inbox currently owns ~165 lines of virtual scrolling, selection, and row rendering logic. With pages-data-table, it would become a domain orchestrator (tabs, SSE, domain filtering, batch operations) that passes filtered data to the table.

`work-item-row`'s rendering would move into ColumnDef `render` functions. Per-row priority borders would use `getRowClass`. The inbox's existing selection model (`Set<string>` with shift+click range) maps directly to multi-selection mode with `selectedKeys`.

```typescript
private tableColumns: ColumnDef<WorkItemRootResponse>[] = [
  { id: 'title', label: 'Title', sortable: true, width: '1fr',
    getValue: r => r.item.title },
  { id: 'status', label: 'Status', sortable: true, width: '120px',
    getValue: r => r.item.status,
    render: v => html`<span class="status-pill">${v}</span>` },
  { id: 'category', label: 'Category', width: '140px',
    getValue: r => r.item.category ?? '' },
  { id: 'created', label: 'Age', type: 'date', width: '60px',
    getValue: r => r.item.createdAt,
    render: v => relativeTime(v as string) },
];
```

## Future Extensibility

Architecturally supported, not implemented now:
- **Row/column spanning**: CSS Grid + layout phase between scroll engine and renderer
- **Multi-column sort**: sort state becomes `{ columnId, direction }[]`
- **Tree/expandable rows**: additional row metadata + indent rendering
- **Column resizing**: drag handles + dynamic grid-template-columns
- **CSV export**: iterate rows × columns calling getValue
- **Text filter**: consumer filters data before providing to table

## Garden Entries Considered

- **GE-20260621-fe3944**: Table filter event needs both row object and rowIndex. Addressed: `row-activate` and `selection-change` emit both row objects and keys.
- **GE-20260705-7c80f2**: Lit Set/Map mutation doesn't trigger re-render. Addressed: selection state creates new Set on every mutation; selectedKeys is a readonly array (new reference on change).
- **GE-20260706-9335b9**: Shadow DOM CSS custom properties override theme tokens. Addressed: table uses `var(--blocks-*, fallback)` pattern, no `:host` property declarations that would shadow inherited tokens.
