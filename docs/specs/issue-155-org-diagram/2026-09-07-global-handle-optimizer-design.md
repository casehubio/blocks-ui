# Global Handle Optimizer — casehub-pages#412

## Problem

`autoDetectHandleDirections` assigns handles greedily edge-by-edge without
backtracking. Earlier assignments block better options for later edges,
producing avoidable crossings (federation archetype is the simplest case).

## Solution

Replace the greedy algorithm with a global optimizer in two phases:

### Phase 1 — Handle enumeration

Enumerate all valid (source-side, target-side) pairs for all edges
simultaneously. Score each complete assignment by total edge-edge crossings.
Pick the assignment with minimum crossings. Prune by handle exclusivity
(no same-side source+target collision) and node-crossing checks.

### Phase 2 — Position offsets

If Phase 1's best assignment still has crossings, identify involved nodes.
Try grid offsets (±10px, ±20px on each axis — 8 candidates per node).
Re-run Phase 1 scoring for each offset. Pick minimum.

### Validator tightening

Remove intra-container edge-edge crossing skip from `edge-routing-validator.ts`.
All crossings become violations. Tests must pass with zero violations.

## Scope

- **Where:** `packages/graph-renderer/src/mapping.ts` (casehub-pages repo,
  tested via `.casehub-packages` dist copy in blocks-ui)
- **Validator:** `packages/graph-renderer/src/edge-routing-validator.ts`
- **Tests:** `components/org-diagram/src/edge-routing-tdd.test.ts` (9 archetypes)
- All edges equal weight (including excluded-from-layout)
- All layout algorithms (layered, mrtree, radial, force, stress)
- ELK ports not used (only works for layered; federation uses radial)

## Decisions

D9–D15 in `decisions.md`.

## References

- `mapping.ts:108-315` — current greedy `autoDetectHandleDirections`
- `edge-routing-validator.ts:110-117` — intra-container skip to remove
- `org-adapter.ts:151-163` — smart edge exclusion (excludeFromLayout)
- `layout-strategy.ts` — 10 org layout strategies, 5 ELK algorithms
- ELK `portConstraints` docs — researched and rejected (D15)
- casehubio/casehub-pages#412
