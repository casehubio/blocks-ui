# Avatar Wizard Step — Design Spec

Replace the stub avatar step in `agent-wizard` with a faceted personality selector, profession presets, and collection style picker. The user converges on 1 of 48 archetypes and picks a visual collection.

**Dependency:** This spec targets implementation after issue-166 (`agent-wizard`) lands. The wizard provides the step navigation shell; `<avatar-step>` provides the step content as a standalone component (see §Component).

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ Collection Bar                                      │
│  [Chibi] [Donut Creek] [Neon] [Mythic]             │
├─────────────────────────────────────────────────────┤
│ Selection Method (tabs)                             │
│  ┌──────────────┐ ┌───────────────┐                │
│  │ By Profession │ │ By Personality │               │
│  └──────────────┘ └───────────────┘                │
│                                                     │
│  By Profession:                                     │
│    Profession: [Software ▾]                         │
│    Roles: [Architect] [QA Lead] [DevOps] [PM] ...  │
│                                                     │
│  By Personality:                                    │
│    MBTI:      [INTJ] [ENTP] [INFJ] ...             │
│    Enneagram: [Type 1] [Type 5] [Type 7] ...       │
│    DISC:      [D] [I] [S] [C]                      │
│    Belbin:    [Plant] [Shaper] [Monitor] ...        │
│    Big Five:  O [High|—|Low]  C [High|—|Low]       │
│               E [High|—|Low]  A [High|—|Low]       │
│               N [High|—|Low]                        │
│    SDI:       [Blue] [Red] [Green] [Hub]           │
│                           [Reset all]               │
├─────────────────────────────────────────────────────┤
│ Avatar Grid (12 rows × 4 cols)                      │
│                                                     │
│  Caregiver:  [Angel] [Guardian] [Healer] [Samaritan]│
│  Creator:    [Artist] [Entrep.] [Story.] [Vision.] │
│  Everyman:   [Advoc.] [Citizen] [Netw.]  [Servant] │
│  ...                                                │
│                                                     │
│  ★ Strong match: full opacity + highlight border    │
│  ○ Weak match: opacity 0.6, clickable              │
│  · Incompatible: opacity 0.3, hover tooltip, no    │
│    click                                            │
├─────────────────────────────────────────────────────┤
│ Preview: [enlarged selected avatar] [name + desc]   │
└─────────────────────────────────────────────────────┘
```

## Component: `<avatar-step>`

A standalone Web Component providing the faceted avatar selection UI. Independently testable in the blocks-ui test harness per ARC42STORIES §1 ("Components work standalone in a test harness AND embedded via pages hostPanel"). The wizard (issue-166) consumes `<avatar-step>` as step 6 content.

Emits `avatar:archetype:selected` CustomEvent (colon-delimited per ARC42STORIES §4 event naming convention) with the selection payload when the user confirms an archetype. The wizard listens and stores the result on the agent entity.

### State

```typescript
type PersonalityFramework = 'mbti' | 'enneagram' | 'disc' | 'belbin' | 'sdi';
type BigFiveDimension = 'O' | 'C' | 'E' | 'A' | 'N';
type BigFivePole = 'high' | 'low';

@customElement('avatar-step')
export class AvatarStep extends LitElement {
  @state() private _selectedCollection: string = 'mythic';
  @state() private _selectedArchetype: string | null = null;
  @state() private _selectionTab: 'profession' | 'personality' = 'profession';
  @state() private _selectedProfession: string | null = null;
  @state() private _frameworkSelections: Partial<Record<PersonalityFramework, string>> = {};
  @state() private _bigFiveSelections: Partial<Record<BigFiveDimension, BigFivePole>> = {};
}
```

`_selectedArchetype` persists across tab switches. Switching from "By Profession" to "By Personality" (or vice versa) preserves the selected archetype — the selection method is a navigation aid, not independent state.

### Data Model

```typescript
interface FrameworkOption {
  value: string;
  label: string;
}

// Static lookup: framework value → compatible archetype families (Section 1)
const FRAMEWORK_FAMILY_MAP: Record<
  PersonalityFramework | 'bigFive',
  Record<string, ArchetypeFamily[]>
>;

// Static lookup: profession → role → archetype key
const PROFESSION_PRESETS: Record<string, Array<{ role: string; archetype: string }>>;

// Derived from ARCHETYPE_CONFIGS — groups sub-archetypes by family
const FAMILY_SUB_ARCHETYPES: Record<ArchetypeFamily, readonly string[]>;
// Computed: Object.entries(ARCHETYPE_CONFIGS) grouped by key.split('/')[0]

// All 48 archetype keys from ARCHETYPE_CONFIGS
const ALL_48_ARCHETYPES: Set<string>;
// Computed: new Set(Object.keys(ARCHETYPE_CONFIGS))

// All valid values per framework
const ALL_VALUES: Record<PersonalityFramework | 'bigFive', readonly string[]>;
// Populated from compatibility matrix Section 1 column headers

// Sub-archetype distinction rules from compatibility matrix Section 2
interface SubArchetypeRule {
  subArchetype: string;
  mbtiAffinity: readonly string[];
  enneagramAffinity: readonly string[];
}
const SUB_ARCHETYPE_RULES: Record<ArchetypeFamily, readonly SubArchetypeRule[]>;
// Populated from Section 2 tables: each sub-archetype's MBTI and Enneagram affinity columns
```

### Filter Algorithm

Three-tier narrowing following the compatibility matrix algorithm (Section 3):

```typescript
type MatchTier = 'strong' | 'weak' | 'incompatible';

function getCompatibleArchetypes(
  selections: Partial<Record<PersonalityFramework, string>>,
  bigFiveSelections: Partial<Record<BigFiveDimension, BigFivePole>>,
): Map<string, MatchTier> {
  const noSelections =
    Object.keys(selections).length === 0 &&
    Object.keys(bigFiveSelections).length === 0;

  if (noSelections) {
    return new Map([...ALL_48_ARCHETYPES].map(a => [a, 'strong' as const]));
  }

  // Step 1: Intersect family sets from each framework value (Section 1)
  let families: Set<ArchetypeFamily> | null = null;

  for (const [framework, value] of Object.entries(selections)) {
    const compatible = new Set(FRAMEWORK_FAMILY_MAP[framework][value]);
    families = families ? intersection(families, compatible) : compatible;
  }

  // Big Five: each selected dimension pole intersects independently
  for (const [dim, pole] of Object.entries(bigFiveSelections)) {
    const key = `${pole === 'high' ? 'High' : 'Low'} ${dim}`;
    const compatible = new Set(FRAMEWORK_FAMILY_MAP.bigFive[key]);
    families = families ? intersection(families, compatible) : compatible;
  }

  // Step 2: Within compatible families, apply Section 2 sub-archetype affinity
  const result = new Map<string, MatchTier>();

  for (const key of ALL_48_ARCHETYPES) {
    const [family] = key.split('/');
    if (!families?.has(family as ArchetypeFamily)) {
      result.set(key, 'incompatible');
      continue;
    }

    const sub = key.split('/')[1]!;
    const rules = SUB_ARCHETYPE_RULES[family as ArchetypeFamily]
      ?.find(r => r.subArchetype === sub);

    // Check MBTI and Enneagram affinity from Section 2 columns
    const mbtiMatch = selections.mbti
      ? rules?.mbtiAffinity.includes(selections.mbti) ?? false
      : null;
    const ennMatch = selections.enneagram
      ? rules?.enneagramAffinity.includes(selections.enneagram) ?? false
      : null;

    const hasAffinityData = mbtiMatch !== null || ennMatch !== null;
    const anyAffinityMatch = mbtiMatch === true || ennMatch === true;

    result.set(key, (!hasAffinityData || anyAffinityMatch) ? 'strong' : 'weak');
  }

  return result;
}

function getValidFrameworkValues(
  framework: PersonalityFramework,
  currentSelections: Partial<Record<PersonalityFramework, string>>,
  bigFiveSelections: Partial<Record<BigFiveDimension, BigFivePole>>,
): string[] {
  const otherSelections = { ...currentSelections };
  delete otherSelections[framework];

  return ALL_VALUES[framework].filter(value => {
    const test = { ...otherSelections, [framework]: value };
    const matches = getCompatibleArchetypes(test, bigFiveSelections);
    return [...matches.values()].some(t => t !== 'incompatible');
  });
}

function getValidBigFivePoles(
  dimension: BigFiveDimension,
  currentBigFive: Partial<Record<BigFiveDimension, BigFivePole>>,
  frameworkSelections: Partial<Record<PersonalityFramework, string>>,
): Set<BigFivePole | null> {
  const otherBigFive = { ...currentBigFive };
  delete otherBigFive[dimension];

  const valid = new Set<BigFivePole | null>([null]); // unset is always valid
  for (const pole of ['high', 'low'] as const) {
    const test = { ...otherBigFive, [dimension]: pole };
    const matches = getCompatibleArchetypes(frameworkSelections, test);
    if ([...matches.values()].some(t => t !== 'incompatible')) {
      valid.add(pole);
    }
  }
  return valid;
}
```

Big Five toggles disable poles not in the valid set, preventing the user from creating an irrecoverable empty intersection (e.g., High O + High C = no compatible families). This mirrors `getValidFrameworkValues` for single-select frameworks.

### Collection System Changes

`AvatarCollection` becomes a discriminated union (D18, corrected):

```typescript
// Current interface (all collections assumed parts-based):
// interface AvatarCollection {
//   readonly id: string;
//   readonly partsUrl: string;
//   readonly previewUrl: string;
//   readonly parts: Map<string, string>;
// }

// New: discriminated union supporting both rendering modes
interface AvatarCollectionBase {
  readonly id: string;
  readonly label: string;
}

interface PartsCollection extends AvatarCollectionBase {
  readonly type: 'parts';
  readonly partsUrl: string;
  readonly previewUrl: string;
  readonly parts: Map<string, string>;
}

interface FixedCollection extends AvatarCollectionBase {
  readonly type: 'fixed';
  readonly fixedSvgs: Map<string, string>;  // key: "Family/Sub" → complete SVG string
}

type AvatarCollection = PartsCollection | FixedCollection;
```

**Fields retained:** `partsUrl` and `previewUrl` remain on `PartsCollection` for collection loading. `label` is added to both for the Collection Bar UI.

**Collection classification** (corrected from D18):

| Collection | Type | Status | Source |
|---|---|---|---|
| Mythic | `parts` | Implemented | `collections/mythic/mythic-parts.ts` — ~140 composable SVG fragments |
| Neon | `parts` | Parts exist, not registered | `neon.parts.svg`, `neon-extras.parts.svg` in spec directory |
| Chibi | `fixed` | POC exists | `chibi-poc.html` — needs extraction to 48 keyed SVGs |
| Donut Creek | `fixed` | Partial | `donutcreek-gallery.html` — 13 leads drawn, 35 remaining (D17) |

D18 incorrectly classified Mythic as fixed. Mythic is the founding parts-based collection — the entire D2/D4/D12/D14 decision chain built the composable parts architecture for it.

**Builder dispatch** in `agent-avatar.ts`:

```typescript
private _buildSvg(): string {
  const coll = getCollection(this.collection);
  if (!coll) return this._fallbackSvg();

  if (coll.type === 'fixed') {
    return this._renderFixed(coll);
  }

  // Parts-based path — coll is narrowed to PartsCollection by the type guard above
  // ... archetype lookup → buildAvatar(config, palette, size, coll)
}

private _renderFixed(coll: FixedCollection): string {
  const key = this._resolveArchetypeKey();
  if (!key) return this._fallbackSvg();

  const svg = coll.fixedSvgs.get(key);
  return svg ?? this._fallbackSvg();
}
```

Fixed SVGs are pre-colored (hand-drawn with baked colors). They do not go through the palette pipeline. The fallback renders the `_fallbackSvg()` placeholder for missing keys.

**Registry addition:**

```typescript
export function listCollections(): ReadonlyArray<{ id: string; label: string }> {
  return [...collections.values()].map(c => ({ id: c.id, label: c.label }));
}
```

The Collection Bar renders dynamically from `listCollections()`. If only mythic is registered, the bar shows only mythic — no hardcoded dependency on specific collections.

### Profession Presets

Heuristic mappings from common profession roles to archetypes. These are starting suggestions — the user can switch to "By Personality" to refine or override.

**Selection criteria:** Each role maps to the archetype whose distinguishing axis (from compatibility matrix Section 2) best describes the role's primary mode of operating.

| Profession | Example Roles → Archetype |
|---|---|
| Software | Architect → Sage/Mentor, QA Lead → Sovereign/Judge, DevOps → Explorer/Pioneer, PM → Sovereign/Ambassador, Tech Lead → Hero/Warrior, UX Designer → Creator/Artist |
| Education | Teacher → Caregiver/Healer, Principal → Sovereign/Ruler, Counsellor → Caregiver/Angel, Researcher → Sage/Detective |
| Legal | Litigator → Hero/Liberator, Mediator → Everyman/Advocate, Compliance → Sovereign/Judge, Defence → Rebel/Maverick |
| Medical | Surgeon → Hero/Rescuer, GP → Caregiver/Healer, Researcher → Sage/Detective, Nurse → Caregiver/Samaritan |
| Finance | Analyst → Sage/Detective, Trader → Explorer/Adventurer, Auditor → Sovereign/Judge, Advisor → Caregiver/Guardian |

Extensible — more professions added by appending to the static map. Mappings are tunable during implementation; the spec defines the mechanism, not the final assignments.

### Rendering

Each avatar in the grid renders using `<agent-avatar>`:

```html
<agent-avatar
  .archetype=${{ family, subArchetype }}
  collection=${this._selectedCollection}
  size="md"
  class=${tierClass}
  @click=${tier !== 'incompatible' ? () => this._selectArchetype(key) : nothing}
  @mouseenter=${() => this._showTooltip(key, tier)}
></agent-avatar>
```

Grid uses CSS grid: `grid-template-columns: repeat(4, 1fr)` with family row headers.

**Three-tier visual hierarchy:**

| Tier | Opacity | Scale | Interaction | Use |
|---|---|---|---|---|
| Strong match | 1.0 | 1.0 | Click to select | Family match + sub-archetype affinity |
| Weak match | 0.6 | 1.0 | Click to select | Family match, no sub-archetype affinity |
| Incompatible | 0.3 | 0.9 | Hover for tooltip ("Incompatible with MBTI selection"), click disabled | Family not in intersection |

Strong matches additionally receive a `2px solid var(--pages-accent)` highlight border.

### Output

When the user selects an archetype, the component emits:

```typescript
this.dispatchEvent(new CustomEvent('avatar:archetype:selected', {
  detail: {
    avatar: encodePreset(archetypeKey, this._selectedCollection),
    archetype: { family, subArchetype },
    collection: this._selectedCollection,
  },
  bubbles: true,
  composed: true,
}));
```

`encodePreset()` from `code.ts` produces the compact `collection:P${base36Index}` format. The wizard's step completion handler receives this event and writes the result to the agent entity.

## Files Changed

### `packages/agent-avatar-2d/` (rendering package)

| File | Change |
|---|---|
| `packages/agent-avatar-2d/src/types.ts` | Replace `AvatarCollection` with discriminated union (`PartsCollection \| FixedCollection`), add `label` field, export both sub-types |
| `packages/agent-avatar-2d/src/builder.ts` | Narrow `collection` parameter from `AvatarCollection` to `PartsCollection` — the builder only handles parts-based rendering; fixed collections never call it |
| `packages/agent-avatar-2d/src/agent-avatar.ts` | Add `type: 'fixed'` dispatch branch in `_buildSvg()`, pass narrowed `PartsCollection` to `buildAvatar()` after type guard |
| `packages/agent-avatar-2d/src/collections/registry.ts` | Add `listCollections()` export |
| `packages/agent-avatar-2d/src/collections/mythic/index.ts` | Add `type: 'parts'` and `label: 'Mythic'` to collection registration |

### `components/avatar-step/` (new interactive component)

| File | Change |
|---|---|
| `components/avatar-step/package.json` | New — component package with `@casehubio/agent-avatar-2d` as dependency |
| `components/avatar-step/src/avatar-step.ts` | New — standalone `<avatar-step>` component |
| `components/avatar-step/src/data/compatibility-matrix.ts` | New — static framework → family mapping + sub-archetype affinity rules |
| `components/avatar-step/src/data/profession-presets.ts` | New — profession → role → archetype mapping |

**Collection prerequisites** (separate work items, not blocked by this spec):

| Collection | Work needed | Tracking |
|---|---|---|
| Chibi | Extract 48 SVGs from `chibi-poc.html`, key by `Family/Sub`, register as `FixedCollection` | Issue TBD |
| Donut Creek | Draw remaining 35 characters per D17 mapping, register as `FixedCollection` | Issue TBD |
| Neon | Register parts from `neon.parts.svg` + `neon-extras.parts.svg`, create 48 config entries | Issue TBD |

## ARIA

- Collection bar: `role="radiogroup"` with `aria-label="Avatar collection"`, each option `role="radio"` + `aria-checked`
- Tab switcher: `role="tablist"` / `role="tab"` / `role="tabpanel"`
- Framework pill bars (MBTI, Enneagram, DISC, Belbin, SDI): `role="listbox"` + `role="option"` + `aria-selected`
- Big Five dimension toggles: one `role="radiogroup"` per dimension with `aria-label="Openness"` etc., three radio options (High / Unset / Low)
- Avatar grid: `role="radiogroup"` with `aria-label="Select archetype avatar"`
  - Each family row: `role="group"` with `aria-label="${family} family"`
  - Each avatar: `role="radio"` + `aria-checked` + `aria-label="${family} ${sub} avatar"`
  - Incompatible avatars: `aria-disabled="true"`
- Preview: `role="status"` + `aria-live="polite"`

## Keyboard Navigation

Following WAI-ARIA Radiogroup pattern:

- **Tab**: Moves focus between major sections: Collection Bar → Tab Switcher → Framework/Profession panel → Avatar Grid → Preview
- **Arrow keys** (avatar grid): Left/Right moves between sub-archetypes within a family; Up/Down moves between families. Focus skips `aria-disabled` cells.
- **Space/Enter**: Selects the focused avatar or framework value
- **Home/End**: Within a family row, moves to first/last non-disabled avatar
- **Escape**: Clears current framework selection for the focused pill bar (not the archetype selection)
- Framework pill bars: Left/Right arrow navigates within a bar; disabled values are skipped

## Responsive Layout

- **≥768px**: Full layout — 12×4 grid with row headers, preview panel adjacent to grid
- **480–767px**: Compact — grid collapses to 12×2 (sub-archetypes paired), framework pills wrap, preview appears inline below grid
- **<480px**: Minimal — grid shows one family at a time with swipe/arrow navigation between families, framework pills in a horizontal scroll strip

## References

- decisions.md D18–D21 — avatar wizard decisions (D18 classification corrected in this spec)
- archetype-compatibility-matrix.md (Sections 1–3) — framework → family mapping, sub-archetype affinity, intersection algorithm
- config-table.ts — 48 archetype preset entries
- code.ts — `encodePreset()` compact encoding
- types.ts — `AvatarCollection` interface (to be updated)
- agent-avatar.ts — `<agent-avatar>` component (to add fixed dispatch)
- collections/registry.ts — collection registry (to add `listCollections()`)
