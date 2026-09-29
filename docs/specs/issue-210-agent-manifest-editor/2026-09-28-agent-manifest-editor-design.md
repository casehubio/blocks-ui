# agent-manifest-editor — Design Spec

LLM provider/model/credential configuration as an interactive Web Component.
Makes LLM setup non-daunting through presets, progressive disclosure, live
detection, and guided help. Part of the agent setup wizard epic (#166).

## Scope

- Provider presets (Anthropic, OpenAI, Google, Ollama) with drill-down editing
- "Other" provider card for arbitrary/unlisted providers
- Dynamic provider rendering from backend (`GET /llm/providers`)
- Credential editing (env var, file path, credential store ref)
- Dev-mode inline API key entry (opt-in, never persisted in manifest)
- Model picker with tier grouping and capability badges
- Model alias configuration (logical names → model resolution constraints)
- Per-model inference parameter sliders with batch-set convenience per provider
- Model-aware slider ranges (adapts min/max per model capabilities)
- System prompt preview (read-only, from host-provided `systemPrompt` property)
- Test connection with persistent session badges and defined invalidation
- State restoration via `data` property (wizard cancel/back semantics)

## Constraints

**C1: Headless/payload data mode.** Standard blocks-ui dual data mode —
`data` property for inline payload, `endpoint` for backend fetch. Fully
simulatable without backend.

**C2: Direct-fetch pattern.** Object-tree data (Manifest), not tabular.
Does NOT use DataSourceMixin/TypedDataSet. Follows gdpr-erasure-action
and worker-task-pane precedent.

**C3: ARIA.** Every component ships with ARIA attributes. Tests include
ARIA assertions.

**C4: Type mirrors.** Manifest types added to blocks-ui-core as manual TS
mirrors of Java types from platform agent-config-core, following the
graph-stencil-org/src/types.ts precedent. Source Java types and version
documented in comment header. UI-only abstractions (e.g., `InferenceDefaults`)
are component-local types, not mirrors — they do not live in blocks-ui-core.

---

## Data Model

### Type mirrors (`blocks-ui-core/src/types/manifest.ts`)

Faithful TS mirrors of Java types from `platform-agent-config-core-0.2-SNAPSHOT`.
Source Java types and version documented in comment header. These match the
parent epic's verified definitions (decompiled bytecode).

```typescript
export type ModelTier = 'FLAGSHIP' | 'STANDARD' | 'FAST' | 'EMBEDDING';
export type ModelLocality = 'CLOUD' | 'LOCAL' | 'HYBRID';
export type CostTier = 'FREE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'PREMIUM';

export interface ProviderDeclaration {
  vendor: string;
  credential?: string | Record<string, string>;
  host?: string;
}

export interface ModelDescriptor {
  id: string;
  apiModelId?: string;
  backendKey?: string;
  backendInstanceId?: string;
  vendor?: string;
  family?: string;
  displayName?: string;
  tier?: ModelTier;
  capabilities?: string[];
  contextWindow?: number;
  maxOutput?: number;
  locality?: ModelLocality;
  costTier?: CostTier;
  authMethod?: string;
  properties?: Record<string, string>;
}

export interface AliasDeclaration {
  tier?: ModelTier;
  capabilities?: string[];
  locality?: ModelLocality;
  maxCost?: CostTier;
  minContext?: number;
  minOutput?: number;
  preferVendor?: string;
}

export interface SourceDeclaration {
  uri: string;
  priority?: number;
}

export interface LocalModelDeclaration {
  id: string;
  backendKey?: string;
  host?: string;
}

export interface ManifestDefaults {
  backend?: string;
}

export interface Manifest {
  providers?: ProviderDeclaration[];
  models?: ModelDescriptor[];
  aliases?: Record<string, AliasDeclaration>;
  defaults?: ManifestDefaults;
  sources?: SourceDeclaration[];
  localModels?: LocalModelDeclaration[];
}

export type CredentialRef =
  | { type: 'env'; name: string }
  | { type: 'file'; path: string }
  | { type: 'ref'; name: string };
```

### Provider endpoint response (`agent-manifest-editor.ts`)

Interface for consuming `GET /llm/providers` (platform#291 wizard API).
This is a component-local type — the platform API shape may carry additional
fields; the component consumes only these.

```typescript
interface LlmProviderInfo {
  vendor: string;
  displayName: string;
  models: ModelDescriptor[];
  detection: 'detected' | 'partial' | 'none';
  credentialTypes?: string[];
  defaultHost?: string;
}
```

The `providersEndpoint` fetch expects `LlmProviderInfo[]`. Each entry maps
to a provider card. If `vendor` matches a built-in provider, the dynamic
data enriches the built-in card (see §Provider Cards Grid). Non-matching
vendors create new dynamic cards.

### Component-local types (`agent-manifest-editor.ts`)

UI abstractions used internally by the component. Not Java mirrors — they do
not live in `blocks-ui-core`.

```typescript
interface InferenceDefaults {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

interface ProviderChangedDetail {
  vendor: string;
  credential?: string | Record<string, string>;
  host?: string;
  selectedModels: ModelDescriptor[];
}
```

**Credential conversion:** `ProviderDeclaration.credential` is `string |
Record<string, string>` (the raw serialized form from the Java model).
`CredentialRef` is the parsed typed form used by `ManifestCredentialResolver`.
The component parses raw credentials into `CredentialRef` for the editor UI
(env selector, file path input, store reference picker) and serializes back
to raw strings on emission.

**Inference parameters:** stored in `ModelDescriptor.properties` entries
(e.g., `temperature=0.7`). The component uses `InferenceDefaults` internally
for slider state and resolves to properties on emission. No separate
persistence for inference — all values live on the model.

**`ProviderChangedDetail`:** carries full `ModelDescriptor[]` (not just IDs).
The card always has full descriptors — built-in providers receive them via the
`models` property; "Other" cards create them from user input. Inference
overrides are baked into each descriptor's `properties` before emission. The
host assembles the manifest directly from the emitted descriptors without
lookup or overlay.

---

## Component Architecture

Two custom elements:

### `<agent-manifest-editor>` (host)

Orchestrates layout, assembles the full Manifest from provider-card events.

**Responsibilities:**
- Preset bar (horizontal card row: Anthropic Production, OpenAI Standard,
  Local Development, Multi-provider)
- Provider card instances via `<manifest-provider-card>`
- Alias editor (global section — see §UI Structure)
- System prompt preview (read-only styled text area)
- Dev-mode banner ("Dev Mode — inline API keys enabled (not persisted)")
- Manifest assembly from provider-card state + alias editor state +
  passthrough fields (see §Manifest Assembly below)
- `manifest:configured` via `emitPagesEvent` on each edit

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `data` | `Manifest` | Initial/reset state. Setting re-initialises the component. |
| `endpoint` | `string` | Backend URL for fetching existing config |
| `providersEndpoint` | `string` | `GET /llm/providers` for detection state |
| `systemPrompt` | `string` | Read-only prompt preview text (host-generated) |
| `devMode` | `boolean` | Enables inline API key entry in provider cards |

**Events emitted:**

| Event | Payload | When |
|-------|---------|------|
| `manifest:configured` | `Manifest` | Every discrete edit (immediate). Slider changes emit on settle (`change` event / pointer release), not during drag. |

**ARIA:** `role="form"`, `aria-label="LLM configuration editor"`

### `<manifest-provider-card>` (sub-component)

Owns per-provider configuration state. Instantiated once per provider.

**Responsibilities:**
- Provider name + detection badge (green/amber/grey)
- Test status badge (green check / amber partial / red X / grey untested)
  with timestamp
- Expand/collapse (progressive disclosure)
- Credential editor: radio selector (env/file/ref), plus inline key when
  `devMode` is true. Inline keys held internally only — never in
  `manifest:configured` events (the persistent configuration). Test connection
  requests DO include the inline key when present (see test connection contract).
  **Multi-field credentials (`Record<string, string>`):** when a provider's
  incoming credential is a Record (e.g. `{accessKey: "env:AWS_KEY",
  secretKey: "env:AWS_SECRET"}`), the credential section displays a read-only
  summary: "Multi-field credential (N fields)" with each key listed. The
  card preserves the Record credential on emission until the user explicitly
  switches to a single credential type via the radio selector. Switching
  replaces the Record with the new single-value credential. Multi-field
  credential editing is out of scope (see §Out of Scope).
- Model list: checkboxes grouped by tier (FLAGSHIP/STANDARD/FAST/EMBEDDING).
  Each row: name, context window badge, capability pills (vision, tool use),
  cost tier indicator.
- Per-model inference parameter sliders (temperature, topP, maxTokens) in
  model detail view. "Set inference for all models" batch-set action at
  provider level — convenience, not a persistent hierarchy.
- Test connection button: validates credentials + model availability via
  backend. Updates status badge.
- "Other" provider card: free-text provider name, endpoint URL, "Add model"
  button for manual model entry (see §Interaction Flow).

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `vendor` | `string` | Provider identifier |
| `displayName` | `string` | Provider display name |
| `provider` | `ProviderDeclaration` | Current provider config |
| `models` | `ModelDescriptor[]` | Available models for this provider |
| `selectedModels` | `string[]` | IDs of selected models |
| `detection` | `'detected' \| 'partial' \| 'none'` | Detection state from backend |
| `devMode` | `boolean` | Pass-through from host |
| `testEndpoint` | `string` | Backend URL for connection test |
| `isOther` | `boolean` | True for "Other" provider card (free-text name, endpoint) |

**Events emitted:**

| Event | Payload | When |
|-------|---------|------|
| `provider-changed` | `ProviderChangedDetail` | Every edit (immediate) |

**Test status badge invalidation rules:**
- Resets on: credential changes, endpoint/host changes, model selection changes
- Does NOT reset on: inference parameter changes
- Badge carries timestamp of last test

**Test connection contract:**
- `POST` to `testEndpoint` with `{ vendor: string, credential: string | Record<string, string>, models: string[] }`
- **Dev-mode credential resolution:** when `devMode` is true and the user has
  entered an inline API key, the test connection sends the inline key as the
  `credential` value — even if no `ProviderDeclaration.credential` is configured.
  Priority: inline key (if present) > `ProviderDeclaration.credential` (if set) >
  omitted (button disabled with "No credentials configured" tooltip).
  The inline key is transient (validates without persisting) — the security
  boundary is that inline keys never reach `manifest:configured` events.
- Expected response: `{ success: boolean, error?: string, details?: Record<string, boolean> }`
  (`details` maps model ID → reachable, for per-model feedback)
- **Provider-level badge from test result:**
  - `success: true` and (`details` absent or all entries `true`) → green check
  - `success: false` → red X
  - `success: true` but some `details` entries are `false` → amber partial
    (tooltip: "N of M models reachable")
- **Per-model indicators:** when `details` is present, each model row in
  the expanded model list shows a small pass/fail icon (green check / red X)
  inline after the model name. Only rendered after a test — no indicator
  before first test. Indicators follow the same invalidation rules as the
  provider badge (reset on credential/endpoint/model-selection change).
- Timeout: 30s. Spinner on button during test. Cancel button appears after 3s.
- `testEndpoint` not set: button disabled, tooltip "No test endpoint configured"

**ARIA:** `role="region"`, `aria-label="<vendor> provider configuration"`,
`aria-expanded` on expand/collapse toggle.

---

## UI Structure

Vertical stack layout:

1. **Dev-mode banner** (conditional) — subtle top banner when `devMode` is true

2. **Preset bar** — horizontal scrolling row of 4 preset cards. Click
   populates the full manifest state. **Single-selection:** clicking
   Preset B while Preset A is highlighted → unhighlights A, highlights B,
   populates state from B's template. Clicking the already-active preset
   is a no-op (the highlight is a provenance indicator, not a "re-apply"
   action — re-applying would silently discard user edits). Subsequent
   edits to provider/alias/inference state do not deselect the preset.

3. **Provider cards grid** — card layout, one per provider:
   - 4 built-in: Anthropic, OpenAI, Google, Ollama — always rendered
   - Dynamic providers from `GET /llm/providers` response:
     - **Matching vendor** (e.g. backend returns `vendor: "anthropic"`):
       enriches the built-in card — updates detection badge, merges
       available model list (backend models take precedence for shared IDs),
       applies default host if not already configured. No duplicate card.
     - **Non-matching vendor** (e.g. `vendor: "mistral"`): creates a new
       dynamic provider card positioned after built-in cards and before
       the "Other" card.
   - "Other": free-text provider for unlisted vendors (always last)
   - Each card: provider name, detection badge, test badge, model count
   - Click to expand → reveals credential editor, model list, inference controls
   - Expanded model list shows per-model inference sliders (temperature, topP,
     maxTokens) with model-aware ranges.
   - **"Set inference for all models" batch action:** a collapsible controls
     section at the top of each provider card's inference area. Contains
     three sliders (temperature, topP, maxTokens) using the provider's
     default ranges. Sliders initialise to provider defaults (e.g.
     temperature=1.0 for Anthropic) each time the section is opened.
     An "Apply to all" button copies the batch values to
     all currently selected models, overwriting their individual settings.
     This is a convenience action — not a persistent hierarchy. After
     applying, individual model sliders can still be adjusted independently.
     The batch controls section collapses by default; a "Batch set" link
     toggles it open.

4. **Alias editor** — global section for configuring model aliases. Each row:
   - Alias name (key): text input (e.g., "reasoning-heavy", "fast-response")
   - Constraint fields: tier dropdown, capabilities multi-select, locality
     dropdown, maxCost dropdown, minContext number, minOutput number,
     preferVendor dropdown (populated from configured providers)
   - "Add alias" button. Delete button per row.
   - Preset aliases pre-filled when populated from a preset template.
   - `AliasDeclaration` is a constraint set for runtime resolution, not a
     direct model reference. The alias resolver finds the best-matching model
     from configured providers at runtime.
   - Duplicate alias keys are blocked (inline validation error on the second
     entry with the same key).
   - **Stale preferVendor warning:** if a `preferVendor` references a vendor
     with no currently selected models, an amber warning badge appears on
     the alias row with tooltip "No models configured for this vendor".
     The value is NOT cleared automatically — `preferVendor` is a soft
     constraint for runtime resolution, and clearing it silently loses
     user intent. The warning informs; the user decides.

5. **System prompt preview** — read-only styled text area showing the
   `systemPrompt` property value. Informational label: "Generated from
   personality profile". Empty state: "No personality profile configured"
   when property is not set.

---

## Manifest Assembly

The host assembles the emitted `Manifest` from three sources:

1. **Provider-card state** → `providers` and `models` arrays
2. **Alias editor state** → `aliases` record
3. **Passthrough fields** from the last `data` snapshot → `sources`,
   `localModels`, `defaults`

The `Manifest` type includes fields the component does not manage through
its UI (`sources`, `localModels`, `defaults`). These fields are preserved
verbatim from the most recent `data` property value (or `endpoint` fetch
result). When the user edits any configuration, the emitted
`manifest:configured` event contains a complete `Manifest` — managed fields
from UI state merged with passthrough fields from the data snapshot.

This ensures no silent data loss: a manifest with populated `sources` or
`defaults` can round-trip through the editor without losing those values.

**`localModels` specifically:** the component does not populate or manage
`localModels`. Ollama models configured through the Ollama provider card
appear in `models` as `ModelDescriptor` entries (with `locality: 'LOCAL'`
when the model descriptor carries that metadata). `localModels` is a
passthrough field — if present in incoming data, it is preserved on
emission. The relationship between `models` and `localModels` (whether
they can overlap, which takes precedence) is a backend concern outside
this component's scope.

---

## Interaction Flow

### Startup

Priority: `data` takes precedence over `endpoint` (standard dual-data mode).
If both set, `data` wins — `endpoint` is ignored.

1. If `data` set → initialise from inline manifest (synchronous, no loading state)
2. If `endpoint` set (and no `data`) → show loading overlay with spinner →
   fetch existing config → populate state. On failure: error banner with
   "Failed to load configuration" and retry button. On timeout (10s):
   same error banner.
3. If `providersEndpoint` set → fetch provider availability (independent of
   data/endpoint — fires in parallel). On failure: detection badges show grey
   (unknown state). Non-blocking — component remains usable.
4. Otherwise → empty state, all cards collapsed and unconfigured

**Fetch lifecycle:**
- Both `endpoint` and `providersEndpoint` fetches use `AbortController`.
  On `disconnectedCallback`, abort all in-flight fetches (follows
  contributor-workbench / trust-workbench precedent).
- If `data` is set while an `endpoint` fetch is in-flight, abort the
  fetch — `data` takes precedence per the dual-data mode rule above.
- If `endpoint` changes while a fetch is in-flight, abort the previous
  fetch and start a new one.

### Preset Selection

1. User clicks preset card → if a different preset was active, it is
   unhighlighted first (single-selection)
2. Component populates full manifest state from preset template
3. All affected provider cards update via properties
4. Preset card highlighted — highlight indicates provenance ("started from
   this preset"), not that the config still matches the preset. Subsequent
   edits (including removing all models) do not deselect the preset.
5. Clicking the already-active preset is a no-op (provenance indicator
   only — re-applying would silently discard customizations).
6. Presets are hardcoded to built-in providers. Dynamic providers from
   `GET /llm/providers` do not have presets.
7. If a preset references a provider the backend doesn't recognise (detection
   state unknown), the preset still applies — detection badge shows grey.

### Provider Configuration

1. Click provider card → expands (multiple can be open simultaneously)
2. Select credential type → enter value
3. Model list appears grouped by tier → check models to include
4. Per-model inference parameters (optional) — set individually or via "Set
   inference for all models" batch action
5. "Test Connection" → validates → badge updates
6. Each edit fires `provider-changed` → host reassembles → `manifest:configured`

### "Other" Provider

1. Click "Other" card → expands with free-text provider name + endpoint URL
2. No preset model list — user adds models manually via "Add model" button:
   - Button adds a new model row with inline text fields
   - Required: `id` (model identifier string, e.g. "my-custom-model")
   - Optional: `displayName` (defaults to `id`), `contextWindow` (number input;
     used for maxTokens slider range if provided)
   - `vendor` is reactively bound to the provider name field — changing the
     provider name updates all existing model rows' `vendor` to match. This
     is a live binding, not a one-time auto-fill on model creation
   - Delete button per model row to remove
   - Models from "Other" provider have no capability badges (no metadata source)
   - Default inference ranges: temperature 0–2, topP 0–1, maxTokens 1–4096
     (conservative defaults when model metadata unavailable)
   - **Duplicate model ID validation:** inline validation error on the second
     model row with the same `id` within the provider (same pattern as alias
     key dedup). Applies to all providers, not just "Other" — built-in
     provider model lists are checkbox-based so duplicates are structurally
     impossible, but the validation is uniform.
3. Credential entry same as named providers

### State Restoration

Host sets `data` to a previous snapshot → component re-initialises,
discarding current edits. Enables wizard cancel/back semantics.

All values appear at model level on restore — inference parameters
are read directly from `ModelDescriptor.properties`. No hierarchy
reconstruction is attempted (the manifest has no concept of provider-level
or global inference defaults).

---

## Inference Parameter Ranges

Per-model reference data for slider ranges. Used by both the per-model
inference sliders within provider cards and the "Set inference for all models"
batch action. Known provider defaults (fallback when model metadata unavailable):

| Provider | Temperature | Top-P | Max Tokens |
|----------|-------------|-------|------------|
| Anthropic | 0.0–1.0, default 1.0 | 0.0–1.0, default 1.0 | 1–model max |
| OpenAI | 0.0–2.0, default 1.0 | 0.0–1.0, default 1.0 | 1–model max |
| Google | 0.0–2.0, default 1.0 | 0.0–1.0, default 1.0 | 1–model max |
| Ollama | 0.0–2.0, default 0.8 | 0.0–1.0, default 0.9 | 1–model max |

**Model-level parameter metadata:** When `ModelDescriptor.properties` carries
parameter range metadata, sliders use those values instead of provider
defaults. This is a frontend convention — the component parses these
property names from the `Record<string, string>`:

| Property key | Type | Description |
|---|---|---|
| `temperature_min` | number | Minimum temperature (default: 0) |
| `temperature_max` | number | Maximum temperature |
| `temperature_default` | number | Default temperature |
| `topP_min` | number | Minimum top-P (default: 0) |
| `topP_max` | number | Maximum top-P (default: 1) |
| `topP_default` | number | Default top-P |
| `maxTokens_min` | number | Minimum max tokens (default: 1) |
| `maxTokens_max` | number | Maximum max tokens |
| `maxTokens_default` | number | Default max tokens |

All are optional. Missing values fall back to the provider defaults table
above. Values are stored as strings in the properties map and parsed as
numbers by the component. This convention is component-local (not a Java-side
mirror) — it is a UI interpretation of the generic properties map.

---

## Test Strategy

### Unit: `agent-manifest-editor.test.ts`

- Preset selection populates provider cards, alias editor, and inference defaults
- `manifest:configured` pages-event fires with correct Manifest payload on edit
- Alias editor: add/remove alias rows, constraint fields populate correctly
- Alias editor: duplicate key blocked with inline validation error
- Alias editor: preset template pre-fills alias entries
- Alias editor: stale preferVendor shows amber warning badge when vendor has
  no selected models
- Preset bar: clicking different preset unhighlights previous (single-selection)
- Preset bar: clicking already-active preset is a no-op
- Dynamic provider with matching vendor enriches built-in card (no duplicate)
- `manifest:configured` fires on slider settle (pointer release), not during drag
- **Passthrough fields preserved:** set `data` with `sources` and `defaults`
  populated → edit a credential → verify emitted Manifest contains original
  `sources` and `defaults` verbatim
- `data` property re-initialises component state (cancel semantics)
- `data` takes precedence over `endpoint` when both set
- `endpoint` fetch failure shows error banner with retry
- **Abort on disconnect:** start `endpoint` fetch → remove component from DOM →
  verify fetch is aborted (no state update after disconnect)
- **Abort on data override:** start `endpoint` fetch → set `data` property before
  fetch completes → verify fetch is aborted and state comes from `data`
- `systemPrompt` property renders in read-only preview area
- Dev-mode banner visible only when `devMode` is true
- Dynamic providers from mock response render as additional cards
- ARIA: `role="form"` and `aria-label` on host

### Unit: `manifest-provider-card.test.ts`

- Credential type switching (env/file/ref) renders correct input field
- Dev-mode inline key entry appears only when `devMode` is true
- Inline key never appears in emitted `provider-changed` data or `manifest:configured` events
- Dev-mode test connection sends inline key as credential when present
- `provider-changed` emits typed `ProviderChangedDetail` payload
- Model list renders grouped by tier with capability badges
- Test connection updates status badge (green/red/grey/amber) with timestamp
- Test connection partial success: `success: true` with mixed `details` →
  amber provider badge, per-model pass/fail indicators on model rows
- Badge resets on credential change, endpoint change, model selection change
- Badge does NOT reset on inference parameter change
- Multi-field credential (`Record<string, string>`) displayed as read-only
  summary, preserved on emission until user switches credential type
- Expand/collapse toggles content visibility
- "Other" card shows free-text name and endpoint fields
- "Other" card "Add model" creates row with id/displayName/contextWindow fields
- "Other" card: changing provider name cascades to all existing model rows'
  vendor field
- "Other" card: duplicate model ID blocked with inline validation error
- Per-model inference sliders with model-aware ranges
- "Set inference for all models" batch action applies values to all selected models
- Test connection: button disabled when `testEndpoint` not set
- Test connection: spinner, cancel after 3s, 30s timeout
- ARIA: `role="region"`, `aria-label`, `aria-expanded`

### Integration: `agent-manifest-editor.integration.test.ts`

- End-to-end: select preset → edit credential → select models → configure
  alias (in global alias editor) → verify emitted Manifest
- Multiple providers configured → Manifest contains all
- State restoration: set data → edit → re-set data → verify reset

All tests use inline `data` property — no endpoint dependency.

---

## File Structure

```
components/agent-manifest-editor/
  package.json
  src/
    index.ts
    agent-manifest-editor.ts          # host component
    manifest-provider-card.ts         # sub-component
    presets.ts                        # preset template definitions
    provider-defaults.ts              # known provider parameter ranges
    agent-manifest-editor.test.ts
    manifest-provider-card.test.ts
    agent-manifest-editor.integration.test.ts
  demo.html                          # test harness

packages/blocks-ui-core/src/types/
  manifest.ts                         # new type definitions
  index.ts                            # updated to export manifest types
```

---

## Out of Scope

- Provider logos/icons — CSS placeholder only, no image assets
- Actual credential resolution — component emits raw credential strings, backend resolves via CredentialRef
- Multi-field credential editing — `Record<string, string>` credentials are
  displayed read-only and preserved; editing requires a dedicated multi-field
  credential editor (tracked as GitHub issue)
- System prompt generation — host provides the string, component displays it
- Model capability detection — component renders what ModelDescriptor provides
- Automated type sync with Java — manual mirror maintenance

---

## References

- casehubio/blocks-ui#210 — this issue
- casehubio/blocks-ui#166 — parent epic (agent setup wizard)
- Parent epic spec: `specs/agent-setup-wizard/2026-09-20-agent-setup-wizard-design.md`
  (on issue-166-agent-setup-wizard branch)
- Parent epic decisions: `specs/agent-setup-wizard/decisions.md` — D2 (preset
  model), D3 (progressive disclosure), C5 (direct-fetch pattern)
- `components/avatar-step/src/avatar-step.ts` — PersonalityProfile interface
- `components/work-item-inbox/` — host + sub-component architecture pattern
- `packages/blocks-ui-core/src/types/agent.ts` — existing FullAgentDescriptor
- `packages/graph-stencil-org/src/types.ts` — TS type mirror precedent
- platform agent-config-core — Manifest, CredentialRef, ProviderDeclaration Java types
- platform#291 — wizard API (GET /llm/providers, POST /llm/configure, GET /llm/configured)
