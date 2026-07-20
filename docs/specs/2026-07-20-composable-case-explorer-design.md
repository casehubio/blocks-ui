# Composable Case Explorer — Design Spec

**Issue:** #87
**Date:** 2026-07-20
**Status:** Draft

## Problem

Every casehub app runs casehub-engine and has cases, workers, sub-cases, gates, and channels — but no shared UI exists for browsing, inspecting, or managing them. Claudony (casehubio/claudony#176), devtown (#119, #120), AML (casehubio/aml#110) all describe slices of this need. Each would build its own solution without a shared component.

Workers are opaque today — the engine provisions and terminates them, but their runtime state is not queryable. There is no SPI for a worker to export what it's doing, what commands it supports, or how to render its internal state. Management actions (cancel, restart) are hardcoded per deployment, not abstracted.

## Design Principles

1. **Universal entity model** — every entity type conforms to the same contract. The UI never hardcodes what entity types exist.
2. **Registration-based** — apps register entity types with endpoints, columns, renderers, relationships. The explorer renders whatever is registered.
3. **Composable and layered** — apps consume any subset, from a single list component to the full management console.
4. **Domain customisable** — per protocol PP-20260713-8ea1af: typed config properties, optional render callbacks, factory method overrides. No domain knowledge baked in.
5. **Homogeneous runtime** — heterogeneous worker runtimes (flow, agent, human) present uniformly via an SPI. The UI sees state and commands, never implementation details.

## 1. Universal Entity Model

Every entity instance in the explorer — case, worker, sub-case, gate, channel, definition — returns the same shape from the REST API.

### EntityInstance (runtime, per-instance from the backend)

```typescript
interface EntityInstance {
  readonly id: string;
  readonly type: string;
  readonly status: string;
  readonly summary: string;
  readonly state: Record<string, unknown>;
  readonly availableCommands: readonly CommandDescriptor[];
  readonly createdAt: string;
  readonly updatedAt?: string;
}
```

- `type` matches a registered entity type identifier.
- `state` is structured key-value — the entity exports whatever is meaningful. A flow worker exports current step, variables, progress. An agent worker exports session status, last activity.
- `availableCommands` is dynamic per-instance based on current runtime state. A running worker might expose `[suspend, cancel]`; a suspended one `[resume, cancel]`.

### CommandDescriptor (MCP-tools-style dynamic actions)

Each entity instance declares its own commands — not a fixed vocabulary. Like MCP tools: the backend declares, the UI renders.

```typescript
interface CommandDescriptor {
  readonly name: string;
  readonly label: string;
  readonly description?: string;
  readonly parameters?: readonly ParameterDescriptor[];
  readonly confirmation?: boolean;
  readonly confirmMessage?: string;
  readonly severity?: 'normal' | 'destructive';
  readonly endpoint: string;
  readonly method?: string;  // defaults to POST
}

interface ParameterDescriptor {
  readonly name: string;
  readonly label: string;
  readonly type: 'string' | 'number' | 'boolean' | 'select';
  readonly required?: boolean;
  readonly options?: readonly SelectOption[];
  readonly defaultValue?: unknown;
}

interface SelectOption {
  readonly value: string;
  readonly label: string;
}
```

The UI renders command buttons. On click: if `confirmation` is true, show `blocks-confirm-dialog`. Then POST to `endpoint` with parameters. On success, emit `entity-changed` event.

### EntityTypeRegistration (compile-time, declared by the app)

Apps register entity types at startup. The explorer renders lists and details for whatever types are registered.

```typescript
interface EntityTypeRegistration {
  readonly type: string;
  readonly label: string;
  readonly icon?: string;
  readonly listEndpoint: string;
  readonly detailEndpoint: (id: string) => string;
  readonly columnConfig: readonly ColumnConfig[];
  readonly columnRenderers?: Record<string, ColumnRenderer>;
  readonly detailRenderer?: DetailRenderer;
  readonly detailRendererMap?: Record<string, string | DetailRenderer>;
  readonly relationships?: readonly RelationshipDeclaration[];
  readonly filters?: readonly FilterDescriptor[];
  readonly subTypes?: readonly string[];
  readonly treeEndpoint?: (rootId: string) => string;
  readonly eventTopics?: readonly string[];
}
```

- `detailRendererMap` maps sub-type → component tag or render callback. For workers: `{ flow: 'flow-worker-detail', agent: 'agent-session-detail' }`. Resolution order: sub-type-specific → entity-type `detailRenderer` → default state table.
- `relationships` declare child entity types for drill-down and detail tabs.
- `treeEndpoint` returns the first two levels of the hierarchy for tree mode (used when drilling into a case). Deeper levels are loaded lazily via `childrenEndpoint` on tree nodes.
- `eventTopics` declares the WebSocket topics to subscribe to for real-time updates on this entity type.

### RelationshipDeclaration

```typescript
interface RelationshipDeclaration {
  readonly childType: string;
  readonly label: string;
  readonly endpointTemplate: string;  // '/api/cases/{parentId}/workers'
}
```

The detail panel reads relationships from the registration and renders child entity lists generically. Apps can declare domain-specific relationships (e.g. AML: investigation → evidence items).

### EntityListResponse

```typescript
interface EntityListResponse {
  readonly entities: readonly EntityInstance[];
  readonly nextCursor?: string;
  readonly totalCount?: number;
}
```

### FilterDescriptor

```typescript
interface FilterDescriptor {
  readonly field: string;
  readonly label: string;
  readonly type: 'text' | 'select' | 'date-range' | 'status';
  readonly options?: readonly SelectOption[];
}
```

## 2. NavigationController

A Lit ReactiveController (like SharedTimerController, EventStreamController in blocks-ui-core) that manages explorer navigation state. Optional — standalone components work without it.

### State

```typescript
interface NavigationState {
  currentEntityType: string;
  selectedEntityId: string | null;
  viewMode: 'list' | 'tree';
  breadcrumbs: readonly BreadcrumbEntry[];
  availableEntityTypes: readonly EntityTypeRegistration[];
}

interface BreadcrumbEntry {
  readonly entityType: string;
  readonly entityId: string;
  readonly label: string;
  readonly listEndpoint: string;
}
```

### Two-mode left panel

**Entity list mode** — flat list of all entities of a type. Top-level entry point and cross-case views. "Show me all cases" or "show me all workers across cases."

**Tree mode** — collapsible hierarchy of a single case and all its descendants (sub-cases, workers, gates). Entered when drilling into a specific case from list mode. Fan-out is natural — all branches visible, expand/collapse per node.

### Navigation flow

1. User views entity type tabs → selects "Cases" → entity list mode shows all cases
2. Clicks Case #7 → detail panel loads on right
3. Clicks "Explore hierarchy" (or similar) → left panel switches to tree mode showing Case #7's full tree
4. Expands "per-repo-checks" group → sees sub-cases with M-of-N progress
5. Clicks worker "test" under sub-case "repo-B" → detail panel shows that worker's state and commands
6. Clicks breadcrumb "Cases" → back to entity list mode

### Events

All events use `emitPagesEvent()` from `@casehubio/pages-component` (re-exported via `blocks-ui-core`), consistent with all other blocks-ui components.

- `entity-type-changed` — list panel switches entity type
- `entity-selected` — carries `EntitySelection { id, type }`. entity-detail fetches the full `EntityInstance` from `detailEndpoint(id)`. Both entity-list (on row activation) and entity-tree (on node click) emit this shape.
- `entity-changed` — after management action or WebSocket event, affected components re-fetch

```typescript
interface EntitySelection {
  readonly id: string;
  readonly type: string;
}
```

### Standalone behaviour

Without NavigationController, each component uses `selection-topic` events — the same coordination pattern used by `split-workbench`, `list-pane`, and `detail-pane`. A `selection-topic` attribute on the component defines the event prefix (e.g., `selection-topic="worker"` → emits `worker:selected`, listens for `worker:deselected`). The controller adds breadcrumbs, cross-entity drill-down, tree mode, and targeted refresh.

## 3. Component Architecture

### Generic components (entity-type-agnostic)

| Component | Purpose |
|-----------|---------|
| `<entity-list>` | `LiveRegionMixin(LitElement)`. Owns data fetching with cursor-aware pagination — fetches from `listEndpoint`, stores `nextCursor`, converts `EntityListResponse.entities` to `TypedDataSet`, and passes to `list-pane` via the `.dataSet` property (data-property mode — `list-pane`'s `DataSourceMixin` is dormant). Enriches selection events: intercepts `list-pane`'s row activation, extracts entity ID, re-emits on its own `selectionTopic` as `EntitySelection { id, type }`. Renders filter controls from registration and "load more" trigger when `nextCursor` is present. |
| `<entity-detail>` | `LiveRegionMixin(LitElement)`. On `EntitySelection`, fetches the full `EntityInstance` from `detailEndpoint(id)`. Renders three-tier detail content (sub-type → entity-type → default state table), `entity-command-bar` from `availableCommands`, and relationship tabs from `registration.relationships` (each tab contains an `entity-list` for the child type). Not a wrapper around `detail-pane` — entity-detail owns its rendering and fetch because it needs the full `EntityInstance` (including `availableCommands` and `state`), not the tabular `TypedRow` that selection events carry. |
| `<entity-tree>` | `DataSourceMixin(LiveRegionMixin(LitElement))`. Collapsible hierarchy view. Each node: type icon, name, status badge, expand/collapse. Sub-case groups show M-of-N. |
| `<entity-command-bar>` | `LiveRegionMixin(LitElement)`. Renders `availableCommands` as buttons. Handles confirmation dialogs, POST execution, entity-changed events. Announces command results to screen readers. |
| `<case-explorer>` | Full composed experience — `split-workbench`, entity type tabs, list/tree mode, NavigationController, breadcrumbs. |

### Convenience components (pre-configured wrappers)

| Component | Wraps | Default columns |
|-----------|-------|----------------|
| `<case-definition-browser>` | `<entity-list>` + `<entity-detail>` | namespace, name, version, worker count, milestones |
| `<case-instance-list>` | `<entity-list>` | name, status, started, active workers, SLA |
| `<worker-list>` | `<entity-list>` | name, type, status, parent case, started, progress |
| `<case-detail-panel>` | `<entity-detail>` | Tabs: Overview, Plan, Workers, Sub-cases, Timeline, Channels |
| `<worker-detail-panel>` | `<entity-detail>` | State, Commands, pluggable renderer |

Convenience components accept all the same customisation hooks as the generic components — they just ship with defaults.

### Three consumption tiers

**Tier 1 — Convenience component.** Drop in with an endpoint.
```html
<case-instance-list endpoint="/api/cases"></case-instance-list>
```

**Tier 2 — Generic component + registration.** Register a custom entity type.
```html
<entity-list .registration=${investigationType}></entity-list>
```

**Tier 3 — Full explorer.** Entity tabs, drill-down, breadcrumbs, management.
```html
<case-explorer .entityTypes=${[caseInstanceType, workerType, gateType]}></case-explorer>
```

### Data flow

Data flows through three stages: entity-list → selection → entity-detail.

**entity-list** fetches `EntityListResponse` from `listEndpoint` with cursor-aware pagination. It converts `entities` to `TypedDataSet` and passes to `list-pane` via the `.dataSet` property (data-property mode — `list-pane`'s own `DataSourceMixin` is dormant, no endpoint set). On row activation, entity-list intercepts `list-pane`'s selection event, extracts the entity ID from the `TypedRow`, and re-emits an `EntitySelection { id, type }` on its own `selectionTopic`. This enrichment is necessary because `list-pane`'s raw selection payload is a `TypedRow` (tabular data after `extractDataSet` transformation), which lacks `availableCommands` and `state` from the original `EntityInstance`.

**entity-detail** listens for `EntitySelection` on its `selectionTopic`. On selection, it fetches the full `EntityInstance` from `registration.detailEndpoint(id)` — a simple JSON fetch, not `DataSourceMixin` (which is designed for tabular datasets, not single entities). entity-detail manages its own loading/error state for this fetch.

**entity-tree** emits the same `EntitySelection { id, type }` on node click, so entity-detail works identically in list and tree modes.

Coordination via `emitPagesEvent()`. No shared data store. Components compose with `split-workbench` (responsive split layout) and `list-pane` (data-driven table rendering via data-property mode).

## 4. Entity Tree

### EntityTreeNode

```typescript
interface EntityTreeNode {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly status: string;
  readonly icon?: string;
  readonly children?: readonly EntityTreeNode[];
  readonly childrenEndpoint?: string;
  readonly childCount?: number;
  readonly groupInfo?: GroupInfo;
}

interface GroupInfo {
  readonly groupId: string;
  readonly totalInGroup: number;
  readonly requiredCount: number;
  readonly completedCount: number;
}
```

- `children` — inline child nodes. Present on nodes within the initial fetch depth (first two levels).
- `childrenEndpoint` — URL to fetch children on demand. Present on nodes beyond the initial fetch depth that have children. Mutually exclusive with `children` in a single response: a node has either inline children or a lazy endpoint, never both.
- `childCount` — number of children, present when `childrenEndpoint` is set. Drives the expand affordance without requiring a fetch.

### Example tree structure

```
Case #7 (PR review)                    [RUNNING]
├── Worker: code-analysis              [COMPLETED]
├── Worker: security-review            [RUNNING]
├── SubCase Group: per-repo-checks     [2/5 required, 1 completed]
│   ├── SubCase: repo-A                [COMPLETED]
│   │   ├── Worker: lint               [COMPLETED]
│   │   └── Worker: test               [COMPLETED]
│   ├── SubCase: repo-B                [RUNNING]
│   │   ├── Worker: lint               [COMPLETED]
│   │   └── Worker: test               [RUNNING]
│   └── SubCase: repo-C                [PENDING]
└── SubCase: rollback-plan             [PENDING]
    └── Worker: rollback-analyzer      [PENDING]
```

Each tree node is clickable — selecting it loads the entity detail on the right. Sub-case group nodes show M-of-N progress. Nodes accept a `nodeRenderer` callback for domain-specific rendering (progress bars, risk indicators).

### Lazy loading

The `treeEndpoint` returns the first two levels (root + immediate children). On expand, `<entity-tree>` fetches children from `childrenEndpoint` and inserts them into the tree. This bounds the initial response and avoids materialising deep hierarchies.

Virtual rendering: `<entity-tree>` renders only visible nodes. Collapsed subtrees are not in the DOM. For trees exceeding ~200 visible nodes, the component uses a virtual scroller.

## 5. Worker State/Command SPI (Java)

The SPI that turns heterogeneous worker runtimes into a homogeneous model. Generalised to all entity types, not just workers.

### Relationship to ActorStateContributor

The platform has an existing `ActorStateContributor` SPI (`io.casehub.platform.api.actor.ActorStateContributor`) that uses an accumulator pattern — multiple sources contribute pieces (trust scores, capability scores, work items, commitments) to build a composite view of a platform **actor** (human or AI agent). `EntityStateContributor` serves a different purpose: it exposes runtime state and management commands for case management **entities** (cases, workers, gates, channels). Different domains, different shapes — not a generalisation of ActorStateContributor.

### EntityStateContributor

```java
public interface EntityStateContributor {
    String entityType();
    EntityInstance getState(String entityId, String tenancyId);
    EntityListResponse list(String tenancyId, Map<String, String> filters);
    CommandResult executeCommand(String entityId, String commandName,
                                 Map<String, Object> params, String tenancyId);
}
```

`entityType()` returns a specific type string. Worker sub-types use compound types: `"worker:flow"`, `"worker:agent"`, `"worker:human"`. The engine routes by exact match — no `supports()` needed, no per-request database lookups for type resolution.

For listing all workers across sub-types, the engine aggregates all contributors whose `entityType()` starts with the prefix `"worker:"`. The UI's `EntityTypeRegistration` for workers declares `subTypes: ["worker:flow", "worker:agent", "worker:human"]` so the explorer knows which types to aggregate.

Tenancy is resolved server-side from the Quarkus security context — it is not part of the UI contract. The `tenancyId` parameter on SPI methods is injected by the REST resource layer.

### Worker-specific contributors (examples)

**FlowWorkerStateContributor:**
- `entityType()` → `"worker:flow"`
- `getState()` → queries Quarkus Flow for process instance state, active nodes, variables. Returns `EntityInstance` with structured state and commands (`suspend`, `resume`, `skip-step`, `retry` — based on current flow state).
- `executeCommand("suspend")` → calls Flow's suspend API.

**AgentWorkerStateContributor:**
- `entityType()` → `"worker:agent"`
- `getState()` → queries SessionRegistry for tmux session status, last activity. Returns `EntityInstance` with state and commands (`interrupt`, `restart`, `send-input`).
- `executeCommand("restart")` → kills and re-provisions the tmux session.

**HumanWorkerStateContributor:**
- `entityType()` → `"worker:human"`
- `getState()` → queries casehub-work for work item status, assignee, SLA. Returns `EntityInstance` with state and commands (`reassign`, `escalate`, `extend-deadline`).
- `executeCommand("reassign")` → calls work item reassignment API.

The UI never distinguishes between these. It sees `EntityInstance` with state and commands.

### Event generation

The SPI is request-response (getState, list, executeCommand). Real-time events are generated via CDI events:

```java
@Inject Event<EntityStateChanged> entityEvents;

// After state change (e.g., flow step transition, command completion):
entityEvents.fire(new EntityStateChanged(entityType, entityId, eventType, data));
```

The engine's WebSocket endpoint observes `EntityStateChanged` CDI events and publishes them to connected clients on the matching topic. Contributors fire CDI events from their own state-change hooks — flow workers fire on step transitions, agent workers fire on session status changes, the engine fires on case lifecycle events.

`executeCommand()` return type `CommandResult` includes a boolean `stateChanged` — when true, the REST resource fires the CDI event automatically after command execution, so contributors don't need to fire events for command-driven changes.

### Tier C — optional detail renderer

A worker type can register a blocks-ui component tag as its detail renderer via `detailRendererMap` on the worker entity type registration. When the detail panel renders a flow worker, it instantiates the registered component (e.g. `<flow-worker-detail>`) instead of the generic state table.

## 6. Real-time Updates

### EntityEvent

```typescript
interface EntityEvent {
  readonly entityType: string;
  readonly entityId: string;
  readonly eventType: string;  // 'state-changed', 'command-completed', 'child-added'
  readonly data?: Record<string, unknown>;
  readonly timestamp: string;
}
```

### Architecture

WebSocket with topic-based multiplexing, using the existing `EventStreamController` from blocks-ui-core. `EventStreamController` wraps `EventStream` from `@casehubio/pages-data`, which provides a single WebSocket connection with topic-based pub/sub filtering and automatic reconnection.

The engine exposes a WebSocket endpoint (e.g., `ws://.../api/events`). `EntityTypeRegistration` declares `eventTopics?: readonly string[]` — the topics to subscribe to. The explorer opens one `EventStreamController` for the union of all registered topics:

```typescript
new EventStreamController(this, '/api/events', allTopics, {
  batchEvents: true,
});
```

Standalone components connect to the same WebSocket endpoint with their own topic filter via `EventStreamController`.

NavigationController routes incoming events to visible components:
- Entity in the current list → list re-fetches (or optimistic update from event data)
- Entity in the detail panel → detail re-fetches
- Entity in the tree → tree node status badge updates in-place

## 7. Domain Customisation

Per protocol PP-20260713-8ea1af: typed config, render callbacks, factory overrides. No slots for content.

### Column renderers

Each entity list accepts `columnRenderers` — same pattern as existing blocks-ui components.

### Detail renderers (three-tier resolution)

1. **Sub-type-specific** — `detailRendererMap` maps sub-type to component tag or render callback. Flow workers get `<flow-worker-detail>`.
2. **Entity-type-specific** — the registration's `detailRenderer` callback. Devtown renders PR metadata in case detail.
3. **Default** — generic state key-value table + command bar.

Resolution order: sub-type → entity-type → default. First match wins.

### Tree node renderer

`<entity-tree>` accepts a `nodeRenderer` callback. Default: icon + name + status badge. Apps can add progress bars, risk indicators, domain badges.

### Filter customisation

Entity type registrations declare available filters. Explorer renders filter controls generically. Apps add domain-specific filters via registration.

### Entity type presets

Standard casehub entity types ship as importable factory functions that return `EntityTypeRegistration` with sensible defaults. Apps call them and override:

```typescript
import { caseInstanceType, workerType } from '@casehubio/blocks-ui-case-explorer';

const myWorkerType = {
  ...workerType({ listEndpoint: '/api/workers' }),
  columnRenderers: { progress: myCustomProgressRenderer },
  detailRendererMap: { flow: 'my-flow-detail' },
};
```

## 8. Package Structure

```
components/case-explorer/
├── src/
│   ├── types.ts                    # All TypeScript interfaces
│   ├── navigation-controller.ts    # NavigationController
│   ├── entity-list.ts              # Generic entity list
│   ├── entity-detail.ts            # Polymorphic entity detail
│   ├── entity-tree.ts              # Collapsible hierarchy
│   ├── entity-command-bar.ts       # Command button rendering
│   ├── case-explorer.ts            # Full composed explorer
│   ├── presets.ts                   # Standard entity type registrations
│   ├── convenience/
│   │   ├── case-definition-browser.ts
│   │   ├── case-instance-list.ts
│   │   ├── worker-list.ts
│   │   ├── case-detail-panel.ts
│   │   └── worker-detail-panel.ts
│   └── index.ts
├── vitest.config.ts
├── tsconfig.json
└── package.json
```

## 9. Cross-repo Impact

### Engine (casehub-engine)

- Implement `EntityStateContributor` SPI and CDI aggregation
- Implement REST endpoints returning `EntityInstance`, `EntityListResponse`, `EntityTreeNode` shapes
- Implement command execution routing via `executeCommand()`
- Implement WebSocket endpoint with topic-based entity event publishing
- Move scaffolded case REST endpoints from ops to engine and implement them. Current scaffold: stubbed `/api/applications/{id}/cases` returning 200 with empty responses. Target: full CRUD + list with cursor pagination, returning `EntityInstance` and `EntityListResponse` shapes. URL structure is preserved — the migration is a backend move, not an API change. No existing consumers beyond the ops admin UI.

### Per-app (devtown, claudony, AML, clinical, openclaw)

- Register entity types with app-specific endpoints, columns, renderers
- Implement `EntityStateContributor` for app-specific worker types
- Optionally provide custom detail renderer components for specialised worker visualisation

### blocks-ui (this repo)

- All components, types, NavigationController, presets
- No engine or app dependencies — pure UI consuming REST contracts

## 10. Error Handling, Loading States, and Accessibility

### Loading and error states

Components that fetch tabular data extend `DataSourceMixin`, which provides `loading`, `error`, and `dataSet` reactive properties. `entity-list` and `entity-detail` manage their own fetch and loading/error state — `entity-list` for cursor-paginated list responses (controlling `list-pane`'s display via data-property mode), `entity-detail` for single-entity JSON fetches on selection. Components render:
- **Loading** — skeleton/spinner while fetching, announced via `LiveRegionMixin.announce()`
- **Error** — inline error message with retry action. Command POST failures show error toast with the server's error message.
- **Empty** — configurable empty-state message (e.g., "No workers found")
- **WebSocket disconnect** — EventStreamController exposes `status` (connected/disconnected/error). `EventStream` from `@casehubio/pages-data` handles automatic reconnection with exponential backoff. Components show a reconnection indicator based on `status`.

### Accessibility

- `<entity-tree>` — `role="tree"` with `role="treeitem"` on nodes. `aria-expanded` on collapsible nodes. Arrow key navigation (up/down between siblings, left/right to collapse/expand).
- `<entity-list>` — delegates to `pages-table` which provides accessible table semantics.
- `<entity-command-bar>` — destructive commands use `aria-label` including the severity level. Confirmation dialogs are modal with focus trap. Command results announced via `LiveRegionMixin.announce()`.
- `<case-explorer>` — entity type tabs use `role="tablist"`/`role="tab"`. View mode toggle is a labelled `role="radiogroup"`.
- All state transitions (selection, navigation, command execution) are announced to screen readers via `LiveRegionMixin`.
- Colour is never the sole indicator — status badges include text labels alongside colour.

## 11. Pagination

### Server-side cursor pagination

Entity list endpoints return `EntityListResponse` with `nextCursor` for server-side pagination. The client passes the cursor as a query parameter: `GET /api/cases?cursor=<value>&limit=25`. Changing any filter invalidates the cursor — the client starts from the first page.

### Integration with entity-list and list-pane

`entity-list` owns all data fetching. It does not use `DataSourceMixin` — instead it performs cursor-aware JSON fetches directly, avoiding dual `DataSourceMixin` between `entity-list` and `list-pane`:

1. **Initial fetch:** `entity-list` calls `fetch(listEndpoint)`, receives `EntityListResponse`. Converts `entities` to `TypedDataSet` (via `extractDataSet` with `columnConfig` from the registration). Sets `list-pane.dataSet` directly (data-property mode — `list-pane`'s `DataSourceMixin` is dormant). Stores `nextCursor`.
2. **Rendering:** `list-pane` renders with its standard `mode="paginated"` client-side pagination and `client-sort`/`client-filter` on the loaded dataset. When `nextCursor` is present, `entity-list` renders a "load more" control below `list-pane`.
3. **Load more:** On "load more" click, `entity-list` fetches the next cursor page, appends to the accumulated entity set, rebuilds `TypedDataSet`, and updates `list-pane.dataSet`. Client-side pagination adjusts to the larger dataset (more pages become available).
4. **Filter changes:** Invalidate the cursor, clear the accumulated dataset, and re-fetch from the first page with updated filter parameters. `list-pane`'s `client-filter` operates independently for instant text matching within the already-loaded data.

For entity types with bounded result sets (definitions, gates), a single fetch suffices and cursor pagination is unused.

## 12. Testing

### Generic components

- **EntityTypeRegistration resolution** — registering types, looking up by type string, sub-type aggregation
- **entity-list** — cursor-aware fetch from listEndpoint; TypedDataSet construction and list-pane data-property pass-through; enriched `EntitySelection` emission on row activation; "load more" fetches next cursor page and appends to accumulated dataset; filter changes reset cursor
- **entity-detail** — fetches full `EntityInstance` from `detailEndpoint(id)` on `EntitySelection`; three-tier detail renderer resolution (sub-type → entity-type → default); relationship tab generation from registration (each tab contains entity-list for child type); command bar receives `availableCommands` from fetched entity; loading/error state during detail fetch
- **entity-tree** — expand/collapse nodes; lazy loading (fetch children on expand); virtual rendering skips off-screen nodes; M-of-N group rendering; `childrenEndpoint` fetch and insert
- **entity-command-bar** — renders buttons from `availableCommands`; confirmation dialog for destructive commands; POST execution; error display; result announcement via LiveRegionMixin

### NavigationController

- State transitions: list → tree mode and back via breadcrumbs
- Breadcrumb construction on drill-down; breadcrumb click restores list state
- Entity type tab switching resets selection and breadcrumbs
- WebSocket event routing to visible components (list re-fetch, detail re-fetch, tree badge update)

### Convenience components

- Default column config matches documentation
- Override behaviour: custom columns, renderers, and filters propagate to inner components

### Accessibility

- Tree: `role="tree"` / `role="treeitem"`, `aria-expanded`, arrow key navigation
- Tabs: `role="tablist"` / `role="tab"`, keyboard activation
- Command bar: destructive button `aria-label`, confirmation focus trap
- LiveRegionMixin announcements on state transitions, command results, and errors

### Data flow

- entity-list cursor-aware fetch → TypedDataSet → list-pane data-property pass-through
- entity-detail EntitySelection → fetch EntityInstance → render detail
- entity-tree node click → EntitySelection → entity-detail fetch
- WebSocket event → entity-changed → component re-fetch
- Loading, error, and empty state rendering

## 13. Scope

This spec addresses case/worker/entity browsing, inspection, and management. The following related needs are explicitly out of scope and tracked separately:

- **Task inbox** (claudony #176 part 2) — aggregating commitments/obligations from COMMAND messages, surfacing overdue tasks, stalled worker notifications. Requires the existing `ActorStateContributor` accumulator pattern (work items, commitments), not the entity state SPI. Tracked as a separate component.
- **Force-directed dependency graph** (devtown #120) — many-to-many relationship visualization between cases. Fundamentally different from the parent→child tree hierarchy. Requires a graph data model and D3/similar rendering. Tracked as a separate component.
