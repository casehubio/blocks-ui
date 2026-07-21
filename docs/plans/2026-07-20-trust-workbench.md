# trust-workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> subagent-driven-development (recommended) or executing-plans to
> implement this plan task-by-task. Each task follows TDD
> (test-driven-development) and uses ide-tooling for structural
> editing. Steps use checkbox (`- [ ]`) syntax for tracking.

**Focal issue:** #89 — feat: trust-workbench — composite trust visibility component
**Issue group:** #89

**Goal:** Build `<trust-workbench>`, a composite component that composes trust-score-panel, routing-rationale, and trust-feedback-display into a pre-wired split-workbench experience with coordinated event wiring.

**Architecture:** The workbench uses split-workbench with trust-score-panel + list-pane in the left slot and routing-rationale + trust-feedback-display in the right slot. State is managed inline via `@state` properties (same pattern as work-item-workbench). Detail data is fetched via plain `fetch` with `AbortController`.

**Tech Stack:** Lit 3, TypeScript, pages-data (TypedDataSet/fromRows), pages-table, pages-primitives (LiveRegionMixin), vitest

## Global Constraints

- All column renderers use inline styles (PP-20260713-8ea1af, cross-shadow-DOM correctness)
- Event topics use colon separator (per generic workbench spec 2026-07-08)
- No slots for content customisation — typed config + render callbacks only (PP-20260713-8ea1af)
- `endpoint` property is the API root (e.g., `/api`), not a trust-specific path
- Import `PHASE_STYLES` from routing-rationale — do not duplicate

---

### Task 1: Prerequisites — event topic migration and PHASE_STYLES export

**Files:**
- Modify: `components/trust-score-panel/src/trust-score-panel.ts` (line 382, event topic constant)
- Modify: `components/trust-score-panel/src/trust-score-panel.test.ts` (line 95, topic assertion — file is at `components/trust-score-panel/src/trust-score-panel.test.ts`)
- Modify: `components/routing-rationale/src/routing-rationale.ts` (line 45, PHASE_STYLES — add export)
- Modify: `components/routing-rationale/src/index.ts` (add PHASE_STYLES re-export)
- Test: existing tests in both components

**Interfaces:**
- Produces: `trust:capability-selected` event topic (was `trust.capability-selected`)
- Produces: `PHASE_STYLES` export from `@casehubio/blocks-ui-routing-rationale`

- [ ] **Step 1: Migrate trust-score-panel event topic**

In `components/trust-score-panel/src/trust-score-panel.ts`, change the topic in `_handleCapabilityClick`:

```typescript
// line ~382: change 'trust.capability-selected' to 'trust:capability-selected'
topic: 'trust:capability-selected',
```

Use `ide_replace_member` on `_handleCapabilityClick` with the updated topic string.

- [ ] **Step 2: Update trust-score-panel test**

In `components/trust-score-panel/src/trust-score-panel.test.ts`, find the test that asserts on the event topic. Update the assertion from `trust.capability-selected` to `trust:capability-selected`.

Use `ide_search_text` to find the exact line, then `ide_replace_text_in_file` to update.

- [ ] **Step 3: Run trust-score-panel tests**

Run: `yarn --cwd components/trust-score-panel test`
Expected: all tests PASS

- [ ] **Step 4: Export PHASE_STYLES from routing-rationale**

In `components/routing-rationale/src/routing-rationale.ts`, change `const PHASE_STYLES` to `export const PHASE_STYLES` (line ~45).

Use `ide_replace_text_in_file` with `searchText: "const PHASE_STYLES"` → `replaceText: "export const PHASE_STYLES"`.

- [ ] **Step 5: Re-export PHASE_STYLES from index.ts**

In `components/routing-rationale/src/index.ts`, add the export:

```typescript
export { PHASE_STYLES } from './routing-rationale.js';
```

Use `ide_replace_text_in_file` or `ide_insert_member` to add the export line.

- [ ] **Step 6: Run routing-rationale tests**

Run: `yarn --cwd components/routing-rationale test`
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add components/trust-score-panel/src/trust-score-panel.ts \
      components/trust-score-panel/src/trust-score-panel.test.ts \
      components/routing-rationale/src/routing-rationale.ts \
      components/routing-rationale/src/index.ts
git commit -m "feat(#89): prerequisites — migrate event topic to colon separator, export PHASE_STYLES"
```

---

### Task 2: Package scaffold, types, and column definitions

**Files:**
- Create: `components/trust-workbench/package.json`
- Create: `components/trust-workbench/tsconfig.json`
- Create: `components/trust-workbench/tsconfig.build.json`
- Create: `components/trust-workbench/vitest.config.ts`
- Create: `components/trust-workbench/src/types.ts`
- Create: `components/trust-workbench/src/columns.ts`
- Create: `components/trust-workbench/src/index.ts`

**Interfaces:**
- Produces: `RoutingDecisionSummary`, `RoutingDecisionDetail` types
- Produces: `ROUTING_HISTORY_COLUMNS`, `ROUTING_HISTORY_TABLE_CONFIG`, `DEFAULT_ROUTING_RENDERERS`, column ID constants (`ID_COL`, `TIMESTAMP_COL`, `CAPABILITY_COL`, `WORKER_COL`, `SCORE_COL`, `PHASE_COL`)

- [ ] **Step 1: Create package.json**

Create `components/trust-workbench/package.json`:

```json
{
  "name": "@casehubio/blocks-ui-trust-workbench",
  "version": "0.1.0",
  "description": "Composite trust visibility — score panel, routing history, feedback display",
  "repository": { "type": "git", "url": "https://github.com/casehubio/blocks-ui.git" },
  "publishConfig": { "registry": "https://npm.pkg.github.com" },
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
    "@casehubio/blocks-ui-list-pane": "workspace:*",
    "@casehubio/blocks-ui-routing-rationale": "workspace:*",
    "@casehubio/blocks-ui-split-workbench": "workspace:*",
    "@casehubio/blocks-ui-trust-feedback-display": "workspace:*",
    "@casehubio/blocks-ui-trust-score-panel": "workspace:*",
    "@casehubio/pages-data": "^0.2.2",
    "@casehubio/pages-primitives": "^0.2.2",
    "@casehubio/pages-table": "^0.2.2",
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

Create `components/trust-workbench/tsconfig.json`:

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
  "references": [
    { "path": "../../packages/blocks-ui-core" }
  ]
}
```

- [ ] **Step 3: Create tsconfig.build.json**

Create `components/trust-workbench/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

Create `components/trust-workbench/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';
import { existsSync } from 'fs';

export default defineConfig({
  resolve: {
    alias: [
      ...(existsSync(path.resolve(__dirname, '../../../pages/packages/pages-primitives/src')) ? [{ find: '@casehubio/pages-primitives', replacement: path.resolve(__dirname, '../../../pages/packages/pages-primitives/src') }] : []),
      ...(existsSync(path.resolve(__dirname, '../../../pages/packages/pages-table/src')) ? [{ find: '@casehubio/pages-table', replacement: path.resolve(__dirname, '../../../pages/packages/pages-table/src') }] : []),
      { find: '@casehubio/blocks-ui-core', replacement: path.resolve(__dirname, '../../packages/blocks-ui-core/src') },
      { find: '@casehubio/blocks-ui-split-workbench', replacement: path.resolve(__dirname, '../split-workbench/src') },
      { find: '@casehubio/blocks-ui-trust-score-panel', replacement: path.resolve(__dirname, '../trust-score-panel/src') },
      { find: '@casehubio/blocks-ui-list-pane', replacement: path.resolve(__dirname, '../list-pane/src') },
      { find: '@casehubio/blocks-ui-routing-rationale', replacement: path.resolve(__dirname, '../routing-rationale/src') },
      { find: '@casehubio/blocks-ui-trust-feedback-display', replacement: path.resolve(__dirname, '../trust-feedback-display/src') },
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

Create `components/trust-workbench/src/types.ts`:

```typescript
import type { RoutingRationaleData, CandidateScore } from '@casehubio/blocks-ui-routing-rationale';
import type { GateDecision } from '@casehubio/blocks-ui-trust-feedback-display';
import type { TableColumnConfig, ColumnRenderer } from '@casehubio/pages-table';
import type { ColumnId } from '@casehubio/pages-data/dist/dataset/types.js';
import type { TemplateResult } from 'lit';

export interface RoutingDecisionSummary {
  readonly id: string;
  readonly timestamp: string;
  readonly capabilityTag: string;
  readonly selectedWorkerId: string;
  readonly finalScore: number;
  readonly phase: CandidateScore['phase'];
}

export interface RoutingDecisionDetail {
  readonly rationale: RoutingRationaleData;
  readonly feedback: readonly GateDecision[];
}

export interface TrustWorkbenchConfig {
  readonly routingColumns?: readonly TableColumnConfig[];
  readonly routingColumnRenderers?: ReadonlyMap<ColumnId, ColumnRenderer>;
  readonly renderCandidate?: (candidate: CandidateScore) => TemplateResult | undefined;
}
```

- [ ] **Step 6: Create columns.ts**

Create `components/trust-workbench/src/columns.ts`:

```typescript
import { html } from 'lit';
import { columnId, ColumnType } from '@casehubio/pages-data/dist/dataset/types.js';
import type { CellValue, ColumnId } from '@casehubio/pages-data/dist/dataset/types.js';
import type { TableColumnConfig, ColumnRenderer } from '@casehubio/pages-table';
import { PHASE_STYLES } from '@casehubio/blocks-ui-routing-rationale';
import type { RoutingDecisionSummary } from './types.js';

export const ID_COL = columnId('id');
export const TIMESTAMP_COL = columnId('timestamp');
export const CAPABILITY_COL = columnId('capabilityTag');
export const WORKER_COL = columnId('selectedWorkerId');
export const SCORE_COL = columnId('finalScore');
export const PHASE_COL = columnId('phase');

export const ROUTING_HISTORY_COLUMNS = [
  { id: ID_COL, name: 'ID', type: ColumnType.TEXT, getValue: (s: RoutingDecisionSummary) => s.id },
  { id: TIMESTAMP_COL, name: 'Time', type: ColumnType.TEXT, getValue: (s: RoutingDecisionSummary) => s.timestamp },
  { id: CAPABILITY_COL, name: 'Capability', type: ColumnType.TEXT, getValue: (s: RoutingDecisionSummary) => s.capabilityTag },
  { id: WORKER_COL, name: 'Worker', type: ColumnType.TEXT, getValue: (s: RoutingDecisionSummary) => s.selectedWorkerId },
  { id: SCORE_COL, name: 'Score', type: ColumnType.NUMBER, getValue: (s: RoutingDecisionSummary) => s.finalScore },
  { id: PHASE_COL, name: 'Phase', type: ColumnType.TEXT, getValue: (s: RoutingDecisionSummary) => s.phase },
];

export const ROUTING_HISTORY_TABLE_CONFIG: readonly TableColumnConfig[] = [
  { id: TIMESTAMP_COL, sortable: true },
  { id: CAPABILITY_COL, sortable: true },
  { id: WORKER_COL, sortable: true },
  { id: SCORE_COL, sortable: true },
  { id: PHASE_COL, sortable: true },
];

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const DEFAULT_ROUTING_RENDERERS: ReadonlyMap<ColumnId, ColumnRenderer> = new Map([
  [TIMESTAMP_COL, (cell: CellValue) => {
    const value = cell.type === 'NULL' ? '' : String((cell as { value: string }).value);
    return html`<span style="font-size: 12px; color: var(--pages-neutral-9, #888);">${formatTimestamp(value)}</span>`;
  }],
  [SCORE_COL, (cell: CellValue) => {
    if (cell.type === 'NULL') return html`<span style="color: var(--pages-neutral-9, #888);">—</span>`;
    const value = (cell as { value: number }).value;
    const pct = Math.round(value * 100);
    return html`
      <div style="display: flex; align-items: center; gap: 0.5rem;" role="img" aria-label="Final score ${pct}%">
        <div style="flex: 1; height: 8px; background: var(--pages-neutral-4, #e5e5e5); border-radius: 4px; overflow: hidden;">
          <div style="height: 100%; width: ${pct}%; background: var(--pages-accent-9, #3b82f6);"></div>
        </div>
        <span style="font-weight: 600; min-width: 35px; font-size: 13px;">${pct}%</span>
      </div>
    `;
  }],
  [PHASE_COL, (cell: CellValue) => {
    const value = cell.type === 'NULL' ? '' : String((cell as { value: string }).value);
    const style = PHASE_STYLES[value] ?? '';
    return html`<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; ${style}">${value}</span>`;
  }],
]);
```

- [ ] **Step 7: Create index.ts**

Create `components/trust-workbench/src/index.ts`:

```typescript
export * from './types.js';
export { TrustWorkbench } from './trust-workbench.js';
export {
  ID_COL, TIMESTAMP_COL, CAPABILITY_COL, WORKER_COL, SCORE_COL, PHASE_COL,
  ROUTING_HISTORY_COLUMNS, ROUTING_HISTORY_TABLE_CONFIG, DEFAULT_ROUTING_RENDERERS,
} from './columns.js';
```

- [ ] **Step 8: Install dependencies**

Run: `yarn install`
Expected: workspace dependencies resolve without errors

- [ ] **Step 9: Verify types compile**

Run: `yarn --cwd components/trust-workbench typecheck`
Expected: no errors (trust-workbench.ts doesn't exist yet, so only types.ts and columns.ts are checked)

- [ ] **Step 10: Commit**

```bash
git add components/trust-workbench/
git commit -m "feat(#89): trust-workbench package scaffold, types, and column definitions"
```

---

### Task 3: trust-workbench — rendering and endpoint-mode event wiring

**Files:**
- Create: `components/trust-workbench/src/trust-workbench.ts`
- Create: `components/trust-workbench/src/trust-workbench.test.ts`
- Modify: `components/trust-workbench/src/index.ts` (already has the export line from Task 2)

**Interfaces:**
- Consumes: `RoutingDecisionSummary`, `RoutingDecisionDetail` from `./types.js`
- Consumes: `ID_COL`, `ROUTING_HISTORY_TABLE_CONFIG`, `DEFAULT_ROUTING_RENDERERS`, `ROUTING_HISTORY_COLUMNS` from `./columns.js`
- Consumes: `trust:capability-selected` event from trust-score-panel (Task 1)
- Consumes: `PHASE_STYLES` export from routing-rationale (Task 1)
- Produces: `<trust-workbench>` custom element with `endpoint`, `actorId` properties

- [ ] **Step 1: Write rendering tests**

Create `components/trust-workbench/src/trust-workbench.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(global, 'IntersectionObserver', { value: IntersectionObserverMock });

import './trust-workbench.js';
import type { RoutingDecisionSummary, RoutingDecisionDetail } from './types.js';
import type { RoutingRationaleData, CandidateScore, RoutingPolicySummary } from '@casehubio/blocks-ui-routing-rationale';
import type { GateDecision } from '@casehubio/blocks-ui-trust-feedback-display';

type TrustWorkbenchEl = HTMLElement & {
  endpoint: string;
  actorId: string;
  routingHistory?: readonly RoutingDecisionSummary[];
  routingDetailResolver?: (id: string) => Promise<RoutingDecisionDetail>;
  _selectedCapability: string | null;
  _selectedDecisionId: string | null;
  _routingDetail: RoutingRationaleData | null;
  _feedbackEntries: readonly GateDecision[];
  _detailLoading: boolean;
  _detailError: string | null;
  updateComplete: Promise<boolean>;
};

const POLICY: RoutingPolicySummary = {
  threshold: 0.7, borderlineMargin: 0.1, blendFactor: 0.6,
  minimumObservations: 10, qualityFloors: {}, cbrWeight: 0, bootstrapEscalationRequired: false,
};

const SELECTED: CandidateScore = {
  workerId: 'agent-a', trustScore: 0.82, workloadScore: 0.8,
  phase: 'QUALIFIED', observations: 14, finalScore: 0.812,
};

const SAMPLE_RATIONALE: RoutingRationaleData = {
  capabilityTag: 'code-review', strategyId: 'trust-weighted',
  selected: SELECTED, alternatives: [], policy: POLICY,
};

const SAMPLE_FEEDBACK: GateDecision = {
  decision: 'APPROVED', actor: 'agent-a', attestation: 'ENDORSED',
  trustScoreBefore: 0.78, trustScoreAfter: 0.82, dimension: 'accuracy',
};

const SAMPLE_SUMMARIES: RoutingDecisionSummary[] = [
  { id: 'dec-1', timestamp: '2026-07-20T10:00:00Z', capabilityTag: 'code-review', selectedWorkerId: 'agent-a', finalScore: 0.812, phase: 'QUALIFIED' },
  { id: 'dec-2', timestamp: '2026-07-20T09:00:00Z', capabilityTag: 'triage', selectedWorkerId: 'agent-b', finalScore: 0.75, phase: 'QUALIFIED' },
];

const SAMPLE_DETAIL: RoutingDecisionDetail = {
  rationale: SAMPLE_RATIONALE,
  feedback: [SAMPLE_FEEDBACK],
};

let originalFetch: typeof globalThis.fetch;

describe('trust-workbench', () => {
  let el: TrustWorkbenchEl;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    el = document.createElement('trust-workbench') as TrustWorkbenchEl;
    el.endpoint = '/api';
    el.actorId = 'worker-42';
  });

  afterEach(() => {
    el.remove();
    globalThis.fetch = originalFetch;
    localStorage.clear();
  });

  describe('rendering', () => {
    it('renders shadow root', async () => {
      document.body.appendChild(el);
      await el.updateComplete;
      expect(el.shadowRoot).toBeTruthy();
    });

    it('renders split-workbench with trust-routing selection-topic', async () => {
      document.body.appendChild(el);
      await el.updateComplete;
      const sw = el.shadowRoot!.querySelector('split-workbench');
      expect(sw).toBeTruthy();
      expect(sw!.getAttribute('selection-topic')).toBe('trust-routing');
    });

    it('renders trust-score-panel in left slot', async () => {
      document.body.appendChild(el);
      await el.updateComplete;
      const panel = el.shadowRoot!.querySelector('trust-score-panel');
      expect(panel).toBeTruthy();
    });

    it('renders list-pane in left slot', async () => {
      document.body.appendChild(el);
      await el.updateComplete;
      const listPane = el.shadowRoot!.querySelector('list-pane');
      expect(listPane).toBeTruthy();
      expect(listPane!.getAttribute('selection-topic')).toBe('trust-routing');
    });

    it('passes endpoint to trust-score-panel', async () => {
      document.body.appendChild(el);
      await el.updateComplete;
      const panel = el.shadowRoot!.querySelector('trust-score-panel') as any;
      expect(panel?.endpoint).toBe('/api');
    });

    it('passes actorId to trust-score-panel', async () => {
      document.body.appendChild(el);
      await el.updateComplete;
      const panel = el.shadowRoot!.querySelector('trust-score-panel') as any;
      expect(panel?.actorId).toBe('worker-42');
    });

    it('renders empty detail pane when no decision selected', async () => {
      document.body.appendChild(el);
      await el.updateComplete;
      const rationale = el.shadowRoot!.querySelector('routing-rationale');
      expect(rationale).toBeNull();
    });
  });

  describe('capability selection', () => {
    it('updates list-pane endpoint on capability selection', async () => {
      document.body.appendChild(el);
      await el.updateComplete;
      document.dispatchEvent(new CustomEvent('pages-event', {
        bubbles: true, detail: { topic: 'trust:capability-selected', data: { tag: 'code-review', score: 0.82, actorId: 'worker-42' } },
      }));
      await el.updateComplete;
      const listPane = el.shadowRoot!.querySelector('list-pane') as any;
      expect(listPane?.endpoint).toContain('capability=code-review');
    });

    it('toggles capability off when same tag selected again', async () => {
      document.body.appendChild(el);
      await el.updateComplete;
      document.dispatchEvent(new CustomEvent('pages-event', {
        bubbles: true, detail: { topic: 'trust:capability-selected', data: { tag: 'code-review', score: 0.82, actorId: 'worker-42' } },
      }));
      await el.updateComplete;
      document.dispatchEvent(new CustomEvent('pages-event', {
        bubbles: true, detail: { topic: 'trust:capability-selected', data: { tag: 'code-review', score: 0.82, actorId: 'worker-42' } },
      }));
      await el.updateComplete;
      const listPane = el.shadowRoot!.querySelector('list-pane') as any;
      expect(listPane?.endpoint).not.toContain('capability=');
    });

    it('resets decision selection on capability change', async () => {
      document.body.appendChild(el);
      await el.updateComplete;
      el._selectedDecisionId = 'dec-1';
      document.dispatchEvent(new CustomEvent('pages-event', {
        bubbles: true, detail: { topic: 'trust:capability-selected', data: { tag: 'triage', score: 0.5, actorId: 'worker-42' } },
      }));
      await el.updateComplete;
      expect(el._selectedDecisionId).toBeNull();
    });
  });

  describe('decision selection and detail loading', () => {
    it('fetches detail on decision selection', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(SAMPLE_DETAIL), { status: 200 })
      );
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      document.body.appendChild(el);
      await el.updateComplete;

      document.dispatchEvent(new CustomEvent('pages-event', {
        bubbles: true, detail: { topic: 'trust-routing:selected', data: { text: (col: unknown) => String(col).includes('id') ? 'dec-1' : '' } },
      }));

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());
      expect(mockFetch.mock.calls[0][0]).toContain('/api/trust/worker-42/routing-history/dec-1');
    });

    it('renders routing-rationale when detail loaded', async () => {
      document.body.appendChild(el);
      await el.updateComplete;
      el._routingDetail = SAMPLE_RATIONALE;
      el._feedbackEntries = [SAMPLE_FEEDBACK];
      await el.updateComplete;
      const rationale = el.shadowRoot!.querySelector('routing-rationale');
      expect(rationale).toBeTruthy();
    });

    it('renders trust-feedback-display for each feedback entry', async () => {
      document.body.appendChild(el);
      await el.updateComplete;
      el._routingDetail = SAMPLE_RATIONALE;
      el._feedbackEntries = [SAMPLE_FEEDBACK, { ...SAMPLE_FEEDBACK, decision: 'REJECTED' }];
      await el.updateComplete;
      const displays = el.shadowRoot!.querySelectorAll('trust-feedback-display');
      expect(displays.length).toBe(2);
    });

    it('renders error state on fetch failure', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 500 })) as unknown as typeof fetch;
      document.body.appendChild(el);
      await el.updateComplete;
      el._detailError = 'HTTP 500';
      await el.updateComplete;
      const error = el.shadowRoot!.querySelector('[role="alert"]');
      expect(error).toBeTruthy();
      expect(error!.textContent).toContain('500');
    });

    it('renders loading state during fetch', async () => {
      document.body.appendChild(el);
      await el.updateComplete;
      el._detailLoading = true;
      await el.updateComplete;
      const loading = el.shadowRoot!.querySelector('[role="status"]');
      expect(loading).toBeTruthy();
    });

    it('cancels in-flight fetch on rapid selection change', async () => {
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
      globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
      document.body.appendChild(el);
      await el.updateComplete;

      document.dispatchEvent(new CustomEvent('pages-event', {
        bubbles: true, detail: { topic: 'trust-routing:selected', data: { text: (col: unknown) => String(col).includes('id') ? 'dec-1' : '' } },
      }));
      document.dispatchEvent(new CustomEvent('pages-event', {
        bubbles: true, detail: { topic: 'trust-routing:selected', data: { text: (col: unknown) => String(col).includes('id') ? 'dec-2' : '' } },
      }));

      expect(abortSpy).toHaveBeenCalled();
      abortSpy.mockRestore();
    });
  });

  describe('actor-id change', () => {
    it('resets all state when actor-id changes', async () => {
      document.body.appendChild(el);
      await el.updateComplete;
      el._selectedCapability = 'code-review';
      el._selectedDecisionId = 'dec-1';
      el._routingDetail = SAMPLE_RATIONALE;
      el._feedbackEntries = [SAMPLE_FEEDBACK];

      el.actorId = 'worker-99';
      await el.updateComplete;

      expect(el._selectedCapability).toBeNull();
      expect(el._selectedDecisionId).toBeNull();
      expect(el._routingDetail).toBeNull();
      expect(el._feedbackEntries).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn --cwd components/trust-workbench test`
Expected: FAIL — `trust-workbench` element not defined

- [ ] **Step 3: Implement trust-workbench.ts**

Create `components/trust-workbench/src/trust-workbench.ts`:

```typescript
import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiveRegionMixin, onPagesEvent } from '@casehubio/pages-primitives';
import type { TableColumnConfig, ColumnRenderer } from '@casehubio/pages-table';
import type { ColumnId, TypedRow } from '@casehubio/pages-data/dist/dataset/types.js';
import type { RoutingRationaleData, CandidateScore } from '@casehubio/blocks-ui-routing-rationale';
import type { GateDecision } from '@casehubio/blocks-ui-trust-feedback-display';
import { fromRows } from '@casehubio/pages-data/dist/dataset/conversion.js';
import { ID_COL, ROUTING_HISTORY_COLUMNS, ROUTING_HISTORY_TABLE_CONFIG, DEFAULT_ROUTING_RENDERERS } from './columns.js';
import type { RoutingDecisionSummary, RoutingDecisionDetail } from './types.js';
import '@casehubio/blocks-ui-split-workbench';
import '@casehubio/blocks-ui-trust-score-panel';
import '@casehubio/blocks-ui-list-pane';
import '@casehubio/blocks-ui-routing-rationale';
import '@casehubio/blocks-ui-trust-feedback-display';

@customElement('trust-workbench')
export class TrustWorkbench extends LiveRegionMixin(LitElement) {
  @property({ type: String }) endpoint = '';
  @property({ type: String, attribute: 'actor-id' }) actorId = '';

  @property({ attribute: false }) routingColumns?: readonly TableColumnConfig[];
  @property({ attribute: false }) routingColumnRenderers?: ReadonlyMap<ColumnId, ColumnRenderer>;
  @property({ attribute: false }) renderCandidate?: (candidate: CandidateScore) => TemplateResult | undefined;

  @property({ attribute: false }) routingHistory?: readonly RoutingDecisionSummary[];
  @property({ attribute: false }) routingDetailResolver?: (id: string) => Promise<RoutingDecisionDetail>;

  @state() _selectedCapability: string | null = null;
  @state() _selectedDecisionId: string | null = null;
  @state() _routingDetail: RoutingRationaleData | null = null;
  @state() _feedbackEntries: readonly GateDecision[] = [];
  @state() _detailLoading = false;
  @state() _detailError: string | null = null;

  private _unsubs: Array<() => void> = [];
  private _abortController: AbortController | null = null;

  static override styles = css`
    :host { display: block; height: 100%; font-family: var(--pages-font-family, system-ui); }
    split-workbench { height: 100%; }
    .left-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
    .left-panel trust-score-panel { flex-shrink: 0; border-bottom: 1px solid var(--pages-neutral-4, #d4d4d4); }
    .left-panel list-pane { flex: 1; overflow: hidden; }
    .detail-panel { display: flex; flex-direction: column; height: 100%; overflow-y: auto; }
    .feedback-section { border-top: 1px solid var(--pages-neutral-4, #d4d4d4); padding: var(--pages-space-3, 12px); }
    .feedback-section h3 {
      margin: 0 0 var(--pages-space-2, 8px) 0;
      font-size: var(--pages-font-size-sm, 12px);
      font-weight: 600;
      color: var(--pages-neutral-9, #525252);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .feedback-list { display: flex; flex-direction: column; gap: var(--pages-space-2, 8px); }
    .detail-empty {
      display: flex; align-items: center; justify-content: center;
      height: 100%; color: var(--pages-neutral-7, #525252);
      font-size: var(--pages-font-size-sm, 12px);
    }
    .detail-loading {
      display: flex; align-items: center; justify-content: center;
      height: 100%; color: var(--pages-neutral-7, #525252);
    }
    .detail-error {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 100%; color: var(--pages-danger-9, #dc2626); gap: var(--pages-space-2, 8px);
    }
    .detail-error button {
      padding: 4px 12px; border: 1px solid var(--pages-neutral-4, #d4d4d4);
      background: var(--pages-neutral-1, #fafafa); border-radius: 4px; cursor: pointer;
    }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this._unsubs.push(
      onPagesEvent(document, 'trust:capability-selected', (e: CustomEvent) => {
        this._handleCapabilitySelected(e.detail.data);
      }),
      onPagesEvent(document, 'trust-routing:selected', (e: CustomEvent) => {
        this._handleDecisionSelected(e.detail);
      }),
      onPagesEvent(document, 'trust-routing:deselected', () => {
        this._clearDetail();
      }),
    );
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubs.forEach(u => u());
    this._unsubs = [];
    this._abortController?.abort();
  }

  override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('actorId') && changed.get('actorId') !== undefined) {
      this._resetAllState();
    }
    if (changed.has('routingHistory') || changed.has('_selectedCapability')) {
      this._updateInlineDataSet();
    }
  }

  private _resetAllState(): void {
    this._selectedCapability = null;
    this._selectedDecisionId = null;
    this._routingDetail = null;
    this._feedbackEntries = [];
    this._detailLoading = false;
    this._detailError = null;
    this._abortController?.abort();
    this.announce('Trust data reset');
  }

  private _handleCapabilitySelected(data: { tag: string }): void {
    if (data.tag === this._selectedCapability) {
      this._selectedCapability = null;
      this.announce('Showing all routing decisions');
    } else {
      this._selectedCapability = data.tag;
      this.announce(`Filtered to ${data.tag}`);
    }
    this._selectedDecisionId = null;
    this._routingDetail = null;
    this._feedbackEntries = [];
    this._detailError = null;
  }

  private _handleDecisionSelected(row: TypedRow | { text: (col: unknown) => string }): void {
    const id = (row as TypedRow).text(ID_COL);
    if (!id) return;
    this._selectedDecisionId = id;
    this.announce('Loading routing detail');
    this._fetchDetail(id);
  }

  private async _fetchDetail(decisionId: string): Promise<void> {
    this._abortController?.abort();
    this._abortController = new AbortController();
    this._detailLoading = true;
    this._detailError = null;

    try {
      let detail: RoutingDecisionDetail;
      if (this.routingDetailResolver) {
        detail = await this.routingDetailResolver(decisionId);
      } else {
        const url = `${this.endpoint}/trust/${this.actorId}/routing-history/${decisionId}`;
        const response = await fetch(url, { signal: this._abortController.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        detail = await response.json();
      }
      if (this._abortController.signal.aborted) return;
      this._routingDetail = detail.rationale;
      this._feedbackEntries = detail.feedback;
      this._detailLoading = false;
      this.announce(`Routing detail loaded for ${detail.rationale.selected.workerId}`);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      this._detailLoading = false;
      this._detailError = err instanceof Error ? err.message : String(err);
      this.announce(`Failed to load routing detail: ${this._detailError}`);
    }
  }

  private _updateInlineDataSet(): void {
    if (!this.routingHistory) return;
    const listPane = this.shadowRoot?.querySelector('list-pane') as any;
    if (!listPane) return;
    const source = this.routingHistory;
    const filtered = this._selectedCapability
      ? source.filter(s => s.capabilityTag === this._selectedCapability)
      : source;
    const dataset = fromRows(filtered, ROUTING_HISTORY_COLUMNS);
    listPane.dataSet = dataset;
    listPane.columnConfig = this.routingColumns ?? ROUTING_HISTORY_TABLE_CONFIG;
    listPane.columnRenderers = this.routingColumnRenderers ?? DEFAULT_ROUTING_RENDERERS;
  }

  private _retryDetail(): void {
    if (this._selectedDecisionId) {
      this._fetchDetail(this._selectedDecisionId);
    }
  }

  private get _routingEndpoint(): string | undefined {
    if (this.routingHistory) return undefined;
    if (!this.endpoint || !this.actorId) return undefined;
    const base = `${this.endpoint}/trust/${this.actorId}/routing-history`;
    return this._selectedCapability ? `${base}?capability=${this._selectedCapability}` : base;
  }

  override render(): TemplateResult {
    return html`
      <split-workbench selection-topic="trust-routing">
        <div slot="list" class="left-panel">
          <trust-score-panel
            mode="full"
            .endpoint=${this.endpoint}
            actor-id=${this.actorId}
          ></trust-score-panel>
          <list-pane
            .endpoint=${this._routingEndpoint}
            selection-topic="trust-routing"
            .columnConfig=${this.routingColumns ?? ROUTING_HISTORY_TABLE_CONFIG}
            .columnRenderers=${this.routingColumnRenderers ?? DEFAULT_ROUTING_RENDERERS}
            .getRowKey=${(row: TypedRow) => row.text(ID_COL)}
            empty-message="No routing decisions"
          ></list-pane>
        </div>
        <div slot="detail" class="detail-panel">
          ${this._renderDetail()}
        </div>
      </split-workbench>
    `;
  }

  private _renderDetail(): TemplateResult | typeof nothing {
    if (this._detailLoading) {
      return html`<div class="detail-loading" role="status">Loading routing detail...</div>`;
    }
    if (this._detailError) {
      return html`
        <div class="detail-error" role="alert">
          <span>Failed to load routing detail: ${this._detailError}</span>
          <button @click=${() => this._retryDetail()}>Retry</button>
        </div>
      `;
    }
    if (!this._routingDetail) {
      return html`<div class="detail-empty">Select a routing decision to view details</div>`;
    }
    return html`
      <routing-rationale
        .data=${this._routingDetail}
        .renderCandidate=${this.renderCandidate}
      ></routing-rationale>
      ${this._feedbackEntries.length > 0 ? html`
        <section class="feedback-section">
          <h3>Feedback</h3>
          <div class="feedback-list">
            ${this._feedbackEntries.map(fb => html`
              <trust-feedback-display compact .gateDecision=${fb}></trust-feedback-display>
            `)}
          </div>
        </section>
      ` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'trust-workbench': TrustWorkbench;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn --cwd components/trust-workbench test`
Expected: all tests PASS

- [ ] **Step 5: Run typecheck**

Run: `yarn --cwd components/trust-workbench typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add components/trust-workbench/src/trust-workbench.ts \
      components/trust-workbench/src/trust-workbench.test.ts
git commit -m "feat(#89): trust-workbench — rendering, endpoint-mode event wiring, detail loading"
```

---

### Task 4: Inline data mode and Tier 2 customisation tests

**Files:**
- Modify: `components/trust-workbench/src/trust-workbench.test.ts` (add test cases)

**Interfaces:**
- Consumes: `routingHistory`, `routingDetailResolver`, `routingColumns`, `routingColumnRenderers`, `renderCandidate` properties from trust-workbench (Task 3)

- [ ] **Step 1: Add inline data mode tests**

Append to `trust-workbench.test.ts`:

```typescript
  describe('inline data mode', () => {
    it('renders list from routingHistory without fetch', async () => {
      const mockFetch = vi.fn();
      globalThis.fetch = mockFetch as unknown as typeof fetch;
      el.routingHistory = SAMPLE_SUMMARIES;
      document.body.appendChild(el);
      await el.updateComplete;
      await new Promise(r => setTimeout(r, 50));
      const listPane = el.shadowRoot!.querySelector('list-pane') as any;
      expect(listPane?.dataSet).toBeTruthy();
      expect(listPane?.dataSet?.rows?.length).toBe(2);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('filters inline data by selected capability', async () => {
      el.routingHistory = SAMPLE_SUMMARIES;
      document.body.appendChild(el);
      await el.updateComplete;
      await new Promise(r => setTimeout(r, 50));
      document.dispatchEvent(new CustomEvent('pages-event', {
        bubbles: true, detail: { topic: 'trust:capability-selected', data: { tag: 'code-review', score: 0.82, actorId: 'worker-42' } },
      }));
      await el.updateComplete;
      await new Promise(r => setTimeout(r, 50));
      const listPane = el.shadowRoot!.querySelector('list-pane') as any;
      expect(listPane?.dataSet?.rows?.length).toBe(1);
    });

    it('uses routingDetailResolver instead of fetch', async () => {
      const resolver = vi.fn().mockResolvedValue(SAMPLE_DETAIL);
      el.routingDetailResolver = resolver;
      document.body.appendChild(el);
      await el.updateComplete;

      document.dispatchEvent(new CustomEvent('pages-event', {
        bubbles: true, detail: { topic: 'trust-routing:selected', data: { text: (col: unknown) => String(col).includes('id') ? 'dec-1' : '' } },
      }));
      await vi.waitFor(() => expect(resolver).toHaveBeenCalledWith('dec-1'));
      await vi.waitFor(() => expect(el._routingDetail).toBeTruthy());
    });
  });

  describe('tier 2 customisation', () => {
    it('passes custom routingColumns to list-pane', async () => {
      const customConfig = [{ id: 'custom' as any, sortable: false }] as const;
      el.routingColumns = customConfig;
      document.body.appendChild(el);
      await el.updateComplete;
      const listPane = el.shadowRoot!.querySelector('list-pane') as any;
      expect(listPane?.columnConfig).toBe(customConfig);
    });

    it('passes custom routingColumnRenderers to list-pane', async () => {
      const customRenderers = new Map() as ReadonlyMap<any, any>;
      el.routingColumnRenderers = customRenderers;
      document.body.appendChild(el);
      await el.updateComplete;
      const listPane = el.shadowRoot!.querySelector('list-pane') as any;
      expect(listPane?.columnRenderers).toBe(customRenderers);
    });

    it('passes renderCandidate to routing-rationale', async () => {
      const renderFn = () => undefined;
      el.renderCandidate = renderFn;
      el._routingDetail = SAMPLE_RATIONALE;
      document.body.appendChild(el);
      await el.updateComplete;
      const rationale = el.shadowRoot!.querySelector('routing-rationale') as any;
      expect(rationale?.renderCandidate).toBe(renderFn);
    });
  });

  describe('accessibility', () => {
    it('announces capability filter change', async () => {
      const announceSpy = vi.spyOn(el as any, 'announce');
      document.body.appendChild(el);
      await el.updateComplete;
      document.dispatchEvent(new CustomEvent('pages-event', {
        bubbles: true, detail: { topic: 'trust:capability-selected', data: { tag: 'code-review', score: 0.82, actorId: 'worker-42' } },
      }));
      expect(announceSpy).toHaveBeenCalledWith('Filtered to code-review');
    });

    it('announces deselection', async () => {
      document.body.appendChild(el);
      await el.updateComplete;
      el._selectedCapability = 'code-review';
      const announceSpy = vi.spyOn(el as any, 'announce');
      document.dispatchEvent(new CustomEvent('pages-event', {
        bubbles: true, detail: { topic: 'trust:capability-selected', data: { tag: 'code-review', score: 0.82, actorId: 'worker-42' } },
      }));
      expect(announceSpy).toHaveBeenCalledWith('Showing all routing decisions');
    });

    it('error state has role="alert"', async () => {
      document.body.appendChild(el);
      await el.updateComplete;
      el._detailError = 'HTTP 500';
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[role="alert"]')).toBeTruthy();
    });

    it('loading state has role="status"', async () => {
      document.body.appendChild(el);
      await el.updateComplete;
      el._detailLoading = true;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[role="status"]')).toBeTruthy();
    });
  });
```

- [ ] **Step 2: Run all tests**

Run: `yarn --cwd components/trust-workbench test`
Expected: all tests PASS (implementation already handles inline data mode and Tier 2 pass-through from Task 3)

- [ ] **Step 3: Commit**

```bash
git add components/trust-workbench/src/trust-workbench.test.ts
git commit -m "test(#89): trust-workbench — inline data mode, tier 2, and accessibility tests"
```

---

### Task 5: Full build verification and CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md` (add trust-workbench to Key Directories table)

**Interfaces:**
- Consumes: all files from Tasks 1–4

- [ ] **Step 1: Run full workspace build**

Run: `yarn build`
Expected: all packages build without errors

- [ ] **Step 2: Run full workspace tests**

Run: `yarn test`
Expected: all tests pass across all packages

- [ ] **Step 3: Run typecheck**

Run: `yarn typecheck`
Expected: no type errors

- [ ] **Step 4: Verify with IntelliJ diagnostics**

Use `ide_diagnostics` on the trust-workbench component files to check for IDE-level issues:
- `components/trust-workbench/src/trust-workbench.ts`
- `components/trust-workbench/src/types.ts`
- `components/trust-workbench/src/columns.ts`

- [ ] **Step 5: Update CLAUDE.md Key Directories**

Add the trust-workbench entry to the Key Directories table in `CLAUDE.md`:

```markdown
| `components/trust-workbench/` | Trust workbench — composes trust-score-panel + list-pane (left) and routing-rationale + trust-feedback-display (right) in split-workbench. Capability drill-down filters routing history. Inline data mode for demos. |
```

Insert alphabetically in the table (after `trust-score-panel`).

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(#89): add trust-workbench to CLAUDE.md key directories"
```
