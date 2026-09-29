# agent-manifest-editor — Design Decisions

## D1: Scope alignment with parent epic

**Choice:** Follow parent epic spec (#166) which already includes inference parameter sliders and system prompt preview in its scope. This issue (#210) implements the manifest editor component as specified.
**Alternatives:**
- Narrower scope omitting those features — would deviate from the parent spec
**Rationale:** Both features (temperature/top-p/max-tokens sliders, system prompt preview) are explicitly listed in the parent epic spec and in issue #210's scope. This is not expanded scope — it is the defined scope.
**Trade-offs:** None — implementing what was specified.
**Sources:** casehubio/blocks-ui#210, parent epic spec §Component 1, parent epic spec §Scope
**Exploration:** quick
**Status:** revised (R1-02: corrected misleading "expanded scope" framing)

## D2: Credential editing — dev mode for inline API keys

**Choice:** Three indirect reference types (env, file, ref) as default. Inline API key entry available behind a `devMode` boolean property. Inline keys are held in component-internal state only — never included in the emitted `Manifest` payload. The emitted manifest uses a placeholder `CredentialRef` with `type: 'env'` and an empty name when dev-mode keys are active. Dev-mode keys are used only for test-connection calls (sent directly to the test endpoint, not via the manifest).
**Alternatives:**
- Always show inline key entry — security risk of accidental persistence
- Never allow inline entry — inconvenient for quick testing
- Model transience in the CredentialRef type system (e.g. `InlineRef` variant) — requires Java sealed interface change in platform, disproportionate for a dev convenience feature
**Rationale:** Clean separation between production credential management and development convenience. The safety invariant is structural: inline keys never enter the Manifest type at all, rather than relying on stripping logic. Dev-mode keys vanish on page refresh — this is acceptable for the development testing use case.
**Trade-offs:** Dev mode keys lost on refresh. `devMode` is a new pattern in blocks-ui — no precedent. Clear visual indicator required when active.
**Sources:** CredentialRef sealed interface (EnvRef, FileRef, ExternalRef), platform agent-config-core
**Exploration:** quick
**Status:** revised (R1-03: inline keys never enter emitted manifest; structural safety over stripping logic)

## D3: System prompt preview — pass-through property

**Choice:** Accept a `systemPrompt` string property. The host application generates the prompt (via its own eidos integration) and passes it in. The manifest editor renders it read-only. No backend endpoint call from within the component.
**Alternatives:**
- Backend endpoint (`POST /agents/preview-prompt`) — endpoint doesn't exist, creates undesigned backend dependency, conflates PersonalityProfile with AgentDescriptor
- Client-side template — duplicates/diverges from eidos generation logic
**Rationale:** The simplest approach. Follows blocks-ui pattern where components display data they're given, not data they fetch from cross-cutting services. The PersonalityProfile→AgentDescriptor→SystemPrompt transformation pipeline is the host app's responsibility. The manifest editor is a display surface for the result.
**Trade-offs:** Host must wire the prompt generation. In inline/demo mode, pass a static example string.
**Sources:** blocks-ui C5 data integration pattern, avatar-step PersonalityProfile interface, eidos SystemPromptRenderer SPI
**Exploration:** quick
**Status:** revised (R1-04: dropped non-existent endpoint, adopted pass-through property)

## D4: Presets cover the common case — "Other" card for unlisted providers

**Choice:** Four provider preset cards (Anthropic, OpenAI, Google, Ollama) plus an "Other" provider card for arbitrary providers. No blank "Custom" preset that starts with nothing. The "Other" card provides free-text provider identifier, endpoint URL, and credential configuration.
**Alternatives:**
- Four presets only — blocks users with Mistral, Cohere, Azure OpenAI, Bedrock, Groq, vLLM, etc.
- Blank "Custom" preset — strictly worse than picking closest preset and editing
**Rationale:** `ProviderDeclaration` in agent-config-core is not a closed enum — it supports arbitrary providers. The UI must match this extensibility. The "Other" card serves unlisted providers without the overhead of a full preset. If `GET /llm/providers` returns additional providers from the backend, render them dynamically as additional cards.
**Trade-offs:** "Other" card has less guidance (no preset model list, no detection). Dynamic provider rendering from backend adds complexity.
**Sources:** Parent epic spec D2 (preset model), ProviderDeclaration type, platform#291 wizard API (GET /llm/providers)
**Exploration:** quick
**Status:** revised (R1-05: added "Other" card for unlisted providers; R1-14: dynamic provider rendering from backend)

## D5: Inference parameters — global defaults with per-provider and per-model overrides

**Choice:** Three-tier hierarchy: global defaults → per-provider defaults → per-model overrides. Slider ranges are model-aware — min/max/step values adapt based on the selected provider and model. When `ModelDescriptor` carries parameter range metadata, sliders use it. Otherwise, fall back to known provider defaults (Anthropic temperature 0–1, OpenAI 0–2, etc.).
**Alternatives:**
- Per-model only — requires configuring each model individually
- Global + per-model only (no provider tier) — forces per-model overrides for provider-wide preferences
- Global only — no per-model granularity
**Rationale:** Most users want one consistent config per provider. The per-provider tier avoids setting the same temperature on every Anthropic model individually. Model-aware ranges prevent invalid values (e.g. temperature 1.5 on Anthropic). Known provider defaults as fallback when model metadata is unavailable.
**Trade-offs:** Three-tier hierarchy adds UI complexity. Must clearly show inheritance (which value is active, where it came from). Provider-specific range knowledge is hardcoded — needs updating as providers change.
**Sources:** Manifest.defaults, ModelDescriptor.properties, provider documentation
**Exploration:** quick
**Status:** revised (R1-06: added per-provider tier, model-aware slider ranges)

## D6: Test connection results — persistent within session with defined invalidation

**Choice:** Provider cards retain last test result as status badge (green check, red X, untested grey). Auto-reset on: credential changes, endpoint/host changes, model selection changes. Alias and inference parameter changes do NOT invalidate (they don't affect connectivity). Badge carries a timestamp showing when last tested.
**Alternatives:**
- Ephemeral — flash success/failure that fades
**Rationale:** Persistent badges give at-a-glance picture of which providers are working. Explicit invalidation rules prevent stale green badges from misleading. Timestamp helps users judge recency without a TTL mechanism.
**Trade-offs:** Timestamp is informational only — no automatic re-test or expiry. Network state changes (rate limiting, outage) between tests are not detected.
**Sources:** Parent epic spec (test connection button)
**Exploration:** quick
**Status:** revised (R1-07: enumerated invalidation rules, added timestamp)

## D7: Event contract — immediate CustomEvent, parent spec topic name

**Choice:** Immediate `manifest:configured` CustomEvent (matching parent spec topic name) with full Manifest payload on each edit. Raw `CustomEvent` with `bubbles: true, composed: true`. No debounce. No save button — configuration surface, not form submission.
**Alternatives:**
- `manifest:config:changed` topic name — contradicts parent spec
- Debounced emission — departure from avatar-step pattern (fires immediately)
- `pages-event` / `emitPagesEvent` — avatar-step actual code uses raw CustomEvent, not pages-event
- Explicit save/confirm action — manual step, less reactive
**Rationale:** Use the topic name already registered in the parent spec. Match avatar-step's actual implementation pattern (raw CustomEvent, immediate, no debounce). Consumers handle update frequency via their own reactive properties.
**Trade-offs:** Consumers must handle rapid updates gracefully. No built-in save/cancel contract — see D9 for state restoration.
**Sources:** Parent epic spec §Event topics (`manifest:configured`), avatar-step.ts:335-340 (immediate CustomEvent pattern)
**Exploration:** quick
**Status:** revised (R1-08: corrected topic name, dropped debounce, clarified CustomEvent vs pages-event)

## D8: Internal architecture — host + provider-card sub-component

**Choice:** Host `<agent-manifest-editor>` orchestrates layout and manifest assembly. `<manifest-provider-card>` sub-component owns credential editing, model selection, test connection, and expand/collapse state per provider. The host renders preset bar, inference defaults section, system prompt preview, and assembles the full Manifest from provider-card events.
**Alternatives:**
- Single component with render methods — avatar-step pattern, but avatar-step is 932 lines (not 1500 as initially claimed). The manifest editor has comparable complexity to work-item-inbox (1310-line host + 4 sub-components), not avatar-step.
- Fully decomposed sub-components — wiring overhead without reuse payoff for sections other than provider cards
**Rationale:** Provider cards are the naturally repeated element with their own state (credential entry, model selection, test result, expanded/collapsed). Matches work-item-inbox pattern (host orchestrates, sub-components own rendering domains). Host stays under ~500 lines of orchestration. Provider cards are independently testable.
**Trade-offs:** Two files instead of one. Provider-card must emit structured events for the host to assemble. More wiring than single-component.
**Sources:** work-item-inbox pattern (host + QueuePillBar, ScopeContextBar, etc.), channel-activity (11 sub-components), notification-inbox (5 sub-components)
**Exploration:** quick
**Status:** revised (R1-09: corrected avatar-step size, adopted sub-component pattern matching repo conventions)

## D9: State restoration — `data` property for initial and reset state

**Choice:** Accept a `data` property containing the initial `Manifest`. This serves as both the initial state and the reset target. When the host sets `data` to a new value, the component re-initialises from it. This enables wizard cancel/back semantics — the host saves the manifest before navigating forward, restores it on back/cancel by re-setting `data`.
**Alternatives:**
- No reset mechanism — forward-only editing, no cancel semantics
- Separate `initialManifest` and `manifest` properties — over-engineered for the use case
**Rationale:** These components will be wired into wizard flows with Back/Cancel buttons. The `data` property pattern (set to restore state) follows the existing blocks-ui dual data mode convention. No explicit save/cancel buttons inside the component — the host owns navigation.
**Trade-offs:** Host must snapshot manifest state at navigation boundaries. Component re-initialisation on `data` change discards unsaved edits — this is the intended cancel behaviour.
**Sources:** blocks-ui dual data mode pattern (C5), parent epic spec (D1: host apps wire components together)
**Exploration:** quick
**Status:** captured (from R1-12: undo/revert contract for wizard integration)

## D10: Tag name — keep `agent-manifest-editor`

**Choice:** Keep the `agent-manifest-editor` tag name from the parent spec.
**Alternatives:**
- `llm-manifest-editor` or `manifest-editor` — more generic, decoupled from agent setup
**Rationale:** The parent spec named it. The component is part of the agent setup wizard epic. While the Manifest type is LLM-specific, the component lives in the agent setup namespace. If it's ever needed standalone, renaming is a trivial refactor.
**Trade-offs:** Tag name couples to agent setup flow. Acceptable — this is where it lives.
**Sources:** Parent epic spec §Component 1
**Exploration:** quick
**Status:** captured (from R1-11: acknowledged coupling, kept parent spec name)

## D11: Type mirror maintenance — manual sync with documented contract

**Choice:** Add Manifest types to `blocks-ui-core/src/types/manifest.ts` as manual TS mirrors of Java types, following the `graph-stencil-org/src/types.ts` precedent. Document the source Java types and version in a comment header. No automated sync mechanism — manual maintenance when Java types evolve, verified by comparing against decompiled bytecode from SNAPSHOT jars.
**Alternatives:**
- Automated code generation from Java types — no tooling exists for this in the platform
- Import types from a shared package — no shared TS/Java type package exists
**Rationale:** Follows established precedent. The existing `AgentDescriptor` mirror in graph-stencil-org has diverged (6 fields vs 23+ in Java) — this is a known gap. Manual sync is the current reality. Documenting the source types makes future sync easier.
**Trade-offs:** Types can drift from Java. Mitigated by documenting source and by the blocks-ui-schema staleness tests which catch interface changes.
**Sources:** graph-stencil-org/src/types.ts (existing mirror pattern), blocks-ui-schema staleness test
**Exploration:** quick
**Status:** captured (from R1-13: type mirror synchronisation strategy)

## D12: Provider extensibility — dynamic rendering from backend

**Choice:** If `GET /llm/providers` returns providers beyond the four built-in presets, render them dynamically as additional provider cards. Each backend-provided provider includes its display name, available models, and credential requirements. The "Other" card (D4) serves as fallback when no backend is available.
**Alternatives:**
- Fixed four providers only — blocks extensibility
- Plugin/registry mechanism for client-side provider definitions — over-engineered
**Rationale:** `ProviderDeclaration` supports arbitrary providers. The backend already knows what's available. Rendering dynamically from the provider list is the natural extension.
**Trade-offs:** Dynamic cards have less polish (no preset logo, no tailored help text). Backend dependency for discovery.
**Sources:** platform#291 wizard API (GET /llm/providers), ProviderDeclaration type
**Exploration:** quick
**Status:** captured (from R1-14: provider extensibility mechanism)
