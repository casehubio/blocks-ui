# Generic Workbench Components + AML Migration

**Date:** 2026-07-08
**Issue:** #37 (AML promotion), #35 (cross-repo migration tracking)
**Status:** Design approved

## Problem

AML built `<case-workbench>`, `<case-list-pane>`, `<case-detail-pane>`, and `tab-registry.ts` locally because blocks-ui's `<work-item-workbench>` hardcodes its children. The layout pattern is identical (split-pane, draggable divider, responsive collapse, keyboard shortcuts, selection coordination via events) but the existing workbench can't accept different children.

The core issue is composability — each domain needs different children in the same layout shell.

## Design Principles

- **Composition over configuration.** The workbench is a layout shell. Children are slotted in. No configuration object that tries to describe all possible children.
- **Each component has one job.** Workbench = layout. List pane = data display + selection. Detail pane = tabbed content.
- **Children control their own state.** Empty states, loading states, error states belong to the child, not the parent.
- **Events for coordination, properties for configuration.** Selection flows via `pages-event` on `document`. Column definitions, tabs, endpoints flow via properties.
- **Name by layout pattern, not by domain.** `split-workbench` describes the pattern. Other workbench patterns (dashboard, wizard, tree-detail) will emerge from other domain repos (e.g. clinical). Each gets a pattern-based name and coexists in the component library.
- **Pipeline-ready.** Use `DataEndpointMixin` now. Swap to `DataSourceMixin` when casehub-pages#145 lands (one-line mixin change per component, no public API change).

## Prerequisites

### Migrate event topics from dots to colons

`WorkItemEventTopics` in `blocks-ui-core/src/types/events.ts` uses dot separators (`work-item.selected`), but the pages-data `matchesTopic()` protocol splits on colons. AML already uses colons (`case:selected`). All blocks-ui event topics must be migrated to colon separators before the generic components can use topic-prefix concatenation:

```typescript
// Before:
export const WorkItemEventTopics = {
  SELECTED: 'work-item.selected',
  DESELECTED: 'work-item.deselected',
  QUEUE_SCOPE_CHANGED: 'queue.scope-changed',
} as const;

// After:
export const WorkItemEventTopics = {
  SELECTED: 'work-item:selected',
  DESELECTED: 'work-item:deselected',
  QUEUE_SCOPE_CHANGED: 'queue:scope-changed',
} as const;
```

All existing call sites use the constants — the migration is a constant-value change, not a call-site refactoring.

### Fix DataEndpointMixin endpoint guard

`DataEndpointMixin._doFetch()` uses `if (!this.endpoint) return;` and `willUpdate` uses `this.endpoint` (truthy check). Both block empty-string endpoints. Update both guards to `this.endpoint == null` to allow empty-string endpoints per GE-20260706-b2804c. Existing consumers (audit-trail-viewer, case-timeline, trust-score-panel) are unaffected — they pass real URL strings or `undefined`, never empty strings.

## Components

### `<split-workbench>` — `@casehubio/blocks-ui-split-workbench`

Pure layout shell. Knows nothing about its children.

**Properties:**

| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| `selection-topic` | `string` | **(required)** | Event topic prefix. Listens for `{topic}:selected` / `{topic}:deselected` on `document` for responsive panel switching on mobile. Required — the component's responsive behaviour, event coordination, and storage key all depend on it. |
| `title` | `string` | — | Default header text. Rendered inside `<slot name="header">` fallback. |
| `storage-key` | `string` | `'split-workbench-{selection-topic}-divider'` | localStorage key for divider position. Override to avoid collisions when multiple workbenches share a page. |

**Slots:**

| Slot | Purpose |
|------|---------|
| `header` | Overrides `title` with custom header content (badges, actions, breadcrumbs). Uses native slot fallback — when slotted content is provided, `title` prop is ignored. |
| `list` | Left panel content. |
| `detail` | Right panel content. |

**Behaviour:**

- `:host` sets `container-type: inline-size` for CSS container queries
- Split-pane layout with draggable divider
- Divider position persisted to localStorage using `storage-key` property
- No keyboard shortcuts — split-workbench is a layout shell. Domain wrappers (e.g., `work-item-workbench`) compose `KeyboardShortcutMixin` and render their own keyboard hints bar and shortcut overlay
- Always renders both slots — never hides the detail slot at desktop breakpoints. The detail child handles its own empty state.

**Responsive collapse (mobile ≤768px):**

- At `@container (max-width: 768px)`, split-workbench switches to single-panel mode
- Tracks `_hasSelection` (boolean) state from `{topic}:selected` / `{topic}:deselected` events on `document`
- Sets `[has-selection]` host attribute based on state — CSS uses this to show one panel:
  - Without `[has-selection]`: list panel visible, detail panel hidden
  - With `[has-selection]`: detail panel visible, list panel hidden, back button rendered
- **Back button:** rendered in split-workbench's own shadow DOM, above the detail slot (part of the mobile chrome, not injected into slotted content). Visible only at mobile breakpoint when `_hasSelection` is true. Clicking it emits `{topic}:deselected` on `document` and sets `_hasSelection = false`
- `{topic}:selected` events set `_hasSelection = true` and switch to the detail panel
- `{topic}:deselected` events set `_hasSelection = false` and switch to the list panel
- **Mobile focus delegation:** After switching panels (in `updated()` lifecycle), focuses the slotted child element in the newly visible panel via the slot's `assignedElements()[0]?.focus()`. This uses the standard slot API — split-workbench does not know or care what the child element is. Both list-pane and detail-pane set `tabindex="-1"` on `:host` to receive programmatic focus.

**Topic consistency:** All components in a workbench composition — `split-workbench`, `list-pane`, and `detail-pane` — must use the same `selection-topic` value. Mismatched topics produce silent coordination failures (selections in the list won't reach the detail pane).

**Multi-instance behaviour:**

- Two split-workbenches with the **same** `selection-topic` share selection events — selecting in one list triggers the other's detail pane. This is by design: the topic defines a coordination scope. Use different topics for independent instances.
- Two split-workbenches with **different** `selection-topic` values are fully isolated — different topic prefixes produce different event strings.
- All events emit on `document` — there is no DOM-scoped event isolation. This matches the pages-event protocol (global coordination).

### `<list-pane>` — `@casehubio/blocks-ui-list-pane`

Generic list wrapping `<pages-data-table>` with filter bar, pagination, and single-selection.

**Properties:**

| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| `endpoint` | `string` | — | Data URL (via `DataEndpointMixin`) |
| `columns` | `ColumnDef<any>[]` | `[]` | Table column definitions |
| `getRowKey` | `(row: unknown) => string` | — | Row identity function |
| `getRowClass` | `(row: unknown) => string` | — | Optional row CSS class |
| `selection-topic` | `string` | — | Emits `{topic}:selected` on `document` with full row object as payload on row activation |
| `empty-message` | `string` | `"No items found"` | Empty state message |
| `page-size` | `number` | `25` | Rows per page |

**Data fetching contract:**

`fetchData()` fetches from `endpoint` as-is (no URL construction, no query parameters appended by the component). The response is parsed as JSON:
- If the response is an array (`T[]`), it is used directly as the row data
- If the response is an object with an `items` property (`{ items: T[], total?: number }`), `items` is used as the row data and `total` is passed to the data table for page count display
- All fetched rows are loaded into the data table at once — `page-size` controls **client-side** pagination only
- Server-side pagination is out of scope for v1 — consumers that need it build the URL with query parameters themselves and update `endpoint` when the page changes, or wait for `DataSourceMixin` (pages #145)

**Behaviour:**

- Uses `DataEndpointMixin` for data fetching (swap to `DataSourceMixin` when pages #145 lands — #44). Note: `DataEndpointMixin` exposes an inherited `identity?: WorkIdentity` property — list-pane does not use it. See blocks-ui#XX for mixin refactoring to remove the coupling.
- Wraps `<pages-data-table>` with `selection="single"`, `mode="paginated"`, `client-sort`, `client-filter` — text filtering is delegated to data-table's built-in `clientFilter` (component-consolidation spec #29). No separate filter bar rendered by list-pane.
- Emits `{topic}:selected` via `emitPagesEvent(document, ...)` on row activation — payload is the full row object
- Listens for `{topic}:refresh` on `document` — triggers re-fetch. This allows external actors (e.g., a detail-pane tab action that modifies data) to refresh the list without DOM traversal
- Public `refresh()` method for programmatic re-fetch (equivalent to the event-based refresh, but via direct method call)
- Endpoint guard uses `this.endpoint == null` (not `!this.endpoint`) to allow empty-string endpoints per GE-20260706-b2804c — this is now handled by the DataEndpointMixin prerequisite fix
- **Focus restoration (mobile):** Tracks the last activated row index (updated on each `row-activate` event from data-table). `:host` sets `tabindex="-1"` to receive programmatic focus from split-workbench. On focus, delegates to `pages-data-table` to focus the tracked row. Note: data-table's `_focusRowIndex` only tracks keyboard navigation — mouse/touch clicks do not update it. list-pane must track the activated row index independently.

### `<detail-pane>` — `@casehubio/blocks-ui-detail-pane`

Generic tabbed detail container. Tabs configured via property array — no registry, no singleton, no global state.

**Properties:**

| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| `tabs` | `TabDefinition[]` | `[]` | Tab configuration array |
| `selection-topic` | `string` | — | Listens for `{topic}:selected` / `{topic}:deselected` |
| `empty-message` | `string` | `"Select an item to view details"` | Empty state when nothing selected |

**TabDefinition interface:**

```typescript
interface TabDefinition {
  id: string;
  label: string;
  tagName: string;
  icon?: string;
  order?: number;
  badge?: (item: unknown) => string | null;
}
```

**Tab child contract:**

Each tab panel implements one property:

```typescript
@property({ attribute: false }) item: any;
```

The detail pane sets `.item = selectionPayload` on the active tab element. The payload is whatever the list pane emitted in the selection event — the detail pane never inspects or maps it. Each tab panel derives what it needs from `item` via getters or destructuring.

**Registration requirement:** Tab panel custom elements must be registered (imported) before the detail-pane creates them via `document.createElement(tab.tagName)`. Unregistered elements are inert `HTMLUnknownElement` instances — setting `.item` has no effect until upgrade. In practice, app-level imports handle this (same pattern as AML's `case-detail-pane`). Tab panels must be Lit (or equivalent) custom elements with reactive JS property setters — attribute-based elements that use `getAttribute()` will not work with the `.item` property contract.

**Behaviour:**

- Listens for `{topic}:selected` — stores the full event payload
- Listens for `{topic}:deselected` — clears the stored payload
- Creates tab elements lazily via `document.createElement(tab.tagName)`, caches in a Map
- Sets `.item` on the active tab element whenever the selection or active tab changes
- Renders tab bar with labels, icons, and optional badges
- Shows `empty-message` when no item is selected (child's empty state, not hidden by parent)
- Tabs sorted by `order` (default: array order)
- **Focus delegation (mobile):** `:host` sets `tabindex="-1"` to receive programmatic focus from split-workbench. On focus with a selected item, moves focus to the active tab panel element (`role="tabpanel"` with `tabindex="0"`)

## Accessibility

### split-workbench

| Element | ARIA | Keyboard |
|---------|------|----------|
| List panel | `role="region"`, `aria-label="List"` | — |
| Detail panel | `role="region"`, `aria-label="Detail"` | — |
| Divider | `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow` (divider position %), `aria-valuemin="20"`, `aria-valuemax="70"` | Arrow Left/Right to adjust divider position by 5% per keystep |
| Mobile back button | `aria-label="Back to list"` | Enter/Space activates |
| Mobile panel switch | `announce('Showing detail')` / `announce('Showing list')` via `LiveRegionMixin` | — |

### list-pane

Inherits `pages-data-table` ARIA (`role="grid"`, row/cell roles, sort announcements, keyboard navigation).

| Element | ARIA | Keyboard |
|---------|------|----------|
| `:host` | `tabindex="-1"` (programmatically focusable for mobile focus restoration) | — |
| Filter input | Inherits data-table's built-in filter input ARIA (rendered by `clientFilter`) | Standard text input |
| Empty state | `role="status"` | — |

### detail-pane

| Element | ARIA | Keyboard |
|---------|------|----------|
| `:host` | `tabindex="-1"` (programmatically focusable for mobile focus delegation) | — |
| Tab bar | `role="tablist"` | Arrow Left/Right to navigate between tabs |
| Tab button | `role="tab"`, `aria-selected="true/false"`, `aria-controls` pointing to tab panel ID | Enter/Space activates tab |
| Tab panel container | `role="tabpanel"`, `aria-labelledby` pointing to tab button, `tabindex="0"` | Tab into panel content |
| Empty state | `role="status"` | — |
| Selection change | `announce('{tab.label} tab')` via `LiveRegionMixin` on new item selection. Domain-specific item summaries belong in individual tab panel components (they know the payload shape), not in the generic detail-pane. | — |

### Focus management

- **Desktop:** On selection change (via list-pane row activation), focus remains in the list panel. The detail panel updates content but does not steal focus — the user navigates to the detail panel with Tab.
- **Mobile panel switch — per-component decomposition:** Each component handles focus for elements it owns. split-workbench focuses the slotted child in the newly visible panel (via `assignedElements()[0]?.focus()`), then the child component handles deeper focus placement:
  - **list-pane (back-navigation):** When receiving focus, restores focus to the previously activated row. list-pane tracks the last activated row index (updated on each `row-activate` from data-table) and delegates to data-table's row focus infrastructure.
  - **detail-pane (forward-navigation):** When receiving focus with a selected item, moves focus to the active tab panel (`role="tabpanel"` with `tabindex="0"`).

## Migration Plan

### Step 1 — Build generic components in blocks-ui

Create three new packages: `blocks-ui-split-workbench`, `blocks-ui-list-pane`, `blocks-ui-detail-pane`.

### Step 1b — Refactor work-item-workbench onto split-workbench

Refactor `<work-item-workbench>` to use `<split-workbench>` internally. No public API change — it becomes a convenience wrapper:

```typescript
@customElement('work-item-workbench')
class WorkItemWorkbench extends LitElement {
  @property() endpoint?: string;
  @property() identity?: WorkIdentity;

  render() {
    return html`
      <split-workbench selection-topic="work-item">
        <work-item-inbox slot="list"
          .endpoint=${this.endpoint}
          .identity=${this.identity}>
        </work-item-inbox>
        <work-item-detail slot="detail"
          .endpoint=${this.endpoint}
          .identity=${this.identity}>
        </work-item-detail>
      </split-workbench>
    `;
  }
}
```

This eliminates duplicated split-pane logic immediately. The divider and responsive layout live in one place: `split-workbench`. Keyboard shortcuts stay in the domain wrapper.

### Step 2 — Migrate AML to consume blocks-ui components

1. Add `@casehubio/blocks-ui-split-workbench`, `@casehubio/blocks-ui-list-pane`, `@casehubio/blocks-ui-detail-pane` as dependencies
2. Replace local `<case-workbench>` usage in `aml-app.ts`:

```html
<split-workbench selection-topic="case" title="AML Investigations">
  <list-pane slot="list"
    selection-topic="case"
    endpoint="/api/investigations"
    .columns=${investigationColumns}
    .getRowKey=${row => row.caseId}
    .getRowClass=${row => statusClass(row.status)}>
  </list-pane>
  <detail-pane slot="detail"
    selection-topic="case"
    .tabs=${[
      { id: 'overview', label: 'Overview', tagName: 'aml-investigation-overview' },
      { id: 'findings', label: 'Findings', tagName: 'aml-findings-panel' },
      { id: 'routing', label: 'Routing & Trust', tagName: 'aml-routing-panel' },
      { id: 'compliance', label: 'Compliance', tagName: 'aml-compliance-panel' },
      { id: 'audit', label: 'Audit', tagName: 'aml-audit-trail' },
    ]}
    empty-message="Select an investigation to view details">
  </detail-pane>
</split-workbench>
```

3. Update AML's five tab panels: rename `caseId`/`caseData` properties to single `item` property, derive domain fields via getters
4. Delete from AML: `components/case-workbench/` directory (case-workbench.ts, case-list-pane.ts, case-detail-pane.ts, tab-registry.ts)
5. Update AML's `package.json` — remove local workbench, add blocks-ui packages

### End state

- blocks-ui has three generic workbench components
- `work-item-workbench` uses `split-workbench` internally (no duplication)
- AML consumes the generic components (local copies deleted)
- Other domains (OpenClaw, Clinical, DevTown) can adopt the same components

## Issues to Update

| Repo | Issue | Update |
|------|-------|--------|
| blocks-ui | #37 | Link this spec, update status |
| blocks-ui | #35 | Update AML row — promotion in progress |
| blocks-ui | new | Refactor work-item-workbench onto split-workbench |
| blocks-ui | new | Migrate `WorkItemEventTopics` from dot to colon separators (prerequisite) |
| blocks-ui | new | Fix `DataEndpointMixin` endpoint guard to `== null` (prerequisite) |
| blocks-ui | new | Refactor `DataEndpointMixin` to remove `WorkIdentity` coupling — consumers that need identity declare their own property |
| blocks-ui | new | Add configurable `filter-placeholder` property to `pages-data-table` (enhancement — not blocking) |
| blocks-ui | #44 | DataSourceMixin migration (blocked by pages #145) |
| pages | #145 | DataSource pipeline improvements (filed) |

## Dependencies

- **casehub-pages#145** gates **blocks-ui#44** (DataSourceMixin migration). Not blocking — components use `DataEndpointMixin` now, one-line swap later.

## Garden Entries Referenced

- **GE-20260706-b2804c** — empty-string endpoint guard (`== null` not `!this.endpoint`)
