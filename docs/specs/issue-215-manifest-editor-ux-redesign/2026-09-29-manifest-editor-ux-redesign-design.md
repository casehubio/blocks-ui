# Design: agent-manifest-editor UX Redesign

**Issue:** #215
**Date:** 2026-09-29
**Status:** Draft

## Problem

The manifest editor's core mechanics work (providers, models, credentials,
aliases) but the UX doesn't communicate the configuration pipeline. Three
gaps: (1) no visual dependency chain between provider setup → model
selection → alias resolution, (2) built-in providers lack model
catalogue/add-model capability that "Other" already has, (3) aliases at
page bottom are disconnected from the models they resolve to.

## Design Overview

Three changes to `agent-manifest-editor` and `manifest-provider-card`,
all within the existing single-page layout. No new components. No
structural layout changes.

### 1. Pipeline Visual Cues — Step Numbers + Status Indicators

Add numbered section headers with completion status badges to the three
pipeline stages: **1. Providers**, **2. Models**, **3. Aliases**.

**Section header rendering:**

Each section gets a `<div class="pipeline-step">` wrapper containing:
- Step number in a circle (16px diameter)
- Section title
- Status badge: empty circle (incomplete), checkmark (complete), warning (partial)

**Completion logic:**

| Section | Complete when | Warning when |
|---------|--------------|--------------|
| Providers | ≥1 provider has credential or host set | Provider expanded but no credential |
| Models | ≥1 model selected across all providers | Models selected but no credential for their provider |
| Aliases | All alias keys non-empty, no duplicates | Alias resolves to (no match) |

**Dimming behaviour:**

- Models section: if no providers configured, section title shows
  "Configure a provider first" tooltip, model lists render at 40% opacity
- Aliases section: if no models selected, same treatment

This does NOT block interaction — users can still edit any section in any
order. Dimming is informational, not a gate.

**Implementation notes:**
- New CSS classes: `.pipeline-step`, `.step-number`, `.step-status`
- Completion state computed in `render()` from `_providerStates` and
  `_aliases` — no new state needed
- Existing `.section-title` class replaced by `.pipeline-step` in the
  three main sections

### 2. Add-Model on Built-In Provider Cards

Give built-in provider cards the same manual model entry that "Other"
already has, below the preset checkbox list.

**Current state:**
- Built-in cards: `_renderModelList()` → tier-grouped checkboxes, fixed list
- Other card: `_renderOtherModelList()` → manual entry with id/displayName/contextWindow

**Change:**
- Add an "Add model" button at the bottom of `_renderModelList()` (after
  the tier groups)
- Clicking it adds a row with id/displayName/contextWindow inputs, same
  as the Other card's model rows
- Added models appear in the tier group matching their tier (default
  STANDARD), or in an "Added" group if no tier specified
- Added models are included in the `models` array in `_emitChanged()`
- Added models persist in `_providerStates` via the existing
  `selectedModels` array

**New state on ManifestProviderCard:**
- `_addedModels: ModelDescriptor[]` — manually added models (separate
  from preset `models` prop)
- The checkbox list renders `[...this.models, ...this._addedModels]`

**Validation:**
- Duplicate model ID within the same provider: show error (reuse
  `_hasDuplicateModelId`)
- Empty model ID: prevent adding to selectedModels

**No changes to `Manifest` type.** Added models flow through the existing
`ModelDescriptor` array.

### 3. Alias Resolution Preview

Add a live-computed "resolves to" column to each alias row.

**Resolution algorithm:**

```typescript
function resolveAlias(
  alias: AliasDeclaration,
  allSelectedModels: ModelDescriptor[],
): ModelDescriptor | null {
  const candidates = allSelectedModels.filter(m => {
    if (alias.tier && m.tier !== alias.tier) return false;
    if (alias.capabilities?.length) {
      if (!alias.capabilities.every(c => m.capabilities?.includes(c))) return false;
    }
    if (alias.locality && m.locality !== alias.locality) return false;
    if (alias.maxCost) {
      const costOrder = ['FREE', 'LOW', 'MEDIUM', 'HIGH', 'PREMIUM'];
      if (costOrder.indexOf(m.costTier ?? 'MEDIUM') > costOrder.indexOf(alias.maxCost)) return false;
    }
    if (alias.minContext && (m.contextWindow ?? 0) < alias.minContext) return false;
    if (alias.minOutput && (m.maxOutput ?? 0) < alias.minOutput) return false;
    // preferVendor is a soft preference, not a hard filter — handled in sort
    return true;
  });
  if (candidates.length === 0) return null;
  // Sort: preferred vendor first, then by tier rank (FLAGSHIP > STANDARD > FAST > EMBEDDING), then largest context window
  const tierRank: Record<string, number> = { FLAGSHIP: 0, STANDARD: 1, FAST: 2, EMBEDDING: 3 };
  candidates.sort((a, b) => {
    const aPreferred = alias.preferVendor && a.vendor === alias.preferVendor ? 0 : 1;
    const bPreferred = alias.preferVendor && b.vendor === alias.preferVendor ? 0 : 1;
    if (aPreferred !== bPreferred) return aPreferred - bPreferred;
    const aTier = tierRank[a.tier ?? 'STANDARD'] ?? 1;
    const bTier = tierRank[b.tier ?? 'STANDARD'] ?? 1;
    if (aTier !== bTier) return aTier - bTier;
    return (b.contextWindow ?? 0) - (a.contextWindow ?? 0);
  });
  return candidates[0]!;
}
```

**Display:**
- After the delete button in each alias row, add a resolution indicator:
  - Match: `→ Claude Opus 4.6` in `--pages-success-11` colour
  - No match: `→ (no match)` in `--pages-warning-9` colour
- Resolution updates reactively whenever `_providerStates` or `_aliases`
  change (both are `@state()`)

**Resolution is UI-only.** It does not modify the Manifest output — it's
a preview of what the runtime resolver would do. The actual resolution
happens server-side in platform-agent-config-core.

**Replaces `_isStalePreferVendor`:** The existing stale-vendor warning
becomes a special case of "no match" in the resolution preview. Remove
the separate `_isStalePreferVendor` check and `alias-stale-warning` CSS.

### Summary of File Changes

| File | Change |
|------|--------|
| `agent-manifest-editor.ts` | Pipeline step headers, resolution preview in alias rows, `resolveAlias()` helper, remove `_isStalePreferVendor` |
| `manifest-provider-card.ts` | `_addedModels` state, "Add model" button in `_renderModelList()`, merge added models into tier groups |
| `agent-manifest-editor.test.ts` | Tests for pipeline completion states, alias resolution, step dimming |
| `manifest-provider-card.test.ts` | Tests for add-model on built-in cards, duplicate validation |
| `agent-manifest-editor.integration.test.ts` | End-to-end: preset → add model → alias resolves |

### ARIA

- Pipeline step numbers: `aria-label="Step N: Section Name — status"` on
  each `.pipeline-step` container
- Dimmed sections: `aria-disabled="true"` with descriptive `aria-label`
  explaining what's needed
- Resolution preview: `aria-live="polite"` on the resolution indicator so
  screen readers announce changes
- Add-model button: `aria-label="Add a model to {provider} configuration"`

## Out of Scope

- Dynamic model discovery via `providersEndpoint` (future enhancement)
- Sources UI / model registry URIs (future — `SourceDeclaration` type
  ready but no backend API yet, platform#291)
- Schema type selection for "Other" provider (blocks-ui-schema integration)
- Per-provider alias scoping (type doesn't support it)
- Wizard/stepper progression (decided against in D1)

## References

- `components/agent-manifest-editor/src/agent-manifest-editor.ts` — current layout and alias rendering
- `components/agent-manifest-editor/src/manifest-provider-card.ts:599-616` — existing Other card add-model UI
- `packages/blocks-ui-core/src/types/manifest.ts` — Manifest, ModelDescriptor, AliasDeclaration types
- `components/agent-manifest-editor/src/presets.ts` — preset model lists
- `components/agent-manifest-editor/src/provider-defaults.ts` — auth patterns, inference ranges
- Issue #215 — three UX gaps described
- Issue #214 — auth pattern abstraction (completed dependency)
- Issue #210 — base agent-manifest-editor (completed dependency)
- Issue #166 — parent epic (agent setup wizard)
- `docs/protocols/blocks-ui/component-customisation-pattern.md` — typed config properties pattern
- `docs/protocols/blocks-ui/component-registry-props.md` — no new components, no registry changes needed
