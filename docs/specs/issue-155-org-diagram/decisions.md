## D1: Component interactivity

**Choice:** Full interactive editing — extends DiagramBaseMixin in edit mode
**Alternatives:**
- Read-only + layout picker — display only with layout override dropdown. Simpler but doesn't allow creating/editing org structures visually.
- Fully read-only — no interactive controls beyond pan/zoom. Too limited.
**Rationale:** The org diagram is a first-class authoring tool, not just a viewer. Users need to create and edit organizational structures visually.
**Trade-offs:** Significantly more scope — CST-preserving YAML edits, palette, property panel, structural editing. Worth it for the authoring use case.
**Sources:** casehub-diagram pattern, DiagramBaseMixin API
**Exploration:** quick
**Status:** captured

## D2: YAML format

**Choice:** Same YAML format as eidos archetype examples (`organization:` > `units:` + `relationships:`)
**Alternatives:**
- Simplified format — optimised for visual editor with translation layer. Adds indirection between UI and runtime.
**Rationale:** Direct compatibility with eidos runtime (ClasspathYamlOrgRegistrar). No translation layer needed. Users can hand-edit the same files.
**Trade-offs:** Constrained by the existing YAML schema, which wasn't designed for a visual editor. CST-preserving edits need to handle the nested structure.
**Sources:** eidos org-runtime YAML loading, 9 archetype examples
**Exploration:** quick
**Status:** captured

## D3: YAML text editor

**Choice:** Generic lightweight YAML editor (`<pages-yaml-pane>`) in pages-diagram-core, composable with any DiagramBaseMixin subclass. Regex-based syntax highlighting extracted from diagram-export-page.ts. Stands alongside CodeMirror as a lighter tier — not a placeholder for it.
**Alternatives:**
- Org-diagram-specific YAML editor — builds it only for the org diagram. Violates platform coherence since all diagram types need this.
- Wait for CodeMirror — blocks progress on another slot.
**Rationale:** The YAML+visual composition is a generic platform concern. All diagram types (case, SWF, org) benefit. Minimal throwaway code with a textarea placeholder.
**Trade-offs:** Regex highlighting is less robust than a proper parser (can miscolour edge cases), but adequate for YAML editing alongside a visual diagram.
**Sources:** casehub-diagram (currently has no YAML pane), pages-diagram-core (DiagramBaseMixin owns _currentYaml)
**Exploration:** quick
**Status:** captured

## D4: Structural editing scope

**Choice:** Full structural editing — add/remove/edit units, members, relationships, scope, attestation
**Alternatives:**
- Units + relationships only — members/capabilities/goals/constraints via YAML editor only. Reduces visual editing scope.
- Relationships only — units defined in YAML, visual editor manages relationships. Minimalist.
**Rationale:** With a YAML text editor alongside, users can fall back to text for edge cases. But the visual editor should cover the full model to be the primary authoring tool.
**Trade-offs:** Large number of property schemas and CST-preserving edit operations. The YAML editor provides a safety net.
**Sources:** casehub-diagram structural editing (addElement, removeElement, switchBindingTarget)
**Exploration:** quick
**Status:** captured

## D5: Layout strategies

**Choice:** All 10 archetype layouts via ELK algorithm selection
**Alternatives:**
- Core 5 layouts — covers most common archetypes. Matrix and holarchy as future work.
- Minimum 3 — tree, circular, flow. Others fall back to closest match.
**Rationale:** ELK supports the algorithms needed (layered, mrtree, radial, force, stress). The mapping is configuration, not new code. All 9 archetype examples should render correctly.
**Trade-offs:** Matrix (bipartite) and holarchy (nested) may need special ELK configuration or custom pre-processing beyond simple algorithm selection.
**Sources:** ELK layout algorithms, elk-layout.ts (already supports compound nodes via parentId)
**Exploration:** quick
**Status:** captured

## D6: Rendering approach

**Choice:** ELK + pages-graph-canvas (ReactFlow wrapper) via DiagramBaseMixin pipeline
**Alternatives:**
- D3 SVG directly — full control but doesn't reuse diagram infrastructure. More work.
- ELK layout + custom SVG — ELK for positions, custom rendering. New rendering path.
**Rationale:** The org diagram is fundamentally a static layout (not interactive force-directed). ELK handles compound nodes. The stencil registry handles custom node/edge rendering. Read-only force layout (pre-computed by ELK) works fine without drag-to-rebalance.
**Trade-offs:** Locked into ELK's layout algorithms. If a specific archetype needs a truly custom layout (e.g. matrix bipartite grid), it may need ELK configuration workarounds rather than a custom algorithm.
**Sources:** GE-20260809-2cbc61 (ReactFlow wrong for interactive force but fine for static), elk-layout.ts compound node support, case-flow-viewer pattern
**Exploration:** quick
**Status:** captured

## D7: Persistence backend centralisation

**Choice:** Centralise PersistenceBackend implementations alongside the SPI in graph-core
**Alternatives:**
- Leave GitHubBackend in pages-diagram-core — current state, scattered.
- Create a separate persistence package — over-engineered for 2 implementations.
**Rationale:** The SPI (PersistenceBackend interface) is in graph-core. GitHubBackend is in pages-diagram-core. InMemoryBackend is in graph-core. Moving GitHubBackend to graph-core co-locates interface and implementations.
**Trade-offs:** Requires migrating imports in casehub-diagram and any other consumer of GitHubBackend from pages-diagram-core.
**Sources:** graph-core/persistence.ts, pages-diagram-core/github-backend.ts
**Exploration:** quick
**Status:** captured

## D8: Package structure (note: D9-D15 below are for casehub-pages#412)

**Choice:** Two new packages: `packages/graph-stencil-org` + `components/org-diagram`
**Alternatives:**
- Single component — everything in one package. Violates established separation (adapter reusability).
- Three packages with workbench — premature; no second diagram type to compose with.
**Rationale:** Follows the exact pattern established by graph-stencil-case + casehub-diagram. The stencil package is reusable — a future read-only org viewer can consume graph-stencil-org without depending on the editor.
**Trade-offs:** Two packages to maintain instead of one. Worth it for reusability.
**Sources:** graph-stencil-case + casehub-diagram pattern, graph-stencil-swf + swf-diagram pattern, graph-stencil-htn + blocks-dag-viewer pattern
**Exploration:** quick
**Status:** captured

---

*Decisions D9–D15 are for casehubio/casehub-pages#412 — global handle optimization.*

## D9: Success metric — zero straight-line crossings

**Choice:** Zero straight-line crossings as the success metric — tighten the validator to flag intra-container edge-edge crossings as violations
**Alternatives:**
- Reduce visual crossings — keep validator lenient, optimizer improves quality but SmartBezierEdge remains the safety net. Tests stay green by default but don't verify actual quality.
- Phased — zero-crossing for solvable cases, SmartBezierEdge fallback for K2,2. Adds complexity distinguishing solvable from unsolvable.
**Rationale:** If the validator doesn't catch crossings, the optimizer has no verifiable success criterion. The existing tests pass trivially because intra-container crossings are skipped. Making them real violations forces the optimizer to actually solve the problem.
**Trade-offs:** May need to mark specific K2,2 cases as mathematically exempt if they prove unsolvable even with position offsets. The grid search offset capability should handle most of these.
**Sources:** edge-routing-validator.ts (lines 110-117 — intra-container skip), casehubio/casehub-pages#412
**Exploration:** quick
**Status:** captured

## D10: Algorithm approach — custom brute-force enumeration with pruning

**Choice:** Enumerate all possible handle assignments for all edges simultaneously, score by total crossings, pick the minimum. Prune by handle exclusivity and node-crossing. Custom optimizer rather than ELK ports.
**Alternatives:**
- ELK native port constraints (`portConstraints: 'FREE'`) — standard solution but only works for layered algorithm. Federation (motivating case) uses radial. Excluded-from-layout edges are invisible to ELK. Would need a hybrid approach anyway.
- Constraint satisfaction (CSP with arc consistency) — well-studied framework but implementing a solver adds complexity. Overkill for problem size.
- Iterative improvement (simulated annealing) — works for large graphs but non-deterministic, harder to test, may miss global optimum.
- Hybrid: ELK ports for layered, custom for rest — two code paths, ELK port mapping complexity.
**Rationale:** Org diagrams are small (5-20 nodes, 5-30 edges). For 5 layout edges, 16^5 = ~1M combinations — trivially fast. Guarantees global optimum and is deterministic (same input → same output), making it testable. One uniform algorithm handles all layout types and excluded edges.
**Trade-offs:** Exponential worst case for large graphs. Mitigated by: (a) org diagrams are small, (b) pruning reduces effective search space, (c) can add time budget fallback later. Building custom code rather than using the standard ELK solution.
**Sources:** mapping.ts autoDetectHandleDirections, ELK portConstraints documentation, federation archetype (radial layout)
**Exploration:** deep-analysis (internet research on ELK port constraints)
**Status:** captured

## D11: Replacement strategy — replace greedy entirely

**Choice:** The global optimizer replaces the greedy algorithm entirely, considering all edges simultaneously from scratch
**Alternatives:**
- Greedy seed + improve — run greedy first, then try global optimization. Two code paths.
- Replace with time-budget fallback — use global optimizer but fall back to greedy if it exceeds a time budget.
**Rationale:** One algorithm, not two paths. Simpler code, simpler testing. The greedy code becomes dead.
**Trade-offs:** No fallback for unexpectedly large graphs. Acceptable because org diagrams are bounded in size.
**Sources:** mapping.ts (current greedy: lines 108-315)
**Exploration:** quick
**Status:** captured
**Depends on:** D10

## D12: Scope — handle assignment + position offsets

**Choice:** Optimizer assigns handles from 4 sides per node AND can adjust ELK-computed node positions with small offsets to break geometric ties
**Alternatives:**
- Handle assignment only — simpler, well-bounded search space. Position offsets deferred.
- Handle first, offset later — phased approach. Ships sooner but may leave unsolved crossings.
**Rationale:** Some node configurations (K2,2 subgraphs) produce mathematically unavoidable straight-line crossings at fixed positions. Position offsets break these symmetries.
**Trade-offs:** Larger search space. Kept bounded by only trying offsets on nodes involved in remaining crossings after handle optimization.
**Sources:** casehubio/casehub-pages#412 issue description (position flexibility requirement)
**Exploration:** quick
**Status:** captured
**Depends on:** D10

## D13: Edge priority — all edges equal weight

**Choice:** All edges have equal weight in crossing minimisation, including excluded-from-layout edges (BACKS_UP, inverse REPORTS_TO)
**Alternatives:**
- Layout edges prioritised — layout edges as hard constraints, excluded edges as soft.
- Weighted scoring — per-edge-type weights. Fine-grained but adds configuration surface.
**Rationale:** All edges render visually, so all crossings are equally visible to users.
**Trade-offs:** May make optimization harder by not prioritising structurally important edges. In practice, equal weight is simpler and produces the best visual result.
**Sources:** org-adapter.ts (smart exclusion: lines 151-163), mapping.ts (all edges passed to autoDetectHandleDirections)
**Exploration:** quick
**Status:** captured

## D14: Position offset strategy — grid search small offsets

**Choice:** After handle optimization, if crossings remain, try ±10px and ±20px offsets on each axis for nodes involved in crossings. Discrete, bounded, deterministic. At most 8 positions per node.
**Alternatives:**
- Gradient-based nudge — compute crossing-minimising direction. More precise but harder to implement and less deterministic.
- No offsets (defer) — ship handle-only optimizer first. Risks leaving unsolvable crossings.
**Rationale:** Grid search is simple, bounded, and deterministic. 8 candidate positions per node is tractable. Combined with handle re-optimization at each offset position, this covers common geometric deadlocks.
**Trade-offs:** Fixed offset magnitudes may not be optimal for all node sizes. 20px is small enough to not visibly disrupt the layout but large enough to break geometric ties.
**Sources:** mapping.ts handlePosPoint
**Exploration:** quick
**Status:** captured
**Depends on:** D12

## D15: ELK ports — not used

**Choice:** Do not use ELK's native port constraint system
**Alternatives:**
- `portConstraints: 'FREE'` on ELK nodes — standard graph drawing solution for crossing minimization
- Hybrid: ELK ports for layered, custom for non-layered
**Rationale:** ELK port optimization only works well for the layered algorithm. Our org layouts use 5+ different algorithms (layered, mrtree, radial, force, stress). The motivating case (federation) uses radial. Excluded-from-layout edges are invisible to ELK. A custom optimizer provides uniform handling across all cases.
**Trade-offs:** We're building a custom solution where a standard one exists — but the standard one only covers ~40% of our layout strategies.
**Sources:** ELK portConstraints documentation, orgLayoutOptions() (10 strategies, 5 algorithms)
**Exploration:** deep-analysis (internet research confirmed ELK port limitations)
**Status:** captured
**Depends on:** D10
