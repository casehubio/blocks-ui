# Decisions — #167 Archetype Avatar System

## D1: Scope — SVG templates only

**Choice:** Build the 48-template SVG system + updated `<agent-avatar>` component. Faceted personality selector is a separate issue.
**Alternatives:**
- Both subsystems — delivers complete pipeline but doubles scope
- Templates + basic wiring — middle ground, but the faceted selector UI deserves its own design cycle
**Rationale:** The faceted selector is a complex interactive UI with its own interaction model, conflict detection, and state management. Separating it allows focused delivery of the visual system.
**Trade-offs:** Callers must provide pre-resolved archetype data until the selector is built. Transition path: server-side ArchetypeResolver already converges disposition → archetype identity. Agents store resolved archetype as part of their entity, returned via existing API endpoints. Frontend callers receive archetype data alongside other agent metadata — no frontend ArchetypeResolver needed.
**Sources:** eidos avatar-generator-contract.md (Sections 1-5 vs Section 3)
**Exploration:** quick
**Status:** revised — corrected count from 60 to 48 (ArchetypeTerm has 12 × 4); added transition path for archetype data resolution

## D2: Visual fidelity — composable SVG parts

**Choice:** Build a template system from composable SVG parts (head shapes, hair, props, costumes, palettes) that combine programmatically.
**Alternatives:**
- 48 hand-drawn SVGs — highest quality but enormous art effort, hard to maintain
- 48 monolithic SVGs with CSS custom property palettes — guaranteed visual coherence, simpler testing, but adjective modifiers limited to palette/opacity/filter (shape language, pose dynamism, and prop changes require SVG path modifications that CSS cannot express)
- Parameterised single template — simpler but insufficient visual distinction
- 12 family templates + parametric variants — middle ground, but limits sub-archetype differentiation
**Rationale:** Composable parts give maximum flexibility with manageable complexity. New sub-archetypes added by registering part combinations. Each part independently testable. Critically, the adjective visual effect system (D5) requires modifying individual visual layers (face expression, pose, line quality) — composable parts make this a layer swap rather than DOM manipulation of monolithic SVG paths.
**Trade-offs:** Requires designing a coherent part system where pieces compose well together.
**Sources:** Issue #167 design references, previous session prototyping insights
**Exploration:** quick
**Status:** revised — corrected count from 60 to 48; added monolithic SVG alternative with CSS properties; strengthened rationale to foreground adjective system dependency

## D3: Component API — archetype payload only

**Choice:** Accept `{ family, subArchetype, adjectives?, canonicalAxes? }`. Clean break from DiceBear. Old disposition-only mode removed.
**Alternatives:**
- Accept `{ archetype, adjectives?, canonicalAxes? }` — derive family internally, eliminates redundancy but requires a family-lookup table in the component
- Dual-mode with fallback — backward compatible but adds complexity
- Extend AgentDisposition — muddies personality axes vs archetype identity
**Rationale:** Archetype identity is a fundamentally different data model from disposition axes. Clean API avoids confusion. The faceted selector (future) handles convergence from disposition to archetype. The `family` field is intentional denormalization — the component receives a pre-resolved payload matching the contract's Section 5 input schema, avoiding the need for an internal family-lookup table. Callers (or the server API layer) resolve once; the component renders without needing vocabulary knowledge.
**Trade-offs:** Breaking change for existing callers (agent-catalog, agent-profile, agent-wizard). All must provide archetype data. Redundant family field creates theoretical inconsistency risk (`{ family: "Hero", subArchetype: "detective" }`), mitigated by validation at the API boundary.
**Sources:** eidos avatar-generator-contract.md Section 5 (input schema)
**Exploration:** quick
**Status:** revised — added derive-family alternative, documented denormalization rationale and consistency risk mitigation

## D4: SVG composition — layered builder with part registries

**Choice:** Layered composition with part registries. Avatar is an SVG canvas with stacked layers (body → costume → head → hair → face → facial hair → props → accessories). Each part is a pure function: `(palette, modifiers) → SVG path string`.
**Alternatives:**
- Monolithic templates with parametric fills — faster to build but harder to maintain, testing individual parts is harder, adjective modifiers need DOM manipulation
- Monolithic templates with CSS custom properties — visual coherence guaranteed per template, but adjective effects (shape language, pose dynamism, line quality) cannot be expressed via CSS alone
**Rationale:** Composability is essential not because of scale (48 is manageable for monolithic templates) but because adjective modifiers (D5) and canonical axes (D6) operate on individual visual layers. The part registry enables: face expression changes without touching body/costume, prop swaps per adjective effect, pose dynamism via body layer variants. Monolithic templates force adjective effects into DOM manipulation of specific SVG paths — fragile and hard to test.
**Trade-offs:** More upfront work to design the part system and ensure visual coherence across combinations.
**Sources:** eidos avatar-generator-contract.md Section 5 (visual template guidelines)
**Exploration:** quick
**Status:** revised — corrected count from 60 to 48; revised rationale from scale-based to adjective-system-based; added CSS custom property alternative

## D5: Adjective system — full implementation

**Choice:** Implement per-sub-archetype valid/invalid adjective lists and all 5 effect categories (intensity, temperament, energy, precision, organic).
**Alternatives:**
- Include basic modifiers only — forward-compatible but limited
- Defer adjectives entirely — simpler scope but incomplete payload support
- Defer adjective VISUAL EFFECTS to a follow-on issue — implement valid/invalid lists now but only apply family palette + archetype template + props; visual effect taxonomy ships separately
**Rationale:** The adjective catalog (valid/invalid lists per archetype) is fully defined in ArchetypeTerm.java. The 5 adjective effect categories are defined in avatar-generator-contract.md Section 4 (Adjective Visual Effects table). The per-adjective classification into categories is semantic — "meticulous" maps to precision, "gentle" maps to intensity — but the full mapping across all 48 archetypes needs explicit documentation as part of implementation. Implementing now means the avatar system is complete when the faceted selector lands.
**Trade-offs:** Significant scope — need to define visual effects for 5 adjective categories across all 48 sub-archetypes. The per-adjective-to-category mapping is inferable from semantics but should be codified explicitly. Effects at xs/sm sizes (24-40px) may be imperceptible — size-responsive application applies (see D8).
**Sources:** ArchetypeTerm.java (valid/invalid adjective lists), eidos avatar-generator-contract.md Section 4 (adjective effect categories and visual effect mappings)
**Exploration:** quick
**Status:** revised — corrected count from 60 to 48; clarified that effect categories exist in the contract (Section 4); acknowledged per-adjective mapping design effort; added size-responsiveness note

## D6: Canonical axes — tertiary expression modifiers

**Choice:** Map the 5 canonical axes to subtle SVG expression adjustments (brow angle, mouth curve, eye openness). Tertiary layer — archetype template dominates.
**Alternatives:**
- Defer — archetype + adjectives enough visual variation
**Rationale:** The axes are the same 5 the current DiceBear system uses (socialOrientation, ruleFollowing, riskAppetite, autonomy, conflictMode — see canonical-registry.js). The current system maps these axes to categorical DiceBear feature selections (e.g., socialOrient.collaborative → `{ mouth: 'smile', eyes: 'happy' }`). The proposed system maps to SVG expression variants — the CONCEPT (axis → visual differentiation) is proven, though the MECHANISM differs (categorical selection → discrete SVG variants rather than continuous geometric transforms). Mapping can use 2-3 discrete expression variants per axis endpoint rather than continuous interpolation.
**Trade-offs:** Additional complexity in the face layer rendering. Expression adjustments may be imperceptible at xs/sm sizes — apply only at md+ (64px+).
**Sources:** eidos avatar-generator-contract.md Section 5 (canonical axes → expression geometry), packages/agent-avatar-2d/dist/canonical-registry.js (current axis mapping)
**Exploration:** quick
**Status:** revised — clarified what "proven" means (concept not mechanism); specified discrete variants over continuous interpolation; added size-responsiveness note

## D7: DiceBear removal

**Choice:** Remove @dicebear/core and @dicebear/avataaars entirely from agent-avatar-2d.
**Alternatives:**
- Keep as fallback for missing archetype data
**Rationale:** The inline SVG builder replaces DiceBear completely. Keeping it adds bundle size and maintenance burden for no benefit since the API is a clean break anyway (D3).
**Trade-offs:** No DiceBear fallback. On missing archetype data, the component renders a neutral "unresolved" avatar — the Everyman/Citizen template with a desaturated greyscale palette. This is visually distinct from any assigned archetype (no user will mistake it for a real identity) while still producing a valid, non-broken avatar output. Matches DiceBear's guarantee that `generateAvatar({})` always returns something, but signals that identity needs resolution rather than silently assigning a random appearance.
**Depends on:** D3 (archetype payload only API)
**Sources:** packages/agent-avatar-2d/dist/generator.js (current DiceBear usage)
**Exploration:** quick
**Status:** revised — specified concrete fallback behavior (Everyman/Citizen template with desaturated palette)

## D8: Visual design constraints (from prototyping)

**Choice:** Apply these constraints from previous session prototyping:
1. Half-body framing (head to waist — not full legs, not just bust)
2. Distinct head shapes per family (round for Innocent/Caregiver, square jaw for Hero, diamond for Magician, heart for Lover, etc.)
3. Archetype-specific props (magnifying glass, orb/wand, paintbrush/palette, shield, crown/scepter, compass/hat, juggling balls, gavel, etc.)
4. Character variety — diverse facial hair (Einstein wild, manicured moustache, bushy beard), diverse hair styles
5. Family colour palettes from spec (cool blues for Sage, deep purples for Magician, bold primaries for Hero, etc.)
6. Size-responsive detail tiers:
   - **xs (24px):** Family silhouette + palette only. No props, no facial detail. Head shape is the primary differentiator.
   - **sm (40px):** Family silhouette + palette + head shape variation. Props omitted. Facial features simplified.
   - **md (64px):** Full archetype template visible. Props rendered. Facial features present but simplified. Adjective effects limited to palette/intensity.
   - **lg (128px):** Full detail — props, facial hair variety, head shapes, adjective effects (pose, line quality, shape language), canonical axis expression adjustments.
**Alternatives:** None — these are validated design constraints from iterative prototyping. Size tiers are new — added to address rendering fidelity at actual component sizes.
**Rationale:** Previous session validated constraints 1-5 through v1-v4 prototype iterations. They produce visually distinctive, recognisable archetypes. Size tiers ensure the system doesn't invest rendering effort in details invisible at the target size — props at 24px are sub-pixel, head shape differences at 40px are marginal.
**Trade-offs:** Head shape variety increases the number of base body/head SVG parts needed. Size-responsive rendering adds conditional logic to the layer builder.
**Sources:** eidos avatar-generator-contract.md Section 5 (visual template guidelines, colour tendencies), previous session prototyping
**Exploration:** quick
**Status:** revised — added size-responsive detail tiers (constraint 6) with explicit per-size rendering rules

## D9: Client-side SVG generation

**Choice:** Generate avatars client-side in the TypeScript component. No server-side SVG rendering.
**Alternatives:**
- Server-side SVG generation — Quarkus endpoint takes archetype payload, returns rendered SVG. Single implementation language, direct access to eidos vocabulary, cacheable responses.
- Hybrid — server renders base templates, client applies runtime modifiers (adjectives, axes)
**Rationale:** blocks-ui components are framework-agnostic Web Components that must work standalone in test harnesses without backend connectivity (ARC42STORIES §1: "Components work standalone in a test harness AND embedded via pages hostPanel"). Server-side rendering couples the component to backend availability, adds network latency to every avatar display, and violates blocks-ui's zero-domain-coupling constraint (ARC42STORIES §3). The eidos Java vocabulary is the IDENTITY model; the avatar system is the VISUAL model — data flows from identity to visual at the API boundary, not at render time. The component needs no runtime access to ArchetypeResolver or ArchetypeTerm — it receives a resolved payload and renders.
**Trade-offs:** Archetype visual logic is duplicated in TypeScript rather than reusing Java vocabulary classes. This is intentional — the visual rendering concern belongs in the UI layer, and the "duplication" is minimal (48 template configurations, not the full compatibility matrix).
**Sources:** ARC42STORIES.MD §1 (standalone test harness requirement), §3 (zero domain coupling)
**Exploration:** surfaced by review (R1-10)
**Status:** captured

## D10: Package placement — replace agent-avatar-2d in-place

**Choice:** New source code lives in `packages/agent-avatar-2d/src/`, replacing the current compiled-only package. Package name and npm scope remain unchanged.
**Alternatives:**
- New package with new name — avoids confusion but requires import changes across all consuming apps (agent-catalog, agent-profile, agent-wizard, and every app that uses `<agent-avatar>`)
- Extend into the `packages/avatar/` (3D) package — wrong boundary, 2D and 3D serve different purposes
**Rationale:** `agent-avatar-2d` currently has no TypeScript sources — only compiled `dist/` files. Adding `src/` with the new implementation is the natural replacement path. The existing custom element name `agent-avatar` is retained, so consumers need no HTML changes — only the data contract changes (D3).
**Trade-offs:** The existing compiled `dist/` files are removed and rebuilt from new sources. Any consumer relying on the current generator API needs updating (which is already required by D3's API break).
**Sources:** packages/agent-avatar-2d/ (current structure: dist-only, no src/)
**Exploration:** surfaced by review (R1-12)
**Status:** captured

## D11: 2D/3D avatar boundary

**Choice:** The 2D archetype avatar system (agent-avatar-2d) and the 3D TalkingHead avatar system (packages/avatar/) are independent rendering systems. Both consume archetype identity from the agent entity but share no rendering code or visual assets.
**Alternatives:**
- Unified rendering pipeline — archetype identity drives both 2D and 3D from a shared visual model
- 2D as 3D fallback — 2D renders when WebGL is unavailable
**Rationale:** The 2D system serves static identification (lists, headers, profiles — xs through lg sizes). The 3D system serves interactive conversation (WebGL rendering, viseme-driven lip sync, camera controls). These are fundamentally different rendering contexts with different technology stacks (SVG vs WebGL), different performance profiles, and different interaction models. The shared data is the archetype identity (family, sub-archetype, adjectives) — not the rendering pipeline. The archetype payload API (D3) is designed to serve any renderer.
**Trade-offs:** Visual consistency between 2D and 3D representations of the same archetype requires separate design work — the systems won't automatically match.
**Sources:** packages/avatar/src/ (3D TalkingHead implementation), packages/agent-avatar-2d/ (2D SVG implementation)
**Exploration:** surfaced by review (R1-13)
**Status:** captured

## D12: Mechanical composition with preset configurations

**Choice:** The 48 archetypes are preset configurations in a lookup table, not hand-drawn illustrations. A mechanical builder assembles SVG from composable part renderers given a config object. Each part renderer is a pure function `(palette, modifiers) → SVG path string`. The builder stacks layers in order (body → costume → head → hair → facial hair → face → glasses → props → accessories).
**Alternatives:**
- Hand-craft each archetype SVG independently — maximum visual quality per archetype, but no composability, no user customisation, no part reuse
- Hybrid: hand-craft family bases, compose only for sub-archetype differentiation — middle ground but inconsistent rendering pipeline
**Rationale:** Mechanical composition means: (1) the part-catalogue.md assignment table translates directly to TypeScript config data — no creative interpretation gap between spec and code; (2) end users can customise avatars by overriding parts from the preset; (3) new archetypes are added by registering a new config row, not drawing new art; (4) the wizard generates everything at setup time from the converged archetype + user tweaks.
**Trade-offs:** Visual quality is bounded by how well parts compose together. Hand-drawn archetypes would have perfect per-archetype coherence. Mitigated by designing parts to compose well (shared viewBox, consistent anchor points, palette-driven colouring).
**Depends on:** D4 (layered builder with part registries)
**Sources:** part-catalogue.md (the config table), DiceBear architecture (prior art for configurable avatar builders)
**Exploration:** quick — natural consequence of D4
**Status:** captured

## D13: Deterministic reproducible avatars via config identity

**Choice:** An avatar is fully determined by its config — store the config, not the SVG. The config is a compact delta from the archetype preset:
```json
{
  "archetype": "Sage/Detective",
  "overrides": { "hair": "afro-short", "glasses": "aviator" },
  "adjectives": ["meticulous", "persistent"],
  "canonicalAxes": { "ruleFollowing": { "term": "strict", "weight": 1.0 } }
}
```
When `overrides` is empty (most agents), the avatar is purely determined by the archetype identity. When present, it records user customisations from the wizard. A SHA-256 of the resolved config (preset + overrides merged) serves as a cache key — same config always produces the same SVG output, no storage of rendered SVGs needed.
**Alternatives:**
- Store rendered SVG blobs — guaranteed pixel-identical across sessions, but large storage, stale when part renderers improve
- Store only archetype name (no overrides) — simpler, but no user customisation survives
- Random seed like DiceBear — reproducible but semantically meaningless, can't be reverse-engineered to parts
**Rationale:** Storing config-as-identity means: (1) avatars survive part renderer upgrades — when a hair style SVG improves, all agents using that hair style get the improvement automatically; (2) the config is human-readable and debuggable; (3) the SHA gives a fast equality check without comparing full configs; (4) the wizard stores the result as data on the agent entity, not as a rendered artifact.
**Trade-offs:** Avatars change when part renderers change (not pixel-stable across versions). This is a feature, not a bug — renderer improvements propagate to all agents. If pixel-stability is ever needed (e.g., for printed materials), render-and-cache at that point.
**Depends on:** D12 (mechanical composition), D3 (archetype payload API)
**Sources:** DiceBear seed-based generation (prior art), eidos avatar-generator-contract.md Section 5 (input schema)
**Exploration:** quick
**Status:** captured

## D14: Collection-based theming — abstract part IDs, swappable renderers

**Choice:** Part IDs are abstract semantic identifiers (`hair-bald-sides`, `glasses-round-wire`), not visual assets. A **collection** provides concrete SVG renderers for every abstract part ID. Different collections render the same part differently (flat illustration, pixel art, watercolour, etc.). The assignment table (which parts go with which archetype) is collection-agnostic — it lives above the rendering layer.
**Alternatives:**
- Single hardcoded renderer per part — simpler, but locks to one art style forever
- CSS-only theming (colour swaps, filters) — limited to palette changes, can't change shape language or line quality
**Rationale:** Collections make the system extensible without touching the archetype model. A new art style is a new set of part renderers, not a new assignment table. This separates identity (what the avatar IS) from presentation (how it LOOKS). The eidos personality model → archetype config → part assignment is stable; only the visual rendering varies.
**Trade-offs:** Each collection must implement renderers for every part ID in the registry. New parts added to the registry require updates across all collections. Mitigated by: (1) the part registry is finite and grows slowly; (2) collections can provide a fallback renderer for unknown parts.
**Depends on:** D12 (mechanical composition)
**Sources:** DiceBear style system (prior art — multiple styles rendering same seed), part-catalogue.md
**Exploration:** quick
**Status:** captured

## D15: Compact avatar identity code

**Choice:** Avatar identity is a compact reproducible code: `collection:config`. Two tiers:
- **Preset** (no overrides, ~90% of agents): `mythic:P1B` — collection slug + `P` + archetype index (base36). 3-char config portion.
- **Customised** (user tweaked parts): `mythic:C` + base64-encoded part selections. ~9-char config portion. 48 bits encodes the full part assignment (version 2b + head 4b + hair 5b + facialHair 4b + costume 5b + glasses 4b + eyebrows 4b + accessory 4b + palette 4b + prop1 6b + prop2 6b = 48 bits = 8 base64 chars).

Same code → same base SVG, always. Deterministic, printable, shareable, loggable. Codes encode part identity only — adjective/axis modifiers are not part of the code and require the full AvatarPayload.
**Alternatives:**
- SHA-256 of full config JSON — opaque, can't decode back to parts without a lookup table
- Full config JSON — human-readable but verbose, not suitable for URLs or compact storage
- UUID — unique but not deterministic from config
**Rationale:** The two-tier encoding keeps the common case ultra-compact (6-8 chars total) while supporting full customisation. The code is decodable — given `mythic:P1B`, you can reconstruct the exact part list without a database lookup. The collection prefix ensures the code renders correctly even when multiple collections exist.
**Trade-offs:** Part registry changes (adding new options, reordering) can invalidate existing codes. Mitigated by: append-only part registries (new parts get new indices, existing indices are stable) and a 2-bit version field enabling future encoding evolution.
**Depends on:** D13 (deterministic config identity), D14 (collection theming)
**Sources:** DiceBear seed encoding, base64/base36 encoding
**Exploration:** quick
**Status:** captured

## D16: Facial feature extraction — composable eyes, nose, mouth

**Choice:** Extract eyes, nose, and mouth from head symbols into independent composable layers. Ears stay in head symbols (x-position is coupled to head width). Builder applies per-head y-offsets from an anchor map to position features correctly per head shape.

**Architecture:**
- Feature symbols drawn at canonical LOCAL y-positions: eyes y=62, nose y=78, mouth y=88
- Per-head anchor map: `HEAD_FEATURE_OFFSETS[headId] → { eyes: N, nose: N, mouth: N }` where N = headTransform + featureDelta
- Builder wraps each feature layer in `<g transform="translate(0, offset)">` using the anchor value
- Eye iris uses CSS custom properties `var(--iris)` and `var(--iris-dark)` — derived from family palette
- Config table gains three new fields: `eyes`, `nose`, `mouth` (string part IDs)

**Per-head offsets (combined transform + delta):**

| Head | Eyes | Nose | Mouth |
|------|------|------|-------|
| oval | 6 | 2 | 8 |
| square-jaw | 6 | 2 | 8 |
| angular | 10 | 2 | 8 |
| round | 6 | 0 | 4 |
| round-wide | 6 | 2 | 4 |
| diamond | 10 | 8 | 10 |
| heart | 8 | 8 | 8 |
| soft-oval | 4 | 2 | 2 |
| strong-sym | 4 | 4 | 6 |
| weathered | 6 | 4 | 4 |
| standard | 6 | 6 | 6 |

**Feature inventory:**

Mouths (8): `line-neutral` (male default), `line-wide` (grin), `line-stern` (downturned), `smile` (upturned), `lips-natural` (subtle lip color — key female signal), `lips-full` (prominent lip color, cupid's bow), `smirk` (asymmetric), `small` (understated)

Noses (6): `subtle` (minimal), `prominent` (wider, stronger), `button` (short, round), `narrow` (thin), `aquiline` (long, pronounced), `broad` (wide base)

Eyes (6): `standard` (14×10), `large` (16×12, animated), `narrow` (14×6, hooded), `round` (10×10), `almond` (16×8, tapered), `deep-set` (heavy upper shadow)

**Male/female lip strategy:** No explicit gender field. Mouth type determines visual read — `line-*` mouths read masculine (dark crease, no lip fill), `lips-*` mouths read feminine (visible lip color using muted rose #cc8888/#cc7777). `smile` and `small` are gender-neutral. This follows LucasArts pixel art convention where lip color is the primary gender signal at low resolution.

**Alternatives:**
- Keep features baked in heads, create per-head face variants — simpler but limits mix-and-match, ~44 face symbols needed (11 heads × 4 variants)
- Fully extract ears too — ears at x=60-66 (left) across heads, 12px variation makes standardisation impractical
- Per-head feature variant groups — groups heads by face zone, creates per-group features — less composable, more complex
**Rationale:** Independent features give maximum customisation with manageable offset data. The anchor map is 11 entries with 3 values each — trivial data. Ears excluded because their x-position is tightly coupled to head outline width (varies 12px), while eyes/nose/mouth are all centered (x=~98-100) and only vary in y.
**Trade-offs:** Feature position depends on head shape — wrong head+feature combo can look slightly off. Mitigated by the anchor map ensuring pixel-correct placement. Code encoding (D15) expands to accommodate 3 new fields — increases custom code length.
**Depends on:** D4 (layered builder), D12 (mechanical composition), D14 (collection theming)
**Sources:** scummbar-hd-test.svg (measured feature positions across all 12 heads), LucasArts pixel art conventions
**Exploration:** thorough — mapped absolute y-positions across all 12 heads, measured x-position variance for ears
**Status:** proposed — pending visual review of feature-preview.html

## D17: Donut Creek Full Cast — character-to-archetype mapping

**Choice:** 48 unique Simpsons characters, one per sub-archetype. Each character is hand-drawn SVG referencing the specific Simpsons character's appearance. Leads (already drawn) map to their most thematic sub-archetype.

**Mapping:**

| Family | Angel/Artist/etc. | Guardian/Entrepreneur/etc. | Healer/Storyteller/etc. | Samaritan/Visionary/etc. |
|--------|-------------------|---------------------------|------------------------|-------------------------|
| Caregiver | Maude Flanders (Angel) | Ned Flanders (Guardian) | **Hibbert** (Healer) | Lunchlady Doris (Samaritan) |
| Creator | Otto Mann (Artist) | Lindsey Naegle (Entrepreneur) | Troy McClure (Storyteller) | **Frink** (Visionary) |
| Everyman | Lenny Leonard (Advocate) | **Homer** (Citizen) | Carl Carlson (Networker) | Barney Gumble (Servant) |
| Explorer | **Willie** (Adventurer) | Apu (Generalist) | Sea Captain (Pioneer) | Milhouse (Seeker) |
| Hero | Drederick Tatum (Athlete) | Nelson Muntz (Liberator) | Chief Wiggum (Rescuer) | **McBain** (Warrior) |
| Innocent | **Ralph** (Child) | Todd Flanders (Dreamer) | Martin Prince (Idealist) | Maggie Simpson (Muse) |
| Jester | **Krusty** (Clown) | Duffman (Entertainer) | Bart Simpson (Provocateur) | Sideshow Bob (Shapeshifter) |
| Lover | Smithers (Companion) | Disco Stu (Hedonist) | Selma Bouvier (Matchmaker) | **Marge** (Romantic) |
| Magician | **Burns** (Alchemist) | Artie Ziff (Engineer) | Hank Scorpio (Innovator) | Comic Book Guy (Scientist) |
| Rebel | Jimbo Jones (Activist) | Moe Szyslak (Gambler) | **Snake** (Maverick) | Hans Moleman (Reformer) |
| Sage | Lisa Simpson (Detective) | **Skinner** (Mentor) | Grandpa Simpson (Shaman) | Kent Brockman (Translator) |
| Sovereign | Rev. Lovejoy (Ambassador) | Blue-Haired Lawyer (Judge) | Fat Tony (Patriarch) | **Quimby** (Ruler) |

**Bold** = family lead (already drawn). Barney also already drawn.

**Alternatives:**
- Fewer unique characters with shared base templates — faster but loses the "Full Cast" identity
- Non-Simpsons references — breaks the Donut Creek collection concept
**Rationale:** Each character is recognizable to Simpsons fans, thematically fits their sub-archetype, and is visually distinct within their family. 48 unique characters ensures maximum variety.
**Trade-offs:** 36 new characters to draw. Each needs a reference image, careful SVG work, and iteration. The handoff's character drawing rules must be followed strictly.
**Sources:** config-table.ts (48 sub-archetype definitions), donutcreek-barney-trial.html (8 leads), donutcreek-cast-trial.html (4 leads), HANDOFF.md (drawing rules)
**Exploration:** quick — mapping is creative assignment, not architectural
**Status:** captured

## D18: Fixed-SVG collections alongside parts-based collections

**Choice:** Add a `type` discriminator to `AvatarCollection`: `'parts'` (current — builder assembles from part symbols) and `'fixed'` (lookup by archetype key, return complete SVG). The builder checks type and either assembles parts or returns the fixed SVG directly.
**Alternatives:**
- Wrap each fixed SVG as a single "part" — hacky, forces builder to handle degenerate case
- Separate rendering path outside the collection system — duplicates avatar resolution logic
**Rationale:** Three of the four collections (Chibi, Simpsons, Mythic initially) use fixed SVGs. Only Neon uses parts. The type discriminator keeps the collection registry uniform while the builder handles the rendering difference cleanly.
**Trade-offs:** `AvatarCollection` interface changes — adds `type` and `fixedSvgs` fields. Existing mythic collection needs `type: 'parts'` added.
**Depends on:** D14 (collection-based theming)
**Sources:** AvatarCollection interface (types.ts:104), registry.ts, builder.ts
**Exploration:** quick
**Status:** captured

## D19: Faceted personality selector — 6-framework filter UI

**Choice:** The wizard's avatar step includes a faceted selector with 6 personality framework filter rows (MBTI, Enneagram, DISC, Belbin, Big Five, SDI). Each row is a pill/chip bar. User can start from ANY framework, in any order. Each selection intersects compatible archetype families (Section 1 of compatibility matrix), narrowing the 48-avatar grid. Section 2 rules distinguish sub-archetypes within a family. Subsequent framework rows only show values still compatible with current selections.
**Alternatives:**
- Single-dimension filter (family only) — too coarse, 12→4 not enough granularity
- Disposition axes as filters — different data model, doesn't map cleanly to archetypes
- Direct archetype picker (no personality filters) — loses the personality-driven selection UX
**Rationale:** The compatibility matrix already defines the intersection logic. The UI is a direct visual expression of the data. Starting from any framework means users enter via whatever framework they know (MBTI-familiar people start there, team coaches start from Belbin, etc.).
**Trade-offs:** Compatibility matrix data must be shipped client-side as a static lookup table (~5KB). 6 filter rows may feel overwhelming — mitigated by: each row is optional, selecting from one immediately simplifies the others.
**Depends on:** eidos archetype-compatibility-matrix.md
**Sources:** archetype-compatibility-matrix.md (Sections 1-2), ArchetypeTerm.java
**Exploration:** quick
**Status:** captured

## D20: Profession preset quick-picks

**Choice:** A "By Profession" tab offers pre-mapped role → archetype shortcuts. Professions (Software, Education, Legal, Medical, Finance, etc.) each list common roles. Clicking a role selects the mapped archetype directly, bypassing the personality filter drill-down.
**Alternatives:**
- No presets — everyone uses the personality filter — slower for users who just want a role-appropriate avatar
- Server-side role mapping — more flexible but adds API dependency
**Rationale:** Most users setting up an agent know what role it serves ("this is a code reviewer") but don't know or care about MBTI/Enneagram. Presets give them a one-click path. The mapping is static data (researched from common role descriptions → archetype alignment).
**Trade-offs:** The role → archetype mapping is opinionated. Some roles could reasonably map to multiple archetypes. Mitigated by: preset is a starting suggestion, user can switch to personality filter to refine.
**Depends on:** D19 (avatar grid infrastructure)
**Sources:** Hartwell & Chen archetype descriptions, common profession role taxonomies
**Exploration:** quick
**Status:** captured

## D21: Avatar grid layout — 12×4 family grid with progressive dimming

**Choice:** The avatar grid displays all 48 avatars in a 12-row × 4-column layout (rows = families, columns = sub-archetypes). As filters narrow compatible archetypes, incompatible avatars dim/shrink. Compatible avatars remain full-size and clickable. Click to select. Selected avatar shows enlarged in a preview area.
**Alternatives:**
- Hide incompatible avatars entirely — jarring layout shifts as grid collapses
- List view — loses the spatial family grouping that helps orientation
- Paginated — unnecessary for 48 items
**Rationale:** Keeping all 48 visible (dimmed vs active) preserves spatial orientation — users learn where their archetype lives in the grid. The 12×4 layout maps directly to the archetype model's structure (12 families × 4 sub-archetypes).
**Trade-offs:** 48 avatars on screen at once may be visually dense at small viewports. Mitigated by: responsive collapse to fewer columns, and the dimming quickly reduces visual noise.
**Sources:** config-table.ts (48 archetype entries), ARCHETYPE_FAMILIES constant
**Exploration:** quick
**Status:** captured
