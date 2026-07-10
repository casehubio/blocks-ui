# Trust Score Trend Sparkline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> subagent-driven-development (recommended) or executing-plans to
> implement this plan task-by-task. Each task follows TDD
> (test-driven-development) and uses ide-tooling for structural
> editing. Steps use checkbox (`- [ ]`) syntax for tracking.

**Focal issue:** #45 — feat(trust-score-panel): trend sparkline with simulated data source
**Issue group:** #45

**Goal:** Add a trend sparkline to trust-score-panel, powered by a shared
sparkline renderer and a reusable TrendSourceMixin, with live-updating
examples using `simulated()` from pages-data.

**Architecture:** Extract sparkline rendering from kpi-metric-row into
blocks-ui-core as a shared utility. Create TrendSourceMixin in
blocks-ui-core for the "primary data + time-series trend" pattern. Wire
both into trust-score-panel. Examples use `simulated()` and `trendData`
to demonstrate live and static modes.

**Tech Stack:** TypeScript, Lit 3, pages-data (TypedDataSet, simulated,
inlineSource, ScenarioController), vitest, SVG

## Global Constraints

- All colors use CSS custom properties with hex fallbacks
  (`var(--color-success, #28a745)`)
- `TypedRow.cell()` for safe cell access — never `row.number()` (throws
  on NULL/mismatch)
- Column lookup by `Column.name` (not positional index), case-sensitive
- `ColumnId` is a branded opaque type — resolve from column list, never
  cast raw strings
- Tests use vitest + jsdom, `@customElement` decorators,
  `el.updateComplete` for Lit flush

---

### Task 1: Shared Sparkline Renderer

**Files:**
- Create: `packages/blocks-ui-core/src/sparkline/render-sparkline.ts`
- Create: `packages/blocks-ui-core/src/sparkline/index.ts`
- Test: `packages/blocks-ui-core/src/sparkline/render-sparkline.test.ts`
- Modify: `packages/blocks-ui-core/src/index.ts` — add sparkline export

**Interfaces:**
- Consumes: nothing (standalone utility)
- Produces:
  - `renderSparkline(data: readonly number[], options?: SparklineOptions): TemplateResult`
  - `interface SparklineOptions { readonly width?: number; readonly height?: number; readonly color?: string; readonly domain?: [number, number] }`

- [ ] **Step 1: Write failing tests**

Create `packages/blocks-ui-core/src/sparkline/render-sparkline.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { html } from 'lit';
import { renderSparkline } from './render-sparkline.js';

describe('renderSparkline', () => {
  it('returns empty template for empty array', () => {
    const result = renderSparkline([]);
    expect(result).toEqual(html``);
  });

  it('returns empty template for single point', () => {
    const result = renderSparkline([0.5]);
    expect(result).toEqual(html``);
  });

  it('renders SVG for two points', () => {
    const result = renderSparkline([0.2, 0.8]);
    const rendered = renderToString(result);
    expect(rendered).toContain('<svg');
    expect(rendered).toContain('<polyline');
    expect(rendered).toContain('<polygon');
  });

  it('renders SVG for normal data', () => {
    const result = renderSparkline([0.1, 0.5, 0.3, 0.9, 0.7]);
    const rendered = renderToString(result);
    expect(rendered).toContain('<svg');
    expect(rendered).toContain('viewBox="0 0 80 24"');
  });

  it('respects width and height options', () => {
    const result = renderSparkline([0.2, 0.8], { width: 48, height: 20 });
    const rendered = renderToString(result);
    expect(rendered).toContain('viewBox="0 0 48 20"');
  });

  it('respects color option', () => {
    const result = renderSparkline([0.2, 0.8], { color: '#ff0000' });
    const rendered = renderToString(result);
    expect(rendered).toContain('stroke="#ff0000"');
  });

  it('defaults to currentColor', () => {
    const result = renderSparkline([0.2, 0.8]);
    const rendered = renderToString(result);
    expect(rendered).toContain('stroke="currentColor"');
  });

  it('uses fixed domain when provided', () => {
    // With domain [0, 1], a value of 0.5 maps to the midpoint
    // With auto-scale on [0.4, 0.6], 0.5 maps to midpoint too but
    // the Y positions differ because the range differs
    const withDomain = renderToString(
      renderSparkline([0.4, 0.6], { domain: [0, 1], height: 100 }),
    );
    const withoutDomain = renderToString(
      renderSparkline([0.4, 0.6], { height: 100 }),
    );
    // With domain [0,1]: 0.4 maps to y=60, 0.6 maps to y=40
    // Without domain: auto-scales [0.4,0.6], 0.4 maps to y=100, 0.6 maps to y=0
    expect(withDomain).not.toBe(withoutDomain);
  });

  it('generates unique gradient IDs per invocation', () => {
    const a = renderToString(renderSparkline([0.2, 0.8]));
    const b = renderToString(renderSparkline([0.3, 0.7]));
    const idA = a.match(/id="([^"]+)"/)?.[1];
    const idB = b.match(/id="([^"]+)"/)?.[1];
    expect(idA).toBeTruthy();
    expect(idB).toBeTruthy();
    expect(idA).not.toBe(idB);
  });

  it('handles all identical values without crashing', () => {
    const result = renderSparkline([0.5, 0.5, 0.5]);
    const rendered = renderToString(result);
    expect(rendered).toContain('<svg');
  });
});

// Minimal render helper — extracts the string representation of a
// Lit TemplateResult for assertion. Uses Lit's internal structure:
// TemplateResult has .strings (static parts) and .values (dynamic parts).
function renderToString(result: ReturnType<typeof html>): string {
  if (!result || !('strings' in result)) return '';
  const strings = (result as any).strings as readonly string[];
  const values = (result as any).values as readonly unknown[];
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) out += String(values[i]);
  }
  return out;
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/mdproctor/claude/casehub/blocks-ui && yarn workspace @casehubio/blocks-ui-core exec vitest run src/sparkline/render-sparkline.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement renderSparkline**

Create `packages/blocks-ui-core/src/sparkline/render-sparkline.ts`:

```typescript
import { html, type TemplateResult } from 'lit';

export interface SparklineOptions {
  readonly width?: number;
  readonly height?: number;
  readonly color?: string;
  readonly domain?: [number, number];
}

let nextId = 0;

export function renderSparkline(
  data: readonly number[],
  options?: SparklineOptions,
): TemplateResult {
  if (data.length < 2) return html``;

  const w = options?.width ?? 80;
  const h = options?.height ?? 24;
  const color = options?.color ?? 'currentColor';
  const gradientId = `spark-fill-${nextId++}`;

  let min: number;
  let max: number;
  if (options?.domain) {
    [min, max] = options.domain;
  } else {
    min = Math.min(...data);
    max = Math.max(...data);
  }
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');

  const polygonPoints = `0,${h} ${points} ${w},${h}`;

  return html`
    <svg
      width="${w}"
      height="${h}"
      viewBox="0 0 ${w} ${h}"
      aria-hidden="true"
      class="sparkline"
    >
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.2" />
          <stop offset="100%" stop-color="${color}" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <polygon
        points="${polygonPoints}"
        fill="url(#${gradientId})"
      />
      <polyline
        points="${points}"
        fill="none"
        stroke="${color}"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
    </svg>
  `;
}
```

Create `packages/blocks-ui-core/src/sparkline/index.ts`:

```typescript
export { renderSparkline, type SparklineOptions } from './render-sparkline.js';
```

- [ ] **Step 4: Add sparkline export to blocks-ui-core index**

In `packages/blocks-ui-core/src/index.ts`, add:
```typescript
export * from './sparkline/index.js';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/mdproctor/claude/casehub/blocks-ui && yarn workspace @casehubio/blocks-ui-core exec vitest run src/sparkline/render-sparkline.test.ts`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add packages/blocks-ui-core/src/sparkline/ packages/blocks-ui-core/src/index.ts
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "feat(blocks-ui-core): shared sparkline renderer (#45)"
```

---

### Task 2: TrendPoint Type and extractTrendPoints

**Files:**
- Create: `packages/blocks-ui-core/src/data-source/trend-types.ts`
- Test: `packages/blocks-ui-core/src/data-source/trend-types.test.ts`
- Modify: `packages/blocks-ui-core/src/data-source/index.ts` — add exports

**Interfaces:**
- Consumes: `TypedDataSet`, `Column`, `ColumnId`, `ColumnType`, `CellValue`
  from `@casehubio/pages-data`
- Produces:
  - `interface TrendPoint { readonly timestamp: number; readonly score: number }`
  - `function extractTrendPoints(dataSet: TypedDataSet): TrendPoint[]`

- [ ] **Step 1: Write failing tests**

Create `packages/blocks-ui-core/src/data-source/trend-types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { extractTrendPoints, type TrendPoint } from './trend-types.js';
import { ColumnType, columnId } from '@casehubio/pages-data/dist/dataset/types.js';
import { createTypedRow } from '@casehubio/pages-data/dist/dataset/conversion.js';
import type { TypedDataSet, Column, CellValue } from '@casehubio/pages-data/dist/dataset/types.js';

const TS_COL: Column = { id: columnId('timestamp'), name: 'timestamp', type: ColumnType.NUMBER };
const SCORE_COL: Column = { id: columnId('score'), name: 'score', type: ColumnType.NUMBER };
const ID_COL: Column = { id: columnId('id'), name: 'id', type: ColumnType.TEXT };
const COLUMNS = [ID_COL, TS_COL, SCORE_COL];

function makeRow(id: string, ts: number, score: number): ReturnType<typeof createTypedRow> {
  const cells: CellValue[] = [
    { type: ColumnType.TEXT, value: id },
    { type: ColumnType.NUMBER, value: ts },
    { type: ColumnType.NUMBER, value: score },
  ];
  return createTypedRow(cells, COLUMNS);
}

function makeNullScoreRow(id: string, ts: number): ReturnType<typeof createTypedRow> {
  const cells: CellValue[] = [
    { type: ColumnType.TEXT, value: id },
    { type: ColumnType.NUMBER, value: ts },
    { type: 'NULL' as const },
  ];
  return createTypedRow(cells, COLUMNS);
}

describe('extractTrendPoints', () => {
  it('extracts TrendPoint[] from valid TypedDataSet', () => {
    const ds: TypedDataSet = {
      columns: COLUMNS,
      rows: [makeRow('1', 1000, 0.8), makeRow('2', 2000, 0.85)],
    };
    const points = extractTrendPoints(ds);
    expect(points).toEqual([
      { timestamp: 1000, score: 0.8 },
      { timestamp: 2000, score: 0.85 },
    ]);
  });

  it('returns empty array when timestamp column missing', () => {
    const ds: TypedDataSet = {
      columns: [ID_COL, SCORE_COL],
      rows: [],
    };
    expect(extractTrendPoints(ds)).toEqual([]);
  });

  it('returns empty array when score column missing', () => {
    const ds: TypedDataSet = {
      columns: [ID_COL, TS_COL],
      rows: [],
    };
    expect(extractTrendPoints(ds)).toEqual([]);
  });

  it('skips rows with NULL score cells', () => {
    const ds: TypedDataSet = {
      columns: COLUMNS,
      rows: [makeRow('1', 1000, 0.8), makeNullScoreRow('2', 2000), makeRow('3', 3000, 0.9)],
    };
    const points = extractTrendPoints(ds);
    expect(points).toEqual([
      { timestamp: 1000, score: 0.8 },
      { timestamp: 3000, score: 0.9 },
    ]);
  });

  it('skips rows with type-mismatched cells', () => {
    const wrongTypeCols: Column[] = [
      ID_COL,
      { id: columnId('timestamp'), name: 'timestamp', type: ColumnType.TEXT },
      SCORE_COL,
    ];
    const cells: CellValue[] = [
      { type: ColumnType.TEXT, value: '1' },
      { type: ColumnType.TEXT, value: 'not-a-number' },
      { type: ColumnType.NUMBER, value: 0.8 },
    ];
    const ds: TypedDataSet = {
      columns: wrongTypeCols,
      rows: [createTypedRow(cells, wrongTypeCols)],
    };
    expect(extractTrendPoints(ds)).toEqual([]);
  });

  it('returns empty array for empty rows', () => {
    const ds: TypedDataSet = { columns: COLUMNS, rows: [] };
    expect(extractTrendPoints(ds)).toEqual([]);
  });

  it('matches column name case-sensitively', () => {
    const wrongNameCols: Column[] = [
      ID_COL,
      { id: columnId('Timestamp'), name: 'Timestamp', type: ColumnType.NUMBER },
      SCORE_COL,
    ];
    const ds: TypedDataSet = { columns: wrongNameCols, rows: [] };
    expect(extractTrendPoints(ds)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/mdproctor/claude/casehub/blocks-ui && yarn workspace @casehubio/blocks-ui-core exec vitest run src/data-source/trend-types.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement TrendPoint and extractTrendPoints**

Create `packages/blocks-ui-core/src/data-source/trend-types.ts`:

```typescript
import { ColumnType } from '@casehubio/pages-data/dist/dataset/types.js';
import type { TypedDataSet } from '@casehubio/pages-data/dist/dataset/types.js';

export interface TrendPoint {
  readonly timestamp: number;
  readonly score: number;
}

export function extractTrendPoints(dataSet: TypedDataSet): TrendPoint[] {
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

- [ ] **Step 4: Add exports to data-source barrel**

In `packages/blocks-ui-core/src/data-source/index.ts`, add:
```typescript
export { type TrendPoint, extractTrendPoints } from './trend-types.js';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/mdproctor/claude/casehub/blocks-ui && yarn workspace @casehubio/blocks-ui-core exec vitest run src/data-source/trend-types.test.ts`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add packages/blocks-ui-core/src/data-source/trend-types.ts packages/blocks-ui-core/src/data-source/trend-types.test.ts packages/blocks-ui-core/src/data-source/index.ts
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "feat(blocks-ui-core): TrendPoint type and extractTrendPoints (#45)"
```

---

### Task 3: TrendSourceMixin

**Files:**
- Create: `packages/blocks-ui-core/src/data-source/trend-source-mixin.ts`
- Test: `packages/blocks-ui-core/src/data-source/trend-source-mixin.test.ts`
- Modify: `packages/blocks-ui-core/src/data-source/index.ts` — add export

**Interfaces:**
- Consumes:
  - `DataSourceAdapter` from `./data-source-adapter.js`
  - `TrendPoint`, `extractTrendPoints` from `./trend-types.js`
  - `DataSource` from `@casehubio/pages-data`
  - `TypedDataSet` from `@casehubio/pages-data`
- Produces: `TrendSourceMixin` function adding these to the host:
  - `trendSource?: DataSource` — property
  - `trendData?: TrendPoint[]` — property
  - `maxTrendPoints: number` — property (default 30)
  - `trendPoints: TrendPoint[]` — readonly getter
  - `trendLoading: boolean` — readonly getter
  - `trendError: string` — readonly getter

- [ ] **Step 1: Write failing tests**

Create `packages/blocks-ui-core/src/data-source/trend-source-mixin.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { TrendSourceMixin } from './trend-source-mixin.js';
import type { TrendPoint } from './trend-types.js';
import type { DataSource, DataSink } from '@casehubio/pages-data/dist/datasource/types.js';
import { ColumnType, columnId } from '@casehubio/pages-data/dist/dataset/types.js';
import { createTypedRow } from '@casehubio/pages-data/dist/dataset/conversion.js';
import type { TypedDataSet, Column, CellValue } from '@casehubio/pages-data/dist/dataset/types.js';

const TS_COL: Column = { id: columnId('timestamp'), name: 'timestamp', type: ColumnType.NUMBER };
const SCORE_COL: Column = { id: columnId('score'), name: 'score', type: ColumnType.NUMBER };
const ID_COL: Column = { id: columnId('id'), name: 'id', type: ColumnType.TEXT };
const COLUMNS = [ID_COL, TS_COL, SCORE_COL];

function makeRow(id: string, ts: number, score: number) {
  const cells: CellValue[] = [
    { type: ColumnType.TEXT, value: id },
    { type: ColumnType.NUMBER, value: ts },
    { type: ColumnType.NUMBER, value: score },
  ];
  return createTypedRow(cells, COLUMNS);
}

function makeDataSet(rows: Array<[string, number, number]>): TypedDataSet {
  return {
    columns: COLUMNS,
    rows: rows.map(([id, ts, score]) => makeRow(id, ts, score)),
  };
}

/** A DataSource that captures its sink for manual event delivery. */
function capturingSource(): { source: DataSource; sink: () => DataSink } {
  let captured: DataSink | null = null;
  return {
    source: {
      connect(s: DataSink) { captured = s; },
      disconnect() { captured = null; },
    },
    sink: () => {
      if (!captured) throw new Error('Source not connected');
      return captured;
    },
  };
}

@customElement('test-trend-host')
class TestTrendHost extends TrendSourceMixin(LitElement) {}

async function flush(): Promise<void> {
  await new Promise(r => setTimeout(r, 20));
}

describe('TrendSourceMixin', () => {
  afterEach(() => {
    document.querySelectorAll('test-trend-host').forEach(e => e.remove());
  });

  function createElement(): TestTrendHost {
    const el = document.createElement('test-trend-host') as TestTrendHost;
    document.body.appendChild(el);
    return el;
  }

  describe('trendData (direct import)', () => {
    it('trendPoints returns trendData capped to maxTrendPoints', async () => {
      const el = createElement();
      await el.updateComplete;
      const data: TrendPoint[] = Array.from({ length: 50 }, (_, i) => ({
        timestamp: i * 1000,
        score: 0.5 + i * 0.01,
      }));
      el.trendData = data;
      await el.updateComplete;
      expect(el.trendPoints).toHaveLength(30);
      expect(el.trendPoints[0]!.timestamp).toBe(20000);
      expect(el.trendPoints[29]!.timestamp).toBe(49000);
    });

    it('trendPoints sorts by timestamp ascending', async () => {
      const el = createElement();
      await el.updateComplete;
      el.trendData = [
        { timestamp: 3000, score: 0.9 },
        { timestamp: 1000, score: 0.7 },
        { timestamp: 2000, score: 0.8 },
      ];
      await el.updateComplete;
      expect(el.trendPoints.map(p => p.timestamp)).toEqual([1000, 2000, 3000]);
    });

    it('trendLoading is false when using trendData', async () => {
      const el = createElement();
      await el.updateComplete;
      el.trendData = [{ timestamp: 1000, score: 0.8 }];
      await el.updateComplete;
      expect(el.trendLoading).toBe(false);
    });

    it('trendError is empty when using trendData', async () => {
      const el = createElement();
      await el.updateComplete;
      el.trendData = [{ timestamp: 1000, score: 0.8 }];
      await el.updateComplete;
      expect(el.trendError).toBe('');
    });
  });

  describe('trendSource (DataSource)', () => {
    it('populates trendPoints from snapshot event', async () => {
      const el = createElement();
      await el.updateComplete;
      const { source, sink } = capturingSource();
      el.trendSource = source;
      await el.updateComplete;
      sink().apply({ type: 'snapshot', dataset: makeDataSet([['1', 1000, 0.8], ['2', 2000, 0.85]]) });
      await flush();
      await el.updateComplete;
      expect(el.trendPoints).toEqual([
        { timestamp: 1000, score: 0.8 },
        { timestamp: 2000, score: 0.85 },
      ]);
    });

    it('accumulates from append events', async () => {
      const el = createElement();
      await el.updateComplete;
      const { source, sink } = capturingSource();
      el.trendSource = source;
      await el.updateComplete;
      sink().apply({ type: 'snapshot', dataset: makeDataSet([['1', 1000, 0.8]]) });
      await flush();
      await el.updateComplete;
      expect(el.trendPoints).toHaveLength(1);
      sink().apply({ type: 'append', rows: [makeRow('2', 2000, 0.85)] });
      await flush();
      await el.updateComplete;
      expect(el.trendPoints).toHaveLength(2);
    });

    it('respects maxTrendPoints with adapter data', async () => {
      const el = createElement();
      el.maxTrendPoints = 2;
      await el.updateComplete;
      const { source, sink } = capturingSource();
      el.trendSource = source;
      await el.updateComplete;
      sink().apply({ type: 'snapshot', dataset: makeDataSet([
        ['1', 1000, 0.8], ['2', 2000, 0.85], ['3', 3000, 0.9],
      ]) });
      await flush();
      await el.updateComplete;
      expect(el.trendPoints).toHaveLength(2);
      expect(el.trendPoints[0]!.timestamp).toBe(2000);
    });

    it('trendLoading is true before data arrives', async () => {
      const el = createElement();
      await el.updateComplete;
      const { source } = capturingSource();
      el.trendSource = source;
      await el.updateComplete;
      expect(el.trendLoading).toBe(true);
    });

    it('trendError reflects source error', async () => {
      const el = createElement();
      await el.updateComplete;
      const { source, sink } = capturingSource();
      el.trendSource = source;
      await el.updateComplete;
      sink().error({ message: 'Network error', permanent: true });
      await flush();
      await el.updateComplete;
      expect(el.trendError).toBe('Network error');
    });

    it('disconnects previous source when new source set', async () => {
      const el = createElement();
      await el.updateComplete;
      const s1 = capturingSource();
      const s2 = capturingSource();
      const disconnect1 = vi.spyOn(s1.source, 'disconnect');
      el.trendSource = s1.source;
      await el.updateComplete;
      el.trendSource = s2.source;
      await el.updateComplete;
      expect(disconnect1).toHaveBeenCalled();
    });
  });

  describe('precedence', () => {
    it('trendData wins over trendSource', async () => {
      const el = createElement();
      await el.updateComplete;
      const { source, sink } = capturingSource();
      el.trendSource = source;
      await el.updateComplete;
      sink().apply({ type: 'snapshot', dataset: makeDataSet([['1', 1000, 0.8]]) });
      await flush();
      await el.updateComplete;
      el.trendData = [{ timestamp: 5000, score: 0.99 }];
      await el.updateComplete;
      expect(el.trendPoints).toEqual([{ timestamp: 5000, score: 0.99 }]);
    });

    it('clearing trendData falls back to adapter data', async () => {
      const el = createElement();
      await el.updateComplete;
      const { source, sink } = capturingSource();
      el.trendSource = source;
      await el.updateComplete;
      sink().apply({ type: 'snapshot', dataset: makeDataSet([['1', 1000, 0.8]]) });
      await flush();
      await el.updateComplete;
      el.trendData = [{ timestamp: 5000, score: 0.99 }];
      await el.updateComplete;
      expect(el.trendPoints[0]!.timestamp).toBe(5000);
      el.trendData = undefined;
      await el.updateComplete;
      expect(el.trendPoints[0]!.timestamp).toBe(1000);
    });

    it('adapter stays connected when trendData is set', async () => {
      const el = createElement();
      await el.updateComplete;
      const { source, sink } = capturingSource();
      const disconnectSpy = vi.spyOn(source, 'disconnect');
      el.trendSource = source;
      await el.updateComplete;
      el.trendData = [{ timestamp: 5000, score: 0.99 }];
      await el.updateComplete;
      expect(disconnectSpy).not.toHaveBeenCalled();
      // Adapter still receives data
      sink().apply({ type: 'snapshot', dataset: makeDataSet([['1', 1000, 0.8]]) });
      await flush();
      await el.updateComplete;
      // Still returning trendData
      expect(el.trendPoints[0]!.timestamp).toBe(5000);
    });
  });

  describe('maxTrendPoints runtime change', () => {
    it('trendPoints reflects new maxTrendPoints without data change', async () => {
      const el = createElement();
      await el.updateComplete;
      el.trendData = Array.from({ length: 10 }, (_, i) => ({
        timestamp: i * 1000,
        score: 0.5,
      }));
      el.maxTrendPoints = 5;
      await el.updateComplete;
      expect(el.trendPoints).toHaveLength(5);
      el.maxTrendPoints = 3;
      await el.updateComplete;
      expect(el.trendPoints).toHaveLength(3);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/mdproctor/claude/casehub/blocks-ui && yarn workspace @casehubio/blocks-ui-core exec vitest run src/data-source/trend-source-mixin.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement TrendSourceMixin**

Create `packages/blocks-ui-core/src/data-source/trend-source-mixin.ts`:

```typescript
import type { LitElement, PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { DataSourceAdapter } from './data-source-adapter.js';
import { extractTrendPoints, type TrendPoint } from './trend-types.js';
import type { DataSource } from '@casehubio/pages-data/dist/datasource/types.js';
import type { TypedDataSet } from '@casehubio/pages-data/dist/dataset/types.js';

type Constructor<T = {}> = new (...args: any[]) => T;

export function TrendSourceMixin<T extends Constructor<LitElement>>(Base: T) {
  class TrendSourceHost extends Base {
    @property({ attribute: false }) trendSource?: DataSource;
    @property({ attribute: false }) trendData?: TrendPoint[];
    @property({ type: Number, attribute: 'max-trend-points' }) maxTrendPoints = 30;

    @state() private _adapterTrendPoints: TrendPoint[] = [];
    @state() private _directTrendPoints: TrendPoint[] = [];

    readonly _trendAdapter: DataSourceAdapter = new DataSourceAdapter(this, {
      onChange: () => {
        const ds = this._trendAdapter.dataSet as TypedDataSet | undefined;
        if (ds) {
          const extracted = extractTrendPoints(ds);
          this._adapterTrendPoints = extracted.toSorted(
            (a, b) => a.timestamp - b.timestamp,
          );
        }
      },
    });

    get trendPoints(): TrendPoint[] {
      const source = this.trendData !== undefined
        ? this._directTrendPoints
        : this._adapterTrendPoints;
      return source.slice(-this.maxTrendPoints);
    }

    get trendLoading(): boolean {
      if (this.trendData !== undefined) return false;
      return this._trendAdapter.loading;
    }

    get trendError(): string {
      if (this.trendData !== undefined) return '';
      return this._trendAdapter.error;
    }

    override willUpdate(changed: PropertyValues): void {
      super.willUpdate(changed);
      if (changed.has('trendSource')) {
        this._trendAdapter.source = this.trendSource;
      }
      if (changed.has('trendData') && this.trendData !== undefined) {
        this._directTrendPoints = [...this.trendData].sort(
          (a, b) => a.timestamp - b.timestamp,
        );
      }
    }
  }

  return TrendSourceHost as unknown as Constructor<{
    trendSource?: DataSource;
    trendData?: TrendPoint[];
    maxTrendPoints: number;
    readonly trendPoints: TrendPoint[];
    readonly trendLoading: boolean;
    readonly trendError: string;
    readonly _trendAdapter: DataSourceAdapter;
  }> & T;
}
```

- [ ] **Step 4: Add export to data-source barrel**

In `packages/blocks-ui-core/src/data-source/index.ts`, add:
```typescript
export { TrendSourceMixin } from './trend-source-mixin.js';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/mdproctor/claude/casehub/blocks-ui && yarn workspace @casehubio/blocks-ui-core exec vitest run src/data-source/trend-source-mixin.test.ts`
Expected: all PASS

- [ ] **Step 6: Run all blocks-ui-core tests**

Run: `cd /Users/mdproctor/claude/casehub/blocks-ui && yarn workspace @casehubio/blocks-ui-core test`
Expected: all PASS (no regressions)

- [ ] **Step 7: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add packages/blocks-ui-core/src/data-source/trend-source-mixin.ts packages/blocks-ui-core/src/data-source/trend-source-mixin.test.ts packages/blocks-ui-core/src/data-source/index.ts
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "feat(blocks-ui-core): TrendSourceMixin for time-series trend data (#45)"
```

---

### Task 4: Migrate kpi-metric-row to Shared Sparkline

**Files:**
- Modify: `components/kpi-metric-row/src/kpi-metric-row.ts` — remove local
  `renderSparkline`, import from blocks-ui-core
- Test: existing `components/kpi-metric-row/src/kpi-metric-row.test.ts`
  (no new tests — behavioral parity, existing tests must pass)

**Interfaces:**
- Consumes: `renderSparkline`, `SparklineOptions` from
  `@casehubio/blocks-ui-core`
- Produces: no API changes

- [ ] **Step 1: Run existing kpi-metric-row tests as baseline**

Run: `cd /Users/mdproctor/claude/casehub/blocks-ui && yarn workspace @casehubio/blocks-ui-kpi-metric-row test`
Expected: all PASS (baseline)

- [ ] **Step 2: Remove local renderSparkline function**

In `components/kpi-metric-row/src/kpi-metric-row.ts`:

1. Add import at top:
   ```typescript
   import { renderSparkline } from '@casehubio/blocks-ui-core';
   ```

2. Delete the local `renderSparkline` function (lines 21–48) using
   `ide_refactor_safe_delete` or `ide_edit_member`.

3. Update the call site in `_renderCard` — the existing call is
   `renderSparkline(m.sparkline)`. The shared function has the same
   signature for this case, but pass options for the current dimensions:
   ```typescript
   renderSparkline(m.sparkline, { width: 48, height: 20 })
   ```

- [ ] **Step 3: Run kpi-metric-row tests**

Run: `cd /Users/mdproctor/claude/casehub/blocks-ui && yarn workspace @casehubio/blocks-ui-kpi-metric-row test`
Expected: all PASS (behavioral parity + gradient ID fix)

- [ ] **Step 4: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add components/kpi-metric-row/src/kpi-metric-row.ts
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "refactor(kpi-metric-row): use shared sparkline renderer from blocks-ui-core (#45)"
```

---

### Task 5: Trust-Score-Panel Trend Integration

**Files:**
- Modify: `components/trust-score-panel/src/trust-score-panel.ts` — add
  TrendSourceMixin, replace placeholder with sparkline
- Test: `components/trust-score-panel/src/trust-score-panel.test.ts` — add
  trend tests

**Interfaces:**
- Consumes:
  - `TrendSourceMixin`, `renderSparkline`, `TrendPoint` from
    `@casehubio/blocks-ui-core`
  - `trustLevelFromScore` from `./types.js`
- Produces: trust-score-panel gains `trendSource`, `trendData`,
  `maxTrendPoints` properties via mixin

- [ ] **Step 1: Write failing tests**

Add to `components/trust-score-panel/src/trust-score-panel.test.ts`:

```typescript
describe('Trend Section', () => {
  it('shows placeholder when no trend data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        actorId: 'agent-123',
        globalScore: 0.87,
        capabilityScores: {},
        dimensionScores: {},
      }),
    });
    const el = document.createElement('trust-score-panel') as TrustScorePanel;
    el.mode = 'full';
    el.actorId = 'agent-123';
    el.endpoint = 'http://test.local/api/v1/ledger';
    document.body.appendChild(el);
    await el.updateComplete;
    await new Promise(r => setTimeout(r, 50));
    await el.updateComplete;
    const placeholder = el.shadowRoot!.querySelector('.trend-placeholder');
    expect(placeholder).toBeTruthy();
    expect(placeholder!.textContent).toContain('Trend data requires backend endpoint');
  });

  it('renders sparkline when trendData is provided', async () => {
    const el = document.createElement('trust-score-panel') as TrustScorePanel;
    el.mode = 'full';
    el.score = 0.87;
    el.trustLevel = 'high';
    (el as any).trendData = [
      { timestamp: 1000, score: 0.8 },
      { timestamp: 2000, score: 0.85 },
      { timestamp: 3000, score: 0.87 },
    ];
    document.body.appendChild(el);
    await el.updateComplete;
    const sparkline = el.shadowRoot!.querySelector('.sparkline');
    expect(sparkline).toBeTruthy();
    expect(sparkline!.tagName.toLowerCase()).toBe('svg');
  });

  it('uses trust-level color for sparkline', async () => {
    const el = document.createElement('trust-score-panel') as TrustScorePanel;
    el.mode = 'full';
    el.score = 0.87;
    el.trustLevel = 'high';
    (el as any).trendData = [
      { timestamp: 1000, score: 0.8 },
      { timestamp: 2000, score: 0.87 },
    ];
    document.body.appendChild(el);
    await el.updateComplete;
    const polyline = el.shadowRoot!.querySelector('polyline');
    expect(polyline).toBeTruthy();
    const stroke = polyline!.getAttribute('stroke');
    expect(stroke).toContain('--color-success');
  });

  it('renders ARIA label on sparkline', async () => {
    const el = document.createElement('trust-score-panel') as TrustScorePanel;
    el.mode = 'full';
    el.score = 0.87;
    el.trustLevel = 'high';
    (el as any).trendData = [
      { timestamp: 1000, score: 0.8 },
      { timestamp: 2000, score: 0.87 },
    ];
    document.body.appendChild(el);
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector('[role="img"]');
    expect(wrapper).toBeTruthy();
    const label = wrapper!.getAttribute('aria-label');
    expect(label).toContain('Trust score trend');
  });

  it('does not show trend section in compact mode', async () => {
    const el = document.createElement('trust-score-panel') as TrustScorePanel;
    el.mode = 'compact';
    el.score = 0.87;
    el.trustLevel = 'high';
    (el as any).trendData = [
      { timestamp: 1000, score: 0.8 },
      { timestamp: 2000, score: 0.87 },
    ];
    document.body.appendChild(el);
    await el.updateComplete;
    const trendSection = el.shadowRoot!.querySelector('.trend-section');
    expect(trendSection).toBeFalsy();
  });

  it('shows single point as placeholder (graceful degradation)', async () => {
    const el = document.createElement('trust-score-panel') as TrustScorePanel;
    el.mode = 'full';
    el.score = 0.87;
    el.trustLevel = 'high';
    (el as any).trendData = [{ timestamp: 1000, score: 0.87 }];
    document.body.appendChild(el);
    await el.updateComplete;
    const placeholder = el.shadowRoot!.querySelector('.trend-placeholder');
    expect(placeholder).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/mdproctor/claude/casehub/blocks-ui && yarn workspace @casehubio/blocks-ui-trust-score-panel test`
Expected: new trend tests FAIL (trendData property not on element yet)

- [ ] **Step 3: Add TrendSourceMixin and TRUST_LEVEL_COLORS**

Modify `components/trust-score-panel/src/trust-score-panel.ts`:

1. Update class declaration — add `TrendSourceMixin`:
   ```typescript
   import { DataSourceMixin, TrendSourceMixin, renderSparkline } from '@casehubio/blocks-ui-core';

   export class TrustScorePanel extends TrendSourceMixin(DataSourceMixin(LiveRegionMixin(LitElement)))
   ```

2. Add `TRUST_LEVEL_COLORS` constant (above the class or as a module-level
   const):
   ```typescript
   const TRUST_LEVEL_COLORS: Record<string, string> = {
     high: 'var(--color-success, #28a745)',
     adequate: 'var(--color-warning, #ffc107)',
     low: 'var(--color-error, #dc3545)',
     none: 'var(--color-neutral, #ccc)',
   };
   ```

3. Replace the inline color map in `_renderScoreGauge()` (the `colors`
   local) with `TRUST_LEVEL_COLORS`. Note: the SVG `stroke` attribute
   needs raw values, not CSS custom properties. For the gauge, keep the
   raw hex values. `TRUST_LEVEL_COLORS` with CSS vars is for contexts
   where CSS can resolve them (HTML attributes passed through Lit
   templates).

4. Add `_renderTrendSection()` method:
   ```typescript
   private _renderTrendSection() {
     if (this.trendLoading) {
       return html`<div class="loading-spinner">Loading trend data...</div>`;
     }
     if (this.trendError) {
       return html`<div class="error-message" role="alert">
         Failed to load trend data: ${this.trendError}
       </div>`;
     }
     const points = this.trendPoints;
     if (points.length < 2) {
       return html`<div class="trend-placeholder">
         Trend data requires backend endpoint
       </div>`;
     }
     const scores = points.map(p => p.score);
     const level = this._getDisplayTrustLevel();
     const color = TRUST_LEVEL_COLORS[level];
     const currentScore = this._getDisplayScore();
     const label = `Trust score trend: ${points.length} data points${
       currentScore !== undefined ? `, current ${currentScore.toFixed(2)}` : ''
     }`;
     return html`
       <div role="img" aria-label=${label}>
         ${renderSparkline(scores, { width: 200, height: 48, color, domain: [0, 1] })}
       </div>
     `;
   }
   ```

5. In `_renderFullMode()`, replace the trend section:
   ```typescript
   <section class="trend-section">
     <h3>Trust Trend</h3>
     ${this._renderTrendSection()}
   </section>
   ```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/mdproctor/claude/casehub/blocks-ui && yarn workspace @casehubio/blocks-ui-trust-score-panel test`
Expected: all PASS (existing + new trend tests)

- [ ] **Step 5: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add components/trust-score-panel/src/trust-score-panel.ts components/trust-score-panel/src/trust-score-panel.test.ts
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "feat(trust-score-panel): trend sparkline via TrendSourceMixin (#45)"
```

---

### Task 6: Examples Page — Live and Static Trend Demos

**Files:**
- Modify: `examples/src/pages/trust-score-page.ts` — add simulated trend
  source, static trendData, play/pause controls
- Modify: `examples/package.json` — add `@casehubio/pages-data` dependency
  if not present

**Interfaces:**
- Consumes:
  - `simulated`, `inlineSource` from `@casehubio/pages-data`
  - `createScenarioController` from `@casehubio/pages-data`
  - `addRow` from `@casehubio/pages-data`
  - `ColumnType`, `columnId` from `@casehubio/pages-data`
  - `TrendPoint` from `@casehubio/blocks-ui-core`
- Produces: visual demo (manual verification only)

- [ ] **Step 1: Check pages-data dependency in examples**

Check `examples/package.json` — if `@casehubio/pages-data` is missing, add
it. Also check `examples/vite.config.ts` or `examples/vitest.config.ts`
for alias resolution.

- [ ] **Step 2: Add simulated trend source to trust-score-page**

In `examples/src/pages/trust-score-page.ts`:

1. Add imports:
   ```typescript
   import { inlineSource } from '@casehubio/pages-data/dist/datasource/sources/inline-source.js';
   import { simulated } from '@casehubio/pages-data/dist/datasource/sources/simulated/simulated-source.js';
   import { addRow } from '@casehubio/pages-data/dist/datasource/sources/simulated/mutations.js';
   import { createScenarioController } from '@casehubio/pages-data/dist/datasource/controller.js';
   import { ColumnType, columnId } from '@casehubio/pages-data/dist/dataset/types.js';
   import type { TrendPoint } from '@casehubio/blocks-ui-core';
   import type { ExternalColumnDef } from '@casehubio/pages-data/dist/dataset/external/types.js';
   ```

2. Create scenario controller as class field:
   ```typescript
   private _scenario = createScenarioController({ speed: 1, playing: true });
   ```

3. Build the simulated trend source:
   ```typescript
   private _trendColumns: ExternalColumnDef[] = [
     { id: columnId('id'), name: 'id', type: ColumnType.TEXT },
     { id: columnId('timestamp'), name: 'timestamp', type: ColumnType.NUMBER },
     { id: columnId('score'), name: 'score', type: ColumnType.NUMBER },
   ];

   private _buildTrendSource() {
     let counter = 10;
     const now = Date.now();
     const initialData = Array.from({ length: 10 }, (_, i) => ({
       id: String(i),
       timestamp: now - (10 - i) * 5000,
       score: 0.75 + Math.sin(i * 0.5) * 0.1,
     }));

     const initial = inlineSource(initialData, {
       columns: this._trendColumns,
     });

     return simulated({
       initial,
       controller: this._scenario,
       interval: 3000,
       mutations: [
         addRow({
           probability: 1.0,
           generator: () => {
             const id = String(counter++);
             return {
               id,
               timestamp: Date.now(),
               score: 0.8 + (Math.random() - 0.5) * 0.2,
             };
           },
         }),
       ],
       keyColumn: 'id',
     });
   }

   private _trendSource = this._buildTrendSource();
   ```

4. Build static trend data:
   ```typescript
   private _staticTrendData: TrendPoint[] = Array.from({ length: 20 }, (_, i) => ({
     timestamp: Date.now() - (20 - i) * 60000,
     score: 0.6 + (i / 20) * 0.25 + Math.sin(i * 0.8) * 0.05,
   }));
   ```

5. Add play/pause toggle handler:
   ```typescript
   @state() private _playing = true;

   private _togglePlayPause() {
     if (this._playing) {
       this._scenario.pause();
     } else {
       this._scenario.play();
     }
     this._playing = !this._playing;
   }
   ```

6. Update the render method — add play/pause button to controls, wire
   `.trendSource` on the full-mode panel, add a static demo section:

   In controls section, add:
   ```html
   <div class="control-group">
     <label>Trend Simulation</label>
     <button @click=${this._togglePlayPause}>
       ${this._playing ? '⏸ Pause' : '▶ Play'}
     </button>
   </div>
   ```

   On the full-mode `<trust-score-panel>`, add:
   ```html
   .trendSource=${this._trendSource}
   ```

   After the compact examples section, add:
   ```html
   <h2>Static Trend Data (trendData import)</h2>
   <div class="demo-section">
     <trust-score-panel
       mode="full"
       .score=${0.82}
       .trustLevel=${'high'}
       .trendData=${this._staticTrendData}
     ></trust-score-panel>
   </div>
   ```

- [ ] **Step 3: Add styles for button**

Add button styles to the existing `styles` block:
```css
button {
  padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: var(--border-radius-sm, 4px);
  font-size: var(--font-size-base, 16px);
  background: white;
  cursor: pointer;
}
button:hover {
  background: var(--color-surface-secondary, #f5f5f5);
}
```

- [ ] **Step 4: Start dev server and verify manually**

Run: `cd /Users/mdproctor/claude/casehub/blocks-ui && yarn workspace blocks-ui-examples dev`

Verify:
- Full-mode panel shows live-updating sparkline (new points appearing)
- Play/pause button controls simulation
- Sparkline color matches trust level (green for high score)
- Static trend demo shows sparkline from pre-populated data
- Compact mode panels still work (no trend section)
- Placeholder shows for actors with no trend data

- [ ] **Step 5: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add examples/src/pages/trust-score-page.ts examples/package.json
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "feat(examples): live and static trend sparkline demos (#45)"
```

---

### Task 7: Build Verification and Full Test Suite

**Files:** none new — verification pass

- [ ] **Step 1: Run full build**

Run: `cd /Users/mdproctor/claude/casehub/blocks-ui && yarn build`
Expected: all packages build successfully

- [ ] **Step 2: Run typecheck**

Run: `cd /Users/mdproctor/claude/casehub/blocks-ui && yarn typecheck`
Expected: no type errors

- [ ] **Step 3: Run all tests**

Run: `cd /Users/mdproctor/claude/casehub/blocks-ui && yarn test`
Expected: all tests pass across all packages

- [ ] **Step 4: Run IntelliJ diagnostics on modified files**

Check for any IDE-level issues:
- `ide_diagnostics` on `packages/blocks-ui-core/src/sparkline/render-sparkline.ts`
- `ide_diagnostics` on `packages/blocks-ui-core/src/data-source/trend-source-mixin.ts`
- `ide_diagnostics` on `packages/blocks-ui-core/src/data-source/trend-types.ts`
- `ide_diagnostics` on `components/trust-score-panel/src/trust-score-panel.ts`
- `ide_diagnostics` on `components/kpi-metric-row/src/kpi-metric-row.ts`
- `ide_diagnostics` on `examples/src/pages/trust-score-page.ts`

Expected: no errors

- [ ] **Step 5: Commit any fixes, then run work-end**

If any issues found, fix and commit. Then invoke `work-end` for code
review, squash, and push.
