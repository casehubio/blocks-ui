# Phase 7 — Runtime Overlay

**Date:** 2026-08-04
**Issue:** #103 (Epic: Visual Diagram Editor — Domain Layer)
**Status:** Approved
**Parent spec:** `specs/2026-08-01-visual-diagram-editor-design.md` (parent workspace)
**Depends on:** Phase 4 (structural editing — completed), pages#277 (NodeDecoration types), pages decoration rendering pipeline

---

## 1. Goal

Project live execution state (TaskStatus badges, milestone progression) onto the definition-time graph as visual decorations. Property-based data delivery — the component receives runtime state as a property, the host application owns data transport. Includes stencil API migration to the new pages graph-renderer contract as a prerequisite.

**Divergence from parent spec:** The parent spec (§2.7, §4 Phase 7) specifies a `PushSource`-based data source owned by the diagram component. This spec uses property-based delivery instead. Rationale: every other blocks-ui component receives data as properties — the host application owns transport (REST, SSE, WebSocket). Embedding a specific transport mechanism in the diagram breaks this pattern and couples the component to a server contract. Property-based delivery keeps the component pure, testable, and transport-agnostic. The host can use `EventStreamController`, REST polling, or any other mechanism to populate the property.

## 2. Scope

**In scope:**
- Stencil API migration to new pages graph-renderer contract
- `runtimeState` property on `casehub-diagram`
- `RuntimeAdapter`: `CaseRuntimeState` → `Map<string, NodeDecoration>`
- TaskStatus badges (all 9 states) with active-worst-first aggregation
- MilestoneLifecycleStatus indicators (3 states: PENDING, ACTIVE, COMPLETED — parent spec §2.7 lists 5 states but the engine enum has 3; the engine is authoritative)
- Design ↔ Runtime mode toggle in toolbar
- Staleness indicator when runtime data is old

**Out of scope (follow-on work):**
- Heatmap colouring (usage frequency — separate data source)
- Active binding highlighting (planning strategy state — separate data source)
- CaseContext data preview on hover
- SWF drill-down (Phase 5 — blocked on @openworkflowspec/sdk)

## 3. Stencil API Migration

Prerequisite for decoration support. All case stencils migrate from the old pages API to the new contract.

### 3.1 Registration change

Old pattern (separate grammar + node type registration):

```typescript
import { registerGrammar } from '@casehubio/graph-core';
import { registerNodeType } from '@casehubio/graph-renderer';
import { createReactNodeType } from '../bridge/create-react-node-type.js';

registerGrammar(bindingGrammar);
registerNodeType({
  type: bindingGrammar.type,
  component: createReactNodeType(renderBinding),
});
```

New pattern (single `StencilDescriptor` registration):

```typescript
import { registerStencil } from '@casehubio/graph-renderer';

registerStencil({
  type: 'binding',
  label: 'Binding',
  icon: 'link',
  grammar: bindingGrammar,
  properties: bindingSchema,
  render: renderBinding,
});
```

Grammar auto-registered by pages. `properties` carries the JSON Schema for the property panel.

### 3.2 Render function signature change

All five stencils (binding, worker, milestone, goal, subcase):

```typescript
// Before
export function renderBinding(data: Record<string, unknown>): TemplateResult

// After
export function renderBinding(node: GraphNode, decoration?: NodeDecoration): StencilTemplate
```

The body stays the same — `data` becomes `node.properties`. The `decoration` parameter is ignored during the migration step; the runtime overlay implementation (§5–§6) wires it up.

### 3.3 Deleted files

- `packages/graph-stencil-case/src/bridge/create-react-node-type.tsx` — replaced by pages `createStencilNodeComponent`
- `packages/graph-stencil-case/src/adapter/react-flow-transform.ts` — replaced by pages `toReactFlowGraph`

### 3.4 casehub-diagram changes

Delete local `react-flow-transform.ts` import. Use `toReactFlowGraph` from `@casehubio/graph-renderer`, which accepts the optional decorations map.

## 4. Runtime State Property

### 4.1 Type contract

```typescript
type TaskStatus = 'PENDING' | 'RUNNING' | 'DELEGATED' | 'SUSPENDED'
  | 'COMPLETED' | 'FAULTED' | 'REJECTED' | 'OBSOLETE' | 'CANCELLED';

type MilestoneLifecycleStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED';

interface PlanItemSnapshot {
  readonly id: string;
  readonly bindingName: string;
  readonly status: TaskStatus;
  readonly createdAt: string;  // ISO 8601
}

interface MilestoneSnapshot {
  readonly name: string;
  readonly status: MilestoneLifecycleStatus;
}

interface CaseRuntimeState {
  readonly planItems: readonly PlanItemSnapshot[];
  readonly milestones: readonly MilestoneSnapshot[];
  readonly timestamp: string;  // ISO 8601 — when this snapshot was produced
}
```

### 4.2 Property on casehub-diagram

`runtimeState: CaseRuntimeState | null` — null = design mode only, present = runtime mode available.

The component does not own data transport. The host application (or `hostPanel` integration) is responsible for fetching runtime state via REST, SSE, or any other mechanism, and passing it in as a property.

## 5. RuntimeAdapter

Pure function in `graph-stencil-case`:

```typescript
function toDecorations(state: CaseRuntimeState): ReadonlyMap<string, NodeDecoration>
```

### 5.1 PlanItem aggregation (active-worst-first)

1. Group PlanItems by `bindingName`
2. Per binding:
   - If any PlanItem is in an active state, show the worst active status. Priority: SUSPENDED > DELEGATED > RUNNING > PENDING
   - If all PlanItems are terminal, show the most recent terminal status (by `createdAt`). Tiebreaker when timestamps match: highest severity wins — FAULTED > REJECTED > CANCELLED > OBSOLETE > COMPLETED
   - `badge.count` = total PlanItems for this binding when count > 1
   - `tooltip` = full breakdown (e.g., `"5 plan items: 3 completed, 1 running, 1 faulted"`)
3. Map binding name to node ID: `binding:<name>`

### 5.2 Milestone mapping

Map milestone name to node ID `milestone:<name>`, apply status badge. Milestones are always 1:1 — one MilestoneSnapshot per milestone name. No aggregation needed (unlike PlanItems which are many-to-one per binding).

### 5.3 TaskStatus → NodeDecoration

| Status | Icon | Color | Pulse | Border |
|--------|------|-------|-------|--------|
| PENDING | `○` | `#9ca3af` (gray) | no | — |
| RUNNING | `▶` | `#22c55e` (green) | yes | solid green |
| DELEGATED | `→` | `#3b82f6` (blue) | no | solid blue |
| SUSPENDED | `⏸` | `#eab308` (yellow) | no | solid yellow |
| COMPLETED | `✓` | `#22c55e` (green) | no | — |
| FAULTED | `!` | `#ef4444` (red) | no | — |
| REJECTED | `✕` | `#f97316` (orange) | no | — |
| OBSOLETE | `—` | `#9ca3af` (gray) | no | — |
| CANCELLED | `/` | `#9ca3af` (gray) | no | — |
| *(unknown)* | `?` | `#9ca3af` (gray) | no | — |

Active states (RUNNING, DELEGATED, SUSPENDED) set `border` to make the node visually distinct even without reading the badge. The unknown fallback handles future TaskStatus values added to the engine before the TypeScript union is updated.

**Active vs terminal classification:** Active states are PENDING, RUNNING, DELEGATED, SUSPENDED. Terminal states are COMPLETED, FAULTED, REJECTED, OBSOLETE, CANCELLED. PENDING is active (lowest priority in the worst-first ordering) but does not get a border — it represents defined-but-not-started work, which is visually quiet.

For OBSOLETE, the stencil render function additionally applies reduced opacity (`0.5`) to the node content — the one case where `decoration` is read inside the render function.

### 5.4 MilestoneLifecycleStatus → NodeDecoration

| Status | Icon | Color | Pulse |
|--------|------|-------|-------|
| PENDING | `○` | `#9ca3af` (gray) | no |
| ACTIVE | `◉` | `#3b82f6` (blue) | yes |
| COMPLETED | `✓` | `#22c55e` (green) | no |

### 5.5 Aggregation tooltip format

When multiple PlanItems exist for a binding:

```
"5 plan items: 3 completed, 1 running, 1 faulted"
```

Single PlanItem: tooltip shows just the status name.

## 6. casehub-diagram Integration

### 6.1 Mode toggle

`casehub-diagram-toolbar` new properties:
- `runtimeAvailable: boolean` — shows/hides the mode toggle button. Derived from `runtimeState !== null`.

New event: `toolbar-mode-change` — `{ mode: 'design' | 'runtime' }` — `composed: true, bubbles: true`.

New internal state on `casehub-diagram`:
- `_mode: 'design' | 'runtime'` — defaults to `'design'`. Switches to `'runtime'` when the user toggles and `runtimeState` is present. Reverts to `'design'` only when `runtimeState` is explicitly set to `null` by the host — not on transient absence during refetch. Implementation: the `updated()` lifecycle checks `changedProperties.has('runtimeState')` AND `this.runtimeState === null` before reverting.

### 6.2 Decoration flow

```
runtimeState property set
  → toDecorations(runtimeState)                    [RuntimeAdapter — pure function]
  → Map<string, NodeDecoration>
  → toReactFlowGraph(model, layout, decorations)   [pages graph-renderer]
  → React Flow nodes with _decoration in data
  → createStencilNodeComponent renders badges/borders/overlays
```

When `_mode === 'design'` or `runtimeState` is null, `decorations` is omitted from the `toReactFlowGraph` call — no badges, no overlays.

When `_mode === 'runtime'`, `toDecorations()` runs on every `runtimeState` change. Pure function over a readonly snapshot — fast, no async concerns.

**Decoration timing relative to layout:** Decorations are applied AFTER `computeElkLayout()` completes, not before. The flow is: `toGraph()` → `computeElkLayout(nodes, edges)` → `toReactFlowGraph(model, layout, decorations)`. Since `computeElkLayout` is async (ELK runs in a Web Worker), `runtimeState` may change while layout is in progress. The render guard from Phase 4 (§7.4) already handles this — if `_currentYaml` changes during a render, a follow-up render runs. The same guard applies to decoration changes: if `runtimeState` changes during layout, the post-render check detects the stale decoration map and re-runs `toReactFlowGraph` with the current decorations (no re-layout needed — only the decoration map changes).

Decoration-only updates (runtimeState changes without YAML changes) skip `computeElkLayout` entirely — node positions are unchanged, only the decoration map passed to `toReactFlowGraph` differs. This is the `_updateWithoutLayout` path extended to also accept decorations.

### 6.3 Staleness

`CaseRuntimeState.timestamp` is compared against current time. If older than 30 seconds (configurable), a staleness indicator appears in the toolbar — a muted badge next to the mode toggle: `⚠ stale (45s ago)`.

No timer or polling — staleness is re-evaluated on each `runtimeState` update and on `_mode` change. If the host stops providing updates, the last staleness check freezes at whatever age it showed when the last update arrived. This is intentional: the component does not own the data lifecycle and adding a `setInterval` to tick the staleness counter would couple the component to wall-clock time for a cosmetic indicator. The staleness badge is a signal that the data WAS stale at the time of the last update — if no updates arrive at all, the host's connection status (outside this component) is the authoritative indicator.

### 6.4 Editing in runtime mode

All editing capabilities (property panel, palette, delete, save) remain active in runtime mode. The overlay is purely visual — badges and borders on top of the editable graph. No separate readonly runtime view.

## 7. File Structure

### New files

```
packages/graph-stencil-case/
  src/
    runtime/
      runtime-adapter.ts             ← toDecorations() pure function
      runtime-adapter.test.ts
      badge-mappings.ts              ← TaskStatus/MilestoneLifecycleStatus → NodeDecoration lookup
      types.ts                       ← CaseRuntimeState, PlanItemSnapshot, MilestoneSnapshot, enums
```

### Modified files

```
packages/graph-stencil-case/
  src/
    stencils/
      binding.ts                     ← render signature, OBSOLETE opacity
      worker.ts                      ← render signature
      milestone.ts                   ← render signature
      goal.ts                        ← render signature
      subcase.ts                     ← render signature
      register.ts                    ← registerStencil() with StencilDescriptor
      index.ts                       ← updated exports
    index.ts                         ← export runtime module

components/casehub-diagram/
  src/
    casehub-diagram.ts               ← runtimeState property, _mode, decoration flow, staleness
    casehub-diagram-toolbar.ts       ← runtimeAvailable, mode toggle, staleness badge
    casehub-diagram-toolbar.test.ts  ← mode toggle tests
```

### Deleted files

```
packages/graph-stencil-case/
  src/
    bridge/create-react-node-type.tsx
    adapter/react-flow-transform.ts
    adapter/react-flow-transform.test.ts
```

## 8. Testing Strategy

1. **RuntimeAdapter — toDecorations()**: Single PlanItem per binding → correct badge. Multiple PlanItems → active-worst-first picks worst active. All terminal → most recent by createdAt. Count and tooltip format. Empty input → empty map.
2. **Badge mappings**: Each of 9 TaskStatus values → correct icon/color/pulse/border. Each of 3 MilestoneLifecycleStatus values → correct mapping. Border set for active states only.
3. **Stencil render signature**: Each stencil renders without decoration (backward compat). Each stencil renders with decoration (OBSOLETE opacity test). Verify `node.properties` access matches old `data` access.
4. **casehub-diagram mode toggle**: runtimeState null → no toggle button. runtimeState set → toggle appears. Toggle emits mode change. Design mode → no decorations passed. Runtime mode → decorations passed to toReactFlowGraph.
5. **Staleness**: Timestamp 5s ago → no indicator. Timestamp 45s ago → stale indicator shown. runtimeState becomes null → reverts to design mode.
6. **Registration migration**: registerStencil called for all 5 types. Grammar auto-registered. Old createReactNodeType/registerNodeType not referenced.

## 9. Dependencies

**Consumes from pages (all available):**
- `NodeDecoration` from `@casehubio/graph-core`
- `StencilRenderFn`, `StencilDescriptor`, `createStencilNodeComponent`, `registerStencil`, `toReactFlowGraph` from `@casehubio/graph-renderer`

**Consumes from engine (type reference only — no runtime dependency):**
- `TaskStatus` enum values (9 states) — replicated as TypeScript string union
- `MilestoneLifecycleStatus` enum values (3 states) — replicated as TypeScript string union

No runtime dependency on engine. The TypeScript string unions match the Java enum constant names. If the engine adds new states, the TypeScript types must be updated manually.
