# Migrate pages-data-table and A11y Mixins to Pages

**Issue:** #48
**Date:** 2026-07-10
**Status:** Design

## Problem

`pages-data-table` is a generic UI primitive (CSS Grid rendering, virtual scroll,
sorting, filtering, column visibility, selection, tree rows, keyboard navigation)
that lives in blocks-ui. But blocks-ui is for domain-aware components that consume
pages APIs. A generic table belongs in pages alongside other primitives.

The same layering violation applies to the four a11y mixins in blocks-ui-core
(`LiveRegionMixin`, `RovingTabindexMixin`, `FocusTrapMixin`, `KeyboardShortcutMixin`).
These are generic LitElement class mixins with no domain awareness — they belong in
the pages layer.

Import paths should point to the package that owns the code. Re-exporting primitives
through blocks-ui-core obscures the dependency graph, creates maintenance tax, and
defeats the pages → blocks-ui → apps layering.

## Decisions

1. **A11y mixins move to `pages-primitives`** (new package) — implementing the architectural
   decision from the 2026-07-05 tokens-wildcards-primitives spec §4, which created
   `pages-primitives` as the Lit-dependent primitives package. `pages-component` stays
   framework-agnostic (vanilla TypeScript, zero framework dependencies).

2. **Data table moves to `packages/pages-data-table/`** in pages — same tier as
   `pages-component`, `pages-data`, `pages-ui-tokens`.

3. **Direct imports everywhere** — blocks-ui consumers update imports to point to pages
   packages. No re-export shims, no deprecated stubs. Import paths are honest dependency
   declarations.

4. **Big bang** — both repos change in one coordinated commit set. No transitional state,
   no version coordination dance.

5. **Drop dead `LiveRegionMixin`** from data-table — it extends `LiveRegionMixin(LitElement)`
   but never calls `this.announce()`. Change to `extends LitElement`.

## Scope

### What Moves

#### A11y mixins → `pages-primitives/src/a11y/`

Source files from `blocks-ui-core/src/mixins/`:

| File | Exports |
|------|---------|
| `live-region.ts` | `LiveRegionMixin` |
| `roving-tabindex.ts` | `RovingTabindexMixin`, `RovingDirection` (type) |
| `focus-trap.ts` | `FocusTrapMixin` |
| `keyboard-shortcut.ts` | `KeyboardShortcutMixin` |
| `roving-tabindex.test.ts` | tests |
| `keyboard-shortcut.test.ts` | tests |

Each mixin file contains its own local `Constructor` type alias — no shared type
to coordinate.

`pages-primitives` depends on `lit@^3.3.3` as its sole runtime dependency (per
2026-07-05 spec §4.1). `RovingTabindexMixin` uses `@state` from `lit/decorators.js`
(runtime import); the other three mixins use type-only LitElement imports but are
Lit-coupled through their type constraints and lifecycle hooks. `pages-component`
remains framework-agnostic — no `lit` dependency added.

#### Data table → `pages/packages/pages-data-table/`

All source files from `blocks-ui/components/data-table/src/`:

| File | Exports |
|------|---------|
| `pages-data-table.ts` | `PagesDataTable` |
| `types.ts` | `ColumnDef`, `DisplayMode`, `SelectionMode`, `SortDirection`, `SortEntry`, `ColumnAlign`, `SortChangeDetail`, `PageChangeDetail`, `SelectionChangeDetail`, `ColumnChangeDetail`, `RowActivateDetail`, `FilterChangeDetail`, `LoadMoreDetail` |
| `virtual-scroll-engine.ts` | `computeScrollWindow`, `ScrollWindow` (type) |
| `sort.ts` | `createComparator`, `createMultiComparator` |
| `csv-export.ts` | `tableToCsv`, `downloadCsv`, `copyToClipboard` |
| `tree.ts` | `flattenTree`, `TreeRow` (type) |
| `*.test.ts` | all tests |

Package dependencies:
- `lit: ^3.0.0`

No `pages-ui-tokens` dependency — the data-table references `--pages-*` CSS custom
properties via the cascade (fallback values in `static styles`), not via TypeScript
imports. No `pages-component` dependency — after dropping `LiveRegionMixin`, the
component extends `LitElement` directly with no pages-component imports.

Custom element name stays `<pages-data-table>` (already correct).

`PagesDataTable` changes from `extends LiveRegionMixin(LitElement)` to `extends LitElement`.

### What Doesn't Move

- `DataSourceMixin`, `TrendSourceMixin`, `EventStreamController`, domain types — blocks-ui concepts
- `renderSparkline`, `blocks-confirm-dialog`, `schema-form` — arguably pages-level, out of scope
- Existing re-exports of tokens/event-helpers in blocks-ui-core — separate concern

## Consumer Updates

### A11y mixin consumers in blocks-ui

Each consumer splits its blocks-ui-core import: mixin symbols come from
`@casehubio/pages-primitives`, everything else stays on `@casehubio/blocks-ui-core`.

**LiveRegionMixin** (10 consumers after data-table removal):

| Component | File | Other blocks-ui-core imports on same line |
|-----------|------|-------------------------------------------|
| work-item-inbox | `work-item-inbox.ts` | DataSourceMixin, emitPagesEvent, KeyboardShortcutMixin, etc. |
| work-item-detail | `work-item-detail.ts` | isTerminalStatus, onPagesEvent, WorkItemEventTopics, FocusTrapMixin, SchemaForm |
| notification-inbox | `notification-inbox.ts` | DataSourceMixin, emitPagesEvent, KeyboardShortcutMixin, etc. |
| approval-gate | `approval-gate.ts` | FocusTrapMixin, emitPagesEvent, BlocksConfirmDialog |
| detail-pane | `detail-pane.ts` | onPagesEvent |
| kpi-metric-row | `kpi-metric-row.ts` | emitPagesEvent, renderSparkline |
| trust-score-panel | `trust-score-panel.ts` | deep import `blocks-ui-core/mixins/live-region.js` |
| audit-trail-viewer | `audit-trail-viewer.ts` | deep import `blocks-ui-core/mixins/live-region.js` |
| case-timeline | `case-timeline.ts` | DataSourceMixin, fetchSource, renderPropertyTree, etc. |
| split-workbench | `split-workbench.ts` | onPagesEvent, emitPagesEvent |

**FocusTrapMixin** (3 external + 1 internal):

| Component | File |
|-----------|------|
| notification-bell | `notification-bell.ts` |
| approval-gate | `approval-gate.ts` |
| work-item-detail | `work-item-detail.ts` |
| blocks-confirm-dialog | `blocks-confirm-dialog.ts` (internal to blocks-ui-core, relative import) |

**KeyboardShortcutMixin** (4 consumers):

| Component | File |
|-----------|------|
| notification-bell | `notification-bell.ts` |
| work-item-workbench | `work-item-workbench.ts` |
| work-item-inbox | `work-item-inbox.ts` |
| notification-inbox | `notification-inbox.ts` |

**RovingTabindexMixin**: No external consumers (only its own test).

### Data table consumers in blocks-ui

All 5 change `@casehubio/blocks-ui-data-table` → `@casehubio/pages-data-table`:

| Component | Imports |
|-----------|---------|
| list-pane | `ColumnDef` (type) + side-effect |
| audit-trail-viewer | `ColumnDef` (type) + side-effect |
| notification-inbox | `ColumnDef`, `SelectionChangeDetail`, `RowActivateDetail` (types) + side-effect |
| work-item-inbox | `ColumnDef`, `SelectionChangeDetail`, `RowActivateDetail` (types) + side-effect |
| trust-score-panel | `ColumnDef` (type) + side-effect |

### Internal blocks-ui-core update

`blocks-confirm-dialog.ts` uses `FocusTrapMixin` via relative import
`'../mixins/focus-trap.js'`. After the move, this changes to
`import { FocusTrapMixin } from '@casehubio/pages-primitives'`.

`blocks-ui-core` gains `@casehubio/pages-primitives` as a new production dependency
(currently depends on `pages-component`, `pages-data`, `pages-ui-tokens`, `lit`).

### Dependency changes per consumer

Each component that gains a direct import from a pages package needs:
1. Versioned dependency in `package.json` (e.g., `"@casehubio/pages-primitives": "^0.2.0"`)
2. Vitest alias entry for local development (resolving to `../../../pages/packages/...`) —
   established convention, see existing `work-item-inbox/vitest.config.ts`
3. TypeScript project reference update if needed

For `@casehubio/pages-data-table` (new package):
1. `"@casehubio/pages-data-table": "^0.2.0"` in consumer `package.json`
2. Vitest alias: `@casehubio/pages-data-table` → `../../../pages/packages/pages-data-table/src`
3. Remove `@casehubio/blocks-ui-data-table` workspace dependency
4. Remove tsconfig project reference `{ "path": "../data-table" }` (present in
   `list-pane`, `notification-inbox`, `audit-trail-viewer`, `work-item-inbox`;
   absent from `trust-score-panel`)

## Cleanup

### blocks-ui removals

1. Delete `components/data-table/` directory entirely
2. Delete `packages/blocks-ui-core/src/mixins/` directory entirely (all 7 files
   are mixin-related: 4 mixin sources, 2 test files, 1 barrel index)
3. Remove data-table reference from root `tsconfig.json`
4. Update `blocks-ui-core/src/index.ts` — remove mixin re-export line

### pages updates

1. Update placeholder test comments in `pages-runtime` (`form-edit.test.ts`,
   `form-interaction.test.ts`) that reference "removed from pages-viz in favour
   of pages-data-table in blocks-ui" — the wiring is now complete.

### pages ARC42STORIES.MD update

1. Add `@casehubio/pages-data-table` to the §5 package table with responsibility:
   "Data table Web Component: CSS Grid rendering, virtual scroll, sorting,
   filtering, column visibility, selection, tree rows, keyboard navigation"
2. `@casehubio/pages-primitives` entry already exists in §5 — this migration
   creates the package that implements it (a11y mixins only; SchemaForm,
   filter-chips, scope-selector are future work per the 2026-07-05 spec)

### PagesTable disposition

`PagesTable` was already removed from `pages-viz`. No replacement action needed.
The placeholder tests in `pages-runtime` reference "removed from pages-viz in
favour of pages-data-table in blocks-ui" — this migration completes the wiring
they reference. Issue #48 item "Replace any older table primitive in pages" is
satisfied: the old primitive is gone, the new one is now in pages.

## CI Coordination

blocks-ui resolves `@casehubio/pages-*` packages from the GitHub Packages
registry (versioned deps like `"^0.2.0"`), not workspace protocol. The
coordination sequence:

1. **pages repo:** Create `pages-primitives` package (a11y mixins), create
   `pages-data-table` package. Publish all new/updated packages.
2. **blocks-ui repo:** Update imports, add new dependencies (`pages-primitives`,
   `pages-data-table`), remove old data-table directory and mixin source files.
   CI resolves new packages from the registry.

Local development uses Vitest aliases (established convention — see existing
configs like `work-item-inbox/vitest.config.ts`) to resolve `@casehubio/pages-*`
to sibling checkout at `../../../pages/packages/...`.

## Dependency Graph After

```
pages-primitives (new: a11y mixins, lit)    pages-component (unchanged, no lit)
                                                     |
pages-data-table (new: lit only)              pages-data
                                                     |
              blocks-ui consumers ──→ blocks-ui-core
                 |    |                  ├── pages-component, pages-data, pages-ui-tokens
                 |    |                  ├── pages-primitives (new — FocusTrapMixin for blocks-confirm-dialog)
                 |    |                  └── lit
                 |    |
                 |    └──→ pages-primitives (direct: LiveRegionMixin, FocusTrapMixin, KeyboardShortcutMixin)
                 └──→ pages-data-table (direct: ColumnDef, PagesDataTable, etc.)
```

## Verification

1. `yarn build` in pages — all packages including new `pages-primitives` and `pages-data-table`
2. `yarn test` in pages — data-table tests + mixin tests pass in new locations
3. `yarn typecheck` in pages
4. `yarn build` in blocks-ui — all consumers resolve new import paths
5. `yarn test` in blocks-ui — all consumer tests pass
6. `yarn typecheck` in blocks-ui
7. `ide_diagnostics` on all changed files
8. Verify `FilterChangeDetail` is exported from `pages-data-table` barrel (`index.ts`)
