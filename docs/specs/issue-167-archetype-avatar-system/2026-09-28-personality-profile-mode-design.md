# Personality Profile Mode — Design Spec

Enhance `<avatar-step>` so the personality sidebar both filters the avatar grid AND configures the agent's personality profile. When an archetype is selected, auto-fill personality values from sub-archetype affinity; the user then tweaks values to customise the profile.

## Architecture

The sidebar has two behavioral modes with the same UI structure:

```
No archetype selected          Archetype selected
─────────────────────         ─────────────────────
Header: "Filter by            Header: "Personality
         personality"                   profile"
                              
Sidebar values → filter       Auto-filled from archetype
grid (current behavior)       affinity → still filters grid
                              + defines agent personality
                              
No output event               Emits personality profile
                              on every value change
```

## Auto-fill Logic

When `_selectArchetype(key)` fires:

1. **MBTI/Enneagram** — first value from `SUB_ARCHETYPE_RULES[family].find(r => r.subArchetype === sub).mbtiAffinity[0]` and `enneagramAffinity[0]`
2. **DISC/Belbin/SDI** — scan `FRAMEWORK_FAMILY_MAP[fw]` for entries containing the family, take first match. For Belbin: first match = primary, next 2 = secondaries.
3. **Big Five** — for each dimension, check if family appears in `High ${dim}` or `Low ${dim}` entries; set the matching pole (skip if family appears in neither or both).

All existing selections replaced unconditionally.

## Belbin Multi-Select

**State:** `_frameworks.belbin` stores primary (filter algorithm unchanged). New `_belbinSecondaries: string[]` stores up to 2 secondaries.

**Click behavior:**
- Empty → set primary (solid blue fill)
- Primary set, clicking different → add secondary (blue outline), up to 2
- 2 secondaries full, clicking new → replaces oldest secondary
- Clicking current primary → clear all Belbin
- Clicking current secondary → remove it

**Visual:**
- Primary: solid fill (existing `aria-selected="true"` style)
- Secondary: blue outline border, transparent background (new `.pill.belbin-secondary` class)

## Dynamic Summary Text

New file `data/framework-descriptors.ts` with ~40 entries:

```typescript
export const FRAMEWORK_DESCRIPTORS: Record<string, string> = {
  'INTJ': 'analytical and strategic',
  'ENFJ': 'empathetic and inspiring',
  'Type 1': 'principled',
  'D': 'decisive',
  // ...
};
```

Template on variant cards (below static description):

```
"A {mbti}, {enneagram} {role-label} with {disc} drive"
```

Only renders when personality values are populated. Omits empty frameworks gracefully.

## Output Events

**`avatar:archetype:selected`** — fires on archetype selection (existing, enhanced):
```typescript
detail: {
  archetype: { family, subArchetype },
  collection: string,
  personality: PersonalityProfile
}
```

**`avatar:personality:changed`** — fires on every personality value tweak:
```typescript
detail: { personality: PersonalityProfile }
```

**PersonalityProfile shape:**
```typescript
interface PersonalityProfile {
  mbti?: string;
  enneagram?: string;
  disc?: string;
  belbin?: { primary: string; secondaries: string[] };
  sdi?: string;
  bigFive?: Partial<Record<'O'|'C'|'E'|'A'|'N', 'high'|'low'>>;
}
```

## Files Changed

| File | Change |
|------|--------|
| `avatar-step.ts` | Auto-fill in `_selectArchetype()`, Belbin multi-select state + rendering, dynamic summary on variant cards, header mode label, enhanced event emission |
| New: `data/framework-descriptors.ts` | ~40-entry descriptor lookup for summary text |
| `filter.ts` | No changes |
| `compatibility-matrix.ts` | No changes |
| `profession-presets.ts` | No changes |

## ARIA

- Belbin row: changes from `role="listbox"` to `role="group"` with `aria-label="Belbin team roles"`. Each pill: `aria-pressed` instead of `aria-selected` (toggle button semantics for multi-select).
- Primary pill: `aria-pressed="true"` + `aria-description="primary"`
- Secondary pills: `aria-pressed="true"` + `aria-description="secondary"`
- Sidebar header: `role="heading"` with `aria-level="3"`, text reflects current mode

## References

- personality-profile-decisions.md D22–D26
- avatar-step.ts (current implementation)
- compatibility-matrix.ts (affinity data)
- filter.ts (filter algorithm — unchanged)
