# HTN Decomposition Tree & DAG Plan Visualiser

**Date:** 2026-08-06
**Issue:** casehubio/blocks-ui#107
**Status:** Approved
**Branch:** `issue-107-htn-dag-visualiser`

---

## 1. Goal

Provide visual representations of the engine's HTN decomposition model and DAG execution plans. Two first-class views: a recursive tree showing how compound tasks decompose through strategies and methods, and a directed acyclic graph showing the concrete execution plan with dependency edges and runtime state.

Both design-time inspection and runtime monitoring are first-class. The tree shows planning structure (what strategies are configured, how tasks decompose). The DAG shows execution (what's running, what depends on what, what succeeded or failed).

## 2. Scope

**In scope:**
- `graph-stencil-htn` package — types, adapter, stencil, runtime decorations
- `blocks-dag-viewer` component — read-only graph viewer for DagPlan execution
- `blocks-decomposition-tree` component — recursive tree for HTN decomposition structure
- Tree ↔ DAG coordination via pages-event selection topics
- NodeState decoration via the `node:` status domain (#109)

**Out of scope (follow-on issues):**
- PlanItemDefinition tree component (#113 — types defined here, component deferred)
- CasePlanModel dashboard component (#114 — architectural sketch here, detailed spec deferred)
- Engine REST endpoints for HTN/DAG data (#115 — planned separately, UI defines the contract)

## 3. Architecture

Three new packages following established patterns:

```
packages/graph-stencil-htn/           ← domain adapter (parallel to graph-stencil-case/swf)
components/blocks-dag-viewer/         ← graph-based DAG execution viewer
components/blocks-decomposition-tree/ ← recursive tree for HTN decomposition
```

**graph-stencil-htn** follows the graph-stencil-case pattern: types define the data contract, an adapter converts to GraphModel, stencils render nodes, and a runtime module maps execution state to decorations. The DAG viewer consumes this package the same way casehub-diagram consumes graph-stencil-case.

**blocks-dag-viewer** wraps `pages-graph-canvas` with ELK layout. Read-only — no palette, no property panel, no persistence. Property-based data delivery consistent with the phase 7 runtime overlay pattern.

**blocks-decomposition-tree** is a dedicated tree component, not graph-based. The HTN decomposition structure is a recursive tree (CompoundTask → Method → children), not a graph. Uses native HTML with ARIA tree roles.

**Separation rationale:** casehub-diagram is a YAML editor for CaseDefinition — it has an adapter that parses YAML, a palette that adds YAML elements, a property panel that edits YAML nodes, and undo/redo that snapshots YAML. The DAG viewer is a read-only execution viewer with a completely different data model. Merging them would create a god component handling two unrelated concerns.

## 4. Type System

TypeScript discriminated unions mirroring the engine's sealed interfaces. These are the UI data contracts — the engine's new REST endpoints will conform to these shapes.

### 4.1 TaskNode hierarchy (design-time decomposition structure)

```typescript
type TaskNodeSnapshot = LeafTaskSnapshot | CompoundTaskSnapshot;

interface LeafTaskSnapshot {
  kind: 'leaf';
  id: string;
  description?: string;
  executorName?: string;
  rationale?: string;
  // Source: strategy-specific metadata from the task payload (generic T).
  // For LLM decomposition strategies, the LLM attaches reasoning for why
  // this task was planned. The REST endpoint (#115) extracts it from the
  // payload — it is not on TaskDescriptor or LeafTask directly.
}

interface CompoundTaskSnapshot {
  kind: 'compound';
  id: string;
  name: string;
  methods: DecompositionMethodSnapshot[];
  selectedMethodIndex?: number;
  // Source: engine decomposition runtime (not on CompoundTask directly).
  // Requires engine to track which method was selected during decomposition.
  // When absent, all methods display at equal opacity (no selection highlight).
  // See casehubio/blocks-ui#116.
}

interface DecompositionMethodSnapshot {
  guardLabel?: string;
  strategyId: string;
  children: TaskNodeSnapshot[];  // empty for unselected methods
}

interface DecompositionSnapshot {
  root: TaskNodeSnapshot;
  timestamp: string;
}
```

**CompoundTaskSnapshot.id:** The engine's `CompoundTask` has only `name` (not unique across nesting levels). The REST endpoint generates a path-based `id` (e.g., `compound:process-claim/assess-damages`) to provide unique identification for UI selection events and tree ↔ DAG coordination.

**DecompositionMethodSnapshot.guardLabel:** The engine's `DecompositionMethod.guard` is a `Predicate<T>` — a Java function object with no inherent string representation. The REST endpoint is responsible for providing a human-readable label. For expression-based guards, this is the expression text. For lambda guards, this requires the engine to carry a label alongside the predicate (tracked in #115). `guardLabel` is `undefined` when no readable form is available.

### 4.2 DagPlan (execution graph)

```typescript
interface DagNodeSnapshot {
  id: string;
  taskId: string;
  taskDescription?: string;
  executorName?: string;
  dependsOn: readonly string[];
  joinType: JoinType;
}

type JoinType = 'ALL_OF' | 'ANY_OF';
type DagDispatchMode = 'STREAMING' | 'BARRIER';

interface DagPlanSnapshot {
  nodes: Record<string, DagNodeSnapshot>;
  timestamp: string;
  // Plan-creation/modification time (ISO-8601). Stable across polls for an
  // unchanged plan — the REST endpoint returns the same value until the plan
  // structure actually changes. Used as plan identity for the async render
  // guard (§8.2): same timestamp = same plan = skip redundant ELK layout.
}
```

`DagDispatchMode` is not on the plan snapshot — it's a `DagDriver` execution-time configuration (§8.1 component property). Unlike `taskDescription`/`executorName` (which are per-node data inlined from the generic payload), dispatch mode is global execution context that doesn't belong on the plan data structure.

### 4.3 NodeState + DagResult (runtime execution state)

```typescript
type NodeStateKind = 'Pending' | 'Dispatched' | 'Completed'
  | 'Failed' | 'Skipped' | 'Cancelled';

interface NodeStateSnapshot {
  kind: NodeStateKind;
  reason?: string;
}

interface DagResultSnapshot {
  nodeStates: Record<string, NodeStateSnapshot>;
  completedResults?: Record<string, unknown>;
  allSucceeded: boolean;
  elapsed: string;
  timestamp: string;
  // Snapshot-capture time (ISO-8601). Changes on each REST response — reflects
  // when the server serialized the result. Used for the staleness badge (§8.3):
  // Date.now() - timestamp > 30s → stale warning. Distinct semantics from
  // DagPlanSnapshot.timestamp (plan identity, stable across polls).
}
```

### 4.4 PlanItemDefinition (outline — component deferred)

```typescript
type PlanItemDefinition = PrimitivePlanItem | CompoundPlanItem;

interface PrimitivePlanItem {
  kind: 'primitive';
  id: string;
  name: string;
  executor: { name: string; description?: string };
  entryCondition?: string;
}

interface CompoundPlanItem {
  kind: 'compound';
  id: string;
  name: string;
  children: PlanItemDefinition[];
  planningStrategy?: string;
  completion: CompletionSemantics;
  dispatchMode: PlanningDispatchMode;
  entryCondition?: string;
  exitCondition?: string;
  repeatable: boolean;
  scopedBindings?: Record<string, Participation>;
}

type Participation = 'PARTICIPANT' | 'COMPANION';

type CompletionSemantics =
  | { kind: 'All' }
  | { kind: 'MOfN'; m: number }
  | { kind: 'FirstWins' };

type PlanningDispatchMode = 'ORCHESTRATED' | 'CHOREOGRAPHED';
```

### 4.5 Design choice: flattened generics

The engine uses `DagPlan<TaskNode.LeafTask<T>>` — Java generics over the task payload. The UI types flatten this into concrete snapshots with task details inlined (`taskId`, `taskDescription`, `executorName`). The UI receives pre-serialized JSON from REST endpoints and doesn't need the generic parameter.

### 4.6 NodeState → `node:` domain decoration

`dagToDecorations()` calls `toDecoration('node', nodeStateKind.toUpperCase())` — using the purpose-built `node:` domain registered by #109. No intermediate TaskStatus mapping is needed.

The `node:` domain provides three specialized descriptors (`DISPATCHED` → info/'→', `SKIPPED` → neutral/'⏭', `FAILED` → danger/'✗'). The remaining three states (`PENDING`, `COMPLETED`, `CANCELLED`) resolve through the cross-domain defaults (`*:PENDING`, `*:COMPLETED`, `*:CANCELLED`).

This preserves the semantic distinction: "Dispatched to an agent" (info, '→', no pulse) ≠ "actively running" (success, '▶', pulse). The `task:` domain would lose this — `Dispatched` would map through `RUNNING` to the wrong visual.

## 5. DAG Adapter — `dagToGraph()`

Converts `DagPlanSnapshot` → `GraphModel` for the graph rendering pipeline. Follows the pattern of `case-adapter.ts`.

```typescript
interface DagAdapterResult {
  readonly model: GraphModel;
  readonly entryNodeIds: ReadonlySet<string>;
  readonly exitNodeIds: ReadonlySet<string>;
  readonly taskIdToGraphNodeId: ReadonlyMap<string, string>;
}

function dagToGraph(plan: DagPlanSnapshot): DagAdapterResult
```

**Node mapping:** Each `DagNodeSnapshot` becomes a `GraphNode` with `type: 'dag-node'`. Node ID is `dag:${node.id}`. Properties carry the snapshot fields for the stencil's render function.

**Edge mapping:** Each entry in `dependsOn` becomes a `GraphEdge`:
- `id: ${sourceId}--depends-on--${targetId}`
- `type: 'dependency'`
- `source: dag:${dependencyId}` (upstream node)
- `target: dag:${node.id}` (this node)

Direction is upstream → downstream (dependency flows left-to-right in ELK layout).

**JoinType handling:** JoinType is a property of the DagNode, not a separate graph entity. The stencil renders the join indicator directly on nodes with `dependsOn.length > 1`. No synthetic join-gate nodes — keeps the graph 1:1 with the engine's model.

**Entry/exit detection:** Computed from GraphModel topology. Entry nodes = no inbound edges. Exit nodes = no outbound edges. Returned as `ReadonlySet<string>` of graph node IDs for the component to highlight.

**Task-to-node index:** `taskIdToGraphNodeId` maps `DagNodeSnapshot.taskId` → graph node ID (`dag:${node.id}`). This is the bridge for tree ↔ DAG selection coordination (§9.5) — data NOT present in GraphModel. Follows the pattern of `yamlPaths` in case-adapter: the adapter result carries cross-referencing data that the graph model doesn't provide.

## 6. DAG Stencil — `dag-node`

Single stencil type with visual adaptation based on node properties.

### 6.1 Grammar

```typescript
const dagNodeGrammar: StencilGrammar = {
  type: 'dag-node',
  connections: {
    inbound: { min: 0, max: Infinity, allowedFrom: ['dag-node'] },
    outbound: { min: 0, max: Infinity, allowedTo: ['dag-node'] },
  },
};
```

### 6.2 Render function

`renderDagNode(node: GraphNode, decoration?: NodeDecoration): StencilTemplate`

Visual layout:
```
┌─────────────────────────────┐
│ ∧ ALL_OF    task-description│
│             executor-name   │
└─────────────────────────────┘
```

- **Join indicator**: `∧` for ALL_OF, `∨` for ANY_OF. Shown only when `dependsOn.length > 1`. Positioned top-left as a small badge.
- **Task description**: primary text, truncated at 60 chars.
- **Executor badge**: small accent pill showing the executor name.
- **Decoration**: NodeDecoration renders as standard badge/border/pulse overlay via pages graph-renderer. No custom decoration handling inside the stencil.
- **Skipped/Cancelled opacity**: `opacity: 0.5` when decoration indicates terminal-inactive state (same pattern as binding stencil's OBSOLETE handling).

### 6.3 Registration

```typescript
function registerHtnStencils(): void {
  registerStencil({
    type: 'dag-node',
    label: 'Task',
    icon: 'box',
    grammar: dagNodeGrammar,
    render: renderDagNode,
  });
}
```

## 7. DAG Runtime — `dagToDecorations()`

```typescript
function dagToDecorations(
  result: DagResultSnapshot
): ReadonlyMap<string, NodeDecoration>
```

For each `nodeId` in `result.nodeStates`:
1. Call `toDecoration('node', nodeStateKind.toUpperCase())` — uses the `node:` domain from the status registry (§4.6)
2. Store at key `dag:${nodeId}`

No aggregation needed — DagNodes are 1:1 with their state (unlike the case diagram's PlanItem-per-binding grouping).

**Task-keyed state map for the tree:**

```typescript
function nodeStatesToTaskStates(
  plan: DagPlanSnapshot,
  result: DagResultSnapshot
): Record<string, NodeStateSnapshot>
```

`DagResultSnapshot.nodeStates` is keyed by DagNode ID (`"node-0"`). The decomposition tree looks up states by task ID (`LeafTaskSnapshot.id`). This function bridges the gap: for each `(nodeId, state)` in `result.nodeStates`, it resolves `plan.nodes[nodeId].taskId` and stores the state at that task ID. The result is suitable for passing directly to `blocks-decomposition-tree.nodeStates`.

## 8. `blocks-dag-viewer` Component

Read-only graph viewer for DAG execution plans. Wraps `pages-graph-canvas` with ELK layout.

### 8.1 Properties

```typescript
@customElement('blocks-dag-viewer')
class BlocksDagViewer extends LitElement {
  @property({ type: Object }) dagPlan: DagPlanSnapshot | null = null;
  @property({ type: Object }) dagResult: DagResultSnapshot | null = null;
  @property({ type: String }) dispatchMode: DagDispatchMode | null = null;
  @property({ attribute: 'selection-topic' }) selectionTopic: string = 'dag-node';
}
```

- `dagPlan` — triggers full render (adapter → ELK layout → canvas). Clears cached decorations (§8.2).
- `dagResult` — triggers decoration-only update (no re-layout). Decorations filtered to known node IDs.
- `dispatchMode` — execution-time configuration from `DagDriver`, not part of `DagPlan`. The host obtains it from the execution context (e.g., the REST endpoint that returns execution metadata alongside the plan). Displayed in toolbar.
- `selectionTopic` — pages-event topic for node selection coordination.

### 8.2 Render flow

```
dagPlan set
  → registerHtnStencils() (once)
  → dagToGraph(dagPlan)              → GraphModel
  → computeElkLayout(nodes, edges)   → ElkLayout (async, Web Worker)
  → toReactFlowGraph(model, layout, decorations?)
  → <pages-graph-canvas>

dagPlan changes (new plan replaces old)
  → clear cached decorations (stale dagResult may reference old node IDs)
  → full render as above (with no decorations until dagResult refreshes)

dagResult set (dagPlan unchanged)
  → dagToDecorations(dagResult)      → Map<string, NodeDecoration>
  → filter decorations to node IDs present in current GraphModel
  → toReactFlowGraph(model, cachedLayout, decorations)  ← skip ELK
  → <pages-graph-canvas> updates
```

**Async render guard:** If `dagPlan` changes while ELK is computing, the pending render runs after the current one completes (same pattern as casehub-diagram). Plan identity is determined by `DagPlanSnapshot.timestamp` — if the new plan has the same timestamp as the pending plan, the re-render is skipped. This avoids redundant ELK layouts when the host re-sets the same snapshot (e.g., polling returns unchanged data as a new object reference).

**dagResult before dagPlan:** If `dagResult` is set while `dagPlan` is null, decorations are computed but silently dropped (no rendered nodes to decorate). When `dagPlan` arrives later, decorations from the current `dagResult` are applied (filtered to known nodes).

**Plan-result correlation:** The component does not enforce version correlation between `dagPlan` and `dagResult`. Instead, it relies on two mechanisms: (1) clearing decorations on plan change ensures stale results don't decorate wrong nodes, and (2) filtering to known node IDs ensures orphaned decoration keys are silently discarded. The host is responsible for providing coherent snapshots.

### 8.3 Sub-elements

**`blocks-dag-toolbar`**: toolbar strip above the canvas.
- Dispatch mode badge: `STREAMING` or `BARRIER` pill (from the `dispatchMode` component property)
- Summary stats: node count, completed/running/failed counts (derived from `dagResult`)
- Staleness badge: `⚠ stale (45s ago)` when `dagResult.timestamp` > 30s old. Refreshed every second via a `setInterval(1000)` timer that re-evaluates `Date.now() - timestamp`. Timer lifecycle: starts in `connectedCallback` when `dagResult` is non-null, stops in `disconnectedCallback` (preventing interval leaks on unmount), and restarts/stops in `updated()` when `dagResult` changes between null and non-null. **Divergence from casehub-diagram:** casehub-diagram computes staleness once on data arrival (design-time tool; frozen staleness is acceptable). The DAG viewer is a runtime monitoring component where frozen relative timestamps would be actively misleading — "stale (5s)" still displayed after 10 minutes of no updates.
- Elapsed time: `dagResult.elapsed` when available

No palette, property panel, or save button.

### 8.4 Layout direction

ELK `direction: 'RIGHT'` — dependencies flow left-to-right. Entry nodes on the left, exit nodes on the right.

### 8.5 Node selection

Click on a dag-node emits `pages-event` on `selectionTopic` with `{ taskId: string }` — the `DagNodeSnapshot.taskId`, not the graph node ID. This shared ID space enables tree ↔ DAG coordination (§9.5). The component uses `taskIdToGraphNodeId` from the adapter result to resolve incoming selection events to graph node IDs for highlighting.

## 9. `blocks-decomposition-tree` Component

Dedicated recursive tree for HTN decomposition structure. ARIA tree roles, keyboard navigation, render callbacks for extensibility.

### 9.1 Properties

```typescript
@customElement('blocks-decomposition-tree')
class BlocksDecompositionTree extends LitElement {
  @property({ type: Object }) decomposition: DecompositionSnapshot | null = null;
  @property({ type: Object }) nodeStates?: Record<string, NodeStateSnapshot>;
  // Keyed by task ID (LeafTaskSnapshot.id), NOT DagNode ID.
  // Use nodeStatesToTaskStates() (§7) to transform DagResultSnapshot.nodeStates.
  @property({ type: Object }) renderLeaf?: (node: LeafTaskSnapshot) => TemplateResult;
  @property({ type: Object }) renderMethod?: (method: DecompositionMethodSnapshot) => TemplateResult;
  @property({ attribute: 'selection-topic' }) selectionTopic: string = 'dag-node';
}
```

Render callbacks follow the component-customisation protocol (PP-20260713-8ea1af): typed config + optional render callbacks with sensible defaults. These are the extension points that enable PlanItemDefinition tree rendering later.

### 9.2 Visual hierarchy

Three node types at different nesting levels:

```
▼ CompoundTask: "process-claim"       selectedMethodIndex: 0
  │
  ├─ Method [1]: hybrid  guard: "hasHistory()"    ← selected, accent border
  │  ├─ ● LeafTask: "verify-identity"  executor: kyc-agent
  │  ├─ ● LeafTask: "score-risk"  executor: risk-scorer
  │  └─ ▼ CompoundTask: "assess-damages"
  │     └─ Method [1]: llm
  │        ├─ ● LeafTask: "photograph-analysis"
  │        └─ ● LeafTask: "cost-estimate"
  │
  └─ Method [2]: static  guard: "isNewCustomer()" ← unselected, opacity: 0.5, no children
```

**Unselected method children:** Unselected methods have `children: []`. The engine's `DecompositionStrategy` produces children only when invoked — unselected methods were never executed, so no children exist. The tree renders the method node (strategy badge + guard) but with no children underneath.

**CompoundTask**: Bold label, collapsible. Expand/collapse with click or arrow keys. Method count badge.

**DecompositionMethod**: Indented under compound task. Shows:
- Strategy badge — coloured pill with strategy name. See §9.3 for colours.
- Guard predicate — italic text, truncated at 40 chars with tooltip for full text.
- Selection highlight — when `selectedMethodIndex` is set, chosen method gets accent border, unselected methods get `opacity: 0.5`.

**LeafTask**: Terminal node. Shows:
- `●` marker
- Task description
- Executor name badge (accent pill)
- State badge via `<status-badge domain="node" .state=${nodeStates[leaf.id]?.kind?.toUpperCase()}>` when `nodeStates` is supplied and contains an entry for the leaf's `id`
- Rationale tooltip for LLM-planned tasks

### 9.3 Strategy badge colours

| Strategy | Colour | Rationale |
|----------|--------|-----------|
| `identity` | gray | No-op passthrough |
| `static` | blue | Deterministic rule-based |
| `forward-reasoning` | teal | SHOP-style forward projection |
| `llm` | purple | AI-driven |
| `hybrid` | indigo | Static + LLM fallback |
| `heuristic` | amber | Ranked method selection |
| `goal-oriented` | green | GOAP capability-based |
| `htn` | cyan | Composite HTN orchestration |
| _(unknown)_ | gray | Fallback for unrecognised strategies |

### 9.4 Keyboard navigation

ARIA `role="tree"` / `role="treeitem"` / `role="group"`:
- `↑`/`↓` — move focus between visible nodes
- `←` — collapse current node, or move to parent
- `→` — expand current node, or move to first child
- `Enter` — on a **leaf node**: emits `pages-event` on `selectionTopic` with `{ taskId }`. On a **compound task or method**: toggles expand/collapse (same as `→`/`←`). Only leaf nodes produce selection events — compound tasks and methods have no DAG counterpart.
- `Home`/`End` — first/last visible node

### 9.5 Tree ↔ DAG coordination

Both components use `taskId` as the shared identifier in selection events:

- **Tree → DAG:** Clicking a leaf emits `pages-event` on `selectionTopic` with `{ taskId: LeafTaskSnapshot.id }`. The DAG viewer receives this, resolves `taskId` → graph node ID via `taskIdToGraphNodeId` (§5), and highlights the corresponding node.
- **DAG → Tree:** Clicking a dag-node emits `pages-event` on `selectionTopic` with `{ taskId: DagNodeSnapshot.taskId }`. The tree receives this and highlights the matching leaf.

When both components share the same `selectionTopic` (default: `'dag-node'`), coordination is implicit via pages-event. `LeafTaskSnapshot.id` and `DagNodeSnapshot.taskId` are the same value — both represent the task's identity in the engine.

**Dashboard composition:** When multiple tree/DAG pairs coexist on a single page (e.g., the CasePlanModel dashboard in §10.2), each pair MUST use a distinct `selectionTopic` value (e.g., `'dag-node-plan-a'`, `'dag-node-plan-b'`). The default topic `'dag-node'` is shared — selection events from one pair would propagate to all other components listening on the same topic.

## 10. Dashboard Outline (deferred)

### 10.1 PlanItemDefinition tree

Same tree component pattern as `blocks-decomposition-tree`, different data shape and render callbacks. `CompoundPlanItem` nodes show `CompletionSemantics` badge (All / M-of-N / FirstWins) and `DispatchMode` pill (ORCHESTRATED / CHOREOGRAPHED). `PrimitivePlanItem` nodes show executor reference and entry condition. Types defined in §4.4.

### 10.2 CasePlanModel overview

Card-based dashboard: agenda (top plan items with status via pages-table), focus area + rationale, resource budget, sub-case list. Composition of existing primitives (status-badge, pages-table). Endpoint: `GET /api/v1/cases/{caseId}/plan-model`.

## 11. File Structure

```
packages/graph-stencil-htn/
  package.json
  tsconfig.json
  src/
    index.ts
    types/
      index.ts
      task-node.ts
      dag-plan.ts
      node-state.ts
      plan-item.ts
    adapter/
      dag-adapter.ts
      dag-adapter.test.ts
    stencils/
      dag-node.ts
      register.ts
      stencils.test.ts
    runtime/
      dag-runtime.ts
      dag-runtime.test.ts
      decoration.ts

components/blocks-dag-viewer/
  package.json
  tsconfig.json
  src/
    blocks-dag-viewer.ts
    blocks-dag-viewer.test.ts
    blocks-dag-toolbar.ts
    blocks-dag-toolbar.test.ts

components/blocks-decomposition-tree/
  package.json
  tsconfig.json
  src/
    blocks-decomposition-tree.ts
    blocks-decomposition-tree.test.ts
```

## 12. Testing Strategy

### graph-stencil-htn — adapter
1. Single-node DagPlan → node ID prefixed `dag:`, identified as both entry and exit
2. Single node, no dependencies → one GraphNode, no edges
3. Linear chain (A→B→C) → 3 nodes, 2 edges, correct direction
4. Diamond (A→B, A→C, B→D, C→D) → 4 nodes, 4 edges
5. JoinType preserved in node properties

### graph-stencil-htn — stencils
6. dag-node renders without decoration
7. dag-node renders with decoration (badge/border)
8. Join indicator shown only when `dependsOn.length > 1`
9. ALL_OF shows `∧`, ANY_OF shows `∨`
10. Skipped/Cancelled nodes get `opacity: 0.5`

### graph-stencil-htn — runtime
11. All 6 NodeStateKind values → correct `node:` domain decoration
12. dagToDecorations produces correct key format (`dag:${nodeId}`)
13. Empty nodeStates → empty map
14. Full DagResult → every node decorated

### blocks-dag-viewer
15. dagPlan null → empty state
16. dagPlan set → graph canvas rendered
17. dagResult set without dagPlan change → decoration-only update
18. Toolbar shows dispatch mode and node counts
19. Staleness badge at > 30s
20. Node click emits pages-event on selectionTopic

### blocks-decomposition-tree
21. Null decomposition → empty state
22. Single leaf → renders with description and executor badge
23. Compound with methods → collapsible tree
24. Nested compounds → correct recursive depth
25. Strategy badges for all 8 strategies + unknown fallback
26. Guard text truncated at 40 chars
27. selectedMethodIndex highlights chosen method
28. Keyboard navigation (arrows, expand/collapse, Home/End)
29. ARIA tree/treeitem/group roles
30. Node click emits pages-event
31. renderLeaf callback overrides default
32. renderMethod callback overrides default
33. nodeStates supplied → status badges rendered on matching leaves
34. nodeStates with missing key → no badge on unmatched leaf (graceful absence)

## 13. Prerequisite: Local `toDecoration` in graph-stencil-htn

`toDecoration(domain, state)` and `BADGE_COLORS` currently live in `graph-stencil-case/src/runtime/decoration.ts`. graph-stencil-htn needs the same function but should not depend on graph-stencil-case (parallel packages) or push graph concerns into blocks-ui-core (#109 explicitly decided against this — `NodeDecoration` is defined in `@casehubio/graph-core`, which blocks-ui-core does not depend on).

**Action:** Duplicate `toDecoration` and `BADGE_COLORS` in `graph-stencil-htn/src/runtime/decoration.ts`. The function is 15 lines of pure logic; the colour map is 9 lines. Both import `lookupStatus` from `@casehubio/blocks-ui-core` and `NodeDecoration` from `@casehubio/graph-core` — the same dependencies graph-stencil-case uses.

This preserves layering: blocks-ui-core stays graph-unaware, graph-stencil-case and graph-stencil-htn remain parallel peers, and the duplication is trivially small.

## 14. Dependencies

**Consumes from pages (all available):**
- `GraphModel`, `GraphNode`, `GraphEdge`, `NodeDecoration`, `StencilGrammar` from `@casehubio/graph-core`
- `StencilTemplate`, `registerStencil`, `toReactFlowGraph` from `@casehubio/graph-renderer`
- `computeElkLayout` from pages ELK integration
- `pages-graph-canvas` web component

**Consumes from blocks-ui-core:**
- `lookupStatus`, `registerStatus` from status registry
- `StatusBadge` for leaf task state display in the tree

**Local to graph-stencil-htn (§13):**
- `toDecoration`, `BADGE_COLORS` — duplicated from graph-stencil-case pattern, imports `lookupStatus` from blocks-ui-core and `NodeDecoration` from graph-core

**No runtime dependency on engine.** TypeScript types are manual mirrors of Java types. If the engine adds new states, the TypeScript types must be updated manually.
