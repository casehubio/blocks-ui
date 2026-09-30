# Decisions — #211 agent-catalog

## D1: Template type — evolve FullAgentDescriptor

**Choice:** Evolve FullAgentDescriptor in blocks-ui-core to carry personality, manifest, description, and category metadata alongside the existing identity fields.
**Alternatives:**
- Separate AgentTemplate type local to agent-catalog — risk of two types describing the same thing drifting apart
- AgentTemplate wrapping FullAgentDescriptor — unnecessary indirection
**Rationale:** FullAgentDescriptor was written before personality profiles and manifests existed. Evolving it makes it the canonical "assembled agent" type that all wizard steps contribute to.
**Trade-offs:** Wider type surface in blocks-ui-core; consumers that only need runtime identity see optional fields they don't use.
**Sources:** blocks-ui-core/src/types/agent.ts, avatar-step PersonalityProfile, manifest.ts Manifest type
**Exploration:** quick
**Status:** captured

## D2: Template data — static data in agent-catalog

**Choice:** Templates defined as a TypeScript const array in a data file within agent-catalog (like PROFESSION_PRESETS in avatar-step).
**Alternatives:**
- Fetched from endpoint at runtime — adds server dependency the other wizard steps don't have
- Dual-mode static + endpoint — more complexity for no current need
**Rationale:** Consistent with how avatar-step (PROFESSION_PRESETS) and manifest-editor (PRESETS) define their data. Simple, testable, no server dependency.
**Trade-offs:** No dynamic templates or server-side usage stats. Can add endpoint support later.
**Sources:** avatar-step/src/data/profession-presets.ts, agent-manifest-editor/src/presets.ts
**Exploration:** quick
**Status:** captured

## D3: Detail view — inline expansion

**Choice:** Clicking a catalog card expands it inline below the grid row to show personality profile, manifest summary, and avatar preview.
**Alternatives:**
- Split-pane with detail panel — heavier layout, overkill for a selection step
- Modal/overlay — interrupts browsing flow
**Rationale:** Same pattern as avatar-step's variant cards. Keeps browsing context visible while showing detail.
**Trade-offs:** Less room for detail than a full panel; adequate for a selection step.
**Sources:** avatar-step variant card pattern
**Exploration:** quick
**Status:** captured

## D4: Curation — featured section with curated picks

**Choice:** Top of catalog shows 3-5 recommended templates with visual highlight, curated via a boolean flag in template data.
**Alternatives:**
- Flat catalog, filters only — less guidance for new users
- Defer curation until server-side usage data — delays useful UX
**Rationale:** Editorial curation works without a server. Provides immediate guidance.
**Trade-offs:** Curation is manual/opinionated. Usage-based ranking comes later with server support.
**Sources:** Issue #211 scope
**Exploration:** quick
**Status:** captured

## D5: From-scratch path — same event, empty template

**Choice:** "From scratch" emits catalog:template:selected with a minimal/empty FullAgentDescriptor. Wizard steps handle defaults.
**Alternatives:**
- Separate catalog:from-scratch event — two event contracts to maintain
**Rationale:** One event, one shape. Simpler contract.
**Trade-offs:** Host must check if template is empty to know it's a from-scratch path (trivial check).
**Sources:** Issue #211 scope
**Exploration:** quick
**Status:** captured

## D6: Categories — reuse PROFESSION_PRESETS

**Choice:** Catalog templates are a browsable view over existing PROFESSION_PRESETS role variants, not a separate template taxonomy. Domain filters = professions, templates = role variants with manifest defaults added.
**Alternatives:**
- Catalog-specific categories — creates parallel hierarchy that drifts from avatar-step
**Rationale:** The catalog should match the personality presets from the avatar wizard. No duplication.
**Trade-offs:** Catalog template count is bounded by PROFESSION_PRESETS size.
**Sources:** avatar-step/src/data/profession-presets.ts, user clarification
**Exploration:** quick
**Status:** captured

## D7: Manifest defaults — alias-driven

**Choice:** Templates specify which alias tier they prefer (reasoning-heavy, fast-response, etc.). Alias resolution picks the right model for whatever provider is configured.
**Alternatives:**
- Defer manifest defaults entirely — simplest now but less useful
**Rationale:** Task type drives model selection, not role. Aliases already model this. Works across any provider.
**Trade-offs:** Need a mapping from role categories to alias tiers.
**Depends on:** D6 (categories reuse PROFESSION_PRESETS)
**Sources:** agent-manifest-editor/src/presets.ts STANDARD_ALIASES
**Exploration:** quick
**Status:** captured

## D8: Avatar rendering — direct import

**Choice:** Catalog imports AgentAvatar from agent-avatar-2d and renders inline on cards.
**Alternatives:**
- Renderer callback SPI — unnecessary indirection for a sibling package
**Rationale:** Both are in the same monorepo. avatar-step already depends on agent-avatar-2d.
**Trade-offs:** Direct coupling to agent-avatar-2d (acceptable within the monorepo).
**Sources:** agent-avatar-2d package
**Exploration:** quick
**Status:** captured
