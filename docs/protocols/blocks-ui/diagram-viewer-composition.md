---
id: PP-20260903-79eda0
title: "Diagram components compose shared pipeline pieces for read-only viewing"
type: principle
scope: repo
applies_to: "all diagram components in blocks-ui (casehub-diagram, swf-diagram, blocks-case-flow-viewer, future diagram viewers)"
severity: important
refs:
  - components/case-flow-viewer/src/blocks-case-flow-viewer.ts
  - components/casehub-diagram/src/casehub-diagram.ts
violation_hint: "A new viewer component duplicates rendering logic from an editor, or an editor is wrapped/hidden rather than composed from shared pipeline pieces"
created: 2026-09-03
---

Diagram editors and their read-only viewer counterparts compose the same shared rendering pipeline pieces (adapter, stencils, ELK layout, graph canvas, decorations) — they are independent compositions, not extractions or duplications. A viewer does not copy code from an editor, wrap an editor with features hidden, or build a parallel rendering path. Both the editor and viewer import the same functions (`toGraph`, `toDecorations`, `computeElkLayout`, `registerStencils`) and wire them independently. New read-only viewers extend `DiagramBaseMixin` in readonly mode and override `_adaptYaml()` and `_decorations()`.
