# SWF Diagram — Complete graph-stencil-swf and Wire Into Editor

**Date:** 2026-08-05
**Issue:** #106 (Epic: Serverless Workflow diagram)
**Status:** Approved
**Depends on:** #103 Phases 0–7 (completed), `@openworkflowspec/sdk@0.0.1` (published)

---

## 1. Goal

Complete the SWF diagram support that was planned as Phase 5 of #103 but deferred. The `graph-stencil-swf` package exists as a stub — empty adapter, two stencil descriptors, no tests. `@openworkflowspec/sdk` is now published, unblocking this work.

**Deliverables:**
1. SWF adapter — parse SWF YAML via SDK, produce GraphModel + yamlPaths
2. SWF stencils — render functions for engine-supported step types + generic fallback
3. diagram-core package — new `packages/diagram-core/` with DiagramBaseMixin and shared sub-components (toolbar, properties)
4. swf-diagram — standalone canvas component for SWF workflows
5. Worker thumbnail — miniaturised SWF preview on worker nodes in case diagram
6. Drill-down — event-based navigation from case diagram workers into swf-diagram

**Editing scope:** Read-only + property editing. No structural editing (add/remove steps) in this epic.

## 2. Architecture Overview

```
SWF YAML string
  → yaml.parse() → raw object
  → new Workflow(raw) → SDK Workflow
  → buildFlatGraph(workflow, true) → SDK FlatGraph (ports removed)
  → mapToGraphModel() → { model: GraphModel, yamlPaths: Map }
  → toReactFlowGraph() → React Flow Node[] + Edge[]
  → computeElkLayout() → positioned Node[]
  → <pages-graph-canvas> renders with registered SWF stencil node types
```

Progressive disclosure for SWF content within case diagrams:
- **Thumbnail** — miniaturised SVG preview on worker nodes with `do:` blocks
- **Inline expand** — worker node grows to show a readable SWF graph in-place
- **Full open** — `swf-diagram` component opens as its own canvas via `diagram:worker-drill-down` event

## 3. Layer 1 — SWF Adapter

**File:** `packages/graph-stencil-swf/src/adapter/swf-adapter.ts`

### 3.1 Interface

```typescript
import type { AdapterResult } from '@casehubio/graph-core';

export function toSwfGraph(yaml: string): AdapterResult;
```

Returns `AdapterResult` from graph-core — the shared type for all domain adapters:

```typescript
export interface AdapterResult {
  readonly model: GraphModel;
  readonly yamlPaths: ReadonlyMap<string, readonly (string | number)[]>;
  readonly degraded?: { readonly reason: string };
}
```

The case adapter's existing `AdapterResult` is promoted to graph-core; both adapters import from the same source. The optional `degraded` field signals that the graph was produced successfully but yamlPaths accuracy cannot be guaranteed — property editing should be disabled. Hard failures (YAML parse errors, SDK validation errors) still throw; `degraded` is for integrity warnings where the graph is valid but editing is unsafe.

The existing `SwfAdapter` class and `DomainAdapter` interface (phantom types — never exported by graph-core) are dropped. The stub's TODOs for SDK parsing (swf-adapter.ts:5) and edit application (swf-adapter.ts:11) are addressed by this section and §6.5 respectively.

### 3.2 Dual YAML Walk

Two parallel walks of the same YAML:

1. **SDK path**: Parse YAML to raw object, hydrate as `Workflow`, call `buildFlatGraph(workflow, true)` (ports removed). Produces `FlatGraphNode[]` and `GraphEdge[]` with typed nodes and flow edges.
2. **YAML path**: `parseDocument()` from the `yaml` library walks the `do:` task list to build `yamlPaths` — a `Map<nodeId, (string|number)[]>` mapping each node ID to its YAML CST path.

#### 3.2.1 SDK Node ID Contract

The SDK generates path-based node IDs from the task reference path. The format is `/{listRef}/{index}/{taskName}`, built recursively for nested structures:

- Top-level task "fetchData" at index 0: `/do/0/fetchData`
- Nested task inside a try block: `/do/1/myTry/try/do/0/innerStep`
- Fork branch: `/do/2/myFork/fork/branches/0/branchStep`

Duplicate task names at different nesting levels are disambiguated by their path prefix. Within a single `do:` array, task names must be unique (each `do:` item is a single-key object). This is enforced by the SWF spec itself.

The YAML walker replicates this path construction by descending the CST in the same order as the SDK: `do:` → index → task name → recurse into `try/do`, `for/do`, `fork/branches`, `catch/do`.

**ID format validation:** The adapter's unit tests (§9, step 1) must include at least one integration test that exercises `buildFlatGraph()` against a representative SWF YAML fixture and asserts the documented ID format. This test serves as the empirical foundation for the ID contract and as a canary for SDK upgrades that change ID generation. The test should validate: (a) IDs match `/{listRef}/{index}/{taskName}` format, (b) IDs are deterministic across repeated calls, (c) the YAML walker produces the same ID set as the SDK for the same fixture.

#### 3.2.2 Integrity Assertion

`toSwfGraph()` asserts after both walks complete. The assertion excludes **synthetic boundary nodes** — `start`/`end` (root workflow markers) and `entry`/`exit` (sub-graph markers) — because these are generated by the SDK's `buildFlatGraph()` and have no corresponding YAML source. They are not task items in the `do:` array and have no editable properties.

```typescript
const SYNTHETIC_TYPES = new Set(['start', 'end', 'entry', 'exit']);

const taskNodes = model.nodes.filter(n => !SYNTHETIC_TYPES.has(n.type));
let degraded: { reason: string } | undefined;

if (yamlPaths.size !== taskNodes.length) {
  degraded = {
    reason: `yamlPaths/model mismatch: ${yamlPaths.size} paths for ${taskNodes.length} task nodes`,
  };
} else {
  for (const node of taskNodes) {
    if (!yamlPaths.has(node.id)) {
      degraded = { reason: `No YAML path for task node '${node.id}'` };
      break;
    }
  }
}

return { model: prefixedModel, yamlPaths, degraded };
```

Note: the filter uses unprefixed SDK types (`start`, not `swf-start`) because the assertion runs **before** the adapter applies the `swf-` prefix. The model at this point still has raw SDK type values; prefixing happens in `mapToGraphModel()` after the assertion passes.

When `degraded` is set, the adapter still returns a valid `GraphModel` — the graph renders normally (layout and stencils work from the model alone). The mixin checks `_adapterResult?.degraded` and enters **degraded read-only mode**: the property panel is disabled and a warning banner shows "Property editing unavailable — YAML path sync error." This prevents `applySwfPropertyEdit()` from targeting wrong YAML locations. Hard failures (YAML parse errors, SDK validation errors) still throw and are caught by the mixin's `_error` pipeline (§5.1.3).

The integrity check functions as a canary for SDK upgrades that change ID generation — a mismatch surfaces immediately on first render rather than silently corrupting YAML on property edit.

### 3.3 Type Mapping

**SDK FlatGraphNode → casehub GraphNode:**

| SDK field | casehub field |
|---|---|
| `id` | `id` |
| `type` (GraphNodeType enum) | `type` (string — prefixed as `swf-${sdkType}`) |
| `parentId` | `parentId` |
| `label` | `properties.label` |
| `task` (parsed Task) | Spread into `properties` |

**SDK GraphEdge → casehub GraphEdge:**

| SDK field | casehub field |
|---|---|
| `id` | `id` |
| `sourceId` | `source` |
| `targetId` | `target` |
| `label` | `properties.label` (if present) |

Edge `type` is derived: `'flow'` for sequential edges, `'switch-case'` for edges originating from a switch node.

The adapter prefixes SDK type values with `swf-` to namespace them in the shared stencil registry (e.g., SDK `call` → casehub `swf-call`). This avoids collisions with case stencil types and future marketplace work stencil types. The `swf-` prefix is consistent with the existing stub convention (`swf-call`, `swf-switch`). Case stencils remain unprefixed as the founding domain.

### 3.4 yamlPaths Correlation

SWF YAML uses named task items in the `do:` array: `[{stepName: {call: http, ...}}]`. The SDK generates node IDs from these names. The YAML walker correlates by matching the task name at each array index to the SDK-generated node ID. For nested structures (try/catch, for/do), the walker descends recursively and builds paths like `['do', 0, 'stepName']`.

## 4. Layer 2 — SWF Stencils

**Directory:** `packages/graph-stencil-swf/src/stencils/`

One file per stencil type. Each exports a `StencilGrammar` and a render function `(node: GraphNode, decoration?: NodeDecoration) => StencilTemplate`. Follows the case stencil pattern exactly.

### 4.1 Stencils for v1 (Engine Subset)

| Type | Label | Icon/Visual | Key info shown |
|---|---|---|---|
| `swf-call` | Call | Switches by `call` property: http → globe, grpc → plug, function → code bracket, `casehub:dispatch` → arrow-right-circle. Default → phone | Call type, endpoint/function name |
| `swf-set` | Set | variable/edit icon | Variable name(s) being set |
| `swf-switch` | Switch | git-branch | Number of cases |
| `swf-raise` | Raise | alert-triangle, red accent | Error type/message |
| `swf-try` | Try | shield icon | Container label |
| `swf-try-catch` | Catch | shield-off, orange accent | Error filter expression |
| `swf-start` | Start | circle-dot, green | Root workflow start marker |
| `swf-end` | End | circle-x, grey | Root workflow end marker |
| `swf-entry` | Entry | circle-dot, teal | Sub-graph entry marker (try, for, etc.) |
| `swf-exit` | Exit | circle-x, grey-light | Sub-graph exit marker |

All SWF stencil types use the `swf-` prefix, consistent with the existing stub convention and the parent spec's collision-avoidance rule (§2.2). The adapter maps SDK `GraphNodeType` values to prefixed types; the stencil registry never sees unprefixed SWF types.

**start/end vs entry/exit:** The SDK's `buildFlatGraph()` produces `start`/`end` nodes for the root workflow and `entry`/`exit` nodes for nested sub-graphs (try, for, fork blocks). These are distinct `GraphNodeType` enum values. Root markers use `swf-start`/`swf-end`; sub-graph markers use `swf-entry`/`swf-exit`. Both pairs share similar visual treatment (boundary markers) but with distinct labels and slight colour variation so users can distinguish nesting depth. For v1, sub-graph stencils (try, for, fork) render via the generic fallback, so `swf-entry`/`swf-exit` nodes only appear once container stencils are promoted from fallback — but the stencils are registered now for forward compatibility.

A single `swf-call` stencil registration with one render function that reads `node.properties.call` to select icon and accent colour. The remaining stub TODO (stencils/index.ts:46) for raise, catch, entry, exit stencils is addressed by this table.

### 4.2 Generic Fallback

A `swf-generic` stencil is registered by `registerSwfStencils()` with a render function that displays:
- The unprefixed type name as a label (e.g., "for", "emit")
- A neutral grey background with `--pages-border-color` border
- A generic workflow-step icon

The adapter maps any SDK `GraphNodeType` value that lacks a dedicated stencil to `swf-generic`. The decision is a **compile-time check** against a shared constant, not a runtime query of the stencil registry:

```typescript
export const SWF_KNOWN_TYPES = new Set([
  'call', 'set', 'switch', 'raise', 'try', 'try-catch',
  'start', 'end', 'entry', 'exit',
] as const);
```

The adapter's type-mapping step checks `SWF_KNOWN_TYPES.has(sdkType)`. If the type is known, the node is emitted as `swf-${sdkType}`. If not, the node is emitted as `swf-generic` with the original SDK type stored in `node.properties.originalType`. This keeps the adapter a pure function — no dependency on graph-renderer's stencil registry, no initialization-order coupling, independently testable without stencil setup.

`registerSwfStencils()` (§4.3) iterates the same `SWF_KNOWN_TYPES` constant when registering stencil descriptors, ensuring the adapter's known-type set and the stencil registration list are always in sync. Adding a new dedicated stencil requires adding the type to `SWF_KNOWN_TYPES` — a single source of truth.

This covers `do`, `for`, `fork`, `emit`, `listen`, `run`, `wait` until they get dedicated artwork. The `swf-generic` stencil is explicitly registered — not a React Flow `default` override — so it integrates with the grammar registry and the stencil descriptor query API.

### 4.3 Registration

```typescript
export function registerSwfStencils(): void;
```

Idempotent — guard with a `registered` flag. Same pattern as `registerCaseStencils()`.

Registers both node stencils and edge types:

```typescript
registerEdgeType({ type: 'flow', label: 'Flow', defaultStyle: '.flow-edge { stroke: var(--pages-border-color, #888); }' });
registerEdgeType({ type: 'switch-case', label: 'Case', defaultStyle: '.switch-case-edge { stroke: var(--pages-accent-color, #4a9eff); stroke-dasharray: 4; }' });
```

Edge type registration distinguishes sequential flow edges from switch-case branch edges visually. The existing case diagram does not register edge types (case edges use React Flow defaults) — SWF adds this because the flow/branch distinction is semantically important in sequential workflows.

### 4.4 Grammar

SWF is a sequential flow. Connection rules:
- Most nodes: one inbound, one outbound
- `swf-switch`: one inbound, multiple outbound (one per case)
- `swf-entry`: no inbound, one outbound
- `swf-exit`: one inbound, no outbound

### 4.5 Visual Style

Inline-styled HTML blocks using `--pages-*` CSS custom properties. Call sub-type distinguished by icon and a subtle accent colour band at the top of the node.

## 5. Layer 3 — DiagramBaseMixin

**Package:** `packages/diagram-core/` (new)
**File:** `packages/diagram-core/src/diagram-base-mixin.ts`

New `diagram-core` package sits between graph-renderer (casehub-pages) and the diagram components (blocks-ui). It depends on graph-core, graph-renderer, and lit. Both casehub-diagram and swf-diagram depend on diagram-core. blocks-ui-core stays clean — no graph dependencies.

```
blocks-ui-core (unchanged — no graph dependencies)
diagram-core (NEW — DiagramBaseMixin, shared sub-components)
    ↑                    ↑
casehub-diagram      swf-diagram
```

Extract shared orchestration from `casehub-diagram` into a Lit mixin.

### 5.1 What the Mixin Owns

| Concern | Detail |
|---|---|
| Shadow DOM | `createRenderRoot()` returns `this` — disables shadow DOM so `--pages-*` CSS custom properties penetrate. All diagram subclasses require this. |
| Undo/redo stack | `_undoStack`, `_redoStack`, `_pushUndo()`, `_undo()`, `_redo()` — operates on YAML strings |
| Render pipeline | `_fullRender()`, `_updateWithoutLayout()`, `_renderInProgress` guard — calls abstract `_adaptYaml()` |
| Dirty tracking | `_currentYaml`, `_savedYaml`, isDirty comparison |
| Persistence | `_load()`, `_save()`, conflict resolution — uses `PersistenceBackend` SPI |
| Keyboard shortcuts | Ctrl+Z, Ctrl+Shift+Z, Ctrl+S, Delete, Escape |
| Selected node state | `_selectedNodeId`, `_selectedData`, `_selectedSchema` |
| Mode toggle | `_mode: 'design' | 'runtime'` — decoration application is abstract |
| `src` fetch | AbortController-managed fetch with `_srcAbortController` — cancels in-flight request on each `src` change |
| Error state | `_error` string + `_clearErrorAndRetry()` method — renders error with a retry button |
| Degraded mode | Checks `_adapterResult?.degraded` — when set, the graph renders normally but the property panel is disabled and a warning banner shows the degradation reason. Distinct from `_error` (which replaces the graph entirely). |
| Read-only mode | `readonly` boolean property — when true, suppresses property panel, save button, dirty tracking, and edit keyboard shortcuts |

The mixin does **not** provide a `render()` method. Each subclass defines its own Lit `render()` template, composing the sub-components it needs. The mixin provides protected state properties (`_nodes`, `_edges`, `_error`, `_selectedNodeId`, etc.) and helper methods that subclasses reference in their templates.

#### 5.1.1 Render Pipeline Correctness

`_fullRender()` captures `_adapterResult` in a local variable before the `await computeElkLayout()` call. After the await, it checks whether `_adapterResult` has been overwritten by a concurrent `_updateWithoutLayout()` during the yield:

```typescript
private async _fullRender(yamlStr: string): Promise<void> {
  if (this._renderInProgress) { this._pendingRenderYaml = yamlStr; return; }
  this._renderInProgress = true;
  try {
    this._error = '';
    const result = this._adaptYaml(yamlStr);
    this._adapterResult = result;
    const layout = await computeElkLayout(result.model, this._layoutOptions());
    // Guard: if _adapterResult changed during await, our layout is stale — re-render
    if (this._adapterResult !== result) {
      this._renderInProgress = false;
      await this._fullRender(this._currentYaml);
      return;
    }
    this._lastLayout = layout;
    const { nodes, edges } = toReactFlowGraph(result.model, layout, this._decorations());
    this._nodes = nodes;
    this._edges = edges;
  } catch (e) {
    this._error = String(e);
  } finally {
    this._renderInProgress = false;
    // ... pending render check
  }
}
```

This eliminates the race between `_fullRender()` (async, yields on layout) and `_updateWithoutLayout()` (sync, overwrites `_adapterResult`). The local `result` capture ensures layout and model are always from the same parse.

#### 5.1.2 `src` Fetch with AbortController

```typescript
private _srcAbortController: AbortController | null = null;

// In updated() handler for src changes:
this._srcAbortController?.abort();
this._srcAbortController = new AbortController();
const response = await fetch(this.src, { signal: this._srcAbortController.signal });
```

Each `src` change aborts any in-flight fetch, preventing stale data from overwriting newer content when URLs change in rapid succession.

#### 5.1.3 Error Recovery

When `_error` is set, subclasses render it via a protected helper:

```typescript
protected _renderError() {
  return html`
    <div style="color: red; padding: 16px;">
      ${this._error}
      <button @click=${() => this._clearErrorAndRetry()}>Retry</button>
    </div>
  `;
}
```

`_clearErrorAndRetry()` clears `_error` and re-invokes `_fullRender(this._currentYaml)`. This handles transient failures (network errors on `src` fetch, SDK parse errors on malformed YAML that is subsequently corrected).

The retry button is suppressed when `readonly && !src` — in this context, the YAML is an in-memory string that cannot be changed, so retrying produces the same error deterministically. When `readonly` is true but `src` is configured, retry remains available for transient fetch errors.

### 5.2 Abstract Methods

```typescript
protected abstract _adaptYaml(yaml: string): AdapterResult;

protected abstract _applyPropertyEdit(
  yaml: string, nodePath: readonly (string | number)[],
  field: (string | number)[], value: unknown,
): string;

protected abstract _schemaTypeMap(): Record<string, string>;

protected abstract _paletteTypes(): string[];

protected abstract _emptyTemplate(): string | null;
```

**`_emptyTemplate()`** returns the YAML for a new empty document when `read()` returns `not_found`, or `null` if document creation is not supported. When null, the mixin shows a "document not found" error state instead of initializing an empty canvas.

**Keyboard shortcut gating:** The mixin's `_handleKeydown` gates Delete/Backspace on `_paletteTypes().length > 0`. If no palette types are registered (meaning no structural editing), the delete shortcut is disabled. This prevents swf-diagram from inheriting a delete handler it can't meaningfully use. Universal shortcuts (undo, redo, save, escape) are always active.

### 5.3 What Stays in casehub-diagram

- `registerCaseStencils()` call
- Case-specific `_adaptYaml` → `toGraph()`
- Case-specific `_applyPropertyEdit` → case `applyPropertyEdit()`
- `SCHEMA_TYPE_MAP` as `_schemaTypeMap()` return value
- Palette types: `binding`, `worker`, `milestone`, `goal`
- `_emptyTemplate()` → returns the case definition YAML template (current hard-coded string in `_load()`)
- Binding target switching (`switchBindingTarget`) — case-specific
- Runtime overlay (`runtimeState`, `toDecorations`) — case-specific for now
- `casehub-diagram-properties` (extends `diagram-properties` with target type selector)

### 5.4 Risk Mitigation

Existing `casehub-diagram` tests (palette, properties, toolbar, render pipeline) must pass unchanged after extraction. The mixin is tested through its concrete subclasses.

### 5.5 Usage

```typescript
class CasehubDiagram extends DiagramBaseMixin(LitElement) { ... }
class SwfDiagram extends DiagramBaseMixin(LitElement) { ... }
```

## 6. Layer 4 — swf-diagram Component

**File:** `components/swf-diagram/src/swf-diagram.ts`

### 6.1 Class Structure

```typescript
@customElement('swf-diagram')
export class SwfDiagram extends DiagramBaseMixin(LitElement) { ... }
```

### 6.2 Abstract Method Implementations

| Method | Delegates to |
|---|---|
| `_adaptYaml(yaml)` | `toSwfGraph(yaml)` from graph-stencil-swf |
| `_applyPropertyEdit(yaml, path, field, value)` | `applySwfPropertyEdit()` — new function in graph-stencil-swf |
| `_schemaTypeMap()` | `{ 'swf-call': 'CallTask', 'swf-set': 'SetTask', 'swf-switch': 'SwitchTask', 'swf-raise': 'RaiseTask', ... }` |
| `_paletteTypes()` | Empty array — no structural editing in v1 |
| `_emptyTemplate()` | Returns `null` — swf-diagram does not support creating new documents |

### 6.3 Public API

| Property | Type | Description |
|---|---|---|
| `yaml` | `string` | SWF YAML string to render |
| `src` | `string` | URL to fetch SWF YAML from |
| `backend` | `PersistenceBackend \| null` | Optional persistence backend |
| `uri` | `string` | Resource URI for persistence |
| `schema` | `Record<string, unknown>` | JSON Schema for property editing — defaults to `swfTaskSchema` |

Same surface as `casehub-diagram` minus `runtimeState`.

**Input mutual exclusivity:** `yaml`, `src`, and `backend`/`uri` are mutually exclusive input sources — callers should provide exactly one. If multiple are set, the mixin processes whichever input triggers an `updated()` cycle; the last `_fullRender` call wins due to the pending-render mechanism (§5.1.1). This is not enforced programmatically — Lit reactive properties fire independently — but using multiple simultaneously is an API contract violation. In dev mode, the mixin logs a warning if more than one input source is configured. Unlike `casehub-diagram` (which defaults `schema` to `{}` because the CaseDefinition schema is generated externally), `swf-diagram` defaults to `swfTaskSchema` — the static schema exported by `graph-stencil-swf`. This makes `swf-diagram` self-sufficient: property editing works without the hosting app explicitly passing a schema. The hosting app can still override `schema` to customize property editing.

**SWF JSON Schema:** The `schema` property is populated from a static JSON Schema object exported by `graph-stencil-swf`. This schema is hand-authored to match the SDK's task type definitions. Schema definition keys match the `_schemaTypeMap()` values: `CallTask`, `SetTask`, `SwitchTask`, `RaiseTask`, `TryTask`, `TryCatchTask`. Each defines the editable properties for that step type (e.g., `CallTask` has `call: string`, `with: object`, `input: object`, `output: object`).

The schema is a static `swfTaskSchema` export:

```typescript
// packages/graph-stencil-swf/src/schema/swf-task-schema.ts
export const swfTaskSchema: Record<string, unknown> = {
  $defs: {
    CallTask: {
      type: 'object',
      properties: {
        call: { type: 'string', title: 'Function' },
        with: { type: 'object', title: 'Arguments' },
        // ... remaining call properties
      },
      required: ['call'],
    },
    SetTask: { /* ... */ },
    SwitchTask: { /* ... */ },
    RaiseTask: { /* ... */ },
    // ... remaining task types
  },
};
```

The hosting app can override `schema` to customize property editing, but the default export covers all engine-supported step types. The schema follows the same `$defs[TypeName]` convention used by the case diagram's CaseDefinition schema (Phase 0 of #103).

### 6.4 Render Template

Composes shared sub-components from diagram-core:
- `diagram-toolbar` (save/dirty — no mode toggle since `runtimeAvailable=false`, no palette)
- `pages-graph-canvas` (nodes, edges)
- `diagram-properties` (generic schema-driven property form, when node selected)
- Confirm dialog (when active)

The shared property form renderer (`renderPropertyForm()`) and toolbar are extracted from casehub-diagram into diagram-core. casehub-diagram-properties extends diagram-properties with its case-specific target type selector. casehub-diagram-toolbar extends diagram-toolbar with the runtime mode toggle.

### 6.5 SWF YAML Editor

**File:** `packages/graph-stencil-swf/src/adapter/swf-yaml-editor.ts`

```typescript
export function applySwfPropertyEdit(
  yaml: string,
  nodePath: readonly (string | number)[],
  field: (string | number)[],
  value: unknown,
): string;
```

CST-preserving edits via `parseDocument()` from the `yaml` library. Same pattern as the case adapter's `applyPropertyEdit`.

## 7. Layer 5 — Worker Thumbnail

**Where:** `packages/graph-stencil-case/src/stencils/worker.ts` + new thumbnail utility.

### 7.1 Mechanism

Dual-write scaled canvas. When a worker node has a `do:` block, the worker stencil renders a miniaturised SWF graph below the worker's name and capabilities.

### 7.2 Flow

1. Case adapter already spreads all worker properties into `node.properties`. The `do` property (raw SWF task array) is available.
2. Worker render function checks `node.properties.do` — if present, queries the thumbnail renderer registry for a `'swf'` renderer.
3. If a renderer is registered, it renders a thumbnail container (e.g. 180×100px). If not, the worker node renders without a thumbnail (graceful degradation — applications that don't load SWF support still render workers correctly).

**Thumbnail renderer SPI** (in graph-renderer):

```typescript
export type ThumbnailRenderer = (doBlock: unknown, container: HTMLElement) => void;
export function registerThumbnailRenderer(type: string, renderer: ThumbnailRenderer): void;
export function getThumbnailRenderer(type: string): ThumbnailRenderer | undefined;
```

The hosting **application** (not casehub-diagram) registers the SWF thumbnail renderer at init time. casehub-diagram does not import from graph-stencil-swf — it has no build-time dependency on the SWF package. graph-stencil-case never imports from graph-stencil-swf — the dependency is inverted through the registry. Applications that don't load SWF support skip the registration call; worker nodes render without thumbnails (graceful degradation).

**SWF thumbnail implementation** (in graph-stencil-swf):

```typescript
export function createSwfThumbnailRenderer(): ThumbnailRenderer;
```

Internally:
- Wraps `do:` array into a minimal SWF Workflow envelope (see §7.3)
- Calls `toSwfGraph()` → GraphModel
- Calls `computeElkLayout()` at thumbnail scale
- Renders as lightweight SVG (positioned rectangles + lines) — not a full React Flow canvas

**Error handling:** The entire thumbnail render is wrapped in a try/catch. If `toSwfGraph()` or `computeElkLayout()` throws (malformed `do:` block, SDK validation failure, expression references to undefined inputs), the worker node renders without a thumbnail — no error propagation to the case diagram. The SDK does not validate runtime expressions (`${ .input.foo }`) during graph construction; it treats them as opaque strings. Validation failures come from structural issues (invalid task shape, missing required fields).

### 7.3 `do:` Block Serialization

The case adapter spreads worker properties into `node.properties`, so `do` arrives as a parsed JavaScript array. Both the thumbnail renderer and the drill-down event need a YAML string. The SWF thumbnail renderer handles this conversion:

```typescript
function wrapDoBlock(doBlock: unknown): string {
  return stringify({
    document: { dsl: '1.0.0', do: doBlock },
  });
}
```

The `stringify` function from the `yaml` library serializes the JS object back to YAML. The envelope mirrors the minimal valid SWF Workflow document structure as defined by the SDK. `toSwfGraph()` accepts this envelope.

For the drill-down event (§8.1), the `doYaml` field is produced by the same `wrapDoBlock()` utility. Both paths use the same serialization to guarantee consistency.

Round-trip fidelity is not a concern here — the original YAML is in the case document (accessible via `yamlPaths`). The serialized `do:` block is a read-only view; edits to SWF properties go through `applySwfPropertyEdit()` against the case YAML (via the case adapter's yamlPath for the worker's `do` key).

### 7.4 SVG Thumbnail Renderer

The thumbnail renders as a lightweight SVG derived from the positioned GraphModel — rectangles for nodes, polylines for edges, text labels where space permits. Not a full React Flow canvas, because:
- Thumbnails are non-interactive (`pointer-events: none`)
- React Flow instances can't trivially nest
- SVG is lighter and sufficient for a visual preview

The same adapter and layout engine produce the data; only the final renderer differs.

### 7.5 Caching

Layout results are cached per worker node ID. The cache key is `JSON.stringify(node.properties.do)` — a deterministic serialization of the parsed `do:` block. The case adapter creates new object references on every `toGraph()` call (`{ ...worker }` spread), so reference equality would never hit. JSON serialization is O(n) in the `do:` block size but is fast for typical workflow sizes (5–30 steps) and only runs during case diagram re-render, not on every frame.

Recomputed only when the serialized key changes. Cache eviction: simple per-node replacement (no size limit — thumbnail layouts are small).

## 8. Layer 6 — Drill-down Events and Inline Expand

### 8.1 Drill-down Event (Full Open)

Worker stencil adds an expand button (visible on hover, or always present when `do:` exists). Click dispatches a `pages-event`:

```typescript
detail: {
  topic: 'diagram:worker-drill-down',
  workerId: string,
  workerName: string,
  doYaml: string,
}
```

`casehub-diagram` does not handle this event — it bubbles to the hosting app. The app decides how to surface `swf-diagram`.

**Drill-down is read-only in v1.** The app opens `swf-diagram` with `yaml="${doYaml}" readonly`. The `readonly` property (inherited from the mixin, §5.1) suppresses the property panel, save button, and dirty tracking. The `doYaml` is a serialized copy of the worker's `do:` block — edits cannot propagate back to the case YAML without a bidirectional sync mechanism, which is out of scope for v1.

Property editing of SWF steps happens in standalone `swf-diagram` instances that have their own `backend` and `uri` — not in drill-down views. A future issue will address bidirectional drill-down editing (event-based propagation of SWF edits back to the parent case YAML).

### 8.2 Inline Expand

Worker node supports an expanded state toggled by clicking a chevron.

**Collapsed (thumbnail):** 180×100px miniaturised SVG preview.

**Expanded:** Worker node grows, SVG thumbnail replaced with a larger version (e.g. 300×200px, less aggressive scale factor). Same SVG renderer, larger container.

On expand/collapse, the case diagram calls `computeElkLayout()` with per-node size overrides to reflow around the changed worker node size.

#### 8.2.1 Per-Node Size Overrides for ELK

`computeElkLayout()` currently uses `DEFAULT_NODE_WIDTH` (172) and `DEFAULT_NODE_HEIGHT` (36) for all non-parent nodes. This is insufficient for expanded worker nodes that need 300×200px.

The function signature is extended with an optional `nodeSizes` parameter:

```typescript
export interface ElkLayoutOptions {
  direction?: 'DOWN' | 'RIGHT' | 'LEFT' | 'UP';
  spacing?: number;
  containerPadding?: number;
  nodeSizes?: ReadonlyMap<string, { width: number; height: number }>;
}
```

Inside `buildElkNode()`, if `nodeSizes` has an entry for the current node ID, those dimensions are used instead of the defaults. This is a layout-time concern — node dimensions are not stored in `GraphModel` (which is model-level) but communicated through layout options.

The case diagram maintains a `_expandedWorkers: Set<string>` tracking which workers are currently expanded. On expand/collapse toggle, it builds the `nodeSizes` map with expanded dimensions for those workers and triggers `_fullRender()`.

**Performance:** ELK relayout is async and its cost scales with graph complexity. For typical case definitions (5–20 workers), relayout completes in <100ms. The expand/collapse handler debounces rapid toggle sequences (150ms) to prevent jitter from multiple rapid toggles.

### 8.3 Interaction Model

| Action | Result |
|---|---|
| Click chevron on worker | Toggle inline expand (larger preview on case canvas) |
| Click expand button on worker | `diagram:worker-drill-down` event → app opens `swf-diagram` |
| Click chevron again | Collapse back to thumbnail |

Inline expand is a readable preview, not an interactive editor. For editing, the user opens `swf-diagram` via drill-down.

## 9. Implementation Order (Bottom-up)

| Step | Layer | Independently testable |
|---|---|---|
| 1 | Adapter (`toSwfGraph`) | Yes — unit tests with SWF YAML fixtures |
| 2 | Stencils + registration | Yes — render function tests |
| 3 | DiagramBaseMixin extraction | Yes — existing casehub-diagram tests validate |
| 4 | swf-diagram component | Yes — integration tests with YAML + canvas |
| 5 | Worker thumbnail | Yes — worker stencil render tests |
| 6 | Drill-down events + inline expand | Yes — event dispatch + expand/collapse tests |

## 10. Dependencies

| Dependency | Status |
|---|---|
| `@openworkflowspec/sdk@0.0.1` | Published on npm |
| `@casehubio/graph-core` | Available (casehub-pages) — requires `AdapterResult` type addition |
| `@casehubio/graph-renderer` | Available (casehub-pages) — requires `ThumbnailRenderer` SPI addition |
| `@casehubio/diagram-core` | New package created by this spec (§5) |
| `yaml` library | Already a dependency of graph-stencil-case |

## 11. Divergence from Parent Spec

This spec refines the parent spec's Phase 5 (#103, §4 Phase 5: "SWF Drill-Down") in three ways:

1. **Three-tier progressive disclosure** (thumbnail → inline expand → full open) instead of simple expand/collapse. Rationale: a miniaturised preview gives immediate visual context without the layout cost of expanding every worker node. The inline expand adds a mid-tier for quick inspection. Full open via `swf-diagram` provides the editing surface.

2. **Separate `swf-diagram` component** instead of inline sub-graph rendering. Rationale: SWF workflows have their own stencil set, property schemas, and persistence lifecycle. Embedding a full interactive SWF graph inside a case diagram canvas creates React Flow nesting issues and conflates two editing contexts. A separate component is cleaner.

3. **DiagramBaseMixin extraction** — not mentioned in the parent spec. Rationale: the parent spec assumed case-diagram would grow in place. With a second diagram component (swf-diagram), extracting shared orchestration into a mixin prevents code duplication and ensures consistent behaviour across both.

**`casehub:dispatch` trace lines** (parent spec Phase 5: "workflow step → Case capability") are deferred — see #TBD-dispatch-traces in §12. The call stencil already distinguishes `casehub:dispatch` calls with a dedicated icon (§4.1), providing visual identification without the full trace-line overlay.

## 12. Out of Scope

The following items are deferred. Each must be tracked as a GitHub issue before implementation begins.

| Item | GitHub Issue | Rationale |
|---|---|---|
| Structural editing (add/remove/reorder SWF steps) | To be filed | Requires `_paletteTypes()` + `addElement()`/`removeElement()` SWF equivalents |
| SWF runtime overlay (execution state decoration) | To be filed | Needs engine-side SWF step execution state API |
| Stencils for non-engine SWF types (do, for, fork, emit, listen, run, wait) | To be filed | Generic fallback covers these; dedicated artwork when engine adds support |
| SWF validation beyond what the SDK provides | To be filed | SDK validation is sufficient for v1 |
| `casehub:dispatch` trace lines | To be filed | Visual lines connecting SWF call steps to case capabilities — cross-domain overlay |
| Edge type registration for case diagram | To be filed | The case diagram doesn't register edge types (uses React Flow defaults); SWF adds this (§4.3), case diagram should follow suit |
