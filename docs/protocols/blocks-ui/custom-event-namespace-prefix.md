---
id: PP-20260930-501ce1
title: "Custom events use component namespace prefixes"
type: rule
scope: repo
applies_to: "All blocks-ui components that emit CustomEvents with bubbles: true, composed: true"
severity: important
refs:
  - components/agent-personality-workbench/src/agent-personality-workbench.ts
violation_hint: "A component emits a generic event name like 'selected' or 'changed' without a component prefix — risks collision in composed DOM trees"
created: 2026-09-30
---

Custom events that bubble across shadow boundaries (`composed: true`) must include
a component namespace prefix in the event name: `<component-prefix>:<action>`. Examples:
`avatar-collection:changed`, `archetype-grid:selected`, `catalog:template:selected`.
Generic names like `selected`, `changed`, or `reset` collide when multiple components
share a DOM tree. Filter-scoped events (`filter:profession:changed`) are acceptable
when owned by a single filter component — the `filter` prefix acts as the namespace.
