# blocks-worker-task-pane — Design Spec

**Issue:** casehubio/blocks-ui#152
**Date:** 2026-09-03
**Branch:** issue-152-worker-task-pane

## Summary

A generic worker task pane for CaseHub applications where domain specialists (human or agent) claim, view, and respond to dispatched worker tasks. Composes existing blocks-ui primitives (split-workbench, list-pane, detail-pane) with workspace element creation and a response form. The component is domain-agnostic — all domain-specific rendering is delegated to consumer-provided tab elements and workspace elements.

## Architecture

`blocks-worker-task-pane` is a single component extending `LiveRegionMixin(KeyboardShortcutMixin(LitElement))`. It manages its own fetch lifecycle (following work-item-inbox's pattern), stores original task responses internally, and derives a TypedDataSet for list-pane display. On selection, it looks up the full response from its internal array — avoiding data loss from TypedDataSet extraction of nested objects.

DataSourceMixin is deliberately not used. The component needs raw `WorkerTaskResponse[]` access alongside TypedDataSet — DataSourceMixin's automatic extraction pipeline has no interception point for storing raw responses before conversion. work-item-inbox uses the same approach: direct fetch, raw item storage, derived TypedDataSet via `fromRows()`.

list-pane operates in **inline dataset mode** — no `endpoint` is set on it, so `DataSourceMixin.resolveEndpoint()` returns `undefined` and no fetch occurs. The pane sets list-pane's `dataSet` directly.

```
┌─ blocks-worker-task-pane ─────────────────────────────────────────────┐
│  extends LiveRegionMixin(KeyboardShortcutMixin(LitElement))           │
│                                                                       │
│  layout='split':                                                      │
│  ┌─ pages-split-workbench ──────────────────────────────────────────┐ │
│  │  ┌─ slot=list ────────┐  ┌─ slot=detail ──────────────────────┐ │ │
│  │  │  blocks-list-pane  │  │  ┌─ context section ─────────────┐ │ │ │
│  │  │  (task queue)      │  │  │  blocks-detail-pane (tabs)    │ │ │ │
│  │  │  .dataSet (inline) │  │  └───────────────────────────────┘ │ │ │
│  │  │  no endpoint set   │  │  ┌─ workspace section ───────────┐ │ │ │
│  │  │                    │  │  │  createElement(tagName)       │ │ │ │
│  │  │                    │  │  │  cached by capabilityTag      │ │ │ │
│  │  │                    │  │  └───────────────────────────────┘ │ │ │
│  │  │                    │  │  ┌─ response section ────────────┐ │ │ │
│  │  │                    │  │  │  Claim? → RESPONSE/DONE/      │ │ │ │
│  │  │                    │  │  │          DECLINE               │ │ │ │
│  │  │                    │  │  └───────────────────────────────┘ │ │ │
│  │  └────────────────────┘  └────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  layout='stacked':                                                    │
│  ┌─ vertical flexbox ──────────────────────────────────────────────┐ │
│  │  task queue │ context │ workspace │ response form               │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Internal state:                                                      │
│  - _items: WorkerTaskResponse[]                                       │
│  - _selectedItem: WorkerTaskResponse | null                           │
│  - _workspaceElements: Map<string, HTMLElement> (cached by tag)       │
│  - _workspaceResult: WorkspaceResultEvent['detail'] | null            │
│  - _claimed: boolean                                                  │
│  - _loading: boolean                                                  │
│  - _error: string | null                                              │
│  - _submitting: boolean                                               │
│  - _submitError: string | null                                        │
└───────────────────────────────────────────────────────────────────────┘
```

## Public API

```typescript
@customElement('blocks-worker-task-pane')
export class BlocksWorkerTaskPane extends LiveRegionMixin(KeyboardShortcutMixin(LitElement)) {

  // --- Layout ---
  @property() layout: 'split' | 'stacked' = 'split';

  // --- Data ---
  @property() endpoint: string = '';
  @property({ attribute: false }) data?: WorkerTaskResponse[];

  // --- Selection ---
  @property({ attribute: 'selection-topic' }) selectionTopic: string = 'worker-task';

  // --- Identity & filtering ---
  @property({ attribute: false }) identity: WorkIdentity = {
    userId: '', displayName: '', groups: []
  };

  // --- Task queue columns ---
  @property({ attribute: false }) columnConfig?: TableColumnConfig[];
  @property({ attribute: false }) columnRenderers?: ReadonlyMap<ColumnId, ColumnRenderer>;
  @property({ attribute: false }) getRowKey?: (row: TypedRow) => string;

  // --- Investigation context (reuses detail-pane's TabDefinition) ---
  @property({ attribute: false }) contextTabs: TabDefinition[] = [];

  // --- Workspace registry ---
  @property({ attribute: false }) workspaces: WorkspaceDefinition[] = [];

  // --- Response submission ---
  @property({ attribute: 'respond-endpoint' }) respondEndpoint: string = '';
  @property({ attribute: false }) declineReasons: string[] = [
    'Out of clearance', 'Insufficient data', 'Conflict of interest'
  ];

  // --- Claim ---
  @property({ attribute: 'claim-endpoint' }) claimEndpoint: string = '';

  // --- Live updates ---
  @property({ attribute: 'event-stream-endpoint' }) eventStreamEndpoint: string = '';

  // --- Section visibility ---
  @property({ type: Boolean, attribute: 'show-context' }) showContext: boolean = true;
  @property({ type: Boolean, attribute: 'show-workspace' }) showWorkspace: boolean = true;

  // --- configure() for imperative batch setup ---
  configure(props: Partial<BlocksWorkerTaskPaneConfig>): void;
}
```

### Dual data mode

Like other blocks-ui components, the pane supports two data modes:
- **Endpoint mode:** `endpoint` is set → component fetches via `fetchSource()` on connect and on refresh events
- **Inline mode:** `data` property is set → component uses provided items directly, no fetch. Used by the showcase and tests.

### CSS custom properties

| Property | Default | Purpose |
|----------|---------|---------|
| `--worker-task-context-min-height` | `120px` | Minimum height for context section |
| `--worker-task-workspace-min-height` | `200px` | Minimum height for workspace section |
| `--worker-task-response-min-height` | `auto` | Minimum height for response form |

## Types

```typescript
interface WorkspaceDefinition {
  capabilityTag: string;
  tagName: string;
  label?: string;
  icon?: string;
}

// Reuses detail-pane's TabDefinition for context tabs.
// Imported from: components/detail-pane/src/types.ts
// badge callback receives the selected task as `item: unknown` — consumers cast as needed.

interface WorkerTaskResponse {
  taskId: string;
  capabilityTag: string;
  caseId: string;
  assigneeId?: string;
  dispatchedAt: string;
  commandParams: Record<string, unknown>;
  investigationSummary: Record<string, unknown>;
}

interface WorkerTaskSubmission {
  type: 'RESPONSE' | 'DONE' | 'DECLINE';
  taskId: string;
  result?: {
    fields: Record<string, unknown>;
    confidence: number;
  };
  declineReason?: string;
  declineDetail?: string;
}

interface WorkerTaskClaimRequest {
  taskId: string;
}

interface WorkerTaskContext {
  taskId: string;
  capabilityTag: string;
  caseId: string;
  commandParams: Record<string, unknown>;
  investigationSummary: Record<string, unknown>;
}

interface WorkspaceResultEvent extends CustomEvent {
  detail: {
    fields: Record<string, unknown>;
    confidence: number;
  };
}
```

`CLAIM` is a separate `WorkerTaskClaimRequest` type — it goes to `claimEndpoint`, not `respondEndpoint`, and carries no result or decline fields. This avoids consumer confusion about which endpoint to use.

The issue's event names use dot separators (`worker-task.responded`). The spec uses colon separators (`worker-task:responded`) per ARC42STORIES §4 colon-delimited topic convention. Action events dispatch on the host element (not via `emitPagesEvent` on document), so the colon is a consistency choice, not a pages-event requirement.

## Events

| Event | Dispatched on | Payload | When |
|-------|--------------|---------|------|
| `pages-selection` | `document` via `emitPagesEvent` | `{ taskId, capabilityTag, caseId }` | Task selected in queue |
| `worker-task:claimed` | host element | `WorkerTaskClaimRequest` | Task claimed |
| `worker-task:responded` | host element | `WorkerTaskSubmission` | Response/Done submitted |
| `worker-task:declined` | host element | `WorkerTaskSubmission` | Task declined |

Action events (`claimed`, `responded`, `declined`) always dispatch on the host element. When the corresponding endpoint (`claimEndpoint` / `respondEndpoint`) is provided, the component also POSTs. The consumer can call `preventDefault()` on the event to suppress the POST and handle submission themselves.

## Data flow

### Fetch and display

1. `connectedCallback` → if `endpoint` set, fetch via `fetchSource(endpoint)`. If `data` set, use directly.
2. On response → store raw `WorkerTaskResponse[]` in `_items`, set `_loading = false`
3. Derive `TypedDataSet` via `fromRows()` with column extraction → set on internal list-pane's `dataSet`
4. If `eventStreamEndpoint` provided → create `SSEManager` instance, subscribe:
   - `task-appeared` → add to `_items`, rebuild dataset, `this.announce('New task received')`
   - `task-disappeared` → remove from `_items`, rebuild dataset, clear selection if removed
   - `task-updated` → update in `_items`, rebuild dataset
5. On fetch error → set `_error`, `this.announce('Failed to load tasks')`

### Identity filtering

The `identity` property controls which tasks are visible in the queue. Filtering is **client-side** in `_rebuildTableDataSet()` (matching work-item-inbox's pattern):

- If `identity.groups` is non-empty, filter `_items` to tasks where `capabilityTag` matches any group in `identity.groups`
- Pre-assigned tasks (`assigneeId` present) are shown only when `assigneeId === identity.userId`
- Unassigned tasks (no `assigneeId`) are shown to all matching specialists

Server-side filtering is the consumer's responsibility — pass query parameters via the `endpoint` URL.

### Selection

1. list-pane emits `{selectionTopic}:selected` with TypedRow
2. Component extracts `taskId` from TypedRow via `getRowKey`
3. Looks up full `WorkerTaskResponse` from `_items` by taskId → sets `_selectedItem`
4. Derives `_claimed` state:
   - If `claimEndpoint` absent → `_claimed = true` (no claim required)
   - If `assigneeId === identity.userId` → `_claimed = true` (already claimed by me)
   - Otherwise → `_claimed = false` (needs claiming)
5. Context section: detail-pane tab elements receive `el.item = _selectedItem`
6. Workspace section: finds matching `WorkspaceDefinition` by `capabilityTag`, creates or retrieves cached element, sets `taskContext` property
7. Response form: resets `_workspaceResult`, `_submitError`

### Workspace element lifecycle

Workspace elements are **cached** in `_workspaceElements: Map<string, HTMLElement>` keyed by `capabilityTag` (matching detail-pane's tab element caching pattern). On selection:

1. Look up `capabilityTag` in `_workspaceElements`
2. If not found → `document.createElement(def.tagName)`, add `workspace-result` listener, cache in map
3. Set `taskContext` property on the element — this is the element's signal to reset its internal state for the new task
4. Show the matching element, hide others

Workspace elements are responsible for resetting their own internal state when `taskContext` changes. The pane does not destroy and recreate elements — caching avoids expensive re-creation for repeated capability tag selections. The `workspace-result` listener persists on the cached element; the pane ignores results that don't match the current `_selectedItem.taskId` (stale result guard).

### Workspace result collection

1. When workspace element is created, component calls `element.addEventListener('workspace-result', handler)`
2. On `workspace-result` → if `event.detail.taskId` matches current selection, stores in `_workspaceResult`, enables Submit button
3. Listener persists for cached element lifetime — stale results from previous tasks are filtered by taskId

### Response submission

1. User clicks Submit → set `_submitting = true`, `aria-disabled` on buttons
2. Component dispatches `worker-task:responded` on host element
3. If `event.defaultPrevented` → consumer handles submission, component resets `_submitting`
4. If `respondEndpoint` provided and not prevented → POST `WorkerTaskSubmission` to `{respondEndpoint}/{taskId}`
5. On success → removes task from `_items`, rebuilds dataset, clears selection, `this.announce('Response submitted')`
6. On failure → set `_submitError`, `_submitting = false`, `this.announce('Submission failed')`
7. Submit error displays inline below the response form in a `role="alert"` region

### Claim flow

1. If `claimEndpoint` provided and `_claimed === false` → show Claim button, hide response form
2. User clicks Claim → dispatch `worker-task:claimed` on host, optionally POST `WorkerTaskClaimRequest` to `{claimEndpoint}/{taskId}`
3. On success → `_claimed = true`, show response form, `this.announce('Task claimed')`
4. On failure → show error inline, `this.announce('Claim failed')`
5. If `claimEndpoint` absent → skip claim step, response form appears immediately on selection

### Error handling

| Error | Display | ARIA |
|-------|---------|------|
| Fetch failure | Inline error banner replacing task queue, with retry button | `role="alert"`, `this.announce()` |
| Submit failure | Inline error below response form, form re-enabled | `role="alert"`, `this.announce()` |
| Claim failure | Inline error below claim button, button re-enabled | `role="alert"`, `this.announce()` |

All errors are retryable — the user can retry the action without page refresh.

## Keyboard shortcuts

| Key | Action | Context |
|-----|--------|---------|
| `c` | Claim selected task | When task selected and `claimEndpoint` provided and not yet claimed |
| `Enter` | Submit response | When response form focused and workspace result available |
| `d` | Open decline form | When task selected and claimed |
| `Escape` | Close decline form / deselect task | Contextual |
| `?` | Show shortcuts overlay | Always |

Shortcuts follow work-item-workbench's pattern — single-key mnemonics, contextual activation.

## ARIA

| Element | Role | Attributes |
|---------|------|------------|
| Host | `region` | `aria-label="Worker task pane"` |
| Task queue | inherited from list-pane | `role="table"` |
| Context section | inherited from detail-pane | `role="tablist"` / `role="tabpanel"` |
| Workspace container | `region` | `aria-label="Specialist workspace"`, `aria-live="polite"` |
| Response form | `form` | `aria-label="Task response"` |
| Submit button | `button` | `aria-disabled` during submission |
| Claim button | `button` | `aria-disabled` during claim |
| Decline button | `button` | — |
| Decline reason select | `listbox` | `aria-label="Decline reason"` |
| Decline detail textarea | `textbox` | `aria-label="Decline detail"` |
| Section headers | — | `aria-expanded` when collapsible |
| Error regions | — | `role="alert"` |
| Loading state | — | `aria-busy="true"` on task queue during fetch |

Every interactive element is keyboard-reachable. Tab order: task queue → context tabs → workspace content → response form buttons. LiveRegionMixin provides `this.announce()` for action outcome announcements to assistive technology.

## Examples gallery showcase

The component must have a showcase entry in the examples gallery with seeded inline data demonstrating all key states and interactions.

### Showcase page: `worker-task-pane`

**Seed data:** 5 tasks across 3 capability tags (entity-resolution, pattern-analysis, osint-screening), with varied investigation summaries (opaque `Record<string, unknown>` — no AML-specific field names in the generic seed data). Two tasks pre-assigned (have `assigneeId`), three unassigned (competitive queue).

**Scenarios displayed:**

| Scenario | What it shows |
|----------|--------------|
| Default split layout | Split-workbench with task queue left, detail right. Five seeded tasks visible. |
| Stacked layout | `layout="stacked"` variant with vertical sections. |
| Task selected | First task selected — context tabs populated, workspace element created, response form visible. |
| Claim flow | `claimEndpoint` provided — Claim button shown before response form for unassigned tasks. |
| Pre-assigned task | Task with `assigneeId` matching identity — response form shown immediately (no claim needed). |
| Decline flow | Decline button clicked — reason dropdown and detail textarea visible. |
| Workspace result ready | Workspace element has fired `workspace-result` — Submit button enabled with confidence indicator. |
| Section hidden | `showContext=false` — context section hidden, workspace gets full height. |
| Empty state | No tasks — empty message shown. |
| Loading state | Simulated loading — skeleton/spinner in task queue. |
| Error state | Simulated fetch error — error banner with retry button. |

**Seed workspace elements:** The showcase registers 3 stub workspace elements (one per capability tag) that render a placeholder with a "Simulate Result" button that dispatches `workspace-result` with mock data. These are showcase-only elements, not shipped with the component.

**Seed context tab elements:** The showcase registers 2 stub context tabs ("Summary" and "History") that render the task's `investigationSummary` fields as a key-value list.

### Showcase file structure

```
examples/showcase/pages/worker-task-pane/
├── index.ts                    # showcase page registration
├── seed-data.ts                # WorkerTaskResponse[] seed data
├── stub-workspace-entity.ts    # stub workspace for entity-resolution
├── stub-workspace-pattern.ts   # stub workspace for pattern-analysis
├── stub-workspace-osint.ts     # stub workspace for osint-screening
├── stub-context-summary.ts     # stub context tab — summary
└── stub-context-history.ts     # stub context tab — history
```

## File structure

```
components/worker-task-pane/
├── package.json
├── tsconfig.json
├── src/
│   ├── worker-task-pane.ts
│   ├── types.ts
│   └── index.ts
└── test/
    └── worker-task-pane.test.ts
```

## Testing strategy

| Test | What it verifies |
|------|-----------------|
| Renders list-pane with derived dataset | Fetch → TypedDataSet derivation → column display |
| Inline data mode | `data` property → items displayed without fetch |
| Selection populates context and workspace | TypedRow → item lookup → detail-pane + workspace element lifecycle |
| Workspace element created by capability tag | WorkspaceDefinition matching, createElement, taskContext set |
| Workspace element cached | Second selection of same capabilityTag reuses element, sets new taskContext |
| Stale workspace-result ignored | Result for previous task's ID ignored after selection change |
| workspace-result event captured | addEventListener on workspace element, Submit button enabled |
| Response submission emits event | worker-task:responded dispatched with correct payload |
| Response POST when endpoint provided | fetch mock, success removes task, failure shows error |
| preventDefault suppresses POST | Consumer intercepts event, no fetch call made |
| Claim flow gating | claimEndpoint present → claim required before response |
| Pre-assigned task skips claim | assigneeId matches identity → response form shown immediately |
| Decline flow | Reason dropdown + detail → worker-task:declined event |
| Layout property switches template | `layout='split'` renders split-workbench, `layout='stacked'` renders vertical flexbox |
| Section visibility | `showContext=false` hides context section |
| Identity filtering | Only tasks matching identity.groups shown; assigneeId filtering works |
| SSE integration | eventStreamEndpoint → SSEManager subscribes, task events update items |
| Keyboard shortcuts | `c` claims, `Enter` submits, `d` declines, `Escape` closes, `?` overlay |
| ARIA: roles and labels | `role="region"`, `aria-label` on host, workspace, response form |
| ARIA: keyboard navigation | Tab order through queue → context → workspace → response |
| ARIA: state attributes | `aria-disabled` on buttons during submission, `aria-expanded` on collapsible sections, `aria-live` on workspace |
| ARIA: empty and loading states | `aria-busy` during loading, empty message announced |
| ARIA: error announcements | `role="alert"` on error regions, `this.announce()` on action outcomes |
| ARIA: live region announcements | SSE task arrival announced, submit/claim/decline outcomes announced |
| configure() batch update | Imperative prop setting triggers single re-render |
| Showcase renders all scenarios | Each showcase scenario renders without errors |

## Design decisions

See `decisions.md` in this spec directory for the full decision log (D1–D9).

Key decisions:
- **D1:** Layout is configurable (`split` / `stacked`), not fixed
- **D2:** Section sizing via CSS custom properties, visibility via boolean props
- **D3:** Workspace registry via declarative `WorkspaceDefinition[]` property — no slots (protocol PP-20260713-8ea1af)
- **D4:** Investigation context from component-owned item array lookup, not TypedRow extraction
- **D5:** Direct fetch (like work-item-inbox) + optional SSE via SSEManager from pages-data
- **D6:** Single component with inline rendering
- **D7:** Events-first with optional REST submission, `preventDefault()` to suppress POST
- **D8:** Optional claim step via `claimEndpoint`, auto-derived `_claimed` from `assigneeId`
- **D9:** workspace-result captured via direct addEventListener on cached workspace element, stale results filtered by taskId

## References

- [component-customisation-pattern protocol (PP-20260713-8ea1af)](/Users/mdproctor/claude/casehub/blocks-ui/docs/protocols/blocks-ui/component-customisation-pattern.md) — typed config + render callbacks, no slots for content
- [Issue #152](https://github.com/casehubio/blocks-ui/issues/152) — original issue with API proposal and motivation
- [components/work-item-workbench/src/work-item-workbench.ts](/Users/mdproctor/claude/casehub/blocks-ui/components/work-item-workbench/src/work-item-workbench.ts) — convenience wrapper composition pattern
- [components/work-item-inbox/src/work-item-inbox.ts](/Users/mdproctor/claude/casehub/blocks-ui/components/work-item-inbox/src/work-item-inbox.ts) — direct fetch + SSEManager pattern, identity filtering, TypedDataSet derivation via fromRows()
- [components/channel-activity/src/blocks-channel-activity.ts](/Users/mdproctor/claude/casehub/blocks-ui/components/channel-activity/src/blocks-channel-activity.ts) — convenience wrapper composition, keyboard shortcuts
- [components/detail-pane/src/detail-pane.ts](/Users/mdproctor/claude/casehub/blocks-ui/components/detail-pane/src/detail-pane.ts) — TabDefinition lazy element creation + caching pattern
- [components/detail-pane/src/types.ts](/Users/mdproctor/claude/casehub/blocks-ui/components/detail-pane/src/types.ts) — TabDefinition interface (reused for contextTabs)
- [components/list-pane/src/list-pane.ts](/Users/mdproctor/claude/casehub/blocks-ui/components/list-pane/src/list-pane.ts) — list-pane inline dataset mode (no endpoint → no fetch)
- [@casehubio/pages-data SSEManager](/Users/mdproctor/claude/casehub/blocks-ui/.casehub-packages/packages/pages-data/src/sse/sse-manager.ts) — SSE subscription lifecycle
- [Spec review R1](/Users/mdproctor/reviews/casehub-blocks-ui/issue-152-worker-task-pane-spec-20260903-212221/responses/reviewer-1.md) — light spec review, 14 findings addressed
- [Decision review R1](/Users/mdproctor/reviews/casehub-blocks-ui/issue-152-worker-task-pane-decision-20260903-180640/responses/reviewer-1.md) — light decision review, revised D2–D6 and added D7–D9
