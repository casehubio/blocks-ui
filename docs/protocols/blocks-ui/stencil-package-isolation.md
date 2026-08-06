---
id: PP-20260806-320d50
title: "Stencil packages must not import from each other — use registry inversion"
type: rule
scope: repo
applies_to: "all graph-stencil-* packages in blocks-ui"
severity: important
refs:
  - packages/graph-stencil-case/src/thumbnail-registry.ts
  - packages/graph-stencil-swf/src/thumbnail/swf-thumbnail.ts
violation_hint: "A graph-stencil-* package has an import from another graph-stencil-* package"
created: 2026-08-06
---

Stencil packages (graph-stencil-case, graph-stencil-swf, future domain stencils) must
never import from each other. Cross-stencil integration uses registries (ThumbnailRenderer
SPI) or events (diagram:worker-drill-down) — the hosting application wires packages together
at init time. This keeps stencil packages independently loadable: an app that uses only case
diagrams never pulls in SWF dependencies, and vice versa.
