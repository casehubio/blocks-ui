## D1: Tab content rendering approach (REVISED after decision review)

**Choice:** Render callbacks on TabDefinition + standalone components for complex tabs, inline templates for simple tabs
**Alternatives:**
- All direct rendering in workbench — simpler but grows the workbench to 600-800 lines, no test isolation for complex tab content, custom tabs lose their rendering path
- All standalone components — unnecessary overhead for thin wiring tabs (audit, health)
- Remove detail-pane entirely — reimplements tested ARIA tab bar, loses custom tab support
**Rationale:** detail-pane was designed for item-detail views (`.item` selection), not tabbed dashboards. The root fix is `renderContent?: () => TemplateResult` on TabDefinition — PP-20260713-8ea1af mechanism #2 (render callbacks). This lets the workbench provide closures that capture its data. Complex tabs (Streams, Inbox) warrant standalone components because they have clear data contracts (~100+ lines each), action handlers, and genuine reuse potential. Simple tabs (Config, Audit, Health) are inline templates — just wiring existing components. Custom tabs fall back to `tagName` element creation.
**Trade-offs:** Two new domain components in evolution-config, plus a minor detail-pane API addition (~10 lines). Both are additive and backward-compatible.
**Sources:** decision-review R1-01 (custom tabs have no rendering path), R1-02 (render callbacks are protocol-aligned), PP-20260713-8ea1af mechanism #2, notification-inbox (groups 7 related components in one package), evolution-workbench.ts (standalone mode hack: `this._item = {}`)
**Exploration:** deep-analysis (decision review surfaced the root mismatch, first-principles analysis revised the approach)
**Status:** captured

## D2: Preview integration for deny-pattern testing and gate-policy impact

**Choice:** Extend editors inline — add preview sections directly inside deny-pattern-editor and gate-policy-editor
**Alternatives:**
- Separate preview components — more modular but splits related domain logic across files
- Workbench-level preview — centralises rendering but couples preview to workbench context
**Rationale:** The editors already have EvolutionApi access and own the relevant data. Preview appears inline below the add-form / policy table. Keeps domain logic co-located. Editors receive streams data via a new `streams` property for preview matching.
**Trade-offs:** Editors grow larger. Manageable since preview is a contained section.
**Sources:** deny-pattern-editor.ts (already has `_api`, `_handleAdd`), PP-20260713-8ea1af (component-customisation-pattern — typed config properties, not separate components), decision-review R1-06
**Exploration:** quick
**Status:** captured

## D3: File structure — workbench stays thin via component extraction

**Choice:** Workbench stays at ~300-350 lines. Complex tab content lives in standalone components (Streams, Inbox) within evolution-config. Simple tab content is inline callbacks.
**Alternatives:**
- All in workbench — grows to 600-800 lines with real tab content (decision-review R1-04)
- Per-tab helper files — file splitting without component boundaries, harder to test
**Rationale:** D1 revision naturally resolves file growth. Streams and Inbox have genuine component boundaries (clear data contracts, own tests). No premature splitting needed.
**Trade-offs:** None — the decomposition follows from D1.
**Depends on:** D1
**Sources:** decision-review R1-04 (file growth estimate), evolution-workbench.ts (currently ~270 lines)
**Exploration:** quick
**Status:** captured

## D4: Responsive layout approach

**Choice:** CSS container queries on the workbench host
**Alternatives:**
- ResizeObserver + breakpoint state — more control but unnecessary complexity
- Defer to last — ordering concern only, not an architecture decision
**Rationale:** The metric-grid wraps naturally with flex-wrap. Tabs scroll horizontally. No JS resize observers needed. Container queries are well-supported and work because the workbench is always a flex child.
**Trade-offs:** Container queries require `container-type: inline-size` on the host, which is a layout commitment. Acceptable for a dashboard component.
**Sources:** evolution-workbench.ts (.metric-grid already uses flex-wrap)
**Exploration:** quick
**Status:** captured

## D5: Extend detail-pane with render callbacks (REVISED after decision review)

**Choice:** Add `renderContent?: (item: unknown) => TemplateResult` to `TabDefinition`. Keep detail-pane. Workbench provides closures for built-in tabs; custom tabs fall back to `tagName` element creation.
**Alternatives:**
- Remove detail-pane entirely — reimplements ~40 lines of ARIA tablist, breaks custom tab support (decision-review R1-01)
- Named slots — violates PP-20260713-8ea1af (slots only for layout shells)
**Rationale:** The render callback is the protocol-prescribed solution. detail-pane has a tested tab bar with ARIA keyboard navigation. The change is ~10 lines in detail-pane and is backward-compatible — zero existing consumers need to change (detail-pane has exactly 2 consumers: evolution-workbench and worker-task-pane). worker-task-pane could also benefit from render callbacks instead of its current `.item` hack.
**Trade-offs:** detail-pane gains a second rendering path (callback vs createElement). Small complexity increase for a large benefit.
**Depends on:** D1 (render callbacks are the unified mechanism)
**Sources:** decision-review R1-02 (protocol-aligned), detail-pane.ts (2 consumers only), worker-task-pane.ts (line 157, _item hack), PP-20260713-8ea1af mechanism #2
**Exploration:** deep-analysis (decision review challenged the original approach, first-principles analysis confirmed the revision)
**Status:** captured
