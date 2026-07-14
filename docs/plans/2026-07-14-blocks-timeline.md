# blocks-timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> subagent-driven-development (recommended) or executing-plans to
> implement this plan task-by-task. Each task follows TDD
> (test-driven-development) and uses ide-tooling for structural
> editing. Steps use checkbox (`- [ ]`) syntax for tracking.

**Focal issue:** #55 — feat: unified pluggable timeline — merge case-timeline + commitment-lifecycle
**Issue group:** #55

**Goal:** Replace `<case-timeline>` with `<blocks-timeline>` — a strategy-based timeline component supporting vertical/horizontal/compact layouts and pluggable content adapters.

**Architecture:** Three-layer design: component (DataSourceMixin + orchestration + ARIA) → strategy (data mapping + default renderers) → layout renderer (DOM structure + connectors + animation). Render resolution: component callback > strategy renderer > built-in default.

**Tech Stack:** Lit 3, TypeScript, `@casehubio/blocks-ui-core` (DataSourceMixin, fetchSource, renderPropertyTree), `@casehubio/pages-primitives` (LiveRegionMixin, emitPagesEvent), vitest + jsdom.

## Global Constraints

- Protocol PP-20260713-8ea1af: typed config + render callbacks for customisation, no slots for content
- `--pages-*` CSS custom properties from `pages-ui-tokens` for all styling
- `emitPagesEvent()` from `@casehubio/pages-component` for all event emission
- Component extends `DataSourceMixin(LiveRegionMixin(LitElement))`
- Connectors owned by layout renderers, never by strategies
- IntelliJ MCP mandatory for all .ts file operations

---

### Task 1: Package scaffold + core types

**Files:**
- Create: `components/blocks-timeline/package.json`
- Create: `components/blocks-timeline/tsconfig.json`
- Create: `components/blocks-timeline/tsconfig.build.json`
- Create: `components/blocks-timeline/vitest.config.ts`
- Create: `components/blocks-timeline/src/types.ts`
- Create: `components/blocks-timeline/src/index.ts`
- Test: `components/blocks-timeline/src/types.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `TimelineNode`, `Layout`, `TimelineStrategy<T>`, `StageConfig` — all downstream tasks depend on these types

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@casehubio/blocks-ui-blocks-timeline",
  "version": "0.1.0",
  "description": "Pluggable timeline — vertical, horizontal, compact layouts with strategy-based content",
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
    "@casehubio/pages-primitives": "^0.2.0",
    "@casehubio/pages-data": "^0.2.1",
    "lit": "^3.2.0"
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
  "references": [
    { "path": "../../packages/blocks-ui-core" }
  ]
}
```

- [ ] **Step 3: Create tsconfig.build.json**

Copy from case-timeline's tsconfig.build.json pattern (same structure, different references if needed).

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@casehubio/pages-primitives', replacement: path.resolve(__dirname, '../../../pages/packages/pages-primitives/src') },
      { find: '@casehubio/pages-table', replacement: path.resolve(__dirname, '../../../pages/packages/pages-table/src') },
      { find: '@casehubio/blocks-ui-core', replacement: path.resolve(__dirname, '../../packages/blocks-ui-core/src') },
      { find: '@casehubio/pages-ui-tokens', replacement: path.resolve(__dirname, '../../../pages/packages/pages-ui-tokens/src') },
      { find: /^@casehubio\/pages-component\/dist\/(.*)/, replacement: path.resolve(__dirname, '../../../pages/packages/pages-component/src/$1') },
      { find: '@casehubio/pages-component', replacement: path.resolve(__dirname, '../../../pages/packages/pages-component/src') },
      { find: /^@casehubio\/pages-data\/dist\/(.*)/, replacement: path.resolve(__dirname, '../../../pages/packages/pages-data/src/$1') },
      { find: '@casehubio/pages-data', replacement: path.resolve(__dirname, '../../../pages/packages/pages-data/src') },
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

- [ ] **Step 5: Write types.ts with all core interfaces**

```typescript
import type { TemplateResult } from 'lit';

export type NodeStatus = 'completed' | 'active' | 'pending' | 'failed' | 'skipped';

export interface TimelineNode {
  key: string;
  label: string;
  status: NodeStatus;
  timestamp?: string;
  actor?: string;
  detail?: unknown;
  category?: string;
}

export type Layout = 'vertical' | 'horizontal' | 'compact';

export interface TimelineStrategy<T = unknown> {
  toNodes(data: T): TimelineNode[];
  transformData?: (raw: unknown) => T;
  defaultLayout: Layout;
  renderNode?: (node: TimelineNode) => TemplateResult;
  renderDetail?: (node: TimelineNode) => TemplateResult;
  filterCategories?: string[];
}

export interface StageConfig {
  key: string;
  label: string;
  icon?: string;
  terminal?: 'success' | 'failure';
}
```

- [ ] **Step 6: Write type tests**

```typescript
import { describe, it, expect } from 'vitest';
import type { TimelineNode, TimelineStrategy, StageConfig, Layout, NodeStatus } from './types.js';

describe('types', () => {
  it('TimelineNode accepts all valid statuses', () => {
    const statuses: NodeStatus[] = ['completed', 'active', 'pending', 'failed', 'skipped'];
    statuses.forEach(status => {
      const node: TimelineNode = { key: 'k', label: 'l', status };
      expect(node.status).toBe(status);
    });
  });

  it('TimelineNode optional fields default to undefined', () => {
    const node: TimelineNode = { key: 'k', label: 'l', status: 'pending' };
    expect(node.timestamp).toBeUndefined();
    expect(node.actor).toBeUndefined();
    expect(node.detail).toBeUndefined();
    expect(node.category).toBeUndefined();
  });

  it('Layout type accepts all valid values', () => {
    const layouts: Layout[] = ['vertical', 'horizontal', 'compact'];
    expect(layouts).toHaveLength(3);
  });

  it('StageConfig terminal field distinguishes success from failure', () => {
    const success: StageConfig = { key: 'DONE', label: 'Done', terminal: 'success' };
    const failure: StageConfig = { key: 'FAILED', label: 'Failed', terminal: 'failure' };
    const waypoint: StageConfig = { key: 'OPEN', label: 'Open' };
    expect(success.terminal).toBe('success');
    expect(failure.terminal).toBe('failure');
    expect(waypoint.terminal).toBeUndefined();
  });

  it('TimelineStrategy contract is satisfiable', () => {
    const strategy: TimelineStrategy<string[]> = {
      toNodes: (data) => data.map((d, i) => ({ key: String(i), label: d, status: 'pending' as const })),
      defaultLayout: 'vertical',
    };
    const nodes = strategy.toNodes(['a', 'b']);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]!.label).toBe('a');
  });

  it('TimelineStrategy with transformData processes raw input', () => {
    const strategy: TimelineStrategy<string[]> = {
      toNodes: (data) => data.map((d, i) => ({ key: String(i), label: d, status: 'pending' as const })),
      transformData: (raw) => (raw as { items: string[] }).items,
      defaultLayout: 'vertical',
    };
    const raw = { items: ['x', 'y'] };
    const transformed = strategy.transformData!(raw);
    expect(strategy.toNodes(transformed)).toHaveLength(2);
  });
});
```

- [ ] **Step 7: Write index.ts**

```typescript
export type { TimelineNode, NodeStatus, Layout, TimelineStrategy, StageConfig } from './types.js';
```

(Will be expanded in later tasks as strategies and the component are added.)

- [ ] **Step 8: Run tests**

Run: `cd components/blocks-timeline && npx vitest run`
Expected: all pass

- [ ] **Step 9: Commit**

```bash
git add components/blocks-timeline/
git commit -m "feat(blocks-timeline): package scaffold and core types (#55)"
```

---

### Task 2: State progression strategy

**Files:**
- Create: `components/blocks-timeline/src/strategies/state-progression.ts`
- Create: `components/blocks-timeline/src/strategies/state-progression.test.ts`
- Modify: `components/blocks-timeline/src/index.ts`

**Interfaces:**
- Consumes: `TimelineNode`, `TimelineStrategy`, `StageConfig`, `NodeStatus` from `types.ts`
- Produces: `stateProgressionStrategy(options?)`, `linearResolveStatus()`, `QHORUS_STAGES` — used by Task 6 (component), Task 8 (horizontal example)

- [ ] **Step 1: Write failing tests for stateProgressionStrategy**

```typescript
import { describe, it, expect } from 'vitest';
import {
  stateProgressionStrategy,
  linearResolveStatus,
  QHORUS_STAGES,
} from './state-progression.js';
import type { StageConfig, TimelineNode } from '../types.js';

describe('stateProgressionStrategy', () => {
  describe('toNodes with default stages', () => {
    it('maps each qhorus stage to a node', () => {
      const strategy = stateProgressionStrategy();
      const nodes = strategy.toNodes({ currentState: 'OPEN' });
      expect(nodes).toHaveLength(QHORUS_STAGES.length);
      expect(nodes.map(n => n.key)).toEqual(QHORUS_STAGES.map(s => s.key));
    });

    it('marks currentState as active for non-terminal stages', () => {
      const strategy = stateProgressionStrategy();
      const nodes = strategy.toNodes({ currentState: 'ACKNOWLEDGED' });
      const ack = nodes.find(n => n.key === 'ACKNOWLEDGED')!;
      expect(ack.status).toBe('active');
    });

    it('marks terminal success currentState as completed', () => {
      const strategy = stateProgressionStrategy();
      const nodes = strategy.toNodes({ currentState: 'FULFILLED' });
      const fulfilled = nodes.find(n => n.key === 'FULFILLED')!;
      expect(fulfilled.status).toBe('completed');
    });

    it('marks terminal failure currentState as failed', () => {
      const strategy = stateProgressionStrategy();
      const nodes = strategy.toNodes({ currentState: 'DECLINED' });
      const declined = nodes.find(n => n.key === 'DECLINED')!;
      expect(declined.status).toBe('failed');
    });

    it('marks visited stages from transitions as completed', () => {
      const strategy = stateProgressionStrategy();
      const nodes = strategy.toNodes({
        currentState: 'ACKNOWLEDGED',
        transitions: [
          { state: 'OPEN', actor: 'system', timestamp: '2026-01-01T00:00:00Z' },
          { state: 'ACKNOWLEDGED', actor: 'agent-1', timestamp: '2026-01-01T01:00:00Z' },
        ],
      });
      const open = nodes.find(n => n.key === 'OPEN')!;
      expect(open.status).toBe('completed');
    });

    it('marks unvisited stages as skipped when transitions provided', () => {
      const strategy = stateProgressionStrategy();
      const nodes = strategy.toNodes({
        currentState: 'DECLINED',
        transitions: [
          { state: 'OPEN', timestamp: '2026-01-01T00:00:00Z' },
          { state: 'DECLINED', timestamp: '2026-01-01T01:00:00Z' },
        ],
      });
      const ack = nodes.find(n => n.key === 'ACKNOWLEDGED')!;
      expect(ack.status).toBe('skipped');
      const fulfilled = nodes.find(n => n.key === 'FULFILLED')!;
      expect(fulfilled.status).toBe('skipped');
    });

    it('marks all non-current stages as pending when no transitions', () => {
      const strategy = stateProgressionStrategy();
      const nodes = strategy.toNodes({ currentState: 'ACKNOWLEDGED' });
      const open = nodes.find(n => n.key === 'OPEN')!;
      expect(open.status).toBe('pending');
      const fulfilled = nodes.find(n => n.key === 'FULFILLED')!;
      expect(fulfilled.status).toBe('pending');
    });

    it('populates actor and timestamp from transitions', () => {
      const strategy = stateProgressionStrategy();
      const nodes = strategy.toNodes({
        currentState: 'ACKNOWLEDGED',
        transitions: [
          { state: 'OPEN', actor: 'requester-1', timestamp: '2026-01-01T00:00:00Z' },
          { state: 'ACKNOWLEDGED', actor: 'agent-1', timestamp: '2026-01-01T01:00:00Z' },
        ],
      });
      const open = nodes.find(n => n.key === 'OPEN')!;
      expect(open.actor).toBe('requester-1');
      expect(open.timestamp).toBe('2026-01-01T00:00:00Z');
    });
  });

  describe('toNodes with custom stages', () => {
    it('uses custom stage definitions', () => {
      const stages: StageConfig[] = [
        { key: 'DRAFT', label: 'Draft' },
        { key: 'SUBMITTED', label: 'Submitted' },
        { key: 'APPROVED', label: 'Approved', terminal: 'success' },
        { key: 'REJECTED', label: 'Rejected', terminal: 'failure' },
      ];
      const strategy = stateProgressionStrategy({ stages });
      const nodes = strategy.toNodes({ currentState: 'SUBMITTED' });
      expect(nodes).toHaveLength(4);
      expect(nodes[1]!.label).toBe('Submitted');
      expect(nodes[1]!.status).toBe('active');
    });
  });

  describe('toNodes with custom resolveStatus', () => {
    it('uses custom resolver', () => {
      const strategy = stateProgressionStrategy({
        resolveStatus: () => 'completed',
      });
      const nodes = strategy.toNodes({ currentState: 'OPEN' });
      expect(nodes.every(n => n.status === 'completed')).toBe(true);
    });
  });

  describe('toNodes edge cases', () => {
    it('handles empty transitions array', () => {
      const strategy = stateProgressionStrategy();
      const nodes = strategy.toNodes({ currentState: 'OPEN', transitions: [] });
      const open = nodes.find(n => n.key === 'OPEN')!;
      expect(open.status).toBe('active');
    });

    it('handles unknown currentState gracefully', () => {
      const strategy = stateProgressionStrategy();
      const nodes = strategy.toNodes({ currentState: 'NONEXISTENT' });
      expect(nodes.every(n => n.status === 'pending')).toBe(true);
    });

    it('handles EXPIRED terminal state', () => {
      const strategy = stateProgressionStrategy();
      const nodes = strategy.toNodes({ currentState: 'EXPIRED' });
      const expired = nodes.find(n => n.key === 'EXPIRED')!;
      expect(expired.status).toBe('failed');
    });

    it('handles DELEGATED (non-terminal) state', () => {
      const strategy = stateProgressionStrategy();
      const nodes = strategy.toNodes({ currentState: 'DELEGATED' });
      const delegated = nodes.find(n => n.key === 'DELEGATED')!;
      expect(delegated.status).toBe('active');
    });
  });

  describe('defaultLayout', () => {
    it('is horizontal', () => {
      const strategy = stateProgressionStrategy();
      expect(strategy.defaultLayout).toBe('horizontal');
    });
  });

  describe('filterCategories', () => {
    it('is undefined (no filtering for fixed stages)', () => {
      const strategy = stateProgressionStrategy();
      expect(strategy.filterCategories).toBeUndefined();
    });
  });
});

describe('linearResolveStatus', () => {
  const stages: StageConfig[] = [
    { key: 'A', label: 'A' },
    { key: 'B', label: 'B' },
    { key: 'C', label: 'C', terminal: 'success' },
    { key: 'D', label: 'D', terminal: 'failure' },
  ];

  it('marks stages before current as completed', () => {
    expect(linearResolveStatus(stages[0]!, 'B', [], stages)).toBe('completed');
  });

  it('marks current non-terminal as active', () => {
    expect(linearResolveStatus(stages[1]!, 'B', [], stages)).toBe('active');
  });

  it('marks current terminal success as completed', () => {
    expect(linearResolveStatus(stages[2]!, 'C', [], stages)).toBe('completed');
  });

  it('marks current terminal failure as failed', () => {
    expect(linearResolveStatus(stages[3]!, 'D', [], stages)).toBe('failed');
  });

  it('marks stages after current as pending', () => {
    expect(linearResolveStatus(stages[2]!, 'B', [], stages)).toBe('pending');
  });

  it('handles unknown current state — all pending', () => {
    expect(linearResolveStatus(stages[0]!, 'UNKNOWN', [], stages)).toBe('pending');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd components/blocks-timeline && npx vitest run`
Expected: FAIL — module not found

- [ ] **Step 3: Implement state-progression.ts**

```typescript
import type { TimelineNode, TimelineStrategy, StageConfig, NodeStatus } from '../types.js';

export const QHORUS_STAGES: readonly StageConfig[] = [
  { key: 'OPEN', label: 'Open' },
  { key: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { key: 'FULFILLED', label: 'Fulfilled', terminal: 'success' },
  { key: 'DECLINED', label: 'Declined', terminal: 'failure' },
  { key: 'FAILED', label: 'Failed', terminal: 'failure' },
  { key: 'DELEGATED', label: 'Delegated' },
  { key: 'EXPIRED', label: 'Expired', terminal: 'failure' },
] as const;

interface StateData {
  currentState: string;
  transitions?: ReadonlyArray<{ state: string; actor?: string; timestamp?: string }>;
}

type ResolveStatus = (
  stage: StageConfig,
  currentState: string,
  transitions: Array<{ state: string; actor?: string; timestamp?: string }>,
  stages: readonly StageConfig[],
) => NodeStatus;

function defaultResolveStatus(
  stage: StageConfig,
  currentState: string,
  transitions: Array<{ state: string; actor?: string; timestamp?: string }>,
  _stages: readonly StageConfig[],
): NodeStatus {
  if (stage.key === currentState) {
    if (stage.terminal === 'success') return 'completed';
    if (stage.terminal === 'failure') return 'failed';
    return 'active';
  }
  if (transitions.length > 0) {
    return transitions.some(t => t.state === stage.key) ? 'completed' : 'skipped';
  }
  return 'pending';
}

export function linearResolveStatus(
  stage: StageConfig,
  currentState: string,
  _transitions: Array<{ state: string; actor?: string; timestamp?: string }>,
  stages: readonly StageConfig[],
): NodeStatus {
  const currentIndex = stages.findIndex(s => s.key === currentState);
  if (currentIndex === -1) return 'pending';
  const stageIndex = stages.indexOf(stage as StageConfig);
  if (stageIndex < currentIndex) return 'completed';
  if (stageIndex === currentIndex) {
    if (stage.terminal === 'success') return 'completed';
    if (stage.terminal === 'failure') return 'failed';
    return 'active';
  }
  return 'pending';
}

export function stateProgressionStrategy(options?: {
  stages?: StageConfig[];
  resolveStatus?: ResolveStatus;
}): TimelineStrategy<StateData> {
  const stages = options?.stages ?? [...QHORUS_STAGES];
  const resolve = options?.resolveStatus ?? defaultResolveStatus;

  return {
    toNodes(data: StateData): TimelineNode[] {
      const transitions = data.transitions ? [...data.transitions] : [];
      const transitionMap = new Map(transitions.map(t => [t.state, t]));

      return stages.map(stage => {
        const transition = transitionMap.get(stage.key);
        return {
          key: stage.key,
          label: stage.label,
          status: resolve(stage, data.currentState, transitions, stages),
          timestamp: transition?.timestamp,
          actor: transition?.actor,
        };
      });
    },
    defaultLayout: 'horizontal',
  };
}
```

- [ ] **Step 4: Update index.ts**

```typescript
export type { TimelineNode, NodeStatus, Layout, TimelineStrategy, StageConfig } from './types.js';
export { stateProgressionStrategy, linearResolveStatus, QHORUS_STAGES } from './strategies/state-progression.js';
```

- [ ] **Step 5: Run tests**

Run: `cd components/blocks-timeline && npx vitest run`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add components/blocks-timeline/src/strategies/
git commit -m "feat(blocks-timeline): state progression strategy with transition-based status (#55)"
```

---

### Task 3: Event chronology strategy

**Files:**
- Create: `components/blocks-timeline/src/strategies/event-chronology.ts`
- Create: `components/blocks-timeline/src/strategies/event-chronology.test.ts`
- Modify: `components/blocks-timeline/src/index.ts`

**Interfaces:**
- Consumes: `TimelineNode`, `TimelineStrategy` from `types.ts`
- Produces: `eventChronologyStrategy(options?)`, `CaseEvent`, `EventStreamType`, `CaseHubEventType`, `categorizeEvent()`, `isCompactModeEvent()`, `PagedResponse`, `EventLogEntryResponse` — used by Task 6 (component), Task 7 (vertical example)

- [ ] **Step 1: Write failing tests for eventChronologyStrategy**

```typescript
import { describe, it, expect } from 'vitest';
import {
  eventChronologyStrategy,
  categorizeEvent,
  isCompactModeEvent,
} from './event-chronology.js';
import type { CaseEvent, EventLogEntryResponse, PagedResponse } from './event-chronology.js';

describe('eventChronologyStrategy', () => {
  const events: CaseEvent[] = [
    { eventType: 'CASE_STARTED', streamType: 'CASE', timestamp: '2026-01-01T10:00:00Z', payload: { type: 'FRAUD' } },
    { eventType: 'TASK_CREATED', streamType: 'WORKER', timestamp: '2026-01-01T10:05:00Z', payload: { taskId: 't-1' } },
    { eventType: 'MILESTONE_REACHED', streamType: 'CASE', timestamp: '2026-01-01T11:00:00Z', payload: {} },
    { eventType: 'AGENT_DISPATCHED', streamType: 'WORKER', timestamp: '2026-01-01T11:30:00Z', payload: {}, metadata: { workerName: 'Alice', trustScore: 0.85 } },
    { eventType: 'TIMER_FIRED', streamType: 'TIMER', timestamp: '2026-01-01T12:00:00Z', payload: {} },
  ];

  describe('toNodes', () => {
    it('maps each event to a node', () => {
      const strategy = eventChronologyStrategy();
      const nodes = strategy.toNodes(events);
      expect(nodes).toHaveLength(5);
    });

    it('uses eventType (spaces) as label', () => {
      const strategy = eventChronologyStrategy();
      const nodes = strategy.toNodes(events);
      expect(nodes[0]!.label).toBe('CASE STARTED');
    });

    it('sets timestamp from event', () => {
      const strategy = eventChronologyStrategy();
      const nodes = strategy.toNodes(events);
      expect(nodes[0]!.timestamp).toBe('2026-01-01T10:00:00Z');
    });

    it('sets category from streamType', () => {
      const strategy = eventChronologyStrategy();
      const nodes = strategy.toNodes(events);
      expect(nodes[0]!.category).toBe('lifecycle');
      expect(nodes[1]!.category).toBe('task');
    });

    it('sets detail to event payload', () => {
      const strategy = eventChronologyStrategy();
      const nodes = strategy.toNodes(events);
      expect(nodes[0]!.detail).toEqual({ type: 'FRAUD' });
    });

    it('sets actor from metadata.workerName', () => {
      const strategy = eventChronologyStrategy();
      const nodes = strategy.toNodes(events);
      expect(nodes[3]!.actor).toBe('Alice');
    });

    it('sets all nodes to completed status', () => {
      const strategy = eventChronologyStrategy();
      const nodes = strategy.toNodes(events);
      expect(nodes.every(n => n.status === 'completed')).toBe(true);
    });
  });

  describe('toNodes with custom categorize', () => {
    it('uses custom categorize function', () => {
      const strategy = eventChronologyStrategy({
        categorize: () => 'custom',
      });
      const nodes = strategy.toNodes(events);
      expect(nodes.every(n => n.category === 'custom')).toBe(true);
    });
  });

  describe('transformData', () => {
    it('passes through CaseEvent[] directly', () => {
      const strategy = eventChronologyStrategy();
      const result = strategy.transformData!(events);
      expect(result).toBe(events);
    });

    it('extracts .content from PagedResponse', () => {
      const paged: PagedResponse<EventLogEntryResponse> = {
        content: events as EventLogEntryResponse[],
        page: 0,
        size: 20,
        totalElements: events.length,
        totalPages: 1,
      };
      const strategy = eventChronologyStrategy();
      const result = strategy.transformData!(paged);
      expect(result).toHaveLength(5);
      expect(result).toBe(paged.content);
    });

    it('handles empty content array', () => {
      const paged: PagedResponse<EventLogEntryResponse> = {
        content: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
      };
      const strategy = eventChronologyStrategy();
      const result = strategy.transformData!(paged);
      expect(result).toHaveLength(0);
    });
  });

  describe('defaultLayout', () => {
    it('is vertical', () => {
      const strategy = eventChronologyStrategy();
      expect(strategy.defaultLayout).toBe('vertical');
    });
  });

  describe('filterCategories', () => {
    it('defaults to standard stream types', () => {
      const strategy = eventChronologyStrategy();
      expect(strategy.filterCategories).toEqual(['CASE', 'WORKER', 'ORCHESTRATION', 'TIMER', 'SYSTEM']);
    });

    it('uses custom streamTypes when provided', () => {
      const strategy = eventChronologyStrategy({ streamTypes: ['CUSTOM_A', 'CUSTOM_B'] });
      expect(strategy.filterCategories).toEqual(['CUSTOM_A', 'CUSTOM_B']);
    });
  });
});

describe('categorizeEvent', () => {
  it('categorizes CASE_ events as lifecycle', () => {
    expect(categorizeEvent('CASE_STARTED')).toBe('lifecycle');
    expect(categorizeEvent('CASE_COMPLETED')).toBe('lifecycle');
  });

  it('categorizes TASK_ events as task', () => {
    expect(categorizeEvent('TASK_CREATED')).toBe('task');
  });

  it('categorizes AGENT_ events as agent', () => {
    expect(categorizeEvent('AGENT_DISPATCHED')).toBe('agent');
  });

  it('categorizes MILESTONE_ and SLA_VIOLATED as milestone', () => {
    expect(categorizeEvent('MILESTONE_REACHED')).toBe('milestone');
    expect(categorizeEvent('SLA_VIOLATED')).toBe('milestone');
  });

  it('categorizes ACTION_GATE_ events as action-gate', () => {
    expect(categorizeEvent('ACTION_GATE_PENDING')).toBe('action-gate');
  });

  it('categorizes ORCHESTRATION_ events as orchestration', () => {
    expect(categorizeEvent('ORCHESTRATION_STARTED')).toBe('orchestration');
  });

  it('categorizes TIMER_ events as timer', () => {
    expect(categorizeEvent('TIMER_FIRED')).toBe('timer');
  });

  it('defaults unknown events to lifecycle', () => {
    expect(categorizeEvent('UNKNOWN_EVENT')).toBe('lifecycle');
  });
});

describe('isCompactModeEvent', () => {
  it('includes lifecycle events', () => {
    expect(isCompactModeEvent('CASE_STARTED')).toBe(true);
  });

  it('includes milestone events', () => {
    expect(isCompactModeEvent('MILESTONE_REACHED')).toBe(true);
  });

  it('excludes task events', () => {
    expect(isCompactModeEvent('TASK_CREATED')).toBe(false);
  });

  it('excludes agent events', () => {
    expect(isCompactModeEvent('AGENT_DISPATCHED')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd components/blocks-timeline && npx vitest run`
Expected: FAIL — module not found

- [ ] **Step 3: Implement event-chronology.ts**

Port types from case-timeline `types.ts` and implement the strategy factory. The `CaseHubEventType`, `EventStreamType`, `CaseEvent`, `PagedResponse`, `EventLogEntryResponse`, `categorizeEvent`, and `isCompactModeEvent` types/functions move here from case-timeline's types.ts.

```typescript
import type { TimelineNode, TimelineStrategy } from '../types.js';

export type CaseHubEventType =
  | 'CASE_STARTED' | 'CASE_COMPLETED' | 'CASE_FAULTED' | 'CASE_CANCELLED' | 'CASE_SUSPENDED' | 'CASE_RESUMED'
  | 'TASK_CREATED' | 'TASK_ACTIVATED' | 'TASK_CLAIMED' | 'TASK_COMPLETED' | 'TASK_FAILED' | 'TASK_CANCELLED'
  | 'AGENT_ROUTED' | 'AGENT_DISPATCHED' | 'AGENT_COMPLETED' | 'AGENT_FAILED' | 'AGENT_TIMEOUT'
  | 'MILESTONE_REACHED' | 'MILESTONE_ACTIVATED' | 'MILESTONE_COMPLETED' | 'MILESTONE_FAILED' | 'SLA_VIOLATED'
  | 'ACTION_GATE_PENDING' | 'ACTION_GATE_APPROVED' | 'ACTION_GATE_REJECTED' | 'ACTION_GATE_TIMEOUT'
  | 'ORCHESTRATION_STARTED' | 'ORCHESTRATION_COMPLETED' | 'ORCHESTRATION_ESCALATED' | 'ORCHESTRATION_FAILED'
  | 'TIMER_SCHEDULED' | 'TIMER_FIRED' | 'TIMER_CANCELLED';

export type EventStreamType = 'CASE' | 'WORKER' | 'TIMER' | 'SYSTEM' | 'ORCHESTRATION';

export type NodeCategory = 'lifecycle' | 'task' | 'agent' | 'milestone' | 'action-gate' | 'orchestration' | 'timer';

export interface CaseEvent {
  eventType: string;
  streamType: string;
  timestamp: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

export interface EventLogEntryResponse {
  eventType: CaseHubEventType;
  streamType: EventStreamType;
  timestamp: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

const DEFAULT_STREAM_TYPES: string[] = ['CASE', 'WORKER', 'ORCHESTRATION', 'TIMER', 'SYSTEM'];

export function categorizeEvent(eventType: string): NodeCategory {
  if (eventType.startsWith('CASE_')) return 'lifecycle';
  if (eventType.startsWith('TASK_')) return 'task';
  if (eventType.startsWith('AGENT_')) return 'agent';
  if (eventType.startsWith('MILESTONE_') || eventType === 'SLA_VIOLATED') return 'milestone';
  if (eventType.startsWith('ACTION_GATE_')) return 'action-gate';
  if (eventType.startsWith('ORCHESTRATION_')) return 'orchestration';
  if (eventType.startsWith('TIMER_')) return 'timer';
  return 'lifecycle';
}

export function isCompactModeEvent(eventType: string): boolean {
  const category = categorizeEvent(eventType);
  return category === 'lifecycle' || category === 'milestone';
}

function isPagedResponse(data: unknown): data is PagedResponse<CaseEvent> {
  return data != null && typeof data === 'object' && 'content' in data && Array.isArray((data as PagedResponse<CaseEvent>).content);
}

export function eventChronologyStrategy(options?: {
  categorize?: (eventType: string) => string;
  streamTypes?: string[];
}): TimelineStrategy<CaseEvent[]> {
  const cat = options?.categorize ?? categorizeEvent;

  return {
    toNodes(data: CaseEvent[]): TimelineNode[] {
      return data.map((event, i) => ({
        key: `event-${i}`,
        label: event.eventType.replace(/_/g, ' '),
        status: 'completed' as const,
        timestamp: event.timestamp,
        actor: event.metadata?.workerName as string | undefined,
        detail: event.payload,
        category: cat(event.eventType),
      }));
    },
    transformData(raw: unknown): CaseEvent[] {
      if (isPagedResponse(raw)) return raw.content;
      return raw as CaseEvent[];
    },
    defaultLayout: 'vertical',
    filterCategories: options?.streamTypes ?? DEFAULT_STREAM_TYPES,
  };
}
```

- [ ] **Step 4: Update index.ts**

Add exports for event chronology strategy and all public types.

```typescript
export type { TimelineNode, NodeStatus, Layout, TimelineStrategy, StageConfig } from './types.js';
export { stateProgressionStrategy, linearResolveStatus, QHORUS_STAGES } from './strategies/state-progression.js';
export {
  eventChronologyStrategy,
  categorizeEvent,
  isCompactModeEvent,
  type CaseEvent,
  type CaseHubEventType,
  type EventStreamType,
  type NodeCategory,
  type EventLogEntryResponse,
  type PagedResponse,
} from './strategies/event-chronology.js';
```

- [ ] **Step 5: Run tests**

Run: `cd components/blocks-timeline && npx vitest run`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add components/blocks-timeline/src/strategies/event-chronology.ts components/blocks-timeline/src/strategies/event-chronology.test.ts components/blocks-timeline/src/index.ts
git commit -m "feat(blocks-timeline): event chronology strategy with PagedResponse transform (#55)"
```

---

### Task 4: Layout renderers

**Files:**
- Create: `components/blocks-timeline/src/renderers/vertical.ts`
- Create: `components/blocks-timeline/src/renderers/horizontal.ts`
- Create: `components/blocks-timeline/src/renderers/compact.ts`
- Create: `components/blocks-timeline/src/renderers/renderers.test.ts`

**Interfaces:**
- Consumes: `TimelineNode`, `Layout` from `types.ts`
- Produces: `renderVertical()`, `renderHorizontal()`, `renderCompact()`, `verticalStyles`, `horizontalStyles`, `compactStyles` — used by Task 5 (component)

Each renderer is a pure function: `(nodes, options) => TemplateResult`. The component calls the appropriate renderer based on `layout`. Renderers accept resolved render callbacks (already resolved through the component > strategy > default chain).

- [ ] **Step 1: Write failing tests for all three renderers**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { html, render } from 'lit';
import type { TimelineNode } from '../types.js';
import { renderVertical } from './vertical.js';
import { renderHorizontal } from './horizontal.js';
import { renderCompact, computeTemporalWeights } from './compact.js';

const makeNodes = (count: number, overrides?: Partial<TimelineNode>): TimelineNode[] =>
  Array.from({ length: count }, (_, i) => ({
    key: `node-${i}`,
    label: `Node ${i}`,
    status: 'completed' as const,
    timestamp: `2026-01-01T${String(10 + i).padStart(2, '0')}:00:00Z`,
    category: 'lifecycle',
    ...overrides,
  }));

describe('renderVertical', () => {
  it('renders role="list" container', () => {
    const container = document.createElement('div');
    render(renderVertical(makeNodes(3), {}), container);
    expect(container.querySelector('[role="list"]')).toBeTruthy();
  });

  it('renders one listitem per node', () => {
    const container = document.createElement('div');
    render(renderVertical(makeNodes(3), {}), container);
    expect(container.querySelectorAll('[role="listitem"]').length).toBe(3);
  });

  it('renders category CSS class on nodes', () => {
    const container = document.createElement('div');
    render(renderVertical(makeNodes(1, { category: 'task' }), {}), container);
    expect(container.querySelector('.timeline-node.task')).toBeTruthy();
  });

  it('renders aria-label with event name and relative time', () => {
    const container = document.createElement('div');
    render(renderVertical(makeNodes(1, { label: 'CASE STARTED' }), {}), container);
    const item = container.querySelector('[role="listitem"]');
    expect(item?.getAttribute('aria-label')).toContain('CASE STARTED');
  });

  it('calls renderNode callback when provided', () => {
    const renderNode = vi.fn(() => html`<span class="custom">custom</span>`);
    const container = document.createElement('div');
    render(renderVertical(makeNodes(1), { renderNode }), container);
    expect(renderNode).toHaveBeenCalledOnce();
    expect(container.querySelector('.custom')).toBeTruthy();
  });

  it('renders expand button with aria-expanded=false by default', () => {
    const container = document.createElement('div');
    render(renderVertical(makeNodes(1, { detail: { x: 1 } }), {}), container);
    const btn = container.querySelector('[aria-expanded]');
    expect(btn?.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('renderHorizontal', () => {
  it('renders role="list" with aria-orientation="horizontal"', () => {
    const container = document.createElement('div');
    render(renderHorizontal(makeNodes(3), {}), container);
    const list = container.querySelector('[role="list"]');
    expect(list?.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('renders one listitem per node', () => {
    const container = document.createElement('div');
    render(renderHorizontal(makeNodes(3), {}), container);
    expect(container.querySelectorAll('[role="listitem"]').length).toBe(3);
  });

  it('renders connectors between nodes', () => {
    const container = document.createElement('div');
    render(renderHorizontal(makeNodes(3), {}), container);
    expect(container.querySelectorAll('.connector').length).toBe(2);
  });

  it('styles connectors based on adjacent status', () => {
    const nodes: TimelineNode[] = [
      { key: 'a', label: 'A', status: 'completed' },
      { key: 'b', label: 'B', status: 'active' },
      { key: 'c', label: 'C', status: 'pending' },
    ];
    const container = document.createElement('div');
    render(renderHorizontal(nodes, {}), container);
    const connectors = container.querySelectorAll('.connector');
    expect(connectors[0]!.classList.contains('connector--completed')).toBe(true);
    expect(connectors[1]!.classList.contains('connector--completed')).toBe(false);
  });

  it('renders numbered circles by default', () => {
    const container = document.createElement('div');
    render(renderHorizontal(makeNodes(3), {}), container);
    const circles = container.querySelectorAll('.stage-node');
    expect(circles[0]!.textContent?.trim()).toBe('1');
    expect(circles[2]!.textContent?.trim()).toBe('3');
  });

  it('renders status CSS class on stage nodes', () => {
    const nodes: TimelineNode[] = [
      { key: 'a', label: 'A', status: 'completed' },
      { key: 'b', label: 'B', status: 'failed' },
    ];
    const container = document.createElement('div');
    render(renderHorizontal(nodes, {}), container);
    expect(container.querySelector('.stage-node--completed')).toBeTruthy();
    expect(container.querySelector('.stage-node--failed')).toBeTruthy();
  });
});

describe('renderCompact', () => {
  it('renders role="img" container', () => {
    const container = document.createElement('div');
    render(renderCompact(makeNodes(3), {}), container);
    expect(container.querySelector('[role="img"]')).toBeTruthy();
  });

  it('renders dots for each node', () => {
    const container = document.createElement('div');
    render(renderCompact(makeNodes(3), {}), container);
    expect(container.querySelectorAll('.event-dot').length).toBe(3);
  });

  it('truncates to first 3 + last 2 when > 7 nodes', () => {
    const container = document.createElement('div');
    render(renderCompact(makeNodes(10), {}), container);
    const dots = container.querySelectorAll('.event-dot');
    expect(dots.length).toBe(5);
    const ellipsis = container.querySelector('.ellipsis');
    expect(ellipsis).toBeTruthy();
    expect(ellipsis?.textContent).toContain('+5');
  });

  it('does not truncate when <= 7 nodes', () => {
    const container = document.createElement('div');
    render(renderCompact(makeNodes(7), {}), container);
    expect(container.querySelectorAll('.event-dot').length).toBe(7);
    expect(container.querySelector('.ellipsis')).toBeNull();
  });

  it('renders aria-label summary', () => {
    const container = document.createElement('div');
    render(renderCompact(makeNodes(5), {}), container);
    const strip = container.querySelector('[role="img"]');
    expect(strip?.getAttribute('aria-label')).toContain('5');
  });
});

describe('computeTemporalWeights', () => {
  it('returns even weights for nodes without timestamps', () => {
    const nodes = makeNodes(3).map(n => ({ ...n, timestamp: undefined }));
    const weights = computeTemporalWeights(nodes);
    expect(weights).toEqual([0, 1, 1]);
  });

  it('returns proportional weights based on time gaps', () => {
    const nodes: TimelineNode[] = [
      { key: 'a', label: 'A', status: 'completed', timestamp: '2026-01-01T10:00:00Z' },
      { key: 'b', label: 'B', status: 'completed', timestamp: '2026-01-01T11:00:00Z' },
      { key: 'c', label: 'C', status: 'completed', timestamp: '2026-01-01T13:00:00Z' },
    ];
    const weights = computeTemporalWeights(nodes);
    expect(weights[0]).toBe(0);
    expect(weights[2]!).toBeGreaterThan(weights[1]!);
  });

  it('returns [1] for single node', () => {
    const weights = computeTemporalWeights(makeNodes(1));
    expect(weights).toEqual([1]);
  });

  it('returns even weights when all timestamps identical', () => {
    const nodes = makeNodes(3).map(n => ({ ...n, timestamp: '2026-01-01T10:00:00Z' }));
    const weights = computeTemporalWeights(nodes);
    expect(weights).toEqual([0, 1, 1]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement vertical.ts**

Pure render function. Accepts `nodes: TimelineNode[]` and options including resolved render callbacks, expanded set, and event handlers. Returns `TemplateResult`. CSS styles exported separately.

The vertical renderer preserves case-timeline's visual structure: left-aligned dot + content card, `::before` connector line, expand/collapse detail, category-coloured dots. Keyboard nav (ArrowUp/ArrowDown) and focus management are handled here.

Key implementation details:
- Node dot colour is derived from `node.category` via CSS classes
- Expand button with `aria-expanded` toggle
- `renderDetail` callback used for expanded content, falling back to `renderPropertyTree(node.detail)`
- Click handler calls `onNodeSelected(node, index)`
- ArrowUp/ArrowDown moves focus between sibling `.timeline-node` elements

- [ ] **Step 4: Implement horizontal.ts**

Pure render function for the pipeline layout. Nodes rendered in a row with connectors between. Each node is a numbered circle with status colouring, label below, actor/timestamp underneath.

Key implementation details:
- `role="list"` with `aria-orientation="horizontal"`
- Connector `<div>` between nodes, `.connector--completed` when left node is completed
- Stage nodes numbered 1..N with status classes (completed/active/pending/failed/skipped)
- ArrowLeft/ArrowRight moves focus
- `pulse` animation on active nodes
- Click handler calls `onNodeSelected(node, index)`

- [ ] **Step 5: Implement compact.ts**

Pure render function for the dot strip. Temporal weighting preserves case-timeline's algorithm. Truncation at 7 (first 3 + last 2 + "+N" indicator).

Key implementation details:
- `role="img"` with `aria-label` summary
- Click/Enter/Space fires `onExpandRequested()`
- `computeTemporalWeights(nodes)` exported for testing
- Dot colour from `node.category` or `node.status`
- Flex spacing from temporal weights

- [ ] **Step 6: Run tests**

Run: `cd components/blocks-timeline && npx vitest run`
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add components/blocks-timeline/src/renderers/
git commit -m "feat(blocks-timeline): vertical, horizontal, compact layout renderers (#55)"
```

---

### Task 5: BlocksTimeline component

**Files:**
- Create: `components/blocks-timeline/src/blocks-timeline.ts`
- Create: `components/blocks-timeline/src/blocks-timeline.test.ts`
- Modify: `components/blocks-timeline/src/index.ts`

**Interfaces:**
- Consumes: `TimelineNode`, `Layout`, `TimelineStrategy` from `types.ts`; renderers from Task 4; strategies from Tasks 2–3; `DataSourceMixin`, `fetchSource` from `@casehubio/blocks-ui-core`; `LiveRegionMixin`, `emitPagesEvent` from `@casehubio/pages-primitives`/`pages-component`
- Produces: `BlocksTimeline` custom element `<blocks-timeline>` — used by Tasks 7–9 (examples)

This is the orchestrating component. It:
1. Extends `DataSourceMixin(LiveRegionMixin(LitElement))`
2. Resolves data (`data` prop takes precedence over `dataSet`)
3. Calls `strategy.transformData` then `strategy.toNodes` in `willUpdate`
4. Resolves render callbacks (component > strategy > default)
5. Delegates to the appropriate layout renderer
6. Manages filter state
7. Emits `timeline.node-selected` and `timeline.expand-requested` events
8. Provides `headers` for auth/tenancy
9. Provides `configure()` for host integration

- [ ] **Step 1: Write failing tests**

Tests must cover ALL combinatorial use cases as requested:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { html, render } from 'lit';
import './blocks-timeline.js';
import type { BlocksTimeline } from './blocks-timeline.js';
import { eventChronologyStrategy } from './strategies/event-chronology.js';
import { stateProgressionStrategy, linearResolveStatus } from './strategies/state-progression.js';
import type { CaseEvent, PagedResponse, EventLogEntryResponse } from './strategies/event-chronology.js';
import type { TimelineNode, TimelineStrategy } from './types.js';

async function fixture<T extends HTMLElement & { updateComplete: Promise<boolean> }>(template: ReturnType<typeof html>): Promise<T> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  render(template, container);
  const element = container.firstElementChild as T;
  await element.updateComplete;
  return element;
}

describe('BlocksTimeline', () => {
  let element: BlocksTimeline;

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const mockEvents: CaseEvent[] = [
    { eventType: 'CASE_STARTED', streamType: 'CASE', timestamp: '2026-01-01T10:00:00Z', payload: { type: 'FRAUD' } },
    { eventType: 'TASK_CREATED', streamType: 'WORKER', timestamp: '2026-01-01T10:05:00Z', payload: { taskId: 't-1' } },
    { eventType: 'MILESTONE_REACHED', streamType: 'CASE', timestamp: '2026-01-01T11:00:00Z', payload: {} },
    { eventType: 'AGENT_DISPATCHED', streamType: 'WORKER', timestamp: '2026-01-01T11:30:00Z', payload: {}, metadata: { workerName: 'Alice', trustScore: 0.85 } },
    { eventType: 'CASE_COMPLETED', streamType: 'CASE', timestamp: '2026-01-01T12:00:00Z', payload: {} },
  ];

  describe('element registration', () => {
    it('defines the custom element', () => {
      const el = document.createElement('blocks-timeline');
      expect(el).toBeInstanceOf(HTMLElement);
    });
  });

  // === COMBINATORIAL: eventChronology × vertical ===
  describe('eventChronologyStrategy + vertical layout', () => {
    beforeEach(async () => {
      element = await fixture(html`
        <blocks-timeline
          .strategy=${eventChronologyStrategy()}
          .data=${mockEvents}
          layout="vertical"
        ></blocks-timeline>
      `);
      await element.updateComplete;
    });

    it('renders vertical timeline with list role', () => {
      const list = element.shadowRoot!.querySelector('[role="list"]');
      expect(list).toBeTruthy();
      expect(list?.getAttribute('aria-orientation')).toBeNull();
    });

    it('renders all events as nodes', () => {
      const nodes = element.shadowRoot!.querySelectorAll('[role="listitem"]');
      expect(nodes.length).toBe(5);
    });

    it('applies category CSS classes', () => {
      expect(element.shadowRoot!.querySelector('.timeline-node.lifecycle')).toBeTruthy();
      expect(element.shadowRoot!.querySelector('.timeline-node.task')).toBeTruthy();
    });

    it('renders filter bar', () => {
      const chips = element.shadowRoot!.querySelectorAll('.filter-chip');
      expect(chips.length).toBeGreaterThan(0);
    });

    it('filters nodes when chip toggled', async () => {
      const caseChip = Array.from(element.shadowRoot!.querySelectorAll('.filter-chip'))
        .find(c => c.textContent?.includes('CASE')) as HTMLElement;
      caseChip.click();
      await element.updateComplete;
      expect(element.shadowRoot!.querySelectorAll('.timeline-node.lifecycle').length).toBe(0);
    });

    it('emits timeline.node-selected on node click', async () => {
      const handler = vi.fn();
      element.addEventListener('pages-event', handler);
      const nodeBody = element.shadowRoot!.querySelector('.node-body') as HTMLElement;
      nodeBody.click();
      await element.updateComplete;
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        detail: expect.objectContaining({ topic: 'timeline.node-selected' }),
      }));
    });

    it('ArrowDown moves focus to next node', async () => {
      const nodes = element.shadowRoot!.querySelectorAll('.timeline-node');
      (nodes[0] as HTMLElement).focus();
      (nodes[0] as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await element.updateComplete;
      await new Promise(r => setTimeout(r, 10));
      expect(element.shadowRoot!.activeElement).toBe(nodes[1]);
    });
  });

  // === COMBINATORIAL: eventChronology × horizontal ===
  describe('eventChronologyStrategy + horizontal layout', () => {
    beforeEach(async () => {
      element = await fixture(html`
        <blocks-timeline
          .strategy=${eventChronologyStrategy()}
          .data=${mockEvents}
          layout="horizontal"
        ></blocks-timeline>
      `);
      await element.updateComplete;
    });

    it('renders horizontal layout with aria-orientation', () => {
      const list = element.shadowRoot!.querySelector('[role="list"]');
      expect(list?.getAttribute('aria-orientation')).toBe('horizontal');
    });

    it('renders connectors between nodes', () => {
      expect(element.shadowRoot!.querySelectorAll('.connector').length).toBe(4);
    });

    it('ArrowRight moves focus', async () => {
      const items = element.shadowRoot!.querySelectorAll('[role="listitem"]');
      (items[0] as HTMLElement).focus();
      (items[0] as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await element.updateComplete;
      await new Promise(r => setTimeout(r, 10));
      expect(element.shadowRoot!.activeElement).toBe(items[1]);
    });
  });

  // === COMBINATORIAL: eventChronology × compact ===
  describe('eventChronologyStrategy + compact layout', () => {
    beforeEach(async () => {
      element = await fixture(html`
        <blocks-timeline
          .strategy=${eventChronologyStrategy()}
          .data=${mockEvents}
          layout="compact"
        ></blocks-timeline>
      `);
      await element.updateComplete;
    });

    it('renders compact strip with role="img"', () => {
      expect(element.shadowRoot!.querySelector('[role="img"]')).toBeTruthy();
    });

    it('emits timeline.expand-requested on click', async () => {
      const handler = vi.fn();
      element.addEventListener('pages-event', handler);
      const strip = element.shadowRoot!.querySelector('.compact-strip') as HTMLElement;
      strip.click();
      await element.updateComplete;
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        detail: expect.objectContaining({ topic: 'timeline.expand-requested' }),
      }));
    });

    it('no filter bar in compact mode', () => {
      expect(element.shadowRoot!.querySelector('.filter-bar')).toBeNull();
    });
  });

  // === COMBINATORIAL: stateProgression × horizontal (default) ===
  describe('stateProgressionStrategy + horizontal layout', () => {
    beforeEach(async () => {
      element = await fixture(html`
        <blocks-timeline
          .strategy=${stateProgressionStrategy()}
          .data=${{ currentState: 'ACKNOWLEDGED', transitions: [
            { state: 'OPEN', actor: 'system', timestamp: '2026-01-01T00:00:00Z' },
            { state: 'ACKNOWLEDGED', actor: 'agent-1', timestamp: '2026-01-01T01:00:00Z' },
          ]}}
        ></blocks-timeline>
      `);
      await element.updateComplete;
    });

    it('uses horizontal layout by default', () => {
      const list = element.shadowRoot!.querySelector('[role="list"]');
      expect(list?.getAttribute('aria-orientation')).toBe('horizontal');
    });

    it('renders all qhorus stages', () => {
      const items = element.shadowRoot!.querySelectorAll('[role="listitem"]');
      expect(items.length).toBe(7);
    });

    it('marks OPEN as completed (visited)', () => {
      expect(element.shadowRoot!.querySelector('.stage-node--completed')).toBeTruthy();
    });

    it('marks ACKNOWLEDGED as active', () => {
      expect(element.shadowRoot!.querySelector('.stage-node--active')).toBeTruthy();
    });

    it('no filter bar (no filterCategories)', () => {
      expect(element.shadowRoot!.querySelector('.filter-bar')).toBeNull();
    });
  });

  // === COMBINATORIAL: stateProgression × vertical ===
  describe('stateProgressionStrategy + vertical layout', () => {
    beforeEach(async () => {
      element = await fixture(html`
        <blocks-timeline
          .strategy=${stateProgressionStrategy()}
          .data=${{ currentState: 'FULFILLED', transitions: [
            { state: 'OPEN', timestamp: '2026-01-01T00:00:00Z' },
            { state: 'ACKNOWLEDGED', timestamp: '2026-01-01T01:00:00Z' },
            { state: 'FULFILLED', timestamp: '2026-01-01T02:00:00Z' },
          ]}}
          layout="vertical"
        ></blocks-timeline>
      `);
      await element.updateComplete;
    });

    it('renders vertical list', () => {
      const list = element.shadowRoot!.querySelector('[role="list"]');
      expect(list).toBeTruthy();
      expect(list?.getAttribute('aria-orientation')).toBeNull();
    });

    it('renders all stages as vertical nodes', () => {
      expect(element.shadowRoot!.querySelectorAll('[role="listitem"]').length).toBe(7);
    });
  });

  // === COMBINATORIAL: stateProgression × compact ===
  describe('stateProgressionStrategy + compact layout', () => {
    beforeEach(async () => {
      element = await fixture(html`
        <blocks-timeline
          .strategy=${stateProgressionStrategy()}
          .data=${{ currentState: 'OPEN' }}
          layout="compact"
        ></blocks-timeline>
      `);
      await element.updateComplete;
    });

    it('renders compact strip', () => {
      expect(element.shadowRoot!.querySelector('[role="img"]')).toBeTruthy();
    });
  });

  // === DATA FLOW ===
  describe('data flow', () => {
    it('data prop takes precedence over dataSet', async () => {
      const inlineData: CaseEvent[] = [
        { eventType: 'CASE_STARTED', streamType: 'CASE', timestamp: '2026-01-01T10:00:00Z', payload: {} },
      ];
      element = await fixture(html`
        <blocks-timeline
          .strategy=${eventChronologyStrategy()}
          .data=${inlineData}
          layout="vertical"
        ></blocks-timeline>
      `);
      await element.updateComplete;
      expect(element.shadowRoot!.querySelectorAll('[role="listitem"]').length).toBe(1);
    });

    it('recomputes nodes when data changes', async () => {
      const data1: CaseEvent[] = [
        { eventType: 'CASE_STARTED', streamType: 'CASE', timestamp: '2026-01-01T10:00:00Z', payload: {} },
      ];
      element = await fixture(html`
        <blocks-timeline .strategy=${eventChronologyStrategy()} .data=${data1} layout="vertical"></blocks-timeline>
      `);
      await element.updateComplete;
      expect(element.shadowRoot!.querySelectorAll('[role="listitem"]').length).toBe(1);

      element.data = [...data1, { eventType: 'CASE_COMPLETED', streamType: 'CASE', timestamp: '2026-01-01T11:00:00Z', payload: {} }];
      await element.updateComplete;
      expect(element.shadowRoot!.querySelectorAll('[role="listitem"]').length).toBe(2);
    });

    it('recomputes nodes when strategy changes', async () => {
      element = await fixture(html`
        <blocks-timeline .strategy=${eventChronologyStrategy()} .data=${mockEvents} layout="vertical"></blocks-timeline>
      `);
      await element.updateComplete;
      expect(element.shadowRoot!.querySelectorAll('[role="listitem"]').length).toBe(5);

      element.strategy = stateProgressionStrategy();
      element.data = { currentState: 'OPEN' };
      await element.updateComplete;
      expect(element.shadowRoot!.querySelectorAll('[role="listitem"]').length).toBe(7);
    });

    it('renders empty state when no data', async () => {
      element = await fixture(html`
        <blocks-timeline .strategy=${eventChronologyStrategy()} layout="vertical"></blocks-timeline>
      `);
      await element.updateComplete;
      expect(element.shadowRoot!.querySelectorAll('[role="listitem"]').length).toBe(0);
    });

    it('transformData is called when present', async () => {
      const paged: PagedResponse<EventLogEntryResponse> = {
        content: mockEvents as EventLogEntryResponse[],
        page: 0, size: 20, totalElements: mockEvents.length, totalPages: 1,
      };
      element = await fixture(html`
        <blocks-timeline .strategy=${eventChronologyStrategy()} .data=${paged} layout="vertical"></blocks-timeline>
      `);
      await element.updateComplete;
      expect(element.shadowRoot!.querySelectorAll('[role="listitem"]').length).toBe(5);
    });
  });

  // === RENDER CALLBACKS ===
  describe('render callback resolution', () => {
    it('component renderNode overrides strategy renderNode', async () => {
      const strategyRender = vi.fn(() => html`<span class="strategy">s</span>`);
      const componentRender = vi.fn(() => html`<span class="component">c</span>`);
      const strategy: TimelineStrategy<CaseEvent[]> = {
        ...eventChronologyStrategy(),
        renderNode: strategyRender,
      };
      element = await fixture(html`
        <blocks-timeline .strategy=${strategy} .data=${mockEvents} .renderNode=${componentRender} layout="vertical"></blocks-timeline>
      `);
      await element.updateComplete;
      expect(componentRender).toHaveBeenCalled();
      expect(strategyRender).not.toHaveBeenCalled();
      expect(element.shadowRoot!.querySelector('.component')).toBeTruthy();
    });

    it('strategy renderNode used when component has none', async () => {
      const strategyRender = vi.fn(() => html`<span class="strategy">s</span>`);
      const strategy: TimelineStrategy<CaseEvent[]> = {
        ...eventChronologyStrategy(),
        renderNode: strategyRender,
      };
      element = await fixture(html`
        <blocks-timeline .strategy=${strategy} .data=${mockEvents} layout="vertical"></blocks-timeline>
      `);
      await element.updateComplete;
      expect(strategyRender).toHaveBeenCalled();
      expect(element.shadowRoot!.querySelector('.strategy')).toBeTruthy();
    });

    it('built-in default when neither provides renderNode', async () => {
      element = await fixture(html`
        <blocks-timeline .strategy=${eventChronologyStrategy()} .data=${mockEvents} layout="vertical"></blocks-timeline>
      `);
      await element.updateComplete;
      expect(element.shadowRoot!.querySelector('.node-dot')).toBeTruthy();
    });
  });

  // === FILTER BEHAVIOR ===
  describe('filter behavior', () => {
    it('shows all categories initially when activeFilters not set', async () => {
      element = await fixture(html`
        <blocks-timeline .strategy=${eventChronologyStrategy()} .data=${mockEvents} layout="vertical"></blocks-timeline>
      `);
      await element.updateComplete;
      const chips = element.shadowRoot!.querySelectorAll('.filter-chip');
      chips.forEach(c => expect(c.getAttribute('aria-checked')).toBe('true'));
    });

    it('accepts string[] as activeFilters', async () => {
      element = await fixture(html`
        <blocks-timeline .strategy=${eventChronologyStrategy()} .data=${mockEvents} .activeFilters=${['CASE']} layout="vertical"></blocks-timeline>
      `);
      await element.updateComplete;
      const lifecycleNodes = element.shadowRoot!.querySelectorAll('.timeline-node.lifecycle');
      expect(lifecycleNodes.length).toBeGreaterThan(0);
      const taskNodes = element.shadowRoot!.querySelectorAll('.timeline-node.task');
      expect(taskNodes.length).toBe(0);
    });

    it('nodes with undefined category always visible', async () => {
      const events: CaseEvent[] = [
        { eventType: 'CUSTOM', streamType: 'CASE', timestamp: '2026-01-01T10:00:00Z', payload: {} },
      ];
      const strategy: TimelineStrategy<CaseEvent[]> = {
        ...eventChronologyStrategy({ categorize: () => undefined as any }),
        filterCategories: ['CASE'],
      };
      element = await fixture(html`
        <blocks-timeline .strategy=${strategy} .data=${events} .activeFilters=${[]} layout="vertical"></blocks-timeline>
      `);
      await element.updateComplete;
      expect(element.shadowRoot!.querySelectorAll('[role="listitem"]').length).toBe(1);
    });

    it('no filter UI when strategy has no filterCategories', async () => {
      element = await fixture(html`
        <blocks-timeline .strategy=${stateProgressionStrategy()} .data=${{ currentState: 'OPEN' }}></blocks-timeline>
      `);
      await element.updateComplete;
      expect(element.shadowRoot!.querySelector('.filter-bar')).toBeNull();
    });
  });

  // === LOADING / ERROR STATES ===
  describe('loading and error states', () => {
    it('shows loading message', async () => {
      element = await fixture(html`
        <blocks-timeline .strategy=${eventChronologyStrategy()} layout="vertical"></blocks-timeline>
      `);
      element.loading = true;
      await element.updateComplete;
      expect(element.shadowRoot!.textContent).toContain('Loading');
    });

    it('shows error message', async () => {
      element = await fixture(html`
        <blocks-timeline .strategy=${eventChronologyStrategy()} layout="vertical"></blocks-timeline>
      `);
      element.error = 'Network error';
      await element.updateComplete;
      expect(element.shadowRoot!.textContent).toContain('Network error');
    });

    it('inline data renders despite loading state', async () => {
      element = await fixture(html`
        <blocks-timeline .strategy=${eventChronologyStrategy()} .data=${mockEvents} layout="vertical"></blocks-timeline>
      `);
      element.loading = true;
      await element.updateComplete;
      expect(element.shadowRoot!.querySelectorAll('[role="listitem"]').length).toBe(5);
    });
  });

  // === HEADERS ===
  describe('headers', () => {
    it('passes headers object to fetch', async () => {
      const mockFetch = vi.fn(() => Promise.resolve(new Response('[]', { status: 200 })));
      const origFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as any;

      element = await fixture(html`
        <blocks-timeline
          .strategy=${eventChronologyStrategy()}
          .headers=${{ 'X-Tenancy-ID': 'tenant-1' }}
          endpoint="/api/events"
          layout="vertical"
        ></blocks-timeline>
      `);
      await element.updateComplete;
      await new Promise(r => setTimeout(r, 10));

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Tenancy-ID': 'tenant-1' }),
        }),
      );

      globalThis.fetch = origFetch;
    });

    it('accepts header function for lazy evaluation', async () => {
      const headerFn = vi.fn(() => ({ 'Authorization': 'Bearer token' }));
      element = await fixture(html`
        <blocks-timeline .strategy=${eventChronologyStrategy()} .headers=${headerFn} layout="vertical"></blocks-timeline>
      `);
      await element.updateComplete;
      expect(element.headers).toBe(headerFn);
    });
  });

  // === CONFIGURE ===
  describe('configure()', () => {
    it('sets endpoint and triggers fetch', async () => {
      const mockFetch = vi.fn(() => Promise.resolve(new Response('[]', { status: 200 })));
      const origFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as any;

      element = await fixture(html`
        <blocks-timeline .strategy=${eventChronologyStrategy()} layout="vertical"></blocks-timeline>
      `);
      element.configure({ endpoint: '/api/test' });
      await element.updateComplete;
      await new Promise(r => setTimeout(r, 10));

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/test'), expect.any(Object));
      globalThis.fetch = origFetch;
    });

    it('maps identity to headers', async () => {
      element = await fixture(html`
        <blocks-timeline .strategy=${eventChronologyStrategy()} layout="vertical"></blocks-timeline>
      `);
      element.configure({
        identity: { userId: 'u', tenancyId: 'tenant-1', displayName: 'U', groups: [], roles: [] },
      });
      await element.updateComplete;
      expect(element.headers).toEqual({ 'X-Tenancy-ID': 'tenant-1' });
    });
  });

  // === LINEAR RESOLVE STATUS (end-to-end) ===
  describe('stateProgression with linearResolveStatus', () => {
    it('shows positional completion', async () => {
      element = await fixture(html`
        <blocks-timeline
          .strategy=${stateProgressionStrategy({ resolveStatus: linearResolveStatus })}
          .data=${{ currentState: 'ACKNOWLEDGED' }}
        ></blocks-timeline>
      `);
      await element.updateComplete;
      expect(element.shadowRoot!.querySelector('.stage-node--completed')).toBeTruthy();
      expect(element.shadowRoot!.querySelector('.stage-node--active')).toBeTruthy();
      expect(element.shadowRoot!.querySelector('.stage-node--pending')).toBeTruthy();
    });
  });

  // === LAYOUT SWITCHING ===
  describe('layout switching', () => {
    it('uses strategy.defaultLayout when layout not set', async () => {
      element = await fixture(html`
        <blocks-timeline .strategy=${eventChronologyStrategy()} .data=${mockEvents}></blocks-timeline>
      `);
      await element.updateComplete;
      expect(element.shadowRoot!.querySelector('[role="list"]')).toBeTruthy();
      expect(element.shadowRoot!.querySelector('[aria-orientation]')).toBeNull();
    });

    it('layout prop overrides strategy default', async () => {
      element = await fixture(html`
        <blocks-timeline .strategy=${eventChronologyStrategy()} .data=${mockEvents} layout="horizontal"></blocks-timeline>
      `);
      await element.updateComplete;
      expect(element.shadowRoot!.querySelector('[aria-orientation="horizontal"]')).toBeTruthy();
    });

    it('switches layout dynamically', async () => {
      element = await fixture(html`
        <blocks-timeline .strategy=${eventChronologyStrategy()} .data=${mockEvents} layout="vertical"></blocks-timeline>
      `);
      await element.updateComplete;
      expect(element.shadowRoot!.querySelector('.timeline')).toBeTruthy();

      element.layout = 'compact';
      await element.updateComplete;
      expect(element.shadowRoot!.querySelector('.compact-strip')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement blocks-timeline.ts**

The component class. Key implementation:
- Extends `DataSourceMixin(LiveRegionMixin(LitElement))`
- `@customElement('blocks-timeline')`
- Properties: `strategy`, `data`, `layout`, `renderNode`, `renderDetail`, `activeFilters`, `headers`
- `willUpdate`: data resolution (data ?? dataSet), transformData, toNodes
- `render`: selects renderer based on active layout, passes resolved callbacks
- Filter UI: renders `strategy.filterCategories` as toggle chips when present and layout !== 'compact'
- Events: `emitPagesEvent(this, 'timeline.node-selected', { node, index })` on node click
- Events: `emitPagesEvent(this, 'timeline.expand-requested', {})` on compact strip click
- `createSourceFactory()`: wraps headers into fetchSource options
- `configure()`: maps `identity.tenancyId` to headers, delegates to super

- [ ] **Step 4: Update index.ts with component export**

- [ ] **Step 5: Run tests**

Run: `cd components/blocks-timeline && npx vitest run`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add components/blocks-timeline/src/blocks-timeline.ts components/blocks-timeline/src/blocks-timeline.test.ts components/blocks-timeline/src/index.ts
git commit -m "feat(blocks-timeline): component with strategy orchestration, filters, events, ARIA (#55)"
```

---

### Task 6: Delete case-timeline package

**Files:**
- Delete: `components/case-timeline/` (entire directory)
- Modify: `examples/vite.config.ts` (update alias)
- Modify: `examples/src/shell.ts` (update nav and route)
- Modify: `examples/src/main.ts` (update import)

**Interfaces:**
- Consumes: `<blocks-timeline>` from Task 5
- Produces: clean removal — no other component in this repo imports case-timeline

- [ ] **Step 1: Verify no in-repo consumers**

Use `ide_find_references` on the `CaseTimeline` class and `case-timeline` tag to confirm nothing else in the repo imports from this package.

- [ ] **Step 2: Delete case-timeline directory**

Use `ide_refactor_safe_delete` for the component file, then remove the directory.

- [ ] **Step 3: Update examples vite.config.ts**

Replace the `@casehubio/blocks-ui-case-timeline` alias with `@casehubio/blocks-ui-blocks-timeline` pointing to `../components/blocks-timeline/src`.

- [ ] **Step 4: Update examples shell.ts**

Replace the `case-timeline` nav entry and route with `blocks-timeline` entries. Update the import in `main.ts`.

- [ ] **Step 5: Run typecheck and tests**

Run: `yarn typecheck && yarn test`
Expected: pass (case-timeline tests are gone, blocks-timeline tests pass)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(blocks-timeline): remove case-timeline — replaced by blocks-timeline (#55)"
```

---

### Task 7: Example page — event chronology (vertical)

**Files:**
- Create: `examples/src/pages/timeline-events-page.ts`
- Create: `examples/mock-data/commitment-data.json`
- Modify: `examples/src/shell.ts` (add nav entry)
- Modify: `examples/src/main.ts` (add import)

**Interfaces:**
- Consumes: `<blocks-timeline>`, `eventChronologyStrategy` from Task 5
- Produces: standalone example page

- [ ] **Step 1: Create timeline-events-page.ts**

Example page showing `<blocks-timeline>` with `eventChronologyStrategy()` in vertical layout. Patches `globalThis.fetch` to serve mock data (same pattern as audit-trail-page.ts fix from this session). Includes:
- Mode toggle: vertical ↔ compact
- Feature list highlighting event chronology, filter bar, expand/collapse, category colouring
- "Try It" section with interactive instructions
- Uses existing `case-events.json` mock data

- [ ] **Step 2: Register in shell.ts and main.ts**

Add nav entry `{ id: 'timeline-events', label: 'Timeline (Events)', hash: '#components/timeline-events' }` and route.

- [ ] **Step 3: Test in browser**

Start dev server, navigate to the page, verify events render, filter works, mode toggle works.

- [ ] **Step 4: Commit**

```bash
git add examples/
git commit -m "feat(examples): timeline event chronology example page (#55)"
```

---

### Task 8: Example page — state progression (horizontal)

**Files:**
- Create: `examples/src/pages/timeline-commitment-page.ts`
- Modify: `examples/src/shell.ts` (add nav entry)
- Modify: `examples/src/main.ts` (add import)

**Interfaces:**
- Consumes: `<blocks-timeline>`, `stateProgressionStrategy`, `linearResolveStatus` from Task 5
- Produces: standalone example page

- [ ] **Step 1: Create timeline-commitment-page.ts**

Example page showing commitment lifecycle in horizontal pipeline layout. Features:
- Mock commitment data with transitions (OPEN → ACKNOWLEDGED → FULFILLED)
- A second instance showing a declined commitment (OPEN → DECLINED)
- A third instance with `linearResolveStatus` for a simple linear pipeline
- Custom stages example (DRAFT → SUBMITTED → APPROVED/REJECTED)
- Feature list highlighting state progression, status colouring, transition history

- [ ] **Step 2: Register in shell.ts and main.ts**

Add nav entry `{ id: 'timeline-commitment', label: 'Timeline (Commitment)', hash: '#components/timeline-commitment' }`.

- [ ] **Step 3: Test in browser**

- [ ] **Step 4: Commit**

```bash
git add examples/
git commit -m "feat(examples): timeline commitment lifecycle example page (#55)"
```

---

### Task 9: Example page — custom strategy

**Files:**
- Create: `examples/src/pages/timeline-custom-page.ts`
- Modify: `examples/src/shell.ts` (add nav entry)
- Modify: `examples/src/main.ts` (add import)

**Interfaces:**
- Consumes: `<blocks-timeline>`, `TimelineStrategy`, `TimelineNode` from Task 5
- Produces: standalone example page

- [ ] **Step 1: Create timeline-custom-page.ts**

Example page showing how to write a custom strategy from scratch. Features:
- A simple custom strategy (e.g., deployment pipeline: Build → Test → Stage → Deploy)
- Custom `renderNode` callback on the component
- Custom `renderDetail` callback
- Layout override (strategy defaults to horizontal, page shows it in vertical too)
- Feature list explaining the strategy pattern, render resolution order, customisation points

- [ ] **Step 2: Register in shell.ts and main.ts**

Add nav entry `{ id: 'timeline-custom', label: 'Timeline (Custom)', hash: '#components/timeline-custom' }`.

- [ ] **Step 3: Test in browser**

- [ ] **Step 4: Commit**

```bash
git add examples/
git commit -m "feat(examples): custom timeline strategy example page (#55)"
```
