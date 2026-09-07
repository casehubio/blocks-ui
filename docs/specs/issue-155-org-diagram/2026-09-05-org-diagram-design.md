# Eidos Org Structure Diagram — Design Spec

**Issue:** casehubio/blocks-ui#155
**Date:** 2026-09-05
**Status:** Draft

---

## Overview

A full interactive diagram editor for eidos organizational structures. Renders units, agents, and relationships with archetype-aware layout. Supports visual and YAML text editing of the full org model — units, members, relationships, scope, and attestation.

---

## Architecture

### Package Structure

Two new packages following the established graph-stencil-* + diagram component pattern:

| Package | Role |
|---------|------|
| `packages/graph-stencil-org` | Domain adapter — YAML↔GraphModel, stencil/edge registration, property schemas, archetype detection, layout strategy mapping, CST-preserving YAML editor |
| `components/org-diagram` | Lit component extending DiagramBaseMixin, toolbar, palette integration |

### Cross-Cutting Changes (casehub-pages repo)

| Package | Change | Repo |
|---------|--------|------|
| `graph-renderer` (elk-layout.ts) | Extend `ElkLayoutOptions` with `algorithm` field and `elkOptions` pass-through. Update `computeElkLayout()` to use selected algorithm instead of hardcoded `'layered'`. | casehub-pages |
| `pages-diagram-core` | Generic YAML text pane (`<pages-yaml-pane>`) — syntax-highlighted YAML editor. | casehub-pages |
| `graph-core` | Move GitHubBackend from pages-diagram-core to graph-core. Update all imports directly (no re-export shim). | casehub-pages |

---

## Data Model

### Input: Eidos Org YAML

The component consumes the same YAML format as eidos org-runtime. Example structure:

```yaml
organization:
  units:
    - unitId: hospital
      name: City Hospital
      kind: holarchy
      tenancyId: t1
      members:
        - agentId: doctor-1
          role: attending
      capabilities:
        - name: emergency-care
      goals:
        - name: patient-safety
          priority: PRIMARY
          visibility: PUBLIC
      constraints:
        - name: hipaa
          severity: HARD
          visibility: PUBLIC
    - unitId: emergency
      parentUnitId: hospital
      name: Emergency Department
      kind: department
      tenancyId: t1
      members:
        - agentId: nurse-1
          role: triage
  relationships:
    - sourceAgentId: doctor-1
      targetAgentId: nurse-1
      kind: SUPERVISES
      tenancyId: t1
```

### TypeScript Types (in graph-stencil-org)

Mirror the eidos org-api Java records as TypeScript interfaces:

```typescript
interface OrgUnit {
  unitId: string;
  name: string;
  kind?: string;
  kindVocabulary?: string;
  tenancyId: string;
  parentUnitId?: string;
  members: Membership[];
  capabilities: AgentCapability[];
  goals: AgentGoal[];
  constraints: AgentConstraint[];
}

interface Membership {
  agentId: string;
  role?: string;
  roleVocabulary?: string;
}

interface AgentRelationship {
  sourceAgentId: string;
  targetAgentId: string;
  kind: RelationshipKind;
  extendedKind?: string;
  kindVocabulary?: string;
  scope?: RelationshipScope;
  attestation?: AttestationGrant;
  tenancyId: string;
}

type RelationshipKind =
  | 'SUPERVISES' | 'DELEGATES_TO' | 'ESCALATES_TO'
  | 'REPORTS_TO' | 'BACKS_UP' | 'EXTENDED';

interface RelationshipScope {
  capabilityName?: string;
  domain?: string;
  custom?: string;
}

type BehavioralSignal = 'DECLINE' | 'SUCCESS' | 'COMPLIANT' | 'VIOLATED';

interface AttestationGrant {
  dimensions: [string, ...string[]];  // at least one (matches Java @NotEmpty)
  capabilityScope?: string[];
  signalTypes?: BehavioralSignal[];
}

interface AgentCapability { name: string; description?: string; }
interface AgentGoal { name: string; description?: string; priority?: string; visibility?: string; }
interface AgentConstraint { name: string; description?: string; severity?: string; visibility?: string; }
```

---

## graph-stencil-org Package

### YAML Adapter: `toOrgGraph(yaml: string) → AdapterResult`

Parses the org YAML into a `GraphModel` with the following node and edge mapping:

**Node types:**

| GraphNode type | Source | parentId | Properties |
|----------------|--------|----------|------------|
| `org-unit` | Each `OrganizationalUnit` | `parentUnitId` (maps to parent org-unit node ID) | `name`, `kind`, `kindVocabulary`, `unitId`, `memberCount`, `capabilities[]`, `goals[]`, `constraints[]` |
| `org-agent` | Each `Membership` within a unit | Unit's node ID (containment) | `agentId`, `role`, `roleVocabulary`, `unitId` (owning unit) |

Agent nodes are children of their unit node via `parentId`. This leverages ELK's existing compound node support — agents render inside their unit's container rectangle.

**Edge types:**

| GraphEdge type | Source | Properties |
|----------------|--------|------------|
| `org-supervises` | `SUPERVISES` relationship | scope, attestation |
| `org-delegates-to` | `DELEGATES_TO` relationship | scope, attestation |
| `org-escalates-to` | `ESCALATES_TO` relationship | scope, attestation |
| `org-reports-to` | `REPORTS_TO` relationship | scope, attestation |
| `org-backs-up` | `BACKS_UP` relationship | scope, attestation |
| `org-extended` | `EXTENDED` relationship | `extendedKind`, scope, attestation |

Edge source/target are agent node IDs (format: `agent:<unitId>:<agentId>`).

**Multi-unit agents:** In matrix structures, an agent belongs to multiple units (e.g. dev-alice in both platform-team and billing-project). The adapter creates one `org-agent` node per membership. Each node has a distinct ID: `agent:<unitId>:<agentId>`.

**Multi-unit edge routing strategy — same-unit preference:**

When a relationship's `sourceAgentId` or `targetAgentId` maps to multiple agent nodes (agent in multiple units), the adapter resolves the target node using same-unit preference:

1. If source and target share a unit, connect within that unit.
2. If the relationship has a `scope.capabilityName`, prefer the unit whose capabilities include that name.
3. Otherwise, connect to the first unit membership found (deterministic by unit order in YAML).

Example: `platform-lead SUPERVISES dev-alice`. Both are in `platform-team`, so the edge connects `agent:platform-team:platform-lead` → `agent:platform-team:dev-alice`, not `agent:billing-project:dev-alice`.

**YAML path tracking:** Like `graph-stencil-case`, the adapter builds a `yamlPaths: Map<string, (string|number)[]>` mapping each node/edge ID to its YAML CST path. This enables CST-preserving property edits.

### CST-Preserving YAML Editor

Functions for structural editing, using the `yaml` library's CST API:

```typescript
applyOrgPropertyEdit(yaml, nodePath, field, value) → string
addOrgUnit(yaml, defaults?) → string
removeOrgUnit(yaml, unitPath) → string
addMember(yaml, unitPath, membership) → string
removeMember(yaml, unitPath, memberIndex) → string
addRelationship(yaml, relationship) → string
removeRelationship(yaml, relPath) → string
```

All functions preserve comments and formatting in the existing YAML.

### Stencil Registration: `registerOrgStencils()`

Registers 2 node stencils (with grammars) and 6 edge types with the pages stencil registry.

**Stencil grammars:**

```typescript
const orgUnitGrammar: StencilGrammar = {
  type: 'org-unit',
  connections: {
    inbound: { min: 0, max: 0, allowedFrom: [] },
    outbound: { min: 0, max: 0, allowedTo: [] },
  },
  containment: {
    allowedChildTypes: ['org-agent', 'org-unit'],
    allowedParentTypes: ['org-unit'],
  },
};

const orgAgentGrammar: StencilGrammar = {
  type: 'org-agent',
  connections: {
    inbound: { min: 0, max: Infinity, allowedFrom: ['org-agent'] },
    outbound: { min: 0, max: Infinity, allowedTo: ['org-agent'] },
  },
  containment: {
    allowedParentTypes: ['org-unit'],
  },
};
```

Units don't connect via edges — nesting is via `parentId`. Agents connect to other agents via relationship edges.

**org-unit stencil:**
- Rounded rectangle container with header bar
- Header shows unit `name` and `kind` badge
- Interior contains child agent nodes (managed by ELK compound layout)
- Member count badge in header
- Capability/goal/constraint indicators as small icons

**org-agent stencil:**
- Compact rounded rectangle (smaller than unit)
- Shows `agentId` as primary label
- `role` as secondary label below
- Distinct styling from unit containers

**Edge type registration** (6 types with distinct visuals):

| Edge type | Visual | Stroke | Arrow |
|-----------|--------|--------|-------|
| `org-supervises` | Solid line | `#374151` (neutral-dark) | Filled arrow ↓ |
| `org-delegates-to` | Dashed line | `#3b82f6` (blue) | Open arrow → |
| `org-escalates-to` | Dotted line | `#ef4444` (red) | Filled arrow ↑ |
| `org-reports-to` | Thin solid line | `#6b7280` (neutral) | Filled arrow ↑ |
| `org-backs-up` | Double line | `#16a34a` (green) | Double-headed ↔ |
| `org-extended` | Dashed with label | `#8b5cf6` (purple) | Open arrow → |

Edge labels show `extendedKind` for EXTENDED relationships and scope badge (`capabilityName`) when scope is present. Attestation grant shown as a small shield icon on the edge.

### Property Schemas

JSON Schema for the property panel, registered via `registerPropertySchema`:

- `org-unit`: unitId, name, kind, kindVocabulary, tenancyId, capabilities (array), goals (array), constraints (array)
- `org-agent`: agentId, role, roleVocabulary

Relationship properties are edited through the selected agent's property panel under a "Relationships" sub-section. The org-diagram component overrides `_propertyPaletteSource` (like casehub-diagram does for discriminators) to construct nested property sources for each relationship.

When an agent node is selected, the adapter's `yamlPaths` maps both the agent node ID and its relationship edge IDs. The custom `_propertyPaletteSource` builds a compound view:

1. **Agent properties** — agentId, role (editing routes to agent's yamlPath)
2. **Outgoing relationships** — listed by target, each with inline editing for kind, extendedKind, scope, attestation. The `onChange` callback routes to the relationship's yamlPath (`['organization', 'relationships', N]`), not the agent's.
3. **Incoming relationships** — same structure, read-only labels showing who relates to this agent

This avoids requiring edge selection in DiagramBaseMixin, which currently only supports node selection. The `yamlPaths` map is extended to include edge IDs (format: `rel:<index>`) pointing to their YAML paths, enabling `_applyPropertyEdit` to target relationship entries directly.

### Edit Policy: `createOrgEditPolicy() → EditPolicy`

Declares what operations the visual editor supports:

- **Creatable types:** org-unit (always available in palette), org-agent (available when `nearNode.type === 'org-unit'` — `getCreatableTypes` gates on selection context). When `_applyGraphEdit` receives `addNode` with type `org-agent`, the target unit ID is passed via `edit.properties.parentUnitId` (set by the edit policy from `nearNode.id`).
- **Creatable edges:** drag from agent to agent creates a `SUPERVISES` relationship (most common default). The kind is changed afterwards via the agent's property panel relationship sub-section, or via the YAML pane.
- **Deletable:** org-unit (removes all contained agents and their relationships), org-agent (removes from unit membership and all relationships), relationships (via agent property panel or YAML pane)
- **Reconnectable edges:** deferred — `reconnectEdge` throws `'not yet implemented'` (same as casehub-diagram and swf-diagram)

### Archetype Detection: `detectArchetype(model: GraphModel) → ArchetypeHint`

Analyzes the relationship topology to suggest a layout strategy:

```typescript
type ArchetypeHint = {
  archetype: ArchetypeName;
  confidence: 'high' | 'medium' | 'low';
  layout: OrgLayoutStrategy;
};

type ArchetypeName =
  | 'simple-structure' | 'hierarchy' | 'professional-bureaucracy'
  | 'tiered-escalation' | 'divisional-holarchy' | 'federation'
  | 'pipeline' | 'coalition' | 'matrix' | 'market';

type OrgLayoutStrategy =
  | 'star' | 'tree' | 'circular' | 'layered'
  | 'nested' | 'hub-spoke' | 'flow' | 'radial'
  | 'grid' | 'force';
```

**Detection heuristics:**

| Signal | Archetype | Layout |
|--------|-----------|--------|
| All edges `SUPERVISES` from one source, flat | simple-structure | star |
| `SUPERVISES` forming tree with depth > 2 | hierarchy | tree |
| No `SUPERVISES`, only `BACKS_UP` | professional-bureaucracy | circular |
| `ESCALATES_TO` with tier-like role patterns | tiered-escalation | layered |
| `parentUnitId` nesting present | divisional-holarchy | nested |
| One node `DELEGATES_TO` many + `REPORTS_TO` back | federation | hub-spoke |
| Linear `DELEGATES_TO` chain (no branching) | pipeline | flow |
| Multiple `REPORTS_TO` converging to one node, no `SUPERVISES` | coalition | radial |
| Agent appears in multiple units (shared `agentId`) | matrix | grid |
| `EXTENDED("bids-to")` present | market | radial |

Multiple signals can co-exist. The detector uses a priority ordering (highest priority wins):

1. `EXTENDED("bids-to")` → market
2. Multi-unit agent (shared agentId across units) → matrix
3. `parentUnitId` nesting → divisional-holarchy
4. `ESCALATES_TO` with tier-like role patterns (l1/l2/l3, tier-*) → tiered-escalation
5. Linear `DELEGATES_TO` chain (no branching, no `REPORTS_TO` back) → pipeline
6. One node `DELEGATES_TO` many + `REPORTS_TO` back → federation
7. Multiple `REPORTS_TO` converging, no `SUPERVISES` → coalition
8. `SUPERVISES` tree depth > 2 → hierarchy
9. All edges `SUPERVISES` from one source, flat → simple-structure
10. No `SUPERVISES`, only `BACKS_UP` → professional-bureaucracy

Fallback for no relationships or unrecognised topology: `force` layout with `low` confidence.

The user can always override via the toolbar layout dropdown.

### Layout Strategy Mapping: `orgLayoutOptions(strategy: OrgLayoutStrategy) → ElkLayoutOptions`

**Prerequisite:** `ElkLayoutOptions` in `graph-renderer` must be extended with:

```typescript
interface ElkLayoutOptions {
  algorithm?: 'layered' | 'mrtree' | 'radial' | 'force' | 'stress';  // NEW — default 'layered'
  direction?: 'DOWN' | 'RIGHT' | 'LEFT' | 'UP';
  spacing?: number;
  containerPadding?: number;
  nodeSizes?: ReadonlyMap<string, { width: number; height: number }>;
  wrapping?: boolean;
  partitions?: ReadonlyMap<string, number>;
  elkOptions?: Readonly<Record<string, string>>;  // NEW — pass-through for algorithm-specific ELK properties
}
```

`computeElkLayout()` uses `algorithm` (default `'layered'`) for the `elk.algorithm` property and merges `elkOptions` into the root layout options. Existing consumers are unaffected — `algorithm` defaults to `'layered'`.

Maps each layout strategy to ELK configuration:

| Strategy | ELK algorithm | Direction | Extra elkOptions |
|----------|---------------|-----------|------------------|
| `star` | `radial` | — | — |
| `tree` | `mrtree` | `DOWN` | — |
| `circular` | `stress` | — | `elk.stress.desiredEdgeLength: '150'` |
| `layered` | `layered` | `DOWN` | `elk.layered.crossingMinimization.strategy: 'LAYER_SWEEP'` |
| `nested` | `layered` | `DOWN` | increased `containerPadding` |
| `hub-spoke` | `radial` | — | — |
| `flow` | `layered` | `RIGHT` | `elk.layered.nodePlacement.strategy: 'LINEAR_SEGMENTS'` |
| `radial` | `radial` | — | — |
| `grid` | `layered` | `DOWN` | `partitions` based on unit membership |
| `force` | `force` | — | `elk.force.temperature: '0.001'` |

---

## org-diagram Component

### `<blocks-org-diagram>` — extends DiagramBaseMixin(LitElement)

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `yaml` | `string` | Inline YAML (from attribute or property) |
| `src` | `string` | URL to fetch YAML from |
| `backend` | `PersistenceBackend \| null` | Pluggable persistence (inherited from mixin) |
| `uri` | `string` | Document URI for persistence backend |
| `readonly` | `boolean` | Disable editing |
| `selectionTopic` | `string` | Pages event topic for node selection |
| `layoutStrategy` | `OrgLayoutStrategy \| 'auto'` | Layout override. Default `'auto'` (uses archetype detection). |

**Abstract method implementations:**

- `_adaptYaml(yaml)` → calls `toOrgGraph(yaml)`, runs `detectArchetype`, caches layout hint
- `_applyPropertyEdit(yaml, nodePath, field, value)` → calls `applyOrgPropertyEdit`
- `_emptyTemplate()` → returns minimal org YAML scaffold
- `_editPolicy()` → returns `createOrgEditPolicy()`
- `_iconRenderer()` → SVG icons: container rectangle for `org-unit`, person silhouette for `org-agent`
- `_layoutOptions()` → calls `orgLayoutOptions(strategy)` using auto-detected or overridden strategy
- `_applyGraphEdit(yaml, edit)` → dispatches to `addOrgUnit`, `removeOrgUnit`, `addMember`, `removeMember`, `addRelationship`, `removeRelationship` based on edit type

**Toolbar: `<blocks-org-diagram-toolbar>`**

- Save button (when backend set, dirty state)
- Layout strategy dropdown (auto-detected default, manual override)
- Archetype badge showing detected archetype name + confidence
- Node/agent/relationship counts
- SVG/PNG export buttons

**Render structure:**

```
┌─────────────────────────────────────────────────────┐
│ Toolbar: [Save] [Layout: auto ▼] [Hierarchy ◉]     │
│          [Stats: 3 units, 7 agents, 9 rels]  [⬇PNG] │
├──────┬──────────────────────────────┬───────────────┤
│      │                              │               │
│  P   │                              │  Properties   │
│  a   │    pages-graph-canvas        │  Panel        │
│  l   │    (ELK + ReactFlow)         │               │
│  e   │                              │  (schema-     │
│  t   │                              │   driven)     │
│  t   │                              │               │
│  e   │                              │               │
├──────┴──────────────────────────────┴───────────────┤
│ YAML Text Pane (generic, from pages-diagram-core)   │
│ ┌─────────────────────────────────────────────────┐ │
│ │ organization:                                    │ │
│ │   units:                                         │ │
│ │     - unitId: hospital                           │ │
│ │       name: City Hospital                        │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

The YAML text pane is a horizontal split below the diagram. Edits in either pane update the other bidirectionally. The pane is collapsible.

**ARIA:**

- Host: `role="region"`, `aria-label="Organization diagram editor"`
- Canvas: `role="img"`, `aria-label` includes archetype name and counts
- Toolbar: standard button/select ARIA
- Property panel: form fields with labels
- YAML pane: `role="textbox"`, `aria-label="Organization YAML editor"`, `aria-multiline="true"`

---

## Generic YAML Text Pane (pages-diagram-core)

A new component `<pages-yaml-pane>` in pages-diagram-core:

**Properties:**
- `value: string` — current YAML text
- `readonly: boolean`

**Events:**
- `yaml-change` — emitted on user edit, detail: `{ value: string }`

**Implementation (v1 — syntax-highlighted textarea):**
Extract the overlay technique from `examples/src/pages/diagram-export-page.ts` (lines 12-24, 89-111). This page already implements YAML editing with regex-based syntax highlighting: a transparent `<textarea>` layered over a `<pre><code>` element with highlighted HTML. The technique provides coloured keys, strings, numbers, booleans, comments, and list dashes without any external library.

The extraction promotes this from an example-only pattern to a reusable component:
- `highlightYaml(text)` utility function (regex-based, already proven)
- Overlay CSS (transparent textarea over highlighted pre)
- `--pages-*` token integration for theme-aware colours
- Debounced change events (300ms) to avoid re-rendering on every keystroke

**Integration with DiagramBaseMixin:**
Each diagram component that wants a YAML pane includes `<pages-yaml-pane>` in its render method, binding `.value=${this._currentYaml}` and handling `@yaml-change`. This is opt-in — the mixin doesn't render the pane itself.

**Bidirectional sync details:**

- **YAML → Graph:** On `yaml-change`, the component calls `_pushUndo()`, updates `_currentYaml`, then calls `_fullRender()`. Parse errors during mid-edit are handled gracefully: if `_adaptYaml()` throws, the graph retains its last valid state (don't set `_error` — instead show a parse-error indicator in the YAML pane gutter). This prevents the graph from vanishing while the user types.
- **Graph → YAML:** Property panel and structural edits update `_currentYaml` via the existing mixin path. The YAML pane re-renders on Lit's reactive update cycle.
- **Undo integration:** YAML pane edits are undo-integrated via `_pushUndo()` before each change. Ctrl+Z reverts both graph and YAML.
- **Cursor preservation:** The `<pages-yaml-pane>` component stores cursor position before updating the textarea value and restores it after, preventing cursor-jump on graph-initiated YAML changes.

**Relationship to CodeMirror:**
This is a lightweight, standalone YAML editor — not a placeholder for CodeMirror. Both can coexist: `<pages-yaml-pane>` for inline diagram editing (fast, zero-dependency, syntax-coloured), CodeMirror for full-featured editing (bracket matching, error gutters, folding). The component's API (`value`, `readonly`, `yaml-change`) is intentionally simple so either can be composed into diagram workbenches.

---

## Persistence Backend Centralisation

Move `GitHubBackend` and `GitHubBackendConfig` from `pages-diagram-core/src/github-backend.ts` to `graph-core/src/persistence.ts` (or a new `graph-core/src/github-backend.ts` re-exported from the index).

**Migration (all in casehub-pages repo):**
- Move `github-backend.ts` from `pages-diagram-core/src/` to `graph-core/src/`
- Update `graph-core/src/index.ts` to export `GitHubBackend` and `GitHubBackendConfig`
- Remove `github-backend.ts` from `pages-diagram-core/src/` and its re-export from `pages-diagram-core/src/index.ts`
- Update all consumers (`casehub-diagram`, `swf-diagram`, `case-flow-viewer` in blocks-ui) to import from `@casehubio/graph-core`
- No backward-compat re-export — clean cut

---

## Testing

### graph-stencil-org tests

- **Adapter:** Parse each of the 9 archetype YAML files → verify correct GraphModel (node count, edge count, parentId nesting, edge types, properties)
- **YAML editor:** CST-preserving round-trip tests — edit property, verify YAML structure preserved. Add/remove unit, member, relationship.
- **Archetype detection:** Each archetype YAML → verify detected archetype matches expected. Test ambiguous cases (overlapping signals). Test empty/minimal graphs (fallback to force layout). Includes an inline hierarchy fixture (SUPERVISES tree depth > 2) since no pure hierarchy exists in the eidos archetype examples.
- **Layout mapping:** Each strategy → verify ELK options are valid
- **Edge cases:** Empty org (no units), single unit no members, self-referencing relationships rejected (validation), multi-unit agents in matrix

### org-diagram tests

- **ARIA:** Verify role, aria-label on host, canvas, toolbar elements
- **Rendering:** Load simple-structure YAML → verify nodes/edges rendered (non-zero counts)
- **Property editing:** Select agent node → verify property panel shows agentId/role. Edit role → verify YAML updated.
- **Structural editing:** Add unit via palette → verify YAML has new unit. Remove unit → verify YAML and all contained agents/relationships removed.
- **Layout override:** Set layoutStrategy='tree' → verify ELK options use mrtree algorithm
- **Readonly mode:** Set readonly=true → verify palette hidden, property panel readonly, YAML pane readonly

---

## Acceptance Criteria Mapping

| Issue criteria | Spec coverage |
|----------------|---------------|
| Renders `OrganizationalUnit` as containers | org-unit stencil with compound node parentId |
| Renders all 6 `RelationshipKind` with distinct visuals | 6 edge types with unique stroke/arrow styles |
| Shows `extendedKind` label for EXTENDED | Edge label rendering in org-extended type |
| Shows `RelationshipScope` as badge/tooltip | Scope badge on edges when scope present |
| Supports unit nesting via `parentUnitId` | GraphNode.parentId → ELK compound nodes |
| Loads from eidos org YAML format | toOrgGraph adapter with same YAML format |
| At least 3 layout strategies | All 10 archetype layouts via ELK |
| Auto-detection suggests layout | detectArchetype heuristics with confidence |
| All 9 archetype examples render correctly | Adapter tests verify each archetype |

---

## References

- `eidos/org-api/src/main/java/io/casehub/eidos/org/api/` — Java record types (OrganizationalUnit, AgentRelationship, RelationshipKind, RelationshipScope, AttestationGrant, Membership)
- `eidos/examples/org-scenarios/src/test/resources/archetypes/` — 9 archetype YAML examples
- `graph-core/src/model.ts` — GraphModel, GraphNode, GraphEdge, NodeDecoration
- `graph-core/src/persistence.ts` — PersistenceBackend SPI, InMemoryBackend
- `pages-diagram-core/src/diagram-base-mixin.ts` — DiagramBaseMixin (undo/redo, persistence, render pipeline)
- `pages-diagram-core/src/github-backend.ts` — GitHubBackend (to be centralised)
- `graph-renderer/src/layout/elk-layout.ts` — ELK layout with compound node support
- `graph-renderer/src/registry/stencil-registry.ts` — registerStencil, registerEdgeType
- `graph-stencil-case/` — established adapter+stencil pattern (toGraph, applyPropertyEdit, registerCaseStencils, createCaseEditPolicy)
- `casehub-diagram/` — established diagram editor pattern (extends DiagramBaseMixin)
- `blocks-dag-viewer/` — standalone viewer pattern (property-based data, ELK layout)
- `GE-20260801-36b9fa` — Cytoscape.js limitation (custom node shapes)
- `GE-20260809-2cbc61` — ReactFlow vs D3 for force-directed (static ELK force is fine)
- `examples/src/pages/diagram-export-page.ts` — YAML syntax highlighting overlay technique (highlightYaml, transparent textarea over highlighted pre)
- `casehubio/blocks-ui#155` — issue description with acceptance criteria
