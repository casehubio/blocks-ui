---
id: PP-20260713-8ea1af
title: "Use typed config properties + render callbacks for domain customisation"
type: rule
scope: repo
applies_to: "all blocks-ui components that allow domain-specific extension"
severity: important
refs:
  - components/list-pane/src/list-pane.ts
  - components/audit-trail-viewer/src/audit-trail-viewer.ts
  - components/trust-score-panel/src/trust-score-panel.ts
  - components/detail-pane/src/detail-pane.ts
  - components/kpi-metric-row/src/kpi-metric-row.ts
violation_hint: "A component uses named slots for content customisation, or requires subclassing to inject domain-specific rendering"
created: 2026-07-13
---

Components customise through three mechanisms, applied in order of preference:

1. **Typed config properties** — data shape contracts passed as reactive properties
   (`columnConfig`, `tabs: TabDefinition[]`, `metrics: MetricDefinition[]`).
2. **Optional render callbacks** — functions passed as properties that override
   specific rendering sections, returning `TemplateResult | undefined`. The component
   provides a sensible default when the callback is absent or returns `undefined`
   (`renderEntryPayload`, `columnRenderers`, badge callbacks on `TabDefinition`).
3. **Factory method overrides** — protected methods on mixins that subclasses override
   to control cross-cutting behaviour (`createSourceFactory()`, `resolveEndpoint()`).

Slots are reserved for **layout shells only** (e.g. `split-workbench` projecting
`list`/`detail`/`header` slots). Content components never use slots for domain
customisation — they accept typed properties and callbacks instead.

4. **Render callbacks use inline styles** — callback output (e.g. `columnRenderers`,
   `renderCandidate`) is rendered inside the consuming component's shadow DOM, not
   the defining component's. CSS classes from the defining component's `static styles`
   have no effect across this shadow boundary. All render callback output must use
   inline styles to be self-contained. Ref: GE-20260717-4618a1, #67.
