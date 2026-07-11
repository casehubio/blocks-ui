# Migrate pages-data-table and A11y Mixins to Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> executing-plans to implement this plan task-by-task. Each task follows TDD
> (test-driven-development) and uses ide-tooling for structural editing.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Focal issue:** #48 — refactor: migrate pages-data-table from blocks-ui to pages as the platform table primitive
**Issue group:** #48

**Goal:** Move `pages-data-table` and 4 a11y mixins from blocks-ui to pages, fixing the layering violation where generic primitives live in a domain-component repo.

**Architecture:** Two new packages in pages: `pages-primitives` (a11y mixins, Lit-dependent) and `pages-data-table` (table component). blocks-ui consumers update imports to point directly at pages packages — no re-export shims. blocks-ui-core loses its mixins directory; its `blocks-confirm-dialog` imports `FocusTrapMixin` from `@casehubio/pages-primitives`.

**Tech Stack:** TypeScript, Lit 3, Yarn 4 workspaces, Vitest, CSS custom properties

## Global Constraints

- All new pages packages use version `0.2.0` (version alignment protocol PP-20260705-8fcb31)
- pages tsconfig extends `@casehubio/pages-tsconfig/tsconfig.json`
- blocks-ui tsconfig extends `../../tsconfig.base.json`
- Cross-repo deps use versioned npm (e.g. `"^0.2.0"`), not `workspace:*`
- Vitest aliases resolve cross-repo packages to `../../../pages/packages/<name>/src`
- IntelliJ MCP is mandatory for all `.ts` file edits — use `ide_edit_member`, `ide_replace_member`, `ide_insert_member`. Never use Edit/Write on existing source files.
- Custom element name `<pages-data-table>` does not change
- `pages-component` stays framework-agnostic — zero `lit` dependency

---

### Task 1: Create `pages-primitives` package in pages

**Files:**
- Create: `pages/packages/pages-primitives/package.json`
- Create: `pages/packages/pages-primitives/tsconfig.json`
- Create: `pages/packages/pages-primitives/tsconfig.build.json`
- Create: `pages/packages/pages-primitives/vitest.config.ts`
- Create: `pages/packages/pages-primitives/src/a11y/live-region.ts`
- Create: `pages/packages/pages-primitives/src/a11y/focus-trap.ts`
- Create: `pages/packages/pages-primitives/src/a11y/roving-tabindex.ts`
- Create: `pages/packages/pages-primitives/src/a11y/keyboard-shortcut.ts`
- Create: `pages/packages/pages-primitives/src/a11y/index.ts`
- Create: `pages/packages/pages-primitives/src/a11y/roving-tabindex.test.ts`
- Create: `pages/packages/pages-primitives/src/a11y/keyboard-shortcut.test.ts`
- Create: `pages/packages/pages-primitives/src/index.ts`

**Interfaces:**
- Produces: `LiveRegionMixin`, `FocusTrapMixin`, `RovingTabindexMixin` (+ `RovingDirection` type), `KeyboardShortcutMixin` — all exported from `@casehubio/pages-primitives`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@casehubio/pages-primitives",
  "version": "0.2.0",
  "description": "CaseHub Pages Lit-dependent primitives — a11y mixins, form controls",
  "repository": {
    "type": "git",
    "url": "https://github.com/casehubio/casehub-pages.git"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rimraf dist"
  },
  "dependencies": {
    "lit": "^3.3.3"
  },
  "devDependencies": {
    "@casehubio/pages-tsconfig": "workspace:*",
    "@open-wc/testing": "^4.0.0",
    "jsdom": "^26.0.0",
    "rimraf": "^6.1.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  },
  "license": "Apache-2.0"
}
```

Write to `/Users/mdproctor/claude/casehub/pages/packages/pages-primitives/package.json`.

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "@casehubio/pages-tsconfig/tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": ".typecheck",
    "emitDeclarationOnly": true,
    "experimentalDecorators": true,
    "useDefineForClassFields": false
  },
  "include": ["src"],
  "references": []
}
```

Note: `experimentalDecorators` + `useDefineForClassFields: false` required because `RovingTabindexMixin` uses `@state` decorator from `lit/decorators.js`.

Write to `/Users/mdproctor/claude/casehub/pages/packages/pages-primitives/tsconfig.json`.

- [ ] **Step 3: Create tsconfig.build.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "emitDeclarationOnly": false,
    "composite": false
  },
  "exclude": ["**/*.test.ts"]
}
```

Write to `/Users/mdproctor/claude/casehub/pages/packages/pages-primitives/tsconfig.build.json`.

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    target: 'es2022',
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
```

Write to `/Users/mdproctor/claude/casehub/pages/packages/pages-primitives/vitest.config.ts`.

- [ ] **Step 5: Copy mixin source files**

Copy the following files from `blocks-ui/packages/blocks-ui-core/src/mixins/` to `pages/packages/pages-primitives/src/a11y/`:

| Source | Destination |
|--------|-------------|
| `live-region.ts` | `src/a11y/live-region.ts` |
| `focus-trap.ts` | `src/a11y/focus-trap.ts` |
| `roving-tabindex.ts` | `src/a11y/roving-tabindex.ts` |
| `keyboard-shortcut.ts` | `src/a11y/keyboard-shortcut.ts` |
| `roving-tabindex.test.ts` | `src/a11y/roving-tabindex.test.ts` |
| `keyboard-shortcut.test.ts` | `src/a11y/keyboard-shortcut.test.ts` |

Files are copied verbatim — no changes to source content. Use bash `cp` (these are new files, not existing source edits).

```bash
mkdir -p /Users/mdproctor/claude/casehub/pages/packages/pages-primitives/src/a11y
```

Then copy each file individually.

- [ ] **Step 6: Fix test import paths**

The test files import from relative paths like `'./roving-tabindex.js'` and `'./keyboard-shortcut.js'`. Verify these are correct in the new location (they should be — both source and test are in `src/a11y/`).

Read each test file to check imports. If they import from `'@casehubio/blocks-ui-core'`, update to relative imports.

- [ ] **Step 7: Create barrel exports**

Create `src/a11y/index.ts`:
```typescript
export { RovingTabindexMixin, type RovingDirection } from './roving-tabindex.js';
export { FocusTrapMixin } from './focus-trap.js';
export { LiveRegionMixin } from './live-region.js';
export { KeyboardShortcutMixin } from './keyboard-shortcut.js';
```

Create `src/index.ts`:
```typescript
export * from './a11y/index.js';
```

Write both to `/Users/mdproctor/claude/casehub/pages/packages/pages-primitives/src/`.

- [ ] **Step 8: Install dependencies and run tests**

```bash
yarn --cwd /Users/mdproctor/claude/casehub/pages install
yarn --cwd /Users/mdproctor/claude/casehub/pages/packages/pages-primitives test
```

Expected: all mixin tests pass in new location.

- [ ] **Step 9: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-primitives/
git -C /Users/mdproctor/claude/casehub/pages commit -m "feat: create pages-primitives package with a11y mixins (#48)"
```

---

### Task 2: Create `pages-data-table` package in pages

**Files:**
- Create: `pages/packages/pages-data-table/package.json`
- Create: `pages/packages/pages-data-table/tsconfig.json`
- Create: `pages/packages/pages-data-table/tsconfig.build.json`
- Create: `pages/packages/pages-data-table/vitest.config.ts`
- Create: `pages/packages/pages-data-table/src/pages-data-table.ts` (modified — drop LiveRegionMixin)
- Create: `pages/packages/pages-data-table/src/types.ts`
- Create: `pages/packages/pages-data-table/src/sort.ts`
- Create: `pages/packages/pages-data-table/src/tree.ts`
- Create: `pages/packages/pages-data-table/src/virtual-scroll-engine.ts`
- Create: `pages/packages/pages-data-table/src/csv-export.ts`
- Create: `pages/packages/pages-data-table/src/index.ts` (modified — add FilterChangeDetail)
- Create: `pages/packages/pages-data-table/src/*.test.ts` (all test files)

**Interfaces:**
- Produces: `PagesDataTable`, `ColumnDef`, `DisplayMode`, `SelectionMode`, `SortDirection`, `SortEntry`, `ColumnAlign`, `SortChangeDetail`, `PageChangeDetail`, `SelectionChangeDetail`, `ColumnChangeDetail`, `RowActivateDetail`, `FilterChangeDetail`, `LoadMoreDetail`, `computeScrollWindow`, `ScrollWindow`, `createComparator`, `createMultiComparator`, `tableToCsv`, `downloadCsv`, `copyToClipboard`, `flattenTree`, `TreeRow` — all exported from `@casehubio/pages-data-table`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@casehubio/pages-data-table",
  "version": "0.2.0",
  "description": "CaseHub Pages data table — CSS Grid rendering, virtual scroll, sorting, filtering, selection, tree rows, keyboard navigation",
  "repository": {
    "type": "git",
    "url": "https://github.com/casehubio/casehub-pages.git"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rimraf dist"
  },
  "dependencies": {
    "lit": "^3.0.0"
  },
  "devDependencies": {
    "@casehubio/pages-tsconfig": "workspace:*",
    "@open-wc/testing": "^4.0.0",
    "jsdom": "^25.0.0",
    "rimraf": "^6.1.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  },
  "license": "Apache-2.0"
}
```

Write to `/Users/mdproctor/claude/casehub/pages/packages/pages-data-table/package.json`.

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "@casehubio/pages-tsconfig/tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": ".typecheck",
    "emitDeclarationOnly": true,
    "experimentalDecorators": true,
    "useDefineForClassFields": false
  },
  "include": ["src"],
  "references": []
}
```

Write to `/Users/mdproctor/claude/casehub/pages/packages/pages-data-table/tsconfig.json`.

- [ ] **Step 3: Create tsconfig.build.json**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "emitDeclarationOnly": false,
    "composite": false
  },
  "exclude": ["**/*.test.ts"]
}
```

Write to `/Users/mdproctor/claude/casehub/pages/packages/pages-data-table/tsconfig.build.json`.

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    target: 'es2022',
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
```

Write to `/Users/mdproctor/claude/casehub/pages/packages/pages-data-table/vitest.config.ts`.

- [ ] **Step 5: Copy source files**

Copy all files from `blocks-ui/components/data-table/src/` to `pages/packages/pages-data-table/src/`:

```bash
mkdir -p /Users/mdproctor/claude/casehub/pages/packages/pages-data-table/src
```

Copy each `.ts` file individually (source + tests).

- [ ] **Step 6: Drop LiveRegionMixin from PagesDataTable**

In `pages/packages/pages-data-table/src/pages-data-table.ts`, make two changes:

1. Remove the import line:
   ```typescript
   import { LiveRegionMixin } from '@casehubio/blocks-ui-core';
   ```

2. Change the class declaration from:
   ```typescript
   export class PagesDataTable extends LiveRegionMixin(LitElement) {
   ```
   to:
   ```typescript
   export class PagesDataTable extends LitElement {
   ```

Use `ide_edit_member` on `PagesDataTable` to update the class declaration. Use `ide_search_text` first to find the exact line numbers.

- [ ] **Step 7: Add FilterChangeDetail to index.ts barrel**

The current `index.ts` is missing `FilterChangeDetail` from its type exports. Update the type export block to include it:

```typescript
export type {
  ColumnDef,
  DisplayMode,
  SelectionMode,
  SortDirection,
  SortEntry,
  ColumnAlign,
  SortChangeDetail,
  PageChangeDetail,
  SelectionChangeDetail,
  ColumnChangeDetail,
  RowActivateDetail,
  FilterChangeDetail,
  LoadMoreDetail,
} from './types.js';
```

- [ ] **Step 8: Run tests**

```bash
yarn --cwd /Users/mdproctor/claude/casehub/pages install
yarn --cwd /Users/mdproctor/claude/casehub/pages/packages/pages-data-table test
```

Expected: all data-table tests pass. The tests that were testing `LiveRegionMixin` behavior (if any) will fail — but from earlier analysis, data-table never calls `this.announce()`, so no test should reference it.

- [ ] **Step 9: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-data-table/
git -C /Users/mdproctor/claude/casehub/pages commit -m "feat: create pages-data-table package (#48)"
```

---

### Task 3: Update pages root configuration

**Files:**
- Modify: `pages/tsconfig.json`
- Modify: `pages/package.json`

**Interfaces:**
- Consumes: Task 1 (pages-primitives), Task 2 (pages-data-table)

- [ ] **Step 1: Add to root tsconfig.json references**

Add two new entries to the `references` array in `pages/tsconfig.json`:

```json
{ "path": "packages/pages-primitives" },
{ "path": "packages/pages-data-table" }
```

- [ ] **Step 2: Add to build:packages script**

In `pages/package.json`, update the `build:packages` script to include the two new packages. Add them before the existing packages (they have no internal pages dependencies):

```
yarn workspace @casehubio/pages-primitives run build && yarn workspace @casehubio/pages-data-table run build &&
```

Prepend these to the existing `build:packages` command value.

- [ ] **Step 3: Full pages build + typecheck + test**

```bash
yarn --cwd /Users/mdproctor/claude/casehub/pages build
yarn --cwd /Users/mdproctor/claude/casehub/pages typecheck
yarn --cwd /Users/mdproctor/claude/casehub/pages test
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/pages add tsconfig.json package.json
git -C /Users/mdproctor/claude/casehub/pages commit -m "chore: add pages-primitives and pages-data-table to root config (#48)"
```

---

### Task 4: Update blocks-ui-core — remove mixins, update confirm-dialog

**Files:**
- Delete: `blocks-ui/packages/blocks-ui-core/src/mixins/` (entire directory — 7 files)
- Modify: `blocks-ui/packages/blocks-ui-core/src/index.ts` (remove mixin re-export)
- Modify: `blocks-ui/packages/blocks-ui-core/src/confirm-dialog/blocks-confirm-dialog.ts` (change import)
- Modify: `blocks-ui/packages/blocks-ui-core/package.json` (add pages-primitives dep)
- Modify: `blocks-ui/packages/blocks-ui-core/vitest.config.ts` (add pages-primitives alias)

**Interfaces:**
- Consumes: Task 1 (`@casehubio/pages-primitives` for `FocusTrapMixin`)

- [ ] **Step 1: Update blocks-confirm-dialog.ts import**

In `blocks-ui/packages/blocks-ui-core/src/confirm-dialog/blocks-confirm-dialog.ts`, change:
```typescript
import { FocusTrapMixin } from '../mixins/focus-trap.js';
```
to:
```typescript
import { FocusTrapMixin } from '@casehubio/pages-primitives';
```

Use `ide_search_text` to find the line, then use the Edit tool (this is a new import path, not a member edit).

- [ ] **Step 2: Remove mixin re-export from index.ts**

In `blocks-ui/packages/blocks-ui-core/src/index.ts`, remove the line:
```typescript
export * from './mixins/index.js';
```

- [ ] **Step 3: Delete the mixins directory**

Delete `blocks-ui/packages/blocks-ui-core/src/mixins/` entirely (all 7 files: 4 mixin sources, 2 test files, 1 barrel index).

```bash
rm -rf /Users/mdproctor/claude/casehub/blocks-ui/packages/blocks-ui-core/src/mixins
```

(bash rm is safe here — the files are being removed, not moved. The source now lives in pages-primitives.)

- [ ] **Step 4: Add pages-primitives dependency to package.json**

In `blocks-ui/packages/blocks-ui-core/package.json`, add to `dependencies`:
```json
"@casehubio/pages-primitives": "^0.2.0"
```

- [ ] **Step 5: Add vitest alias for pages-primitives**

Read `blocks-ui/packages/blocks-ui-core/vitest.config.ts` (if it exists — blocks-ui-core may use the test files directly). If it has aliases, add:
```typescript
'@casehubio/pages-primitives': path.resolve(__dirname, '../../../pages/packages/pages-primitives/src'),
```

If blocks-ui-core does not have a vitest.config.ts, check if the mixin tests were run from blocks-ui-core or as part of a parent config. Since we deleted the mixin tests (they now live in pages-primitives), no alias is needed if blocks-ui-core has no remaining tests that import from pages-primitives. The `blocks-confirm-dialog` tests may transitively need the alias.

- [ ] **Step 6: Run blocks-ui-core tests**

```bash
yarn --cwd /Users/mdproctor/claude/casehub/blocks-ui/packages/blocks-ui-core test
```

Expected: pass. The mixin tests are gone (they live in pages-primitives now). The confirm-dialog tests should still pass via the vitest alias.

- [ ] **Step 7: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add packages/blocks-ui-core/
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "refactor: remove a11y mixins from blocks-ui-core, import from pages-primitives (#48)"
```

---

### Task 5: Update blocks-ui consumers — a11y mixin imports

**Files (all in blocks-ui):**
- Modify: `components/work-item-inbox/src/work-item-inbox.ts`
- Modify: `components/work-item-detail/src/work-item-detail.ts`
- Modify: `components/notification-inbox/src/notification-inbox.ts`
- Modify: `components/notification-inbox/src/notification-bell.ts`
- Modify: `components/approval-gate/src/approval-gate.ts`
- Modify: `components/detail-pane/src/detail-pane.ts`
- Modify: `components/kpi-metric-row/src/kpi-metric-row.ts`
- Modify: `components/trust-score-panel/src/trust-score-panel.ts`
- Modify: `components/audit-trail-viewer/src/audit-trail-viewer.ts`
- Modify: `components/case-timeline/src/case-timeline.ts`
- Modify: `components/split-workbench/src/split-workbench.ts`
- Modify: `components/work-item-workbench/src/work-item-workbench.ts`
- Modify: 12 `package.json` files (add `@casehubio/pages-primitives`)
- Modify: 12 `vitest.config.ts` files (add pages-primitives alias)

**Interfaces:**
- Consumes: Task 1 (`@casehubio/pages-primitives`)

For each consumer, the change pattern is:

1. **Split the blocks-ui-core import:** Move mixin symbols (`LiveRegionMixin`, `FocusTrapMixin`, `KeyboardShortcutMixin`) to a new import from `@casehubio/pages-primitives`. Leave all other symbols on `@casehubio/blocks-ui-core`.

2. **Add dependency** to `package.json`: `"@casehubio/pages-primitives": "^0.2.0"`

3. **Add vitest alias**: `'@casehubio/pages-primitives': path.resolve(__dirname, '../../../pages/packages/pages-primitives/src')`

The exact import changes per file (use `ide_search_text` to locate, then edit):

- [ ] **Step 1: work-item-inbox/src/work-item-inbox.ts**

Split: move `LiveRegionMixin`, `KeyboardShortcutMixin` to `@casehubio/pages-primitives`.
Keep on `@casehubio/blocks-ui-core`: `DataSourceMixin`, `emitPagesEvent`, `onPagesEvent`, etc.

- [ ] **Step 2: work-item-detail/src/work-item-detail.ts**

Split: move `FocusTrapMixin`, `LiveRegionMixin` to `@casehubio/pages-primitives`.
Keep on `@casehubio/blocks-ui-core`: `isTerminalStatus`, `onPagesEvent`, `WorkItemEventTopics`, `SchemaForm`.

- [ ] **Step 3: notification-inbox/src/notification-inbox.ts**

Split: move `LiveRegionMixin`, `KeyboardShortcutMixin` to `@casehubio/pages-primitives`.
Keep on `@casehubio/blocks-ui-core`: `DataSourceMixin`, `emitPagesEvent`, etc.

- [ ] **Step 4: notification-inbox/src/notification-bell.ts**

Split: move `FocusTrapMixin`, `KeyboardShortcutMixin` to `@casehubio/pages-primitives`.
Keep on `@casehubio/blocks-ui-core`: `WorkIdentity` type (or wherever else it imports from).

- [ ] **Step 5: approval-gate/src/approval-gate.ts**

Split: move `FocusTrapMixin`, `LiveRegionMixin` to `@casehubio/pages-primitives`.
Keep on `@casehubio/blocks-ui-core`: `emitPagesEvent`, `BlocksConfirmDialog`.

- [ ] **Step 6: detail-pane/src/detail-pane.ts**

Split: move `LiveRegionMixin` to `@casehubio/pages-primitives`.
Keep on `@casehubio/blocks-ui-core`: `onPagesEvent`.

- [ ] **Step 7: kpi-metric-row/src/kpi-metric-row.ts**

Split: move `LiveRegionMixin` to `@casehubio/pages-primitives`.
Keep on `@casehubio/blocks-ui-core`: `emitPagesEvent`, `renderSparkline`.

- [ ] **Step 8: trust-score-panel/src/trust-score-panel.ts**

Change deep import `@casehubio/blocks-ui-core/mixins/live-region.js` to `@casehubio/pages-primitives`.

- [ ] **Step 9: audit-trail-viewer/src/audit-trail-viewer.ts**

Change deep import `@casehubio/blocks-ui-core/mixins/live-region.js` to `@casehubio/pages-primitives`.

- [ ] **Step 10: case-timeline/src/case-timeline.ts**

Split: move `LiveRegionMixin` to `@casehubio/pages-primitives`.
Keep on `@casehubio/blocks-ui-core`: `DataSourceMixin`, `fetchSource`, `renderPropertyTree`, `propertyTreeStyles`, `WorkIdentity` type.

- [ ] **Step 11: split-workbench/src/split-workbench.ts**

Split: move `LiveRegionMixin` to `@casehubio/pages-primitives`.
Keep on `@casehubio/blocks-ui-core`: `onPagesEvent`, `emitPagesEvent`.

- [ ] **Step 12: work-item-workbench/src/work-item-workbench.ts**

Split: move `KeyboardShortcutMixin` to `@casehubio/pages-primitives`.
Keep remaining imports on `@casehubio/blocks-ui-core`.

- [ ] **Step 13: Add `@casehubio/pages-primitives` dependency to all 12 consumer package.json files**

Add `"@casehubio/pages-primitives": "^0.2.0"` to the `dependencies` section of each consumer's `package.json`:

`work-item-inbox`, `work-item-detail`, `notification-inbox`, `approval-gate`, `detail-pane`, `kpi-metric-row`, `trust-score-panel`, `audit-trail-viewer`, `case-timeline`, `split-workbench`, `work-item-workbench`

(notification-bell is part of the notification-inbox package — same package.json.)

- [ ] **Step 14: Add vitest aliases for pages-primitives to each consumer**

For each consumer's `vitest.config.ts`, add the alias entry:

Array-style configs (list-pane pattern):
```typescript
{ find: '@casehubio/pages-primitives', replacement: path.resolve(__dirname, '../../../pages/packages/pages-primitives/src') },
```

Object-style configs (work-item-inbox pattern):
```typescript
'@casehubio/pages-primitives': path.resolve(__dirname, '../../../pages/packages/pages-primitives/src'),
```

Match the existing alias style in each file.

- [ ] **Step 15: Run tests for affected consumers**

```bash
yarn --cwd /Users/mdproctor/claude/casehub/blocks-ui test
```

Expected: all pass.

- [ ] **Step 16: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add components/ packages/
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "refactor: update a11y mixin imports to @casehubio/pages-primitives (#48)"
```

---

### Task 6: Update blocks-ui consumers — data-table imports

**Files (all in blocks-ui):**
- Modify: `components/list-pane/src/list-pane.ts`
- Modify: `components/audit-trail-viewer/src/audit-trail-viewer.ts`
- Modify: `components/notification-inbox/src/notification-inbox.ts`
- Modify: `components/notification-inbox/src/subscription-list.ts`
- Modify: `components/work-item-inbox/src/work-item-inbox.ts`
- Modify: `components/trust-score-panel/src/trust-score-panel.ts`
- Modify: 5 `package.json` files
- Modify: 5 `vitest.config.ts` files
- Modify: 4 `tsconfig.json` files

**Interfaces:**
- Consumes: Task 2 (`@casehubio/pages-data-table`)

For each consumer:

1. **Change import path:** `@casehubio/blocks-ui-data-table` → `@casehubio/pages-data-table`
2. **Update package.json:** Remove `"@casehubio/blocks-ui-data-table": "workspace:*"`, add `"@casehubio/pages-data-table": "^0.2.0"`
3. **Update vitest alias:** `@casehubio/blocks-ui-data-table` → `@casehubio/pages-data-table` pointing to `../../../pages/packages/pages-data-table/src`
4. **Remove tsconfig reference** to `../data-table` (present in list-pane, notification-inbox, audit-trail-viewer, work-item-inbox; absent from trust-score-panel)

- [ ] **Step 1: Update list-pane source + config**

In `list-pane/src/list-pane.ts`:
- `import '@casehubio/blocks-ui-data-table'` → `import '@casehubio/pages-data-table'`
- `import type { ColumnDef } from '@casehubio/blocks-ui-data-table'` → `import type { ColumnDef } from '@casehubio/pages-data-table'`

Update `list-pane/package.json`: remove `@casehubio/blocks-ui-data-table`, add `"@casehubio/pages-data-table": "^0.2.0"`.

Update `list-pane/vitest.config.ts`: change the `@casehubio/blocks-ui-data-table` alias to `@casehubio/pages-data-table` pointing to `../../../pages/packages/pages-data-table/src`.

Update `list-pane/tsconfig.json`: remove `{ "path": "../data-table" }` from references.

- [ ] **Step 2: Update audit-trail-viewer source + config**

Same pattern. In `audit-trail-viewer/src/audit-trail-viewer.ts`:
- Change both import lines from `@casehubio/blocks-ui-data-table` to `@casehubio/pages-data-table`

Update package.json, vitest.config.ts, tsconfig.json as in Step 1.

- [ ] **Step 3: Update notification-inbox source + config**

Two source files: `notification-inbox.ts` and `subscription-list.ts`.
- Change all `@casehubio/blocks-ui-data-table` imports to `@casehubio/pages-data-table`

Update package.json, vitest.config.ts, tsconfig.json.

- [ ] **Step 4: Update work-item-inbox source + config**

In `work-item-inbox/src/work-item-inbox.ts`:
- Change all `@casehubio/blocks-ui-data-table` imports to `@casehubio/pages-data-table`

Update package.json, vitest.config.ts, tsconfig.json.

- [ ] **Step 5: Update trust-score-panel source + config**

In `trust-score-panel/src/trust-score-panel.ts`:
- Change `@casehubio/blocks-ui-data-table` import to `@casehubio/pages-data-table`

Update package.json, vitest.config.ts. trust-score-panel's tsconfig.json has NO reference to `../data-table` — skip tsconfig update.

- [ ] **Step 6: Run tests**

```bash
yarn --cwd /Users/mdproctor/claude/casehub/blocks-ui install
yarn --cwd /Users/mdproctor/claude/casehub/blocks-ui test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add components/
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "refactor: update data-table imports to @casehubio/pages-data-table (#48)"
```

---

### Task 7: Cleanup — remove data-table from blocks-ui, update pages-runtime

**Files:**
- Delete: `blocks-ui/components/data-table/` (entire directory)
- Modify: `blocks-ui/tsconfig.json` (remove data-table reference)
- Modify: `pages/packages/pages-runtime/tests/form-edit.test.ts` (update placeholder comment)
- Modify: `pages/packages/pages-runtime/tests/form-interaction.test.ts` (update placeholder comment)

**Interfaces:**
- Consumes: Tasks 4-6 (all consumer imports already updated)

- [ ] **Step 1: Delete data-table directory from blocks-ui**

```bash
rm -rf /Users/mdproctor/claude/casehub/blocks-ui/components/data-table
```

(bash rm is safe — the source now lives in pages-data-table.)

- [ ] **Step 2: Remove data-table from root tsconfig.json**

In `blocks-ui/tsconfig.json`, remove the line:
```json
{ "path": "components/data-table" },
```

- [ ] **Step 3: Update pages-runtime placeholder comments**

Search for the placeholder comments in pages-runtime test files:

```
// removed from pages-viz in favour of pages-data-table in blocks-ui.
```

Update to:
```
// pages-data-table now lives in pages/packages/pages-data-table (migrated from blocks-ui in #48).
```

Use `ide_search_text` with query `"pages-data-table in blocks-ui"` in the pages project to find exact locations, then update.

- [ ] **Step 4: Full verification — both repos**

Pages:
```bash
yarn --cwd /Users/mdproctor/claude/casehub/pages build
yarn --cwd /Users/mdproctor/claude/casehub/pages typecheck
yarn --cwd /Users/mdproctor/claude/casehub/pages test
```

blocks-ui:
```bash
yarn --cwd /Users/mdproctor/claude/casehub/blocks-ui build
yarn --cwd /Users/mdproctor/claude/casehub/blocks-ui typecheck
yarn --cwd /Users/mdproctor/claude/casehub/blocks-ui test
```

Expected: all pass in both repos.

- [ ] **Step 5: Commit both repos**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add components/ tsconfig.json
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "refactor: remove data-table from blocks-ui — now in pages (#48)"

git -C /Users/mdproctor/claude/casehub/pages add packages/pages-runtime/
git -C /Users/mdproctor/claude/casehub/pages commit -m "docs: update pages-runtime placeholder comments for data-table migration (#48)"
```

- [ ] **Step 6: Run ide_diagnostics on key files**

Run `ide_diagnostics` on these files to verify no TypeScript errors:
- `blocks-ui/packages/blocks-ui-core/src/confirm-dialog/blocks-confirm-dialog.ts`
- `blocks-ui/packages/blocks-ui-core/src/index.ts`
- `blocks-ui/components/list-pane/src/list-pane.ts`
- `blocks-ui/components/work-item-inbox/src/work-item-inbox.ts`
- `blocks-ui/components/notification-inbox/src/notification-inbox.ts`
- `blocks-ui/components/trust-score-panel/src/trust-score-panel.ts`
- `blocks-ui/components/audit-trail-viewer/src/audit-trail-viewer.ts`
