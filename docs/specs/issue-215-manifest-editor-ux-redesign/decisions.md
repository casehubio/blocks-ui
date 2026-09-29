# Decisions — #215 Manifest Editor UX Redesign

## D1: Configuration flow model

**Choice:** All-visible single-page layout with pipeline cues (step numbers, status indicators, dim-until-ready states)
**Alternatives:**
- Stepped wizard progression — forces linear flow but slower for power users
- Hybrid collapsible phases — auto-expanding panels, middle ground but adds collapse/expand interaction overhead
**Rationale:** The manifest editor is a configuration form, not a linear onboarding flow. Users need to see and adjust all sections simultaneously. The missing piece is visual dependency feedback, not navigation control.
**Trade-offs:** Less hand-holding for first-time users compared to a wizard. Mitigated by step numbers and completion indicators providing implicit guidance.
**Sources:** components/agent-manifest-editor/src/agent-manifest-editor.ts (current flat layout), issue #215 Gap 1
**Exploration:** quick
**Status:** captured

## D2: Model catalogue scope

**Choice:** Add "Add model" capability to built-in provider cards (parity with "Other" card)
**Alternatives:**
- Static catalogue expansion — expand preset model lists (goes stale)
- Dynamic discovery via providersEndpoint — richest but backend-dependent
- Sources UI + registry — most powerful but heaviest lift, requires platform#291
**Rationale:** Simple, no backend dependency, gives users the ability to add models they know exist (e.g. a newly released model not yet in presets). Achieves parity between built-in and "Other" provider cards.
**Trade-offs:** Users must know model IDs to add them manually. No browsing/discovery. Dynamic discovery (D2-alt-c) can be layered on later without changing this foundation.
**Sources:** components/agent-manifest-editor/src/manifest-provider-card.ts:599-616 (_renderOtherModelList), packages/blocks-ui-core/src/types/manifest.ts (SourceDeclaration), issue #215 Gap 2
**Exploration:** quick
**Status:** captured

## D3: Alias positioning and scope

**Choice:** Keep aliases global (bottom of page) with live resolution preview added
**Alternatives:**
- Per-provider aliases — cleaner visual association but mismatches Manifest type semantics (aliases are global)
- Global + per-provider model tagging — two-way linking, most pipeline-visible but complex
**Rationale:** Alias semantics in the Manifest type are cross-provider (tier + capabilities + preferVendor). Global scope is correct. The UX gap is missing resolution feedback, not wrong positioning.
**Trade-offs:** Aliases remain visually separated from the provider cards they relate to. Mitigated by resolution preview creating the visual link (alias → resolved model name).
**Sources:** packages/blocks-ui-core/src/types/manifest.ts:33-41 (AliasDeclaration), issue #215 Gap 3
**Exploration:** quick
**Status:** captured

## D4: Pipeline visual cues

**Choice:** Step numbers + completion status indicators on section headers
**Alternatives:**
- Vertical flow line with nodes — more visual weight, requires layout restructuring
- Progress bar / stepper strip — compact but doesn't show section-level dependencies
**Rationale:** Lightweight, accessible, requires no layout changes. Numbered sections with completion badges (empty → checkmark) and dimmed states with tooltips on incomplete prerequisites.
**Trade-offs:** Less visually dramatic than a flow line. But the information density is appropriate for a form — overly visual pipeline metaphors can feel out of place in configuration UIs.
**Sources:** issue #215 Gap 1, pages-ui-tokens CSS custom properties
**Exploration:** quick
**Depends on:** D1 (all-visible layout enables numbering)
**Status:** captured

## D5: Alias resolution preview

**Choice:** Resolved model name + match indicator — simple text label per alias row
**Alternatives:**
- Expandable resolution detail — shows match reasoning on click
- Resolution + eligible model highlights — cross-section visual linking on hover/focus
**Rationale:** Minimal, informative, no extra interaction. Shows "reasoning-heavy → Claude Opus 4.6" computed live. Warning state for "(no match)" makes configuration gaps immediately visible.
**Trade-offs:** Users don't see *why* a model was chosen without inspecting the alias constraints. Acceptable because the constraints are visible in the same row (tier/capabilities/preferVendor fields).
**Sources:** components/agent-manifest-editor/src/agent-manifest-editor.ts:259-265 (_isStalePreferVendor — existing partial validation), issue #215 Gap 3
**Exploration:** quick
**Depends on:** D3 (global positioning with resolution preview)
**Status:** captured
