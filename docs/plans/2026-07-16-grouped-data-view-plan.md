# grouped-data-view Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> subagent-driven-development (recommended) or executing-plans to
> implement this plan task-by-task. Each task follows TDD
> (test-driven-development) and uses ide-tooling for structural
> editing. Steps use checkbox (`- [ ]`) syntax for tracking.

**Focal issue:** #53 — feat: grouped-data-view component
**Issue group:** #53

**Goal:** Build a thin blocks-ui wrapper over `pages-grouped-view` that adds DataSourceMixin dual data mode, per-group styling, and platform event integration.

**Architecture:** `grouped-data-view` extends `DataSourceMixin(LitElement)`. It creates a `<pages-grouped-view>` child element in its shadow DOM and bridges the reactive Lit model to PagesElement's imperative setters. The wrapper converts a simple `groupBy` string to a `GroupingKey`, sorts data to ensure group adjacency, and applies per-group styling via a callback.

**Tech Stack:** Lit 3, TypeScript, `@casehubio/pages-viz` (PagesGroupedView), `@casehubio/pages-data` (TypedDataSet, GroupingKey, fromRows), `@casehubio/pages-table` (TableColumnConfig, ColumnRenderer), `@casehubio/blocks-ui-core` (DataSourceMixin, emitPagesEvent), vitest + jsdom.

## Global Constraints

- All `--pages-*` CSS custom properties for visual consistency
- Protocol PP-20260713-8ea1af: typed config properties + render callbacks, no content slots
- `pages-grouped-view` custom element must be registered before this component renders (side-effect import by consumer)
- Never include `lookup` in forwarded `GroupedViewProps` (data request suppression)
- Grouping restricted to `distinct` strategy only

---

### Task 1: Package scaffolding and types

**Files:**
- Create: `components/grouped-data-view/package.json`
- Create: `components/grouped-data-view/tsconfig.json`
- Create: `components/grouped-data-view/tsconfig.build.json`
- Create: `components/grouped-data-view/vitest.config.ts`
- Create: `components/grouped-data-view/src/types.ts`
- Create: `components/grouped-data-view/src/index.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `GroupStyleConfig` interface, `GroupedDataViewTopics` const — used by Task 2 and Task 3

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@casehubio/blocks-ui-grouped-data-view",
  "version": "0.2.2",
  "description": "Grouped data view — items grouped by column with per-group pages-table rendering",
  "repository": {
    "type": "git",
    "url": "https://github.com/casehubio/blocks-ui.git"
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
    "clean": "rimraf dist"
  },
  "dependencies": {
    "@casehubio/blocks-ui-core": "workspace:*",
    "@casehubio/pages-component": "^0.2.2",
    "@casehubio/pages-data": "^0.2.2",
    "@casehubio/pages-table": "^0.2.2",
    "@casehubio/pages-viz": "^0.2.2",
    "lit": "^3.2.1"
  },
  "devDependencies": {
    "rimraf": "^6.1.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  },
  "license": "Apache-2.0"
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "experimentalDecorators": true,
    "useDefineForClassFields": false
  },
  "include": ["src"],
  "references": [{ "path": "../../packages/blocks-ui-core" }]
}
```

- [ ] **Step 3: Create tsconfig.build.json**

```json
{ "extends": "./tsconfig.json", "exclude": ["src/**/*.test.ts"] }
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';
import { existsSync } from 'fs';

export default defineConfig({
  resolve: {
    alias: [
      ...(existsSync(path.resolve(__dirname, '../../../pages/packages/pages-primitives/src')) ? [{ find: '@casehubio/pages-primitives', replacement: path.resolve(__dirname, '../../../pages/packages/pages-primitives/src') }] : []),
      ...(existsSync(path.resolve(__dirname, '../../../pages/packages/pages-table/src')) ? [{ find: '@casehubio/pages-table', replacement: path.resolve(__dirname, '../../../pages/packages/pages-table/src') }] : []),
      ...(existsSync(path.resolve(__dirname, '../../../pages/packages/pages-viz/src')) ? [{ find: '@casehubio/pages-viz', replacement: path.resolve(__dirname, '../../../pages/packages/pages-viz/src') }] : []),
      { find: '@casehubio/blocks-ui-core', replacement: path.resolve(__dirname, '../../packages/blocks-ui-core/src') },
      ...(existsSync(path.resolve(__dirname, '../../../pages/packages/pages-ui-tokens/src')) ? [{ find: '@casehubio/pages-ui-tokens', replacement: path.resolve(__dirname, '../../../pages/packages/pages-ui-tokens/src') }] : []),
      ...(existsSync(path.resolve(__dirname, '../../../pages/packages/pages-component/src')) ? [{ find: /^@casehubio\/pages-component\/dist\/(.*)/, replacement: path.resolve(__dirname, '../../../pages/packages/pages-component/src/$1') }] : []),
      ...(existsSync(path.resolve(__dirname, '../../../pages/packages/pages-component/src')) ? [{ find: '@casehubio/pages-component', replacement: path.resolve(__dirname, '../../../pages/packages/pages-component/src') }] : []),
      ...(existsSync(path.resolve(__dirname, '../../../pages/packages/pages-data/src')) ? [{ find: /^@casehubio\/pages-data\/dist\/(.*)/, replacement: path.resolve(__dirname, '../../../pages/packages/pages-data/src/$1') }] : []),
      ...(existsSync(path.resolve(__dirname, '../../../pages/packages/pages-data/src')) ? [{ find: '@casehubio/pages-data', replacement: path.resolve(__dirname, '../../../pages/packages/pages-data/src') }] : []),
    ],
  },
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
    environment: 'jsdom',
    globals: true,
  },
});
```

- [ ] **Step 5: Create types.ts**

```typescript
export interface GroupStyleConfig {
  readonly label?: string;
  readonly className?: string;
  readonly icon?: string;
}

export const GroupedDataViewTopics = {
  GROUP_TOGGLE: 'grouped-data.group-toggle',
  ROW_ACTIVATED: 'grouped-data.row-activated',
} as const;
```

- [ ] **Step 6: Create index.ts (stub — will be updated in Task 2)**

```typescript
export type { GroupStyleConfig } from './types.js';
export { GroupedDataViewTopics } from './types.js';
```

- [ ] **Step 7: Install dependencies and verify build**

Run: `yarn install && yarn workspace @casehubio/blocks-ui-grouped-data-view typecheck`
Expected: clean typecheck (types.ts and index.ts only)

- [ ] **Step 8: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add components/grouped-data-view/
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "feat(grouped-data-view): package scaffolding and types — closes nothing"
```

---

### Task 2: Data preparation — _toGroupingKey and _prepareDataSet

**Files:**
- Create: `components/grouped-data-view/src/grouped-data-view.ts` (partial — data preparation only)
- Create: `components/grouped-data-view/src/grouped-data-view.test.ts`

**Interfaces:**
- Consumes: `GroupStyleConfig`, `GroupedDataViewTopics` from Task 1
- Produces: `GroupedDataView` class with `_toGroupingKey()` and `_prepareDataSet()` methods — used by Task 3. Also `groupBy`, `groupOrder` properties.

This task implements and tests the two pure data-transformation methods in isolation, before wiring them into the render pipeline.

- [ ] **Step 1: Write failing tests for _toGroupingKey**

Create `components/grouped-data-view/src/grouped-data-view.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import './grouped-data-view.js';
import type { ColumnId } from '@casehubio/pages-data/dist/dataset/types.js';

type GroupedDataViewEl = HTMLElement & {
  groupBy: string;
  groupOrder?: string[];
  updateComplete: Promise<boolean>;
  _toGroupingKey(columnId: string): {
    sourceId: ColumnId;
    columnId: ColumnId;
    strategy: { mode: string };
    maxIntervals: number;
    emptyIntervals: boolean;
    ascendingOrder: boolean;
  };
  _prepareDataSet(
    ds: { columns: readonly any[]; rows: readonly any[] },
    keyColumn: string,
    groupOrder?: string[],
  ): { columns: readonly any[]; rows: readonly any[] };
};

describe('_toGroupingKey', () => {
  it('converts string column ID to GroupingKey with distinct strategy', () => {
    const el = document.createElement('grouped-data-view') as GroupedDataViewEl;
    const key = el._toGroupingKey('lane');
    expect(key.sourceId).toBe('lane');
    expect(key.columnId).toBe('lane');
    expect(key.strategy).toEqual({ mode: 'distinct' });
    expect(key.maxIntervals).toBe(100);
    expect(key.emptyIntervals).toBe(false);
    expect(key.ascendingOrder).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn workspace @casehubio/blocks-ui-grouped-data-view test`
Expected: FAIL — `grouped-data-view` element not defined

- [ ] **Step 3: Write minimal grouped-data-view.ts with _toGroupingKey**

Create `components/grouped-data-view/src/grouped-data-view.ts`:

```typescript
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { DataSourceMixin } from '@casehubio/blocks-ui-core';
import type { ColumnId } from '@casehubio/pages-data/dist/dataset/types.js';
import type { TypedDataSet } from '@casehubio/pages-data/dist/dataset/types.js';
import type { GroupingKey } from '@casehubio/pages-data/dist/dataset/group.js';
import type { GroupStyleConfig } from './types.js';

@customElement('grouped-data-view')
export class GroupedDataView extends DataSourceMixin(LitElement) {
  @property({ type: String, attribute: 'group-by' }) groupBy = '';
  @property({ attribute: false }) groupOrder?: string[];
  @property({ attribute: false }) groupConfig?: Map<string, GroupStyleConfig>;
  @property({ attribute: false }) groupStyle?: (groupName: string) => GroupStyleConfig | undefined;

  _toGroupingKey(columnId: string): GroupingKey {
    return {
      sourceId: columnId as ColumnId,
      columnId: columnId as ColumnId,
      strategy: { mode: 'distinct' },
      maxIntervals: 100,
      emptyIntervals: false,
      ascendingOrder: true,
    };
  }

  _prepareDataSet(
    ds: TypedDataSet,
    keyColumn: string,
    groupOrder?: string[],
  ): TypedDataSet {
    const colId = keyColumn as ColumnId;

    if (groupOrder) {
      const orderIndex = new Map(groupOrder.map((name, i) => [name, i]));
      const sorted = [...ds.rows].sort((a, b) => {
        const aCell = a.cell(colId);
        const bCell = b.cell(colId);
        const aName = aCell.type !== 'NULL' ? String(aCell.value) : '';
        const bName = bCell.type !== 'NULL' ? String(bCell.value) : '';
        const aIdx = orderIndex.get(aName) ?? groupOrder.length;
        const bIdx = orderIndex.get(bName) ?? groupOrder.length;
        if (aIdx !== bIdx) return aIdx - bIdx;
        return aName < bName ? -1 : aName > bName ? 1 : 0;
      });
      return { columns: ds.columns, rows: sorted };
    }

    const sorted = [...ds.rows].sort((a, b) => {
      const aCell = a.cell(colId);
      const bCell = b.cell(colId);
      const aName = aCell.type !== 'NULL' ? String(aCell.value) : '';
      const bName = bCell.type !== 'NULL' ? String(bCell.value) : '';
      return aName < bName ? -1 : aName > bName ? 1 : 0;
    });
    return { columns: ds.columns, rows: sorted };
  }

  override render() {
    return html`<div></div>`;
  }
}
```

- [ ] **Step 4: Run test to verify _toGroupingKey passes**

Run: `yarn workspace @casehubio/blocks-ui-grouped-data-view test`
Expected: PASS

- [ ] **Step 5: Write failing tests for _prepareDataSet**

Add to `grouped-data-view.test.ts`:

```typescript
import { columnId, ColumnType } from '@casehubio/pages-data/dist/dataset/types.js';
import { fromRows } from '@casehubio/pages-data/dist/dataset/conversion.js';

const LANE_COL = columnId('lane');
const NAME_COL = columnId('name');

const COLUMNS = [
  { id: LANE_COL, name: 'Lane', type: ColumnType.TEXT, getValue: (r: { lane: string }) => r.lane },
  { id: NAME_COL, name: 'Name', type: ColumnType.TEXT, getValue: (r: { name: string }) => r.name },
];

function makeDataSet(items: Array<{ lane: string; name: string }>) {
  return fromRows(items, COLUMNS);
}

describe('_prepareDataSet', () => {
  let el: GroupedDataViewEl;
  beforeEach(() => {
    el = document.createElement('grouped-data-view') as GroupedDataViewEl;
  });

  it('sorts interleaved data to ensure group adjacency', () => {
    const ds = makeDataSet([
      { lane: 'HIGH', name: 'a' },
      { lane: 'NORMAL', name: 'b' },
      { lane: 'HIGH', name: 'c' },
      { lane: 'NORMAL', name: 'd' },
    ]);
    const result = el._prepareDataSet(ds, 'lane');
    const lanes = result.rows.map(r => {
      const cell = r.cell(LANE_COL);
      return cell.type !== 'NULL' ? String(cell.value) : '';
    });
    expect(lanes).toEqual(['HIGH', 'HIGH', 'NORMAL', 'NORMAL']);
  });

  it('applies explicit groupOrder', () => {
    const ds = makeDataSet([
      { lane: 'NORMAL', name: 'a' },
      { lane: 'CRITICAL', name: 'b' },
      { lane: 'HIGH', name: 'c' },
    ]);
    const result = el._prepareDataSet(ds, 'lane', ['CRITICAL', 'HIGH', 'NORMAL']);
    const lanes = result.rows.map(r => {
      const cell = r.cell(LANE_COL);
      return cell.type !== 'NULL' ? String(cell.value) : '';
    });
    expect(lanes).toEqual(['CRITICAL', 'HIGH', 'NORMAL']);
  });

  it('places unordered groups after ordered groups alphabetically', () => {
    const ds = makeDataSet([
      { lane: 'NORMAL', name: 'a' },
      { lane: 'UNKNOWN', name: 'b' },
      { lane: 'CRITICAL', name: 'c' },
      { lane: 'DEBUG', name: 'd' },
    ]);
    const result = el._prepareDataSet(ds, 'lane', ['CRITICAL', 'NORMAL']);
    const lanes = result.rows.map(r => {
      const cell = r.cell(LANE_COL);
      return cell.type !== 'NULL' ? String(cell.value) : '';
    });
    expect(lanes).toEqual(['CRITICAL', 'NORMAL', 'DEBUG', 'UNKNOWN']);
  });

  it('returns empty dataset without error', () => {
    const ds = makeDataSet([]);
    const result = el._prepareDataSet(ds, 'lane');
    expect(result.rows).toHaveLength(0);
  });

  it('preserves within-group order (stable sort)', () => {
    const ds = makeDataSet([
      { lane: 'HIGH', name: 'second' },
      { lane: 'HIGH', name: 'first' },
      { lane: 'LOW', name: 'only' },
    ]);
    const result = el._prepareDataSet(ds, 'lane');
    const names = result.rows
      .filter(r => { const c = r.cell(LANE_COL); return c.type !== 'NULL' && String(c.value) === 'HIGH'; })
      .map(r => { const c = r.cell(NAME_COL); return c.type !== 'NULL' ? String(c.value) : ''; });
    expect(names).toEqual(['second', 'first']);
  });
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn workspace @casehubio/blocks-ui-grouped-data-view test`
Expected: ALL PASS

- [ ] **Step 7: Update index.ts barrel export**

```typescript
export type { GroupStyleConfig } from './types.js';
export { GroupedDataViewTopics } from './types.js';
export { GroupedDataView } from './grouped-data-view.js';
```

- [ ] **Step 8: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add components/grouped-data-view/
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "feat(grouped-data-view): data preparation — _toGroupingKey + _prepareDataSet with TDD"
```

---

### Task 3: Render pipeline — bridge to PagesGroupedView

**Files:**
- Modify: `components/grouped-data-view/src/grouped-data-view.ts`
- Modify: `components/grouped-data-view/src/grouped-data-view.test.ts`

**Interfaces:**
- Consumes: `GroupedDataView` class from Task 2 with `_toGroupingKey()`, `_prepareDataSet()`, properties
- Produces: Complete `GroupedDataView` with render pipeline, event capture, `configure()`, `refresh()` — ready for consumer use

This task wires the data preparation into the render lifecycle, creates the `<pages-grouped-view>` child element, and handles event bridging.

- [ ] **Step 1: Write failing test — renders pages-grouped-view child**

Add to `grouped-data-view.test.ts`:

```typescript
import { beforeEach, afterEach } from 'vitest';

let originalFetch: typeof globalThis.fetch;

describe('grouped-data-view rendering', () => {
  let el: GroupedDataViewEl & {
    preset?: string;
    defaultExpanded?: boolean;
    columnConfig?: readonly any[];
    sortable?: boolean;
    selection?: string;
    rowStyle?: readonly any[];
    columnRenderers?: ReadonlyMap<any, any>;
    configure(props: Record<string, unknown>): void;
    refresh(): void;
    dataSet: any;
  };

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    el = document.createElement('grouped-data-view') as any;
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
    globalThis.fetch = originalFetch;
  });

  it('creates pages-grouped-view in shadow DOM when groupBy and dataSet are present', async () => {
    el.groupBy = 'lane';
    el.dataSet = makeDataSet([
      { lane: 'HIGH', name: 'pr-1' },
      { lane: 'NORMAL', name: 'pr-2' },
    ]);
    await el.updateComplete;
    const grouped = el.shadowRoot!.querySelector('pages-grouped-view');
    expect(grouped).toBeTruthy();
  });

  it('does not render when groupBy is missing', async () => {
    el.dataSet = makeDataSet([{ lane: 'HIGH', name: 'pr-1' }]);
    await el.updateComplete;
    const grouped = el.shadowRoot!.querySelector('pages-grouped-view');
    expect(grouped).toBeFalsy();
  });

  it('does not render when dataSet is missing', async () => {
    el.groupBy = 'lane';
    await el.updateComplete;
    const grouped = el.shadowRoot!.querySelector('pages-grouped-view');
    expect(grouped).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn workspace @casehubio/blocks-ui-grouped-data-view test`
Expected: FAIL — pages-grouped-view not created

- [ ] **Step 3: Implement render pipeline**

Update `grouped-data-view.ts` — replace the `render()` method and add lifecycle:

```typescript
import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { DataSourceMixin, emitPagesEvent } from '@casehubio/blocks-ui-core';
import type { ColumnId, TypedDataSet } from '@casehubio/pages-data/dist/dataset/types.js';
import type { GroupingKey } from '@casehubio/pages-data/dist/dataset/group.js';
import type { TableColumnConfig, ColumnRenderer, SelectionMode } from '@casehubio/pages-component';
import type { RowStyleRule } from '@casehubio/pages-component';
import type { GroupStyleConfig } from './types.js';
import { GroupedDataViewTopics } from './types.js';

interface PagesGroupedViewHost extends HTMLElement {
  props: Record<string, unknown> | undefined;
  dataSet: TypedDataSet | undefined;
  loading: boolean;
  error: string;
  setColumnRenderers(v: ReadonlyMap<ColumnId, ColumnRenderer> | undefined): void;
  setGetRowKey(v: ((row: import('@casehubio/pages-data/dist/dataset/types.js').TypedRow) => string) | undefined): void;
  setGetRowClass(v: ((row: import('@casehubio/pages-data/dist/dataset/types.js').TypedRow) => string) | undefined): void;
}

@customElement('grouped-data-view')
export class GroupedDataView extends DataSourceMixin(LitElement) {
  @property({ type: String, attribute: 'group-by' }) groupBy = '';
  @property({ attribute: false }) groupOrder?: string[];
  @property({ attribute: false }) groupConfig?: Map<string, GroupStyleConfig>;
  @property({ attribute: false }) groupStyle?: (groupName: string) => GroupStyleConfig | undefined;
  @property({ type: String }) preset: 'sectioned' | 'spreadsheet' | 'list' = 'sectioned';
  @property({ type: Boolean, attribute: 'default-expanded' }) defaultExpanded = true;
  @property({ attribute: false }) columnConfig?: readonly TableColumnConfig[];
  @property({ attribute: false }) columnRenderers?: ReadonlyMap<ColumnId, ColumnRenderer>;
  @property({ attribute: false }) rowStyle?: readonly RowStyleRule[];
  @property({ type: String }) selection?: SelectionMode;
  @property({ type: Boolean }) sortable = false;

  private _groupedView: PagesGroupedViewHost | null = null;

  static override styles = css`
    :host { display: block; font-family: var(--pages-font-family, system-ui); }
    .empty { color: var(--pages-neutral-9, #888); font-style: italic; padding: var(--pages-space-4, 1rem); }
  `;

  _toGroupingKey(columnId: string): GroupingKey {
    return {
      sourceId: columnId as ColumnId,
      columnId: columnId as ColumnId,
      strategy: { mode: 'distinct' },
      maxIntervals: 100,
      emptyIntervals: false,
      ascendingOrder: true,
    };
  }

  _prepareDataSet(
    ds: TypedDataSet,
    keyColumn: string,
    groupOrder?: string[],
  ): TypedDataSet {
    const colId = keyColumn as ColumnId;

    if (groupOrder) {
      const orderIndex = new Map(groupOrder.map((name, i) => [name, i]));
      const sorted = [...ds.rows].sort((a, b) => {
        const aCell = a.cell(colId);
        const bCell = b.cell(colId);
        const aName = aCell.type !== 'NULL' ? String(aCell.value) : '';
        const bName = bCell.type !== 'NULL' ? String(bCell.value) : '';
        const aIdx = orderIndex.get(aName) ?? groupOrder.length;
        const bIdx = orderIndex.get(bName) ?? groupOrder.length;
        if (aIdx !== bIdx) return aIdx - bIdx;
        return aName < bName ? -1 : aName > bName ? 1 : 0;
      });
      return { columns: ds.columns, rows: sorted };
    }

    const sorted = [...ds.rows].sort((a, b) => {
      const aCell = a.cell(colId);
      const bCell = b.cell(colId);
      const aName = aCell.type !== 'NULL' ? String(aCell.value) : '';
      const bName = bCell.type !== 'NULL' ? String(bCell.value) : '';
      return aName < bName ? -1 : aName > bName ? 1 : 0;
    });
    return { columns: ds.columns, rows: sorted };
  }

  private _ensureGroupedView(): PagesGroupedViewHost {
    if (!this._groupedView) {
      this._groupedView = document.createElement('pages-grouped-view') as PagesGroupedViewHost;
      this._groupedView.addEventListener('pages-event', (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail.topic === 'group-toggle') {
          e.stopPropagation();
          emitPagesEvent(this, GroupedDataViewTopics.GROUP_TOGGLE, detail.payload);
        }
      });
      this._groupedView.addEventListener('row-activate', (e: Event) => {
        e.stopPropagation();
        emitPagesEvent(this, GroupedDataViewTopics.ROW_ACTIVATED, (e as CustomEvent).detail);
      });
    }
    return this._groupedView;
  }

  override updated(changed: PropertyValues): void {
    super.willUpdate(changed);

    if (!this.groupBy || !this.dataSet) {
      if (this._groupedView?.parentNode) {
        this._groupedView.remove();
      }
      return;
    }

    const gv = this._ensureGroupedView();

    const preparedDataSet = this._prepareDataSet(this.dataSet, this.groupBy, this.groupOrder);

    gv.props = {
      groupBy: this._toGroupingKey(this.groupBy),
      preset: this.preset,
      defaultExpanded: this.defaultExpanded,
      ...(this.columnConfig ? { columnConfig: this.columnConfig } : {}),
      ...(this.rowStyle ? { rowStyle: this.rowStyle } : {}),
      ...(this.selection ? { selection: this.selection } : {}),
      ...(this.sortable ? { sortable: true } : {}),
    };

    gv.dataSet = preparedDataSet;

    if (this.columnRenderers) {
      gv.setColumnRenderers(this.columnRenderers);
    }

    const container = this.shadowRoot!.querySelector('.container');
    if (container && !gv.parentNode) {
      container.appendChild(gv);
    }
  }

  override configure(props: Record<string, unknown>): void {
    if (props.groupBy !== undefined) this.groupBy = props.groupBy as string;
    if (props.groupOrder !== undefined) this.groupOrder = props.groupOrder as string[];
    if (props.groupConfig !== undefined) this.groupConfig = props.groupConfig as Map<string, GroupStyleConfig>;
    if (props.groupStyle !== undefined) this.groupStyle = props.groupStyle as (name: string) => GroupStyleConfig | undefined;
    if (props.columnConfig !== undefined) this.columnConfig = props.columnConfig as readonly TableColumnConfig[];
    if (props.columnRenderers !== undefined) this.columnRenderers = props.columnRenderers as ReadonlyMap<ColumnId, ColumnRenderer>;
    if (props.rowStyle !== undefined) this.rowStyle = props.rowStyle as readonly RowStyleRule[];
    if (props.selection !== undefined) this.selection = props.selection as SelectionMode;
    if (props.sortable !== undefined) this.sortable = props.sortable as boolean;
    if (props.preset !== undefined) this.preset = props.preset as 'sectioned' | 'spreadsheet' | 'list';
    if (props.defaultExpanded !== undefined) this.defaultExpanded = props.defaultExpanded as boolean;
    super.configure(props);
  }

  async refresh(): Promise<void> {
    this.dataSource.refresh();
  }

  override render() {
    if (this.loading) return html`<div class="empty">Loading...</div>`;
    if (this.error) return html`<div class="empty">${this.error}</div>`;
    if (!this.groupBy || !this.dataSet || this.dataSet.rows.length === 0) {
      return html`<div class="empty">No data</div>`;
    }
    return html`<div class="container"></div>`;
  }
}
```

- [ ] **Step 4: Run tests to verify rendering passes**

Run: `yarn workspace @casehubio/blocks-ui-grouped-data-view test`
Expected: ALL PASS

- [ ] **Step 5: Write failing tests for event capture**

Add to `grouped-data-view.test.ts`:

```typescript
describe('event capture', () => {
  let el: any;

  beforeEach(() => {
    el = document.createElement('grouped-data-view') as any;
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
  });

  it('intercepts group-toggle and re-dispatches as grouped-data.group-toggle', async () => {
    el.groupBy = 'lane';
    el.dataSet = makeDataSet([{ lane: 'HIGH', name: 'pr-1' }]);
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('pages-event', handler);

    const gv = el.shadowRoot!.querySelector('pages-grouped-view');
    expect(gv).toBeTruthy();

    gv!.dispatchEvent(new CustomEvent('pages-event', {
      bubbles: true,
      composed: true,
      detail: { topic: 'group-toggle', payload: { group: 'HIGH', expanded: false } },
    }));

    const match = handler.mock.calls.find(
      (c: unknown[]) => (c[0] as CustomEvent).detail.topic === 'grouped-data.group-toggle'
    );
    expect(match).toBeTruthy();
    expect((match![0] as CustomEvent).detail.payload).toEqual({ group: 'HIGH', expanded: false });

    el.removeEventListener('pages-event', handler);
  });

  it('intercepts row-activate and re-dispatches as grouped-data.row-activated', async () => {
    el.groupBy = 'lane';
    el.dataSet = makeDataSet([{ lane: 'HIGH', name: 'pr-1' }]);
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('pages-event', handler);

    const gv = el.shadowRoot!.querySelector('pages-grouped-view');
    gv!.dispatchEvent(new CustomEvent('row-activate', {
      bubbles: true,
      composed: true,
      detail: { row: { id: 'pr-1' }, key: 'pr-1' },
    }));

    const match = handler.mock.calls.find(
      (c: unknown[]) => (c[0] as CustomEvent).detail.topic === 'grouped-data.row-activated'
    );
    expect(match).toBeTruthy();

    el.removeEventListener('pages-event', handler);
  });
});
```

- [ ] **Step 6: Run tests to verify events pass**

Run: `yarn workspace @casehubio/blocks-ui-grouped-data-view test`
Expected: ALL PASS

- [ ] **Step 7: Write failing tests for configure()**

Add to `grouped-data-view.test.ts`:

```typescript
describe('configure()', () => {
  let el: any;

  beforeEach(() => {
    el = document.createElement('grouped-data-view') as any;
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
  });

  it('sets all properties atomically', () => {
    const groupConfig = new Map([['HIGH', { className: 'lane-high' }]]);
    el.configure({
      groupBy: 'lane',
      groupOrder: ['CRITICAL', 'HIGH', 'NORMAL'],
      groupConfig,
      preset: 'spreadsheet',
      sortable: true,
    });
    expect(el.groupBy).toBe('lane');
    expect(el.groupOrder).toEqual(['CRITICAL', 'HIGH', 'NORMAL']);
    expect(el.groupConfig).toBe(groupConfig);
    expect(el.preset).toBe('spreadsheet');
    expect(el.sortable).toBe(true);
  });
});
```

- [ ] **Step 8: Run full test suite**

Run: `yarn workspace @casehubio/blocks-ui-grouped-data-view test`
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add components/grouped-data-view/
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "feat(grouped-data-view): render pipeline — PagesGroupedView bridge, events, configure"
```

---

### Task 4: DataSourceMixin integration and showcase page

**Files:**
- Modify: `components/grouped-data-view/src/grouped-data-view.test.ts`
- Create: `examples/mock-data/grouped-items.json`
- Create: `examples/src/pages/grouped-data-view-page.ts`
- Modify: `examples/src/shell.ts` (add nav entry)

**Interfaces:**
- Consumes: Complete `GroupedDataView` from Task 3
- Produces: DataSourceMixin integration tests, showcase page for visual verification

- [ ] **Step 1: Write failing tests for DataSourceMixin integration**

Add to `grouped-data-view.test.ts`:

```typescript
describe('DataSourceMixin integration', () => {
  let el: any;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    el = document.createElement('grouped-data-view') as any;
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
    globalThis.fetch = originalFetch;
  });

  it('renders loading state during fetch', async () => {
    const mockFetch = vi.fn(() => new Promise(() => {}));
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    el.groupBy = 'lane';
    el.endpoint = 'http://test.local/api/items';
    await el.updateComplete;
    await vi.waitFor(() => expect(el.loading).toBe(true));
    expect(el.shadowRoot!.textContent).toContain('Loading');
  });

  it('renders error state on fetch failure', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('', { status: 500 }));
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    el.groupBy = 'lane';
    el.endpoint = 'http://test.local/api/items';
    await el.updateComplete;
    await vi.waitFor(() => expect(el.shadowRoot!.textContent).toContain('HTTP 500'));
  });

  it('forwards dataSet to pages-grouped-view when set directly (hosted push)', async () => {
    el.groupBy = 'lane';
    el.dataSet = makeDataSet([
      { lane: 'HIGH', name: 'pr-1' },
      { lane: 'NORMAL', name: 'pr-2' },
    ]);
    await el.updateComplete;
    const gv = el.shadowRoot!.querySelector('pages-grouped-view') as any;
    expect(gv).toBeTruthy();
    expect(gv.dataSet).toBeTruthy();
    expect(gv.dataSet.rows).toHaveLength(2);
  });

  it('never sets lookup on pages-grouped-view props', async () => {
    el.groupBy = 'lane';
    el.dataSet = makeDataSet([{ lane: 'HIGH', name: 'pr-1' }]);
    await el.updateComplete;
    const gv = el.shadowRoot!.querySelector('pages-grouped-view') as any;
    expect(gv.props.lookup).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `yarn workspace @casehubio/blocks-ui-grouped-data-view test`
Expected: ALL PASS

- [ ] **Step 3: Create mock data for showcase**

Create `examples/mock-data/grouped-items.json`:

```json
{
  "items": [
    { "lane": "CRITICAL", "title": "Fix auth bypass in login flow", "author": "alice", "waitTime": "2h 15m", "trustScore": 95 },
    { "lane": "CRITICAL", "title": "Patch SQL injection in search", "author": "bob", "waitTime": "1h 30m", "trustScore": 88 },
    { "lane": "HIGH", "title": "Upgrade TLS certificates", "author": "carol", "waitTime": "4h 10m", "trustScore": 82 },
    { "lane": "HIGH", "title": "Fix race condition in batch processor", "author": "dave", "waitTime": "3h 45m", "trustScore": 76 },
    { "lane": "HIGH", "title": "Add retry logic for webhook delivery", "author": "eve", "waitTime": "5h 20m", "trustScore": 71 },
    { "lane": "NORMAL", "title": "Update README with new API docs", "author": "frank", "waitTime": "8h 00m", "trustScore": 90 },
    { "lane": "NORMAL", "title": "Refactor date formatting utils", "author": "grace", "waitTime": "6h 30m", "trustScore": 85 },
    { "lane": "NORMAL", "title": "Add unit tests for config parser", "author": "hank", "waitTime": "7h 15m", "trustScore": 79 },
    { "lane": "NORMAL", "title": "Migrate deprecated API calls", "author": "iris", "waitTime": "10h 00m", "trustScore": 73 }
  ]
}
```

- [ ] **Step 4: Create showcase page**

Create `examples/src/pages/grouped-data-view-page.ts`:

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../../../components/grouped-data-view/src/grouped-data-view.js';
import type { GroupStyleConfig } from '../../../components/grouped-data-view/src/types.js';
import itemData from '../../mock-data/grouped-items.json';
import { fromRows } from '@casehubio/pages-data/dist/dataset/conversion.js';
import { columnId, ColumnType } from '@casehubio/pages-data/dist/dataset/types.js';
import type { TypedDataSet } from '@casehubio/pages-data/dist/dataset/types.js';

interface QueueItem {
  lane: string;
  title: string;
  author: string;
  waitTime: string;
  trustScore: number;
}

const COLUMNS = [
  { id: columnId('lane'), name: 'Lane', type: ColumnType.LABEL, getValue: (r: QueueItem) => r.lane },
  { id: columnId('title'), name: 'Title', type: ColumnType.TEXT, getValue: (r: QueueItem) => r.title },
  { id: columnId('author'), name: 'Author', type: ColumnType.TEXT, getValue: (r: QueueItem) => r.author },
  { id: columnId('waitTime'), name: 'Wait Time', type: ColumnType.TEXT, getValue: (r: QueueItem) => r.waitTime },
  { id: columnId('trustScore'), name: 'Trust Score', type: ColumnType.NUMBER, getValue: (r: QueueItem) => r.trustScore },
];

const LANE_CONFIG: Map<string, GroupStyleConfig> = new Map([
  ['CRITICAL', { className: 'lane-critical', icon: '🔴', label: 'Critical' }],
  ['HIGH', { className: 'lane-high', icon: '🟠', label: 'High Priority' }],
  ['NORMAL', { className: 'lane-normal', icon: '🟢', label: 'Normal' }],
]);

@customElement('grouped-data-view-page')
export class GroupedDataViewPage extends LitElement {
  @state() private _eventLog: string[] = [];
  @state() private _dataSet: TypedDataSet;

  constructor() {
    super();
    this._dataSet = fromRows(itemData.items as QueueItem[], COLUMNS);
  }

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin-bottom: 8px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin-bottom: 24px; color: var(--pages-neutral-11, #555); font-size: 14px; }
    h3 { margin: 24px 0 12px; font-size: 16px; font-weight: 600; }
    .demo-section { margin-bottom: 32px; padding: 16px; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 6px; background: var(--pages-neutral-1, #fff); }
    .event-log { margin-top: 24px; padding: 16px; background: var(--pages-neutral-2, #f5f5f5); border-radius: 8px; max-height: 150px; overflow-y: auto; }
    .event-log h3 { margin: 0 0 8px; font-size: 14px; }
    .event-log pre { margin: 0; font-size: 13px; font-family: monospace; white-space: pre-wrap; }
  `;

  private _handleEvent(e: CustomEvent) {
    const { topic, payload } = e.detail;
    this._eventLog = [
      `[${new Date().toLocaleTimeString()}] ${topic}: ${JSON.stringify(payload)}`,
      ...this._eventLog.slice(0, 9),
    ];
  }

  override render() {
    return html`
      <h2>Grouped Data View</h2>
      <p>Items grouped by a key column with per-group pages-table rendering. Thin wrapper over pages-grouped-view.</p>

      <h3>Sectioned with Lane Styling</h3>
      <div class="demo-section" @pages-event=${this._handleEvent}>
        <grouped-data-view
          group-by="lane"
          .groupOrder=${['CRITICAL', 'HIGH', 'NORMAL']}
          .groupConfig=${LANE_CONFIG}
          .dataSet=${this._dataSet}
          sortable
        ></grouped-data-view>
      </div>

      <h3>Spreadsheet Preset</h3>
      <div class="demo-section">
        <grouped-data-view
          group-by="lane"
          preset="spreadsheet"
          .dataSet=${this._dataSet}
        ></grouped-data-view>
      </div>

      <h3>Empty State</h3>
      <div class="demo-section">
        <grouped-data-view group-by="lane"></grouped-data-view>
      </div>

      ${this._eventLog.length > 0 ? html`
        <div class="event-log">
          <h3>Event Log</h3>
          <pre>${this._eventLog.join('\n')}</pre>
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'grouped-data-view-page': GroupedDataViewPage;
  }
}
```

- [ ] **Step 5: Add nav entry in shell.ts**

Add to the `Components` category in the `NAV` array in `examples/src/shell.ts`:

```typescript
{ id: 'grouped-data-view', label: 'Grouped Data View', hash: '#components/grouped-data-view' },
```

Add the page import and route mapping in the shell's page resolver (follow existing pattern for other pages).

- [ ] **Step 6: Run full test suite across the monorepo**

Run: `yarn test`
Expected: ALL PASS (no regressions)

- [ ] **Step 7: Run typecheck**

Run: `yarn typecheck`
Expected: Clean

- [ ] **Step 8: Start dev server and verify showcase visually**

Run: `yarn workspace @casehubio/blocks-ui-examples dev`
Navigate to `#components/grouped-data-view` in the browser. Verify:
- Sectioned view shows CRITICAL/HIGH/NORMAL sections with tables
- Spreadsheet view shows inline group rows
- Empty state shows "No data"
- Events appear in the log on row click and group toggle

- [ ] **Step 9: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add components/grouped-data-view/ examples/
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "feat(grouped-data-view): DataSourceMixin integration and showcase page"
```

---

### Task 5: CLAUDE.md and workspace registration

**Files:**
- Modify: `CLAUDE.md` (add grouped-data-view to Key Directories table)

**Interfaces:**
- Consumes: Complete component from Tasks 1-4
- Produces: Updated project documentation

- [ ] **Step 1: Update CLAUDE.md Key Directories table**

Add entry after `compliance-summary`:

```markdown
| `components/grouped-data-view/` | Grouped data view — items grouped by column key with per-group pages-table, DataSourceMixin, group styling. Thin wrapper over pages-grouped-view. |
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add CLAUDE.md
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "docs: add grouped-data-view to CLAUDE.md key directories"
```
