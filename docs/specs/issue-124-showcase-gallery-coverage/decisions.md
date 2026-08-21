# Decisions — Combined Diagram Composition

## D1: Worker SWF patterns for demo

**Choice:** All three candidates get `do:` blocks — fraud-ml-agent (pipeline), sanctions-screener (branching), risk-aggregator (fan-in + try/catch)
**Alternatives:**
- Two workers only — less demo coverage but simpler YAML
- One worker only — minimal demo, doesn't show pattern variety
**Rationale:** Three workers showcase distinct SWF patterns in thumbnails, making the composition demo richer
**Trade-offs:** More YAML to maintain in the example
**Sources:** `packages/graph-stencil-case/src/stencils/worker.ts`, `packages/graph-stencil-swf/src/thumbnail/swf-thumbnail.ts`
**Exploration:** quick
**Status:** captured

## D2: Drill-down composition mode

**Choice:** Replace mode — right pane shows one SWF diagram at a time, clicking a different worker swaps it
**Alternatives:**
- Tab mode — multiple SWF diagrams open as tabs, more complex state management
- Panel/overlay mode — SWF opens as drawer over the case diagram, loses side-by-side context
**Rationale:** Same pattern as orchestration-workbench and trust-workbench; uses split-workbench directly; avoids tab lifecycle complexity
**Trade-offs:** Can't compare two workers' workflows side by side
**Sources:** `components/orchestration-workbench/`, `components/trust-workbench/`
**Exploration:** quick
**Status:** captured

## D3: Thumbnail sizes

**Choice:** Keep existing 180×100 collapsed / 300×200 expanded
**Alternatives:**
- Larger expanded (400×280) — more detail visible but dominates the case diagram layout
**Rationale:** Current sizes are reasonable per user feedback; ELK per-node overrides handle the layout reflow
**Trade-offs:** Complex workflows may be hard to read at 300×200
**Sources:** `packages/graph-stencil-case/src/stencils/worker.ts:103-105`
**Exploration:** quick
**Status:** captured
