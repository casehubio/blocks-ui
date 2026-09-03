---
id: PP-20260903-c9a82e
title: "Runtime visual state belongs in NodeDecoration, not GraphNode.properties"
type: rule
scope: repo
applies_to: "all graph-stencil-* packages and components consuming NodeDecoration"
severity: important
refs:
  - packages/graph-stencil-case/src/runtime/runtime-adapter.ts
  - packages/graph-stencil-case/src/runtime/decoration.ts
violation_hint: "Runtime data (trust scores, execution times, status indicators) injected into GraphNode.properties instead of using NodeDecoration fields (badge, pills, tooltip, border)"
created: 2026-09-03
---

`GraphNode.properties` carries definition data parsed from YAML — the static structure of the case/workflow. `NodeDecoration` carries runtime visual overlays — status badges, trust score pills, adaptive decision tooltips. Never inject runtime state into `GraphNode.properties` as a workaround. If `NodeDecoration` lacks the right visual channel, extend it upstream (e.g. the `pills` array added in casehub-pages#404) rather than conflating the two data models.
