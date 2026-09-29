# Design — agent-catalog (#211)

Agent template catalog: browse, filter, and select pre-built agent
configurations or start from scratch. Entry point for the wizard flow.

## Overview

The catalog presents the existing PROFESSION_PRESETS role variants as
selectable agent templates. Each template combines an avatar/archetype
identity with a personality profile and alias-driven manifest defaults.
Users can filter by profession, search by name/description, or start
from scratch.

## Type Evolution — FullAgentDescriptor

Evolve FullAgentDescriptor in blocks-ui-core to carry the full agent
configuration. New optional fields:

```typescript
export interface FullAgentDescriptor {
  // Existing fields (unchanged)
  readonly agentId: string;
  readonly name: string;
  readonly tenancyId: string;
  readonly archetypeFamily?: string;
  readonly subArchetype?: string;
  readonly archetypeAdjectives?: readonly string[];
  readonly avatar?: string;

  // New fields
  readonly description?: string;
  readonly personality?: PersonalityProfile;
  readonly manifest?: Manifest;
  readonly preferredAlias?: string;
  readonly profession?: string;
  readonly role?: string;
}
```

`PersonalityProfile` is imported from avatar-step. `Manifest` from
blocks-ui-core/types/manifest. `preferredAlias` names which alias tier
this agent leans on (e.g. `'reasoning-heavy'`, `'fast-response'`).

The type remains the canonical runtime identity type — the new fields
are all optional so existing consumers are unaffected.

## Template Data

Templates are derived from PROFESSION_PRESETS. A data file in
agent-catalog maps each role variant to a `CatalogTemplate`:

```typescript
export interface CatalogTemplate {
  readonly id: string;              // e.g. 'software-architect-guiding'
  readonly profession: string;      // from PROFESSION_PRESETS key
  readonly role: string;            // from ProfessionRole.role
  readonly variant: RoleVariant;    // from ProfessionRole.variants[]
  readonly preferredAlias: string;  // alias tier for this task type
  readonly featured?: boolean;      // curated pick
}
```

The catalog derives a FullAgentDescriptor from each template by:
1. Parsing `variant.archetype` into `archetypeFamily` + `subArchetype`
2. Using `_initProfile()` logic (from avatar-step) to build the
   personality profile for that archetype
3. Setting `preferredAlias` from the template's alias mapping
4. Setting `name` from variant.label, `description` from
   variant.description

### Alias tier mapping

Roles map to alias tiers by task category:

| Task category | Alias tier | Example roles |
|---|---|---|
| Analysis, investigation, research | `reasoning-heavy` | Analyst, Detective, Researcher, Auditor |
| Fast interaction, support, triage | `fast-response` | Nurse, Sales Development, Tutor |
| Creative, generalist, balanced | (no preference) | Content Strategist, Coach, Designer |

The mapping is a simple lookup by role, not a complex rules engine.

### Featured templates

3-5 templates marked `featured: true`:
- Software > Architect > The systems architect
- Legal > Compliance Officer > The standards enforcer
- Medical > GP > The holistic family doctor
- Finance > Analyst > The evidence-driven analyst
- Coaching > Life Coach > The wisdom guide

## Component Architecture

Single component: `<agent-catalog>`.

### Layout

```
┌──────────────────────────────────────────────┐
│ Featured Picks (3-5 highlighted cards)       │
├──────────────────────────────────────────────┤
│ [Search...___________]                       │
│ ┌─ Professions ─────────────────────────────┐│
│ │ [Software] [Legal] [Medical] [Finance] ...││
│ └────────────────────────────────────────────┘│
│ ┌─ Grid ─────────────────────────────────────┐│
│ │ ┌────────┐ ┌────────┐ ┌────────┐          ││
│ │ │ Avatar │ │ Avatar │ │ Avatar │          ││
│ │ │ Name   │ │ Name   │ │ Name   │          ││
│ │ │ Role   │ │ Role   │ │ Role   │          ││
│ │ └────────┘ └────────┘ └────────┘          ││
│ │ ┌──── Expanded detail ────────────────┐   ││
│ │ │ Personality: MBTI, SDI, Belbin...   │   ││
│ │ │ Alias tier: reasoning-heavy         │   ││
│ │ │ [Select]  [Start from scratch]      │   ││
│ │ └─────────────────────────────────────┘   ││
│ │ ┌────────┐ ┌────────┐ ┌────────┐          ││
│ │ │ ...    │ │ ...    │ │ ...    │          ││
│ └────────────────────────────────────────────┘│
│ ┌─ From Scratch ────────────────────────────┐│
│ │ [+ Create from scratch]                   ││
│ └────────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

### Sections

1. **Featured picks** — 3-5 curated cards with larger avatar,
   description, and profession badge. Visual highlight (accent border).
   Only shown when no profession filter is active.

2. **Search bar** — text input with fuzzy matching on variant label,
   description, archetype name, and profession/role names.

3. **Profession filter pills** — pill buttons for each profession from
   PROFESSION_LIST. Single-select. Selecting a profession filters the
   grid to that profession's variants. Clicking again deselects.

4. **Template grid** — responsive card grid (3-4 columns desktop, 2
   mobile). Each card shows: avatar (agent-avatar sm), variant label,
   `profession > role`, archetype family badge. Click expands inline.

5. **Inline detail expansion** — expands below the clicked card's row.
   Shows: larger avatar, full personality summary (from
   buildSummaryText), framework values (MBTI, SDI, etc.), preferred
   alias tier, action buttons.

6. **From scratch button** — always visible at the bottom. Emits
   `catalog:template:selected` with an empty FullAgentDescriptor.

### State

```typescript
@state() private _search = '';
@state() private _profession: string | null = null;
@state() private _expandedId: string | null = null;
```

### Filtering logic

1. Start with all templates
2. If `_profession` set, filter to that profession
3. If `_search` non-empty, fuzzy-match against label, description,
   archetype, profession, and role
4. Featured section only shows when `_profession` is null and
   `_search` is empty

### Events

| Event | Detail | When |
|---|---|---|
| `catalog:template:selected` | `{ template: FullAgentDescriptor }` | User clicks Select on a template or "From scratch" |

### ARIA

- Host: `role="region"` + `aria-label="Agent template catalog"`
- Search: `role="searchbox"` + `aria-label="Search templates"`
- Profession pills: `role="listbox"` + `aria-label="Filter by profession"`
- Grid: `role="list"` + `aria-label="Agent templates"`
- Cards: `role="listitem"`
- Expanded detail: `role="region"` + `aria-label="Template details"`

## Personality Profile Derivation

The catalog needs to derive a PersonalityProfile from an archetype key
to show in the detail expansion and to include in the emitted event.
This logic already exists in avatar-step's `_initProfile()` method,
which is currently a private method on the AvatarStep class.

**Approach:** Extract `_initProfile()` into a standalone exported
function in avatar-step's data module (e.g.
`data/profile-derivation.ts`). The catalog imports and calls it.
No duplication.

## Dependencies

| Dependency | What for |
|---|---|
| `@casehubio/agent-avatar-2d` | AgentAvatar component, ARCHETYPE_CONFIGS |
| `@casehubio/avatar-step` | PROFESSION_PRESETS, PROFESSION_LIST, PersonalityProfile, profile derivation, buildSummaryText |
| `@casehubio/blocks-ui-core` | FullAgentDescriptor (evolved), Manifest types |

## Test Plan

- Renders with correct ARIA attributes
- Renders featured section with curated templates
- Profession pill filtering reduces grid to matching templates
- Search filters templates by label, description, archetype
- Card click expands inline detail
- Second card click collapses previous, expands new
- Select button emits catalog:template:selected with correct
  FullAgentDescriptor (archetype, personality, preferredAlias)
- From-scratch button emits catalog:template:selected with empty
  descriptor
- Featured section hidden when profession filter active
- Empty state when search matches nothing

## Scope Exclusion

- No server-side data fetching (static templates only)
- No usage statistics or popularity ranking
- No template editing or creation (that's the wizard)
- No avatar collection switching (catalog uses default collection)

## References

- blocks-ui-core/src/types/agent.ts — FullAgentDescriptor (to evolve)
- blocks-ui-core/src/types/manifest.ts — Manifest type
- avatar-step/src/data/profession-presets.ts — PROFESSION_PRESETS data
- avatar-step/src/avatar-step.ts:342-377 — _initProfile() logic
- avatar-step/src/data/framework-descriptors.ts — buildSummaryText
- agent-manifest-editor/src/presets.ts — STANDARD_ALIASES
- Issue #211
- Issue #166 (parent epic)
