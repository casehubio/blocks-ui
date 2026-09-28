# Decisions — Personality Profile Mode

## D22: Auto-fill policy — replace all

**Choice:** When an archetype is selected, auto-fill ALL personality framework values from sub-archetype affinity, replacing any existing manual selections.
**Alternatives:**
- Fill empty only — respects prior selections but creates contradictory states (user filtered via INTJ, selected archetype with ENFJ affinity)
- Fill empty + confirm conflicts — most careful but adds modal/confirmation UI complexity
**Rationale:** The archetype is the personality anchor. Personality filter values are a navigation tool to reach the archetype; once selected, the archetype defines the starting profile. User can then tweak individual values from that base.
**Trade-offs:** Users who carefully set personality values before selecting an archetype lose those selections. Mitigated by: the auto-filled values are the archetype's natural profile, and the user can immediately adjust.
**Sources:** avatar-step.ts `_selectArchetype()`, `getFrameworkProfile()`
**Exploration:** quick
**Status:** captured

## D23: Belbin multi-select — primary + up to 2 secondaries

**Choice:** Belbin uses multi-select with primary (solid fill) + up to 2 secondaries (outline). Click behavior: first click = primary, subsequent clicks = secondary (up to 2), clicking full slots replaces oldest secondary. Clicking existing primary clears all Belbin. Clicking existing secondary removes it.
**Alternatives:**
- Exactly one secondary — simpler but doesn't match Belbin's top-3 assessment model
- Unlimited secondaries — too flexible, dilutes the concept
**Rationale:** Belbin assessments commonly identify a top-3 team role profile. Primary + 2 secondaries matches this.
**Trade-offs:** Belbin rendering is more complex than other frameworks. Filter algorithm only uses primary value.
**Data model:** Keep `_frameworks.belbin` for primary (filter algorithm unchanged). Add `_belbinSecondaries: string[]` for secondaries.
**Sources:** Belbin team role assessment methodology
**Exploration:** quick
**Status:** captured

## D24: Dynamic summary text — template from descriptors

**Choice:** Small adjective lookup (~40 entries) mapping each framework value to a 1-3 word descriptor. Template generates summary: "A [mbti-desc], [enneagram-desc] [role-label] with [disc-desc] drive." Shown below static description on variant cards.
**Alternatives:**
- Static description only — no dynamic feedback loop
- Pre-authored combination phrases — richer language but N×M authoring effort
**Rationale:** Template approach is predictable, requires minimal data, and gives immediate feedback when personality values change.
**Trade-offs:** Generated text is formulaic. Acceptable for a configuration UI — it's a summary, not prose.
**Sources:** Existing `RoleVariant.description` field in profession-presets.ts
**Exploration:** quick
**Status:** captured

## D25: Mode indication — subtle header change

**Choice:** Sidebar header text changes from "Filter by personality" to "Personality profile" when an archetype is selected. No structural UI change.
**Alternatives:**
- No visual distinction — confusing, user doesn't know grid behavior changed
- Explicit mode toggle — adds UI complexity without proportional value
**Rationale:** The auto-fill (all values populate at once) is the primary signal that mode changed. The header text reinforces this without adding UI weight.
**Trade-offs:** Subtle — some users may not notice. Acceptable since the auto-fill itself is an obvious change.
**Exploration:** quick
**Status:** captured

## D26: Output event — full personality profile

**Choice:** Enhance `avatar:archetype:selected` event to include the full personality profile. Also emit `avatar:personality:changed` on every personality value change so the wizard always has the latest profile.
**Alternatives:**
- Single event on archetype selection only — wizard misses personality tweaks
- Property-based output (no events) — breaks the pages-event pattern
**Rationale:** Two events: archetype selection (includes initial auto-filled profile) and personality change (includes updated profile). Wizard can listen to both or just the latter.
**Trade-offs:** Two event types to handle instead of one.
**Data shape:**
```typescript
interface PersonalityProfile {
  archetype: { family: string; subArchetype: string };
  collection: string;
  mbti?: string;
  enneagram?: string;
  disc?: string;
  belbin?: { primary: string; secondaries: string[] };
  sdi?: string;
  bigFive?: Partial<Record<'O'|'C'|'E'|'A'|'N', 'high'|'low'>>;
}
```
**Exploration:** quick
**Status:** captured
