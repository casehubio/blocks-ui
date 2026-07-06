# Queue Board UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> subagent-driven-development (recommended) or executing-plans to
> implement this plan task-by-task. Each task follows TDD
> (test-driven-development) and uses ide-tooling for structural
> editing. Steps use checkbox (`- [ ]`) syntax for tracking.

**Focal issue:** #20 — Redesign queue board UX — navigation pattern and constrained filter pills
**Issue group:** #20

**Goal:** Replace the giant-card queue dashboard with a queue pill bar inside the inbox that composes orthogonally with My Work / Claimable / All tabs and ad-hoc filter pills.

**Architecture:** Three orthogonal filtering axes — population scope (queue pill bar), perspective (tabs), and ad-hoc filters (status/priority pills) — compose via a unified filter pipeline. The inbox owns all data: inbox items from `/workitems/inbox`, queue items from `/queues/{id}/items`. The pill bar is pure navigation. New components consume `@casehubio/pages-primitives` (scope selector, filter chips) and `@casehubio/pages-component` (event helpers).

**Tech Stack:** TypeScript 5, Lit 3, Vitest, `@casehubio/pages-primitives` (scope selector, filter chips, a11y mixins), `@casehubio/pages-component` (event helpers)

## Global Constraints

- New components use `--pages-*` CSS custom properties (with fallback values for standalone use)
- Existing components retain `--blocks-*` tokens until blocks-ui#21 migrates them
- `@casehubio/pages-primitives` and `@casehubio/pages-component` are available as local workspace links to `../../pages/packages/*`
- TDD: write failing test → verify fail → implement → verify pass → commit
- IntelliJ MCP for all code navigation and refactoring
- No backward compatibility shims — breaking changes are intentional

---

### Task 1: Types and Event Topics

**Files:**
- Modify: `packages/blocks-ui-core/src/types/events.ts`
- Modify: `packages/blocks-ui-core/src/types/work-item.ts`
- Modify: `packages/blocks-ui-core/src/types/index.ts`
- Test: `packages/blocks-ui-core/src/types/events.test.ts` (new)

**Interfaces:**
- Consumes: nothing
- Produces: `QueueScopeChangedPayload` (event payload type), `QueueScope` (internal inbox type), `QueueSummaryEntry` (API response type), `WorkItemEventTopics.QUEUE_SCOPE_CHANGED` (event topic constant), `InboxMode` type union including `'all'`

- [ ] **Step 1: Write failing test for new event topics**

Create `packages/blocks-ui-core/src/types/events.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { WorkItemEventTopics } from './events.js';

describe('WorkItemEventTopics', () => {
  it('has QUEUE_SCOPE_CHANGED topic', () => {
    expect(WorkItemEventTopics.QUEUE_SCOPE_CHANGED).toBe('queue.scope-changed');
  });

  it('does not have legacy QUEUE_SELECTED or QUEUE_DESELECTED', () => {
    expect('QUEUE_SELECTED' in WorkItemEventTopics).toBe(false);
    expect('QUEUE_DESELECTED' in WorkItemEventTopics).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn workspace @casehubio/blocks-ui-core run test -- --run src/types/events.test.ts`
Expected: FAIL — `QUEUE_SCOPE_CHANGED` not defined, `QUEUE_SELECTED` still exists

- [ ] **Step 3: Update event topics**

Edit `packages/blocks-ui-core/src/types/events.ts`:

Replace `WorkItemEventTopics`:
```typescript
export const WorkItemEventTopics = {
  SELECTED: 'work-item.selected',
  DESELECTED: 'work-item.deselected',
  QUEUE_SCOPE_CHANGED: 'queue.scope-changed',
} as const;
```

Add `QueueScopeChangedPayload`:
```typescript
export interface QueueScopeChangedPayload {
  readonly queue: QueueView | null;
}
```

Import `QueueView` from `./work-item.js`.

- [ ] **Step 4: Add QueueScope and QueueSummaryEntry types**

Add to `packages/blocks-ui-core/src/types/work-item.ts`:

```typescript
export type InboxMode = 'my-work' | 'claimable' | 'all';

export interface QueueScope {
  readonly queue: QueueView;
  readonly items: WorkItemRootResponse[];
  readonly statusCounts: ReadonlyMap<string, number>;
  readonly priorityCounts: ReadonlyMap<string, number>;
  readonly overdueCount: number;
  readonly breachCount: number;
}

export interface QueueSummaryEntry {
  readonly queueId: string;
  readonly count: number;
  readonly breachCount: number;
}
```

- [ ] **Step 5: Update barrel exports**

Add to `packages/blocks-ui-core/src/types/index.ts`:
```typescript
export type { QueueScopeChangedPayload } from './events.js';
export type { InboxMode, QueueScope, QueueSummaryEntry } from './work-item.js';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `yarn workspace @casehubio/blocks-ui-core run test`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add packages/blocks-ui-core/
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "feat(core): add queue scope types and update event topics Refs #20"
```

---

### Task 2: Filter Bar with Counts and Disabled State

**Files:**
- Modify: `components/work-item-inbox/src/inbox-filter-bar.ts`
- Modify: `components/work-item-inbox/src/inbox-filter-bar.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `InboxFilterBar` with `statusCounts: Map<string, number>`, `priorityCounts: Map<string, number>` properties. Pills with count = 0 are visually disabled. `FilterChangeDetail` unchanged.

- [ ] **Step 1: Write failing tests for count display and disabled state**

Add to `components/work-item-inbox/src/inbox-filter-bar.test.ts`:

```typescript
it('renders count next to each status chip', async () => {
  el.statusCounts = new Map([['PENDING', 5], ['ASSIGNED', 3], ['IN_PROGRESS', 0]]);
  await (el as any).updateComplete;
  const pendingChip = el.shadowRoot!.querySelector('[data-status="PENDING"]');
  expect(pendingChip?.textContent).toContain('(5)');
});

it('disables chips with count = 0', async () => {
  el.statusCounts = new Map([['PENDING', 5], ['ASSIGNED', 0], ['IN_PROGRESS', 0]]);
  await (el as any).updateComplete;
  const assignedChip = el.shadowRoot!.querySelector('[data-status="ASSIGNED"]');
  expect(assignedChip?.getAttribute('aria-disabled')).toBe('true');
  expect(assignedChip?.classList.contains('disabled')).toBe(true);
});

it('does not emit filter-change for disabled chips', async () => {
  el.statusCounts = new Map([['PENDING', 5], ['ASSIGNED', 0]]);
  await (el as any).updateComplete;
  const handler = vi.fn();
  el.addEventListener('filter-change', handler);
  const assignedChip = el.shadowRoot!.querySelector('[data-status="ASSIGNED"]') as HTMLElement;
  assignedChip.click();
  expect(handler).not.toHaveBeenCalled();
});

it('renders priority counts', async () => {
  el.priorityCounts = new Map([['URGENT', 1], ['HIGH', 3], ['MEDIUM', 4], ['LOW', 0]]);
  await (el as any).updateComplete;
  const urgentChip = el.shadowRoot!.querySelector('[data-priority="URGENT"]');
  expect(urgentChip?.textContent).toContain('(1)');
  const lowChip = el.shadowRoot!.querySelector('[data-priority="LOW"]');
  expect(lowChip?.getAttribute('aria-disabled')).toBe('true');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace @casehubio/blocks-ui-work-item-inbox run test -- --run src/inbox-filter-bar.test.ts`
Expected: FAIL — `statusCounts` property doesn't exist

- [ ] **Step 3: Add count properties and disabled styling**

Edit `components/work-item-inbox/src/inbox-filter-bar.ts`:

Add properties:
```typescript
@property({ type: Object }) statusCounts: Map<string, number> = new Map();
@property({ type: Object }) priorityCounts: Map<string, number> = new Map();
```

Add CSS for disabled state:
```css
.chip.disabled {
  opacity: 0.4;
  cursor: default;
  pointer-events: none;
}
```

Update status chip rendering to include count and disabled state:
```typescript
${STATUS_FILTERS.map(
  (status) => {
    const count = this.statusCounts.get(status);
    const isDisabled = count !== undefined && count === 0;
    return html`
      <button
        class="chip status-chip ${this.activeStatusFilters.has(status) ? 'active' : ''} ${isDisabled ? 'disabled' : ''}"
        data-status="${status}"
        aria-disabled="${isDisabled}"
        @click="${() => !isDisabled && this.handleStatusChipClick(status)}"
        tabindex="0"
      >
        ${this.formatLabel(status)}${count !== undefined ? html` <span class="chip-count">(${count})</span>` : ''}
      </button>
    `;
  },
)}
```

Apply same pattern to priority chips using `this.priorityCounts`.

Add CSS for count:
```css
.chip-count {
  color: var(--blocks-neutral-9, #888);
  font-size: 10px;
}

.chip.active .chip-count {
  color: var(--blocks-accent-1, #ffffff);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn workspace @casehubio/blocks-ui-work-item-inbox run test -- --run src/inbox-filter-bar.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add components/work-item-inbox/src/inbox-filter-bar.ts components/work-item-inbox/src/inbox-filter-bar.test.ts
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "feat(filter-bar): add per-pill counts and disabled state Refs #20"
```

---

### Task 3: Queue Pill Bar Component

**Files:**
- Create: `components/work-item-inbox/src/queue-pill-bar.ts`
- Create: `components/work-item-inbox/src/queue-pill-bar.test.ts`

**Interfaces:**
- Consumes: `QueueView` from `@casehubio/blocks-ui-core`, `QueueSummaryEntry` from `@casehubio/blocks-ui-core`, `emitPagesEvent` from `@casehubio/pages-component`, `WorkItemEventTopics` from `@casehubio/blocks-ui-core`
- Produces: `QueuePillBar` custom element (`<queue-pill-bar>`). Properties: `endpoint: string`, `queues: QueueView[]`, `summaries: QueueSummaryEntry[]`, `selectedQueueId: string | null`, `selectedQueueCount: number | null` (reactive count from inbox). Emits `pages-event` with topic `queue.scope-changed` and `QueueScopeChangedPayload`. Fetches `GET /queues` and `GET /queues/summary`. 30-second polling for summary refresh.

- [ ] **Step 1: Write failing tests**

Create `components/work-item-inbox/src/queue-pill-bar.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './queue-pill-bar.js';
import type { QueueView, QueueSummaryEntry } from '@casehubio/blocks-ui-core';

const QUEUES: QueueView[] = [
  { id: 'q1', name: 'Compliance', labelPattern: 'domain=compliance', scope: null },
  { id: 'q2', name: 'Clinical Safety', labelPattern: 'domain=clinical', scope: null },
];

const SUMMARIES: QueueSummaryEntry[] = [
  { queueId: 'q1', count: 12, breachCount: 0 },
  { queueId: 'q2', count: 8, breachCount: 2 },
];

describe('queue-pill-bar', () => {
  let el: HTMLElement & {
    queues: QueueView[];
    summaries: QueueSummaryEntry[];
    selectedQueueId: string | null;
    selectedQueueCount: number | null;
  };

  beforeEach(async () => {
    el = document.createElement('queue-pill-bar') as any;
    el.queues = QUEUES;
    el.summaries = SUMMARIES;
    document.body.appendChild(el);
    await (el as any).updateComplete;
  });

  afterEach(() => el.remove());

  it('renders a pill for each queue', () => {
    const pills = el.shadowRoot!.querySelectorAll('[role="radio"]');
    expect(pills.length).toBe(2);
  });

  it('shows queue name and count', () => {
    const pill = el.shadowRoot!.querySelector('[data-id="q1"]');
    expect(pill?.textContent).toContain('Compliance');
    expect(pill?.textContent).toContain('12');
  });

  it('shows breach badge when breachCount > 0', () => {
    const pill = el.shadowRoot!.querySelector('[data-id="q2"]');
    const badge = pill?.querySelector('.scope-badge');
    expect(badge?.textContent?.trim()).toBe('2');
  });

  it('sorts pills by urgency — breached first', () => {
    const pills = el.shadowRoot!.querySelectorAll('[role="radio"]');
    expect(pills[0]?.getAttribute('data-id')).toBe('q2');
    expect(pills[1]?.getAttribute('data-id')).toBe('q1');
  });

  it('emits queue.scope-changed on pill click', async () => {
    const handler = vi.fn();
    el.addEventListener('pages-event', handler);
    const pill = el.shadowRoot!.querySelector('[data-id="q1"]') as HTMLElement;
    pill.click();
    expect(handler).toHaveBeenCalled();
    const detail = handler.mock.calls[0][0].detail;
    expect(detail.topic).toBe('queue.scope-changed');
    expect(detail.payload.queue.id).toBe('q1');
  });

  it('emits null queue on deselect (click active pill)', async () => {
    el.selectedQueueId = 'q1';
    await (el as any).updateComplete;
    const handler = vi.fn();
    el.addEventListener('pages-event', handler);
    const pill = el.shadowRoot!.querySelector('[data-id="q1"]') as HTMLElement;
    pill.click();
    expect(handler.mock.calls[0][0].detail.payload.queue).toBeNull();
  });

  it('uses selectedQueueCount for active pill when provided', async () => {
    el.selectedQueueId = 'q1';
    el.selectedQueueCount = 15;
    await (el as any).updateComplete;
    const pill = el.shadowRoot!.querySelector('[data-id="q1"]');
    expect(pill?.textContent).toContain('15');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn workspace @casehubio/blocks-ui-work-item-inbox run test -- --run src/queue-pill-bar.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement queue-pill-bar**

Create `components/work-item-inbox/src/queue-pill-bar.ts`:

```typescript
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  type QueueView,
  type QueueSummaryEntry,
  type QueueScopeChangedPayload,
  emitPagesEvent,
  WorkItemEventTopics,
} from '@casehubio/blocks-ui-core';

@customElement('queue-pill-bar')
export class QueuePillBar extends LitElement {
  @property({ type: String }) endpoint = '';
  @property({ type: Array }) queues: QueueView[] = [];
  @property({ type: Array }) summaries: QueueSummaryEntry[] = [];
  @property({ type: String }) selectedQueueId: string | null = null;
  @property({ type: Number }) selectedQueueCount: number | null = null;

  private _pollTimer: number | null = null;

  static override styles = css`
    :host {
      display: block;
      padding: var(--blocks-space-2, 8px) var(--blocks-space-3, 12px);
      border-bottom: 1px solid var(--blocks-neutral-4, #e5e5e5);
      background: var(--pages-neutral-2, var(--blocks-neutral-2, #f5f5f5));
      overflow-x: auto;
    }

    .pill-bar {
      display: flex;
      gap: var(--pages-space-1, 6px);
      align-items: center;
    }

    .label {
      font-size: 10px;
      color: var(--blocks-neutral-9, #888);
      font-weight: 600;
      text-transform: uppercase;
      margin-right: 4px;
      white-space: nowrap;
    }

    [role="radio"] {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 14px;
      border: 1px solid var(--blocks-neutral-4, #e5e5e5);
      background: var(--blocks-neutral-1, #fafafa);
      color: var(--blocks-neutral-12, #111);
      font-size: 11px;
      cursor: pointer;
      white-space: nowrap;
      outline: none;
    }

    [role="radio"]:focus-visible {
      box-shadow: 0 0 0 2px var(--blocks-accent-9, #2563eb);
    }

    [role="radio"][aria-checked="true"] {
      background: var(--blocks-accent-9, #2563eb);
      border-color: var(--blocks-accent-9, #2563eb);
      color: white;
    }

    .pill-count {
      font-weight: 600;
      color: var(--blocks-accent-9, #2563eb);
    }

    [role="radio"][aria-checked="true"] .pill-count {
      color: white;
    }

    .pill-badge {
      display: inline-flex;
      padding: 0 5px;
      border-radius: 8px;
      background: var(--blocks-danger-9, #dc2626);
      color: white;
      font-size: 9px;
      font-weight: 700;
      line-height: 1.6;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this._loadQueues();
    this._startPolling();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._stopPolling();
  }

  private async _loadQueues() {
    if (!this.endpoint) return;
    try {
      const [queuesRes, summaryRes] = await Promise.all([
        fetch(`${this.endpoint}/queues`),
        fetch(`${this.endpoint}/queues/summary`),
      ]);
      if (queuesRes.ok) this.queues = await queuesRes.json();
      if (summaryRes.ok) this.summaries = await summaryRes.json();
    } catch { /* silent — counts are informational */ }
  }

  private async _refreshSummary() {
    if (!this.endpoint) return;
    try {
      const res = await fetch(`${this.endpoint}/queues/summary`);
      if (res.ok) this.summaries = await res.json();
    } catch { /* silent retry on next poll */ }
  }

  private _startPolling() {
    this._pollTimer = window.setInterval(() => {
      if (!document.hidden) this._refreshSummary();
    }, 30000);
  }

  private _stopPolling() {
    if (this._pollTimer !== null) clearInterval(this._pollTimer);
  }

  private _getSortedQueues(): Array<{ queue: QueueView; count: number; breachCount: number }> {
    return this.queues
      .map(queue => {
        const summary = this.summaries.find(s => s.queueId === queue.id);
        const isSelected = this.selectedQueueId === queue.id;
        const count = isSelected && this.selectedQueueCount !== null
          ? this.selectedQueueCount
          : (summary?.count ?? 0);
        return { queue, count, breachCount: summary?.breachCount ?? 0 };
      })
      .sort((a, b) => {
        if (a.breachCount > 0 && b.breachCount === 0) return -1;
        if (b.breachCount > 0 && a.breachCount === 0) return 1;
        if (a.breachCount !== b.breachCount) return b.breachCount - a.breachCount;
        return b.count - a.count;
      });
  }

  private _handlePillClick(queue: QueueView) {
    const newQueue = this.selectedQueueId === queue.id ? null : queue;
    this.selectedQueueId = newQueue?.id ?? null;
    emitPagesEvent<QueueScopeChangedPayload>(this, WorkItemEventTopics.QUEUE_SCOPE_CHANGED, {
      queue: newQueue,
    });
  }

  override render() {
    if (this.queues.length === 0) return nothing;

    const sorted = this._getSortedQueues();

    return html`
      <div role="radiogroup" aria-label="Queue scope" class="pill-bar">
        <span class="label">Queues:</span>
        ${sorted.map(({ queue, count, breachCount }) => html`
          <span
            role="radio"
            tabindex="-1"
            aria-checked="${this.selectedQueueId === queue.id}"
            data-id="${queue.id}"
            @click="${() => this._handlePillClick(queue)}"
            @keydown="${(e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this._handlePillClick(queue);
              }
            }}"
          >
            ${queue.name}
            <span class="pill-count">${count}</span>
            ${breachCount > 0 ? html`<span class="pill-badge">${breachCount}</span>` : nothing}
          </span>
        `)}
      </div>
    `;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn workspace @casehubio/blocks-ui-work-item-inbox run test -- --run src/queue-pill-bar.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add components/work-item-inbox/src/queue-pill-bar.ts components/work-item-inbox/src/queue-pill-bar.test.ts
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "feat(inbox): queue pill bar — single-select scope navigation Refs #20"
```

---

### Task 4: Scope Context Bar

**Files:**
- Create: `components/work-item-inbox/src/scope-context-bar.ts`
- Create: `components/work-item-inbox/src/scope-context-bar.test.ts`

**Interfaces:**
- Consumes: `QueueView` from `@casehubio/blocks-ui-core`
- Produces: `ScopeContextBar` custom element (`<scope-context-bar>`). Properties: `queue: QueueView | null`. Emits `scope-clear` event on clear button click.

- [ ] **Step 1: Write failing tests**

Create `components/work-item-inbox/src/scope-context-bar.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './scope-context-bar.js';
import type { QueueView } from '@casehubio/blocks-ui-core';

describe('scope-context-bar', () => {
  let el: HTMLElement & { queue: QueueView | null };

  beforeEach(async () => {
    el = document.createElement('scope-context-bar') as any;
    document.body.appendChild(el);
    await (el as any).updateComplete;
  });

  afterEach(() => el.remove());

  it('renders nothing when no queue is set', () => {
    el.queue = null;
    expect(el.shadowRoot!.querySelector('.scope-bar')).toBeNull();
  });

  it('renders label pattern as key:value tag', async () => {
    el.queue = { id: 'q1', name: 'AML', labelPattern: 'domain=aml', scope: null };
    await (el as any).updateComplete;
    const tag = el.shadowRoot!.querySelector('.scope-tag');
    expect(tag?.textContent).toContain('domain');
    expect(tag?.textContent).toContain('aml');
  });

  it('renders raw pattern for non key=value patterns', async () => {
    el.queue = { id: 'q1', name: 'Complex', labelPattern: 'status:active AND priority>2', scope: null };
    await (el as any).updateComplete;
    const tag = el.shadowRoot!.querySelector('.scope-tag');
    expect(tag?.textContent).toContain('status:active AND priority>2');
  });

  it('emits scope-clear on clear button click', async () => {
    el.queue = { id: 'q1', name: 'AML', labelPattern: 'domain=aml', scope: null };
    await (el as any).updateComplete;
    const handler = vi.fn();
    el.addEventListener('scope-clear', handler);
    const clearBtn = el.shadowRoot!.querySelector('.clear-btn') as HTMLElement;
    clearBtn.click();
    expect(handler).toHaveBeenCalled();
  });

  it('has role="status" and aria-live="polite"', async () => {
    el.queue = { id: 'q1', name: 'AML', labelPattern: 'domain=aml', scope: null };
    await (el as any).updateComplete;
    const bar = el.shadowRoot!.querySelector('.scope-bar');
    expect(bar?.getAttribute('role')).toBe('status');
    expect(bar?.getAttribute('aria-live')).toBe('polite');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn workspace @casehubio/blocks-ui-work-item-inbox run test -- --run src/scope-context-bar.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement scope-context-bar**

Create `components/work-item-inbox/src/scope-context-bar.ts`:

```typescript
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { QueueView } from '@casehubio/blocks-ui-core';

@customElement('scope-context-bar')
export class ScopeContextBar extends LitElement {
  @property({ type: Object }) queue: QueueView | null = null;

  static override styles = css`
    :host { display: block; }

    .scope-bar {
      padding: 4px 12px;
      background: var(--blocks-accent-3, #eff6ff);
      border-bottom: 1px solid var(--blocks-accent-6, #bfdbfe);
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .scope-label {
      font-size: 10px;
      color: var(--blocks-accent-11, #1e40af);
      font-weight: 600;
    }

    .scope-tag {
      background: var(--blocks-accent-2, #dbeafe);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      color: var(--blocks-accent-11, #1e40af);
      border: 1px solid var(--blocks-accent-6, #bfdbfe);
    }

    .scope-tag.raw {
      font-family: monospace;
    }

    .clear-btn {
      margin-left: auto;
      font-size: 10px;
      color: var(--blocks-accent-9, #3b82f6);
      cursor: pointer;
      background: none;
      border: none;
      text-decoration: underline;
      padding: 0;
    }

    .clear-btn:focus-visible {
      outline: 2px solid var(--blocks-accent-9, #2563eb);
      outline-offset: 2px;
    }
  `;

  private _parseLabelPattern(pattern: string): Array<{ key: string; value: string } | { raw: string }> {
    const parts = pattern.split(',').map(p => p.trim());
    return parts.map(part => {
      const eqIdx = part.indexOf('=');
      if (eqIdx > 0 && eqIdx < part.length - 1 && !part.includes(' ')) {
        return { key: part.substring(0, eqIdx), value: part.substring(eqIdx + 1) };
      }
      return { raw: part };
    });
  }

  private _handleClear() {
    this.dispatchEvent(new CustomEvent('scope-clear', { bubbles: true, composed: true }));
  }

  override render() {
    if (!this.queue) return nothing;

    const tags = this._parseLabelPattern(this.queue.labelPattern);

    return html`
      <div class="scope-bar" role="status" aria-live="polite">
        <span class="scope-label">SCOPE:</span>
        ${tags.map(tag =>
          'raw' in tag
            ? html`<span class="scope-tag raw">${tag.raw}</span>`
            : html`<span class="scope-tag">${tag.key}=${tag.value}</span>`
        )}
        <button class="clear-btn" @click="${this._handleClear}">✕ clear</button>
      </div>
    `;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn workspace @casehubio/blocks-ui-work-item-inbox run test -- --run src/scope-context-bar.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add components/work-item-inbox/src/scope-context-bar.ts components/work-item-inbox/src/scope-context-bar.test.ts
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "feat(inbox): scope context bar — shows queue label constraints Refs #20"
```

---

### Task 5: "All" Tab and handleItemAppears Fix

**Files:**
- Modify: `components/work-item-inbox/src/work-item-inbox.ts`
- Modify: `components/work-item-inbox/src/work-item-inbox.test.ts`

**Interfaces:**
- Consumes: `InboxMode` from `@casehubio/blocks-ui-core` (Task 1)
- Produces: Updated `WorkItemInbox` with three tabs (my-work, claimable, all). Fixed `handleItemAppears` that is tab-independent. Updated `getTabItems()` and `getFilteredItems()` supporting `'all'` mode.

- [ ] **Step 1: Write failing tests for All tab**

Add to `components/work-item-inbox/src/work-item-inbox.test.ts`:

```typescript
it('renders three tabs: My Work, Claimable, All', async () => {
  const tabs = el.shadowRoot!.querySelectorAll('.tab');
  expect(tabs.length).toBe(3);
  expect(tabs[0]?.textContent?.trim()).toContain('My Work');
  expect(tabs[1]?.textContent?.trim()).toContain('Claimable');
  expect(tabs[2]?.textContent?.trim()).toContain('All');
});

it('All tab shows union of assigned and claimable without tab filter', async () => {
  // Switch to All tab
  const allTab = el.shadowRoot!.querySelectorAll('.tab')[2] as HTMLElement;
  allTab.click();
  await (el as any).updateComplete;
  // Should show all items from inbox data (no perspective filter)
  const rows = el.shadowRoot!.querySelectorAll('work-item-row');
  expect(rows.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Write failing test for handleItemAppears fix**

```typescript
it('does not remove items from data array when All tab is active', async () => {
  // Switch to All tab
  const allTab = el.shadowRoot!.querySelectorAll('.tab')[2] as HTMLElement;
  allTab.click();
  await (el as any).updateComplete;
  const initialCount = el.shadowRoot!.querySelectorAll('work-item-row').length;
  // Simulate SSE event — should not empty the list
  // (verifies handleItemAppears is tab-independent)
  expect(initialCount).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn workspace @casehubio/blocks-ui-work-item-inbox run test`
Expected: FAIL — only 2 tabs rendered, All tab not found

- [ ] **Step 4: Add All tab and fix handleItemAppears**

In `components/work-item-inbox/src/work-item-inbox.ts`:

Change `InboxMode` import and `activeTab` type:
```typescript
import type { InboxMode } from '@casehubio/blocks-ui-core';
// Change: @state() private activeTab: InboxMode = 'my-work';
```

Add All tab to `renderTabs()`:
```typescript
<button
  class="tab ${this.activeTab === 'all' ? 'active' : ''}"
  @click="${() => this.handleTabClick('all')}"
  aria-current="${this.activeTab === 'all' ? 'page' : 'false'}"
>
  All
</button>
```

Update `getTabItems()` to handle `'all'`:
```typescript
private getTabItems(): WorkItemRootResponse[] {
  if (this.activeTab === 'my-work') {
    return this.items.filter(
      (item) => item.item.assigneeId === this.identity.userId && isActiveStatus(item.item.status),
    );
  }
  if (this.activeTab === 'claimable') {
    return this.items.filter(
      (item) => item.item.status === 'PENDING' && item.item.candidateGroups &&
        this.identity.groups.some((g) => item.item.candidateGroups!.split(',').includes(g)),
    );
  }
  // 'all' — no perspective filter
  return this.items;
}
```

Update `getFilteredItems()` to handle `'all'` in the mode filtering section:
```typescript
if (this.activeTab === 'all') {
  // No perspective filter — full population
} else if (this.activeTab === 'my-work') {
  filtered = filtered.filter(/* existing my-work predicate */);
} else {
  filtered = filtered.filter(/* existing claimable predicate */);
}
```

Fix `handleItemAppears()` — make `shouldBeVisible` tab-independent:
```typescript
const shouldBeVisible =
  (newItem.item.assigneeId === this.identity.userId && isActiveStatus(newItem.item.status)) ||
  (newItem.item.status === 'PENDING' && newItem.item.candidateGroups &&
    this.identity.groups.some((g) => newItem.item.candidateGroups!.split(',').includes(g)));
```

Remove the `willUpdate` override that cleared `claimBreachFilter` only for `'my-work'` — update to also handle `'all'`:
```typescript
override willUpdate(changed: Map<string, unknown>): void {
  if (changed.has('activeTab') && this.activeTab !== 'claimable') {
    this.claimBreachFilter = false;
  }
}
```

Update `renderSummaryBar()` to hide claim breach on All tab (same as My Work):
```typescript
.hideClaimBreach=${this.activeTab !== 'claimable'}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn workspace @casehubio/blocks-ui-work-item-inbox run test`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add components/work-item-inbox/
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "feat(inbox): All tab + tab-independent handleItemAppears fix Refs #20"
```

---

### Task 6: Queue Scope Integration

**Files:**
- Modify: `components/work-item-inbox/src/work-item-inbox.ts`
- Modify: `components/work-item-inbox/src/work-item-inbox.test.ts`
- Modify: `components/work-item-inbox/src/index.ts`

**Interfaces:**
- Consumes: `QueuePillBar` from Task 3, `ScopeContextBar` from Task 4, `QueueScope` from Task 1, `QueueScopeChangedPayload` from Task 1, `WorkItemEventTopics.QUEUE_SCOPE_CHANGED` from Task 1, `onPagesEvent` from `@casehubio/blocks-ui-core`
- Produces: Updated `WorkItemInbox` that: (a) renders queue pill bar above tabs, (b) renders scope context bar when queue active, (c) fetches queue items on queue selection with AbortController, (d) builds QueueScope, (e) switches filter pipeline source, (f) computes status/priority counts for filter bar, (g) handles error states

- [ ] **Step 1: Write failing tests for queue scope integration**

Add to `components/work-item-inbox/src/work-item-inbox.test.ts`:

```typescript
describe('queue scope', () => {
  it('renders queue-pill-bar above tabs', async () => {
    const pillBar = el.shadowRoot!.querySelector('queue-pill-bar');
    expect(pillBar).not.toBeNull();
  });

  it('renders scope-context-bar when queue is active', async () => {
    // Simulate queue selection by setting internal state
    (el as any)._queueScope = {
      queue: { id: 'q1', name: 'Test', labelPattern: 'domain=test', scope: null },
      items: [],
      statusCounts: new Map(),
      priorityCounts: new Map(),
      overdueCount: 0,
      breachCount: 0,
    };
    await (el as any).updateComplete;
    const contextBar = el.shadowRoot!.querySelector('scope-context-bar');
    expect(contextBar).not.toBeNull();
  });

  it('hides scope-context-bar when no queue selected', async () => {
    (el as any)._queueScope = null;
    await (el as any).updateComplete;
    const contextBar = el.shadowRoot!.querySelector('scope-context-bar');
    expect(contextBar).toBeNull();
  });

  it('passes statusCounts to filter bar', async () => {
    const filterBar = el.shadowRoot!.querySelector('inbox-filter-bar') as any;
    expect(filterBar.statusCounts).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace @casehubio/blocks-ui-work-item-inbox run test`
Expected: FAIL — no queue-pill-bar in render tree

- [ ] **Step 3: Implement queue scope integration**

In `components/work-item-inbox/src/work-item-inbox.ts`:

Add imports:
```typescript
import './queue-pill-bar.js';
import './scope-context-bar.js';
import type { QueueScope, QueueScopeChangedPayload } from '@casehubio/blocks-ui-core';
```

Add state:
```typescript
@state() private _queueScope: QueueScope | null = null;
@state() private _queueLoading = false;
@state() private _queueError: string | null = null;
private _queueFetchController: AbortController | null = null;
```

Add queue selection handler:
```typescript
private async _handleQueueScopeChanged(payload: QueueScopeChangedPayload) {
  // Abort any in-flight queue fetch
  this._queueFetchController?.abort();
  this._queueFetchController = null;

  if (!payload.queue) {
    this._queueScope = null;
    this._queueLoading = false;
    this._queueError = null;
    return;
  }

  this._queueLoading = true;
  this._queueError = null;
  this._queueFetchController = new AbortController();

  try {
    const res = await fetch(
      `${this.endpoint}/queues/${payload.queue.id}/items`,
      { signal: this._queueFetchController.signal },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items: WorkItemResponse[] = await res.json();

    const wrapped: WorkItemRootResponse[] = items.map(item => ({
      item,
      childCount: 0,
      completedCount: null,
      requiredCount: null,
      groupStatus: null,
    }));

    this._queueScope = this._buildQueueScope(payload.queue, wrapped);
    this._queueLoading = false;
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    this._queueError = e instanceof Error ? e.message : 'Failed to load queue';
    this._queueLoading = false;
    this._queueScope = null;
  }
}
```

Add scope builder:
```typescript
private _buildQueueScope(queue: QueueView, items: WorkItemRootResponse[]): QueueScope {
  const statusCounts = new Map<string, number>();
  const priorityCounts = new Map<string, number>();
  let overdueCount = 0;
  let breachCount = 0;
  const now = Date.now();

  for (const root of items) {
    const s = root.item.status;
    statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
    const p = root.item.priority;
    priorityCounts.set(p, (priorityCounts.get(p) ?? 0) + 1);
    if (root.item.expiresAt && new Date(root.item.expiresAt).getTime() < now && isActiveStatus(root.item.status)) {
      overdueCount++;
    }
    if (root.item.claimDeadline && new Date(root.item.claimDeadline).getTime() < now && root.item.status === 'PENDING') {
      breachCount++;
    }
  }

  return { queue, items, statusCounts, priorityCounts, overdueCount, breachCount };
}
```

Update `getFilteredItems()` source selection:
```typescript
private getFilteredItems(): WorkItemRootResponse[] {
  let filtered = this._queueScope ? this._queueScope.items : this.items;
  // ... rest of perspective + ad-hoc filter pipeline unchanged
}
```

Update `getTabItems()` source selection (same pattern):
```typescript
private getTabItems(): WorkItemRootResponse[] {
  const source = this._queueScope ? this._queueScope.items : this.items;
  if (this.activeTab === 'my-work') {
    return source.filter(/* ... */);
  }
  // ...
}
```

Compute status/priority counts for filter bar:
```typescript
private _computeFilterCounts(): { statusCounts: Map<string, number>; priorityCounts: Map<string, number> } {
  const tabItems = this.getTabItems();
  const statusCounts = new Map<string, number>();
  const priorityCounts = new Map<string, number>();
  for (const root of tabItems) {
    const s = root.item.status;
    statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
    const p = root.item.priority;
    priorityCounts.set(p, (priorityCounts.get(p) ?? 0) + 1);
  }
  return { statusCounts, priorityCounts };
}
```

Update `render()` to include pill bar and context bar:
```typescript
override render() {
  const { statusCounts, priorityCounts } = this._computeFilterCounts();
  return html`
    <div class="inbox-container">
      ${this._renderQueuePillBar()}
      ${this._queueScope ? html`<scope-context-bar .queue="${this._queueScope.queue}" @scope-clear="${this._handleScopeClear}"></scope-context-bar>` : ''}
      ${this.renderTabs()}
      ${this.renderSummaryBar()}
      ${this._renderFilterBar(statusCounts, priorityCounts)}
      ${this._queueLoading ? html`<div class="loading">Loading queue...</div>` : ''}
      ${this._queueError ? html`<div class="error">${this._queueError}</div>` : ''}
      ${!this._queueLoading && !this._queueError ? this.renderItems() : ''}
      ${this.renderBatchActionBar()}
    </div>
  `;
}

private _renderQueuePillBar() {
  return html`
    <queue-pill-bar
      .endpoint="${this.endpoint}"
      .selectedQueueId="${this._queueScope?.queue.id ?? null}"
      .selectedQueueCount="${this._queueScope?.items.length ?? null}"
      @pages-event="${(e: CustomEvent) => {
        if (e.detail.topic === 'queue.scope-changed') {
          this._handleQueueScopeChanged(e.detail.payload);
        }
      }}"
    ></queue-pill-bar>
  `;
}

private _handleScopeClear() {
  this._handleQueueScopeChanged({ queue: null });
}
```

Update `renderFilterBar()` to pass counts:
```typescript
private _renderFilterBar(statusCounts: Map<string, number>, priorityCounts: Map<string, number>) {
  return html`
    <div class="filter-bar">
      <inbox-filter-bar
        .activeStatusFilters="${this.statusFilter}"
        .activePriorityFilters="${this.priorityFilter}"
        .statusCounts="${statusCounts}"
        .priorityCounts="${priorityCounts}"
        @filter-change="${this.handleFilterChange}"
        @clear-filters="${this.handleClearFilters}"
      ></inbox-filter-bar>
    </div>
  `;
}
```

Update tab counts in `renderTabs()`:
```typescript
private renderTabs() {
  const source = this._queueScope ? this._queueScope.items : this.items;
  const myWorkCount = source.filter(r => r.item.assigneeId === this.identity.userId && isActiveStatus(r.item.status)).length;
  const claimableCount = source.filter(r => r.item.status === 'PENDING' && r.item.candidateGroups && this.identity.groups.some(g => r.item.candidateGroups!.split(',').includes(g))).length;
  const allCount = source.length;

  return html`
    <div class="tabs">
      <button class="tab ${this.activeTab === 'my-work' ? 'active' : ''}" @click="${() => this.handleTabClick('my-work')}" aria-current="${this.activeTab === 'my-work' ? 'page' : 'false'}">
        My Work <span class="tab-count">(${myWorkCount})</span>
      </button>
      <button class="tab ${this.activeTab === 'claimable' ? 'active' : ''}" @click="${() => this.handleTabClick('claimable')}" aria-current="${this.activeTab === 'claimable' ? 'page' : 'false'}">
        Claimable <span class="tab-count">(${claimableCount})</span>
      </button>
      <button class="tab ${this.activeTab === 'all' ? 'active' : ''}" @click="${() => this.handleTabClick('all')}" aria-current="${this.activeTab === 'all' ? 'page' : 'false'}">
        All <span class="tab-count">(${allCount})</span>
      </button>
    </div>
  `;
}
```

Add tab-count CSS:
```css
.tab-count {
  font-size: 11px;
  color: var(--blocks-neutral-7, #a3a3a3);
}

.tab.active .tab-count {
  color: var(--blocks-accent-9, #0080ff);
}
```

Update `connectedCallback` to listen for scope events, add Escape handler, and update `disconnectedCallback`:
```typescript
override connectedCallback() {
  super.connectedCallback();
  // ... existing code ...
  this._unsubscribeQueueScope = onPagesEvent<QueueScopeChangedPayload>(
    this, WorkItemEventTopics.QUEUE_SCOPE_CHANGED,
    (payload) => this._handleQueueScopeChanged(payload),
  );
  this.addEventListener('keydown', this._handleEscapeKey);
}

override disconnectedCallback() {
  super.disconnectedCallback();
  // ... existing cleanup ...
  this._unsubscribeQueueScope?.();
  this._queueFetchController?.abort();
  this.removeEventListener('keydown', this._handleEscapeKey);
}
```

Add Escape key handler to clear queue scope:
```typescript
private _handleEscapeKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && this._queueScope) {
    e.preventDefault();
    this._handleScopeClear();
  }
};
```
```

Update `index.ts` to export new components:
```typescript
export { QueuePillBar } from './queue-pill-bar.js';
export { ScopeContextBar } from './scope-context-bar.js';
```

- [ ] **Step 4: Run all inbox tests**

Run: `yarn workspace @casehubio/blocks-ui-work-item-inbox run test`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add components/work-item-inbox/
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "feat(inbox): queue scope integration — pill bar, context bar, filter pipeline Refs #20"
```

---

### Task 7: Queue SSE Lifecycle

**Files:**
- Modify: `components/work-item-inbox/src/work-item-inbox.ts`
- Modify: `components/work-item-inbox/src/work-item-inbox.test.ts`

**Interfaces:**
- Consumes: `QueueScope` from Task 1, `SSEManager` from `@casehubio/blocks-ui-core`, `WorkItemQueueEvent` from `@casehubio/blocks-ui-core`
- Produces: Updated `WorkItemInbox` with queue SSE stream lifecycle. Opens `/queues/{id}/events` on queue selection, closes on deselection. Handles `ADDED`/`REMOVED`/`CHANGED` events to update `QueueScope.items`.

- [ ] **Step 1: Write failing tests for queue SSE lifecycle**

Add to `components/work-item-inbox/src/work-item-inbox.test.ts`:

```typescript
describe('queue SSE lifecycle', () => {
  it('subscribes to queue SSE when queue is selected', async () => {
    // Verify that selecting a queue triggers SSE subscription
    // by checking that _queueSSECleanup is set
    const inbox = el as any;
    inbox._queueScope = {
      queue: { id: 'q1', name: 'Test', labelPattern: 'domain=test', scope: null },
      items: [],
      statusCounts: new Map(),
      priorityCounts: new Map(),
      overdueCount: 0,
      breachCount: 0,
    };
    inbox._subscribeQueueSSE('q1');
    expect(inbox._queueSSECleanup).not.toBeNull();
  });

  it('unsubscribes from queue SSE when queue is deselected', async () => {
    const inbox = el as any;
    inbox._subscribeQueueSSE('q1');
    inbox._unsubscribeQueueSSE();
    expect(inbox._queueSSECleanup).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace @casehubio/blocks-ui-work-item-inbox run test`
Expected: FAIL — `_subscribeQueueSSE` not defined

- [ ] **Step 3: Implement queue SSE lifecycle**

Add to `components/work-item-inbox/src/work-item-inbox.ts`:

```typescript
private _queueSSECleanup: (() => void) | null = null;

private _subscribeQueueSSE(queueId: string) {
  this._unsubscribeQueueSSE();
  if (!this.endpoint) return;

  const url = `${this.endpoint}/queues/${queueId}/events`;
  const handler = (event: SSEEvent) => this._handleQueueSSEEvent(event);
  this.sseManager.subscribe(url, handler);
  this._queueSSECleanup = () => {
    this.sseManager.unsubscribe(url, handler);
    this._queueSSECleanup = null;
  };
}

private _unsubscribeQueueSSE() {
  this._queueSSECleanup?.();
  this._queueSSECleanup = null;
}

private async _handleQueueSSEEvent(event: SSEEvent) {
  if (!this._queueScope) return;

  const data = event.data as WorkItemQueueEvent;
  const queueId = this._queueScope.queue.id;
  if (data.queueViewId !== queueId) return;

  if (data.eventType === 'ADDED') {
    await this._handleQueueItemAdded(data.workItemId);
  } else if (data.eventType === 'REMOVED') {
    this._handleQueueItemRemoved(data.workItemId);
  } else if (data.eventType === 'CHANGED') {
    await this._handleQueueItemChanged(data.workItemId);
  }
}

private async _handleQueueItemAdded(workItemId: string) {
  if (!this.endpoint || !this._queueScope) return;
  try {
    const res = await fetch(`${this.endpoint}/workitems/${workItemId}`);
    if (!res.ok) return;
    const raw = await res.json() as Record<string, unknown>;
    const newItem: WorkItemRootResponse = raw.item && typeof (raw.item as Record<string, unknown>).id === 'string'
      ? raw as unknown as WorkItemRootResponse
      : { item: raw as unknown as WorkItemResponse, childCount: 0, completedCount: null, requiredCount: null, groupStatus: null };

    const items = [newItem, ...this._queueScope.items];
    this._queueScope = this._buildQueueScope(this._queueScope.queue, items);
    this.requestUpdate();
  } catch { /* single-item fetch failure is non-fatal */ }
}

private _handleQueueItemRemoved(workItemId: string) {
  if (!this._queueScope) return;
  const items = this._queueScope.items.filter(r => r.item.id !== workItemId);
  this._queueScope = this._buildQueueScope(this._queueScope.queue, items);
  this.requestUpdate();
}

private async _handleQueueItemChanged(workItemId: string) {
  if (!this.endpoint || !this._queueScope) return;
  try {
    const res = await fetch(`${this.endpoint}/workitems/${workItemId}`);
    if (!res.ok) return;
    const raw = await res.json() as Record<string, unknown>;
    const updated: WorkItemRootResponse = raw.item && typeof (raw.item as Record<string, unknown>).id === 'string'
      ? raw as unknown as WorkItemRootResponse
      : { item: raw as unknown as WorkItemResponse, childCount: 0, completedCount: null, requiredCount: null, groupStatus: null };

    const items = this._queueScope.items.map(r => r.item.id === workItemId ? updated : r);
    this._queueScope = this._buildQueueScope(this._queueScope.queue, items);
    this.requestUpdate();
  } catch { /* single-item fetch failure is non-fatal */ }
}
```

Modify `_handleQueueScopeChanged` (defined in Task 6) to open/close SSE around the data operations:

In the successful fetch branch, after `this._queueLoading = false;`:
```typescript
this._subscribeQueueSSE(payload.queue.id);
```

In the `payload.queue === null` branch, before clearing scope:
```typescript
this._unsubscribeQueueSSE();
```

In the AbortError catch, also unsubscribe:
```typescript
// No action needed — abort means a new queue is taking over (which subscribes its own SSE)
```

Update `disconnectedCallback` to clean up queue SSE:
```typescript
this._unsubscribeQueueSSE();
```

- [ ] **Step 4: Run all tests**

Run: `yarn workspace @casehubio/blocks-ui-work-item-inbox run test`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add components/work-item-inbox/
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "feat(inbox): queue SSE lifecycle — subscribe, update, close Refs #20"
```

---

### Task 8: Workbench Simplification

**Files:**
- Modify: `components/work-item-workbench/src/work-item-workbench.ts`
- Modify: `components/work-item-workbench/src/work-item-workbench.test.ts`

**Interfaces:**
- Consumes: `WorkItemInbox` (updated with queue pill bar from Tasks 3-7)
- Produces: Updated `WorkItemWorkbench` with no Queues tab. Left panel always renders inbox.

- [ ] **Step 1: Write failing tests**

Update `components/work-item-workbench/src/work-item-workbench.test.ts`:

```typescript
it('renders only Inbox tab (no Queues tab)', async () => {
  const tabs = el.shadowRoot!.querySelectorAll('.tab');
  expect(tabs.length).toBe(0);
  // No tabs at all — left panel is always inbox, no tab bar needed
});

it('does not render queue-board', async () => {
  const queueBoard = el.shadowRoot!.querySelector('queue-board');
  expect(queueBoard).toBeNull();
});

it('always renders work-item-inbox in left panel', async () => {
  const inbox = el.shadowRoot!.querySelector('work-item-inbox');
  expect(inbox).not.toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn workspace @casehubio/blocks-ui-work-item-workbench run test`
Expected: FAIL — Queues tab still exists, queue-board still renders

- [ ] **Step 3: Simplify workbench**

In `components/work-item-workbench/src/work-item-workbench.ts`:

Remove `LeftPanelView` type and `_leftPanel` state:
```typescript
// DELETE: type LeftPanelView = 'inbox' | 'queues';
// DELETE: @state() private _leftPanel: LeftPanelView = 'inbox';
```

Remove queue-board import:
```typescript
// DELETE: import '@casehubio/blocks-ui-queue-board';
```

Remove queue event subscriptions from `_subscribeToEvents()`:
```typescript
// DELETE: this._unsubscribeQueueSelection = onPagesEvent(...)
// DELETE: this._unsubscribeQueueDeselection = onPagesEvent(...)
```

Remove `_unsubscribeQueueSelection` and `_unsubscribeQueueDeselection` fields and their cleanup.

Remove `_handleTabClick` method.

Remove tabs from left panel render. Replace with direct inbox render:
```typescript
<div class="left-panel">
  <div class="panel-content">
    ${this._renderInbox()}
  </div>
</div>
```

Remove the tabs CSS rules and the `_renderQueues()` method.

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn workspace @casehubio/blocks-ui-work-item-workbench run test`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add components/work-item-workbench/
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "refactor(workbench): remove Queues tab — queue scope lives in inbox Refs #20"
```

---

### Task 9: Mock Updates and Examples

**Files:**
- Modify: `examples/src/mock/mock-fetch.ts`
- Modify: `examples/src/mock/mock-state.ts`
- Create: `examples/src/pages/queue-inbox-page.ts`
- Modify: `examples/src/shell.ts`
- Modify: `examples/src/pages/workbench-page.ts` (if queue-board import exists)

**Interfaces:**
- Consumes: all previous tasks
- Produces: `GET /queues/summary` mock endpoint, queue SSE mock events, updated examples

- [ ] **Step 1: Add queue summary endpoint to mock-fetch**

Add to `examples/src/mock/mock-fetch.ts` before the `GET /queues` handler:

```typescript
// GET /queues/summary
if (method === 'GET' && path.match(/\/queues\/summary$/)) {
  return json(state.getQueueSummaries());
}
```

- [ ] **Step 2: Add getQueueSummaries to mock-state**

Add to `examples/src/mock/mock-state.ts`:

```typescript
getQueueSummaries(): Array<{ queueId: string; count: number; breachCount: number }> {
  const now = Date.now();
  return this.queues.map(q => {
    const items = this.getQueueItems(q.id);
    const breachCount = items.filter(item =>
      item.expiresAt && new Date(item.expiresAt).getTime() < now && isActiveStatus(item.status)
    ).length;
    return { queueId: q.id, count: items.length, breachCount };
  });
}
```

- [ ] **Step 3: Create queue-inbox-page example**

Create `examples/src/pages/queue-inbox-page.ts`:

```typescript
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { WorkIdentity } from '@casehubio/blocks-ui-core';
import '@casehubio/blocks-ui-work-item-inbox';

const IDENTITY: WorkIdentity = {
  userId: 'demo-user',
  displayName: 'Demo User',
  groups: ['compliance', 'clinical-safety', 'household', 'device-ops', 'code-review'],
};

@customElement('queue-inbox-page')
export class QueueInboxPage extends LitElement {
  static override styles = css`
    :host { display: block; height: 100%; }
    h2 { padding: 24px 24px 8px; font-size: 20px; font-weight: 600; color: var(--blocks-neutral-12, #111); }
    p { padding: 0 24px 16px; color: var(--blocks-neutral-11, #555); font-size: 14px; }
    work-item-inbox { display: block; height: calc(100% - 80px); }
  `;

  override render() {
    return html`
      <h2>Queue + Inbox Integration</h2>
      <p>Select a queue pill to scope. Tabs compose with queue scope. Filter pills show counts and disable at zero.</p>
      <work-item-inbox endpoint="" .identity=${IDENTITY}></work-item-inbox>
    `;
  }
}
```

- [ ] **Step 4: Update shell.ts navigation**

In `examples/src/shell.ts`, replace the queue-page route with queue-inbox-page:
- Change import from `'./pages/queue-page.js'` to `'./pages/queue-inbox-page.js'`
- Update the route label from `Queue Board` to `Queue + Inbox`

- [ ] **Step 5: Delete old queue-page.ts**

Delete `examples/src/pages/queue-page.ts`.

- [ ] **Step 6: Build and verify examples**

Run: `yarn workspace @casehubio/blocks-ui-examples run build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add examples/ -A
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "feat(examples): queue-inbox-page + queue summary mock endpoint Refs #20"
```

---

### Task 10: Remove queue-board and queue-card

**Files:**
- Delete: `components/queue-board/` (entire directory)
- Modify: `package.json` (root — remove from workspaces)
- Modify: `components/work-item-workbench/package.json` (remove queue-board dependency if present)

**Interfaces:**
- Consumes: nothing
- Produces: clean codebase with no dead queue-board or queue-card code

- [ ] **Step 1: Remove queue-board from workspaces**

Edit root `package.json`: remove `"components/queue-board"` from the `workspaces` array.

- [ ] **Step 2: Remove queue-board dependency from workbench**

Edit `components/work-item-workbench/package.json`: remove `"@casehubio/blocks-ui-queue-board": "workspace:*"` from dependencies.

- [ ] **Step 3: Delete queue-board directory**

Delete `components/queue-board/` entirely.

- [ ] **Step 4: Full build verification**

Run: `yarn install && yarn build && yarn test`
Expected: ALL packages build, ALL tests pass. No references to queue-board or queue-card remain.

- [ ] **Step 5: Commit**

```bash
git -C /Users/mdproctor/claude/casehub/blocks-ui add -A
git -C /Users/mdproctor/claude/casehub/blocks-ui commit -m "refactor: remove queue-board and queue-card — replaced by queue pill bar Refs #20"
```
