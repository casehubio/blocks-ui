# Case Dependency Graph — Design Spec

**Issue:** casehubio/blocks-ui#118
**Date:** 2026-08-08
**Status:** Reviewed (light — coherence, structure, robustness, cross-cutting)

## Context

Moved from casehubio/devtown#120 (governance workbench gap analysis #85). gastown-viewer-intent has a D3.js force-directed `DependencyGraph` React component for beads/issues. The CaseHub equivalent shows case-to-case relationships as a domain-agnostic blocks-ui component, reusable across all CaseHub applications.

### Why force-directed, not tree or ELK

Case relationships include non-hierarchical edges that cross tree boundaries:

| Relationship | Hierarchical? | Tree can show? |
|---|:---:|:---:|
| parent/child | Yes | Yes |
| supersedes | No — peer replacement | No |
| coordination | No — cross-repo links | No |
| blocks/blocked_by | No — dependency | No |
| relates_to | No — association | No |

`entity-tree` in case-explorer handles parent/child. Force-directed layout reveals clusters and cross-cutting connection patterns that hierarchical layout cannot represent.

### Why D3 SVG, not ReactFlow via pages-graph-canvas

`pages-graph-canvas` wraps ReactFlow with ELK layout — designed for static, directed diagrams (case definitions, SWF workflows, DAG plans). Force-directed simulation needs direct SVG manipulation for animated convergence and drag-to-rebalance. At the graph sizes involved (5–200 nodes), the simulation converges quickly and the animation gives the user a sense of the graph structure forming. ReactFlow adds React reconciliation overhead with no benefit for this use case.

### Why not DataSourceMixin

DataSourceMixin produces `TypedDataSet` — a tabular model (rows × columns). Graph data is nodes + edges, which is structurally non-tabular. Forcing graph data through TypedDataSet would require either two datasets (one for nodes, one for edges) or a flattened representation that loses the graph semantics. Instead, the component uses a direct fetch pattern (like blocks-timeline's raw JSON access mode), fetching JSON and deserializing to `GraphModel` directly.

## Data Model

### Graph data — reuses graph-core

The component consumes `GraphModel` from `@casehubio/graph-core` directly. No parallel type system.

```typescript
import type { GraphModel, GraphNode, GraphEdge } from '@casehubio/graph-core';
```

Reminder of graph-core types:

```typescript
interface GraphNode {
  readonly id: string;
  readonly type: string;
  readonly parentId?: string;
  readonly properties: Readonly<Record<string, unknown>>;
}

interface GraphEdge {
  readonly id: string;
  readonly type: string;
  readonly source: string;
  readonly target: string;
  readonly properties?: Readonly<Record<string, unknown>>;
}

interface GraphModel {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}
```

**Case-specific conventions** (stored in `properties`):

| Field | Location | Description |
|-------|----------|-------------|
| `label` | `node.properties.label` | Display label |
| `status` | `node.properties.status` | Status string for status registry lookup |
| `domain` | `node.properties.domain` | Status registry domain (default: `'case'`) |

Edge `type` is looked up in the relationship type registry. Edge `id` can be `${source}-${type}-${target}`.

**Input validation:** `GraphModel` edges reference node IDs via `source`/`target`. On data load, edges with dangling references (source or target not in the node set) are silently dropped. graph-core's `validator` module can be used if available, otherwise a simple `Set<string>` membership check.

### Relationship type registry

Lives in **blocks-ui-core** alongside `registerStatus`/`lookupStatus`. Same pattern — module-level registry, no deregistration (matches status registry precedent).

```typescript
// In @casehubio/blocks-ui-core

interface RelationshipTypeDescriptor {
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
  directed: boolean;
  label?: string;
}

function registerRelationshipType(type: string, descriptor: RelationshipTypeDescriptor): void;
function lookupRelationshipType(type: string): RelationshipTypeDescriptor;
const FALLBACK_RELATIONSHIP: RelationshipTypeDescriptor;
```

Built-in types (registered at module load, not on component connection):

| Type | Color | Style | Directed | Label |
|------|-------|-------|----------|-------|
| `parent_child` | `--pages-neutral-9` | solid | yes | Parent/Child |
| `supersedes` | `#f59e0b` (amber) | solid | yes | Supersedes |
| `coordination` | `--pages-accent-9` | dashed | yes | Coordination |

Consuming apps register additional types:

```typescript
import { registerRelationshipType } from '@casehubio/blocks-ui-core';

registerRelationshipType('blocks', {
  color: '#ef4444', style: 'solid', directed: true, label: 'Blocks'
});
```

`FALLBACK_RELATIONSHIP` (neutral, dotted, directed) is returned for unknown types.

## Component Architecture

### Package structure

```
components/case-dependency-graph/
├── src/
│   ├── blocks-case-dependency-graph.ts   — main Lit component
│   ├── blocks-dependency-toolbar.ts      — toolbar sub-component
│   ├── force-layout.ts                   — D3 force simulation setup + lifecycle
│   ├── graph-renderer.ts                 — D3 SVG node/edge rendering
│   ├── dot-export.ts                     — GraphModel → DOT string
│   └── types.ts                          — component-local types (SimNode, SimLink)
├── package.json
└── tsconfig.json
```

**Module interfaces:**

- `force-layout.ts` exports `createSimulation(nodes, edges, width, height): Simulation` and `stopSimulation(sim): void`. The simulation is an opaque handle returned to the component for lifecycle management.
- `graph-renderer.ts` exports `renderGraph(container, nodes, edges, options): void` and `clearGraph(container): void`. Takes a `<g>` SVG element, creates D3 selections for nodes/edges. `options` includes `renderNode` and `renderTooltip` callbacks, status lookup, and relationship registry lookup.
- `dot-export.ts` exports `toDOT(model: GraphModel): string`. Uses the global relationship type registry for edge labels/styles.

### Dependencies

- `lit` — component framework
- `d3-force`, `d3-selection`, `d3-zoom`, `d3-drag` — force simulation + SVG rendering (tree-shakeable D3 modules, not the full d3 bundle)
- `@casehubio/blocks-ui-core` — status registry, relationship type registry, event helpers, pages-ui-tokens
- `@casehubio/graph-core` — `GraphModel`, `GraphNode`, `GraphEdge` types

### Data delivery — dual mode

| Mode | Trigger | Behaviour |
|------|---------|-----------|
| Endpoint | `endpoint` property set | Direct fetch → JSON → `GraphModel`. Not DataSourceMixin (see §Why not DataSourceMixin). |
| Property | `graphData` property set | Accepts `GraphModel` directly, skips fetch |

When both are set, `graphData` takes precedence. Consistent with dual-data pattern across the repo.

### States

| State | Renders |
|-------|---------|
| Loading | Centered spinner (endpoint mode only) |
| Error | Error message with retry button |
| Empty | "No graph data" message (0 nodes after validation) |
| Data | SVG graph |

### Selection topic

`selection-topic` attribute, defaults to `'case-graph'`. Node click emits `emitPagesEvent(this, '${selectionTopic}:selected', { id })`. Payload is `{ id: string }` only — consistent with blocks-dag-viewer.

### Render callbacks (per PP-20260713-8ea1af)

- `renderNode?: (node: GraphNode) => SVGElement | undefined` — custom node SVG. Called once per node when data changes (not per simulation tick). D3 moves the parent `<g>` on each tick; the callback's element is a child of that `<g>`. When absent or returns undefined, the default rect+label rendering is used. The component owns cleanup — `clearGraph()` removes all D3-created elements before re-rendering.
- `renderTooltip?: (node: GraphNode) => string` — custom tooltip text. Default: `"${properties.label}\nStatus: ${properties.status}"`.

These callbacks return raw SVG elements (not Lit templates) since D3 operates on raw DOM. The PP-20260713-8ea1af inline-styles rule does not apply — D3 renders into a raw SVG element owned by the component, not across shadow roots.

### Accessibility

The SVG element has `role="img"` and an `aria-label` summarizing the graph (e.g., "Case dependency graph: 12 cases, 15 relationships"). Keyboard navigation within the graph is deferred — not in initial scope. The toolbar controls are standard HTML and keyboard-accessible.

## D3 Force Simulation

### Simulation forces

- `d3.forceLink(edges)` — edge attraction, distance ~150
- `d3.forceManyBody()` — node repulsion, strength ~-400
- `d3.forceCenter(width/2, height/2)` — center gravity
- `d3.forceCollide()` — prevent overlap, radius ~50

### Lifecycle

- **Data change:** stop existing simulation (`stopSimulation`), clear SVG (`clearGraph`), create new simulation and render.
- **disconnectedCallback:** stop simulation, clear SVG. Prevents leaked timers.
- **Visibility:** no special handling — simulation naturally decays to zero alpha.
- **Concurrent drag + filter:** edge filter toggles update the link force's edges array and restart at low alpha (`alphaTarget(0.1)`). Node `<g>` elements are never removed by filtering — only `<line>` elements are shown/hidden. A node being dragged keeps its `fx`/`fy` pins through a filter toggle.

### SVG structure

```
<svg role="img" aria-label="Case dependency graph: {N} cases, {M} relationships">
  <defs>
    <marker id="arrow-{type}">    ← one per relationship type, colored
  </defs>
  <g class="container">           ← zoom/pan transform target
    <g class="edges">
      <line per edge>             ← stroke from registry descriptor
    </g>
    <g class="nodes">
      <g per node>                ← translate(x, y) on each tick
        <rect>                    ← fill from lookupStatus(domain, status)
        <text>                    ← label, truncated
      </g>
    </g>
  </g>
</svg>
```

### Interaction

- **Zoom/pan:** `d3.zoom()` on SVG, transforms the container `<g>`
- **Drag:** `d3.drag()` on nodes. Drag start pins node (`fx`/`fy`), restarts simulation at low alpha. Drag end releases pin.
- **Click:** emits selection topic event
- **Hover:** tooltip (native `<title>` element or custom via `renderTooltip`)

### Theming

Node fill colors from `lookupStatus(node.properties.domain ?? 'case', node.properties.status)` which returns a `StatusDescriptor` with `category`. Category maps to `stateCategoryStyles` colors from blocks-ui-core. Edge colors from the relationship type registry. Falls back to `--pages-*` CSS custom properties for neutrals.

### Edge type filtering

Toolbar passes `selectedEdgeTypes: Set<string>` as a typed property to the main component. Toggling a type updates the set. The component re-filters the link force's edges array and restarts the simulation at low alpha. Nodes are unaffected — orphaned nodes remain visible. On data change, the selected set resets to include all types present in the new data.

## Toolbar

`blocks-dependency-toolbar` — sub-component, communicates via typed properties (not events):

**Inputs (from parent):**
- `edgeTypes: Array<{ type: string, count: number }>` — types present in data, with counts
- `selectedTypes: Set<string>` — currently active types
- `nodeCount: number`
- `edgeCount: number`

**Outputs (to parent via pages-event):**
- `dependency-toolbar:filter-change` → `{ selectedTypes: Set<string> }`
- `dependency-toolbar:refresh` → `{}`
- `dependency-toolbar:export-dot` → `{}`

**Renders:**
- Edge type filter checkboxes with colored badges (color from registry)
- Stats: node count, edge count
- Refresh button
- Export DOT button

## DOT Export

```typescript
function toDOT(model: GraphModel): string
```

Uses the global relationship type registry (`lookupRelationshipType`) for edge labels and styles. Produces Graphviz DOT digraph (or graph for undirected edges) with node labels from `properties.label`, status as a node attribute, edge types as labels. Undirected relationship types (`directed: false`) emit `--` edges within a subgraph.

Output is valid for `dot -Tsvg` rendering.

Exposed two ways:
- **Programmatic:** `element.exportDOT(): string` method on the component
- **UI:** toolbar button triggers browser file download of `dependencies.dot`

DOT export always includes all edges regardless of the current edge type filter state.

## Consumer API Summary

```html
<!-- Endpoint mode -->
<blocks-case-dependency-graph
  endpoint="/api/v1/cases/graph"
  selection-topic="case-graph"
></blocks-case-dependency-graph>

<!-- Property mode (inline data or tests) -->
<blocks-case-dependency-graph
  .graphData=${myGraphModel}
  .renderNode=${customNodeFn}
  .renderTooltip=${customTooltipFn}
  selection-topic="case-graph"
></blocks-case-dependency-graph>
```

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `endpoint` | `string` | — | REST endpoint returning `GraphModel` JSON |
| `graphData` | `GraphModel` | — | Inline data (takes precedence over endpoint) |
| `selectionTopic` | `string` | `'case-graph'` | Event topic for node selection |
| `renderNode` | `(node: GraphNode) => SVGElement \| undefined` | — | Custom node rendering (called once per data change, not per tick) |
| `renderTooltip` | `(node: GraphNode) => string` | — | Custom tooltip content |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `exportDOT()` | `string` | Full graph as DOT string (ignores edge filter state) |
| `refresh()` | `void` | Re-fetch (endpoint) or re-simulate (property) |

### Events (via pages-event)

| Event | Payload | When |
|-------|---------|------|
| `${selectionTopic}:selected` | `{ id: string }` | Node clicked |

## What This Is Not

- Not a case editor — read-only visualization
- Not a replacement for entity-tree — entity-tree is for hierarchical browsing of one entity's descendants; this shows the whole landscape of cross-cutting relationships
- Not devtown-specific — generic to any CaseHub application; devtown registers its own relationship types
