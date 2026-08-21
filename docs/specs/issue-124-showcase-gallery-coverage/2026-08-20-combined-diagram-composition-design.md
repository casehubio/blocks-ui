# Combined Diagram Composition

**Branch:** issue-124-showcase-gallery-coverage
**Issue:** #124
**Date:** 2026-08-20

## Summary

Demonstrate diagram composition — a case diagram with embedded SWF workflow thumbnails inside worker nodes, and a split-pane workbench that shows a full SWF diagram alongside the case diagram on drill-down.

Two deliverables, both in blocks-ui (no pages changes):
1. Enrich the casehub-diagram example with SWF `do:` blocks in three workers
2. New `diagram-workbench` component composing case + SWF diagrams via split-workbench

## Part 1 — Embedded SWF Thumbnails

### What exists

- Worker stencil (`graph-stencil-case/stencils/worker.ts`) renders a `<worker-thumbnail>` when the worker's properties contain a `do` block and `getThumbnailRenderer('swf')` returns a renderer
- `graph-stencil-swf` exports `createSwfThumbnailRenderer()` which renders a cached SVG preview of SWF steps
- `WorkerThumbnail` custom element has expand/collapse toggle (180×100 collapsed, 300×200 expanded) that emits `worker-expand-toggle`
- `casehub-diagram` handles `worker-expand-toggle` by adding the worker ID to `_expandedWorkers` and re-running ELK layout with per-node size overrides
- Worker stencil emits `diagram:worker-drill-down` with the `do` block wrapped as a standalone SWF document YAML

### What's missing

The example YAML (`casehub-diagram-page.ts`) has no workers with `do:` blocks. All workers use `agent:`, `a2a:`, or `mcp:` function types — none contain SWF workflow definitions.

### Changes

**File:** `examples/src/pages/casehub-diagram-page.ts`

1. Import and register the SWF thumbnail renderer:
   ```typescript
   import { createSwfThumbnailRenderer } from '@casehubio/graph-stencil-swf';
   import { registerThumbnailRenderer } from '@casehubio/graph-stencil-case';
   registerThumbnailRenderer('swf', createSwfThumbnailRenderer());
   ```

2. Add `do:` blocks to three workers in the YAML, each showing a different SWF pattern:

   **fraud-ml-agent** — sequential pipeline (4 steps):
   ```yaml
   do:
     - fetchEnrichment:
         call: http
         with: { method: post, endpoint: { uri: https://api.internal/enrich } }
     - runModel:
         call: http
         with: { method: post, endpoint: { uri: https://api.internal/ml/fraud } }
     - computeScore:
         set:
           fraudScore: ${.runModel.output.score}
     - checkThreshold:
         switch:
           - when: ${.fraudScore > 0.8}
             then: flagForReview
           - when: ${.fraudScore <= 0.8}
             then: pass
   ```

   **sanctions-screener** — branching with escalation:
   ```yaml
   do:
     - fetchPEPLists:
         call: http
         with: { method: get, endpoint: { uri: https://api.internal/sanctions/pep-lists } }
     - screenClaimant:
         call: http
         with: { method: post, endpoint: { uri: https://api.internal/sanctions/screen } }
     - routeResult:
         switch:
           - when: ${.screenClaimant.output.hit}
             then: escalateToCompliance
           - when: ${!.screenClaimant.output.hit}
             then: recordClearance
   ```

   **risk-aggregator** — fan-in with error handling:
   ```yaml
   do:
     - aggregateInputs:
         try:
           do:
             - combineSanctions:
                 call: http
                 with: { method: post, endpoint: { uri: https://api.internal/risk/sanctions } }
             - combineFraud:
                 call: http
                 with: { method: post, endpoint: { uri: https://api.internal/risk/fraud } }
             - combineMedical:
                 call: http
                 with: { method: post, endpoint: { uri: https://api.internal/risk/medical } }
           catch:
             errors: [ * ]
             do:
               - handleMissingInput:
                   call: http
                   with: { method: post, endpoint: { uri: https://api.internal/risk/fallback } }
     - computeOverallRisk:
         call: http
         with: { method: post, endpoint: { uri: https://api.internal/risk/compute } }
   ```

### Expected result

The casehub-diagram example shows worker nodes with:
- SWF thumbnail previews (collapsed by default at 180×100)
- Expand/collapse chevron to toggle between 180×100 and 300×200
- Drill-down button (⤢) that emits `diagram:worker-drill-down`
- Three distinct workflow patterns visible in the thumbnails

## Part 2 — Diagram Workbench

### Component

**Path:** `components/diagram-workbench/`

A composition shell that places `casehub-diagram` on the left and `swf-diagram` on the right, using `split-workbench` for the split-pane layout.

### Props

| Property | Type | Description |
|----------|------|-------------|
| `yaml` | `string` | Case definition YAML (passed to casehub-diagram) |
| `src` | `string` | Optional fetch URL for case YAML |
| `runtimeState` | `CaseRuntimeState \| null` | Optional runtime overlay |

### Behavior

1. **Initial state:** Left pane shows casehub-diagram with the case definition. Right pane shows an empty state: "Click ⤢ on a worker to inspect its workflow"
2. **On drill-down:** Listens for `diagram:worker-drill-down` event from the left pane. Extracts `workerName` and `doYaml` from the event detail. Right pane renders `<swf-diagram .yaml=${doYaml} layout-direction="RIGHT"></swf-diagram>` with a header showing the worker name.
3. **Replace mode:** Clicking drill-down on a different worker replaces the right pane content. One SWF diagram visible at a time.
4. **Close:** A close button in the right pane header returns to the empty state.

### Internal structure

```html
<split-workbench>
  <div slot="header">Diagram Workbench</div>
  <div slot="list">
    <casehub-diagram
      .yaml=${this.yaml}
      .src=${this.src}
      .runtimeState=${this.runtimeState}
    ></casehub-diagram>
  </div>
  <div slot="detail">
    ${this._selectedWorker
      ? html`
        <div class="worker-header">
          <span>${this._selectedWorker.name}</span>
          <button @click=${this._clearSelection}>✕</button>
        </div>
        <swf-diagram
          .yaml=${this._selectedWorker.yaml}
          layout-direction="RIGHT"
        ></swf-diagram>`
      : html`<div class="empty">Click ⤢ on a worker to inspect its workflow</div>`}
  </div>
</split-workbench>
```

### Example page

**Path:** `examples/src/pages/diagram-workbench-page.ts`

- Registers in `shell.ts` under the Diagrams nav category
- Uses the same enriched YAML from Part 1
- Registers SWF stencils and thumbnail renderer

### Dependencies

- `@casehubio/blocks-ui-casehub-diagram`
- `@casehubio/blocks-ui-swf-diagram`
- `@casehubio/blocks-ui-split-workbench`
- `@casehubio/graph-stencil-case` (for thumbnail registration)
- `@casehubio/graph-stencil-swf` (for stencil + thumbnail registration)

## Implementation order

1. Part 1: Add `do:` blocks to YAML, register thumbnail renderer in example page
2. Verify thumbnails render in casehub-diagram example
3. Part 2: Create diagram-workbench component
4. Create diagram-workbench example page, register in shell
5. Verify drill-down opens SWF diagram in right pane

## References

- `packages/graph-stencil-case/src/stencils/worker.ts` — thumbnail rendering and drill-down event emission
- `packages/graph-stencil-case/src/thumbnail-registry.ts` — ThumbnailRenderer SPI
- `packages/graph-stencil-swf/src/thumbnail/swf-thumbnail.ts` — SVG thumbnail renderer
- `components/casehub-diagram/src/casehub-diagram.ts` — worker expand handling
- `components/split-workbench/` — split-pane layout shell
- `components/orchestration-workbench/` — reference pattern for split composition
