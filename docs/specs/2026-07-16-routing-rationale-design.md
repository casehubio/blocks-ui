# Routing Rationale Component

**Issue:** #54
**Date:** 2026-07-16

## Problem

Routing decisions are opaque. When engine selects agent A over agent B for a capability, consumers (DevTown, AML, Clinical) have no visual explanation of why — score vs threshold, maturity phase, observation count, alternatives considered, borderline flagging. This applies to both trust-weighted routing (`TrustWeightedAgentStrategy`) and semantic routing (`SemanticAgentRoutingStrategy`) — both share the same `TrustCandidateClassifier` pipeline and produce `ScoredCandidate` results.

## Data Source

Engine's `TrustCandidateClassifier` produces per-candidate classification (phase, trust score, workload score, final blended score) and `TrustRoutingPolicy` defines the selection parameters (threshold, borderlineMargin, blendFactor, minimumObservations, qualityFloors). The specific scoring formula depends on the active strategy — trust-weighted blends trust + workload (+ optional CBR), semantic adds embedding similarity.

**No REST endpoint exists yet** — tracked as engine issue (see §Deferred Issues). The component supports both a `data` property (app passes data directly) and an `endpoint` (for when the API is built). Same dual-data pattern as similarity-panel and compliance-summary.

## Data Contract

```typescript
export interface RoutingRationaleData {
  capabilityTag: string;
  strategyId: string;
  selected: CandidateScore;
  alternatives: CandidateScore[];
  policy: RoutingPolicySummary;
}

export interface CandidateScore {
  workerId: string;
  trustScore: number | null;
  workloadScore: number;
  phase: 'BOOTSTRAP' | 'QUALIFIED' | 'BORDERLINE' | 'EXCLUDED_PHASE2B' | 'EXCLUDED_PHASE3';
  observations: number;
  finalScore: number;
  exclusionReason?: string;
  rationale?: string;
  additionalScores?: Record<string, number>;
}

export interface RoutingPolicySummary {
  threshold: number;
  borderlineMargin: number;
  blendFactor: number;
  minimumObservations: number;
  qualityFloors: Record<string, number>;
  cbrWeight: number;
  bootstrapEscalationRequired: boolean;
}
```

`CandidateScore` is a UI view model composed from three engine sources:
- **`ClassifiedCandidate`** — `phase`, `trustScore` (mapped from `OptionalDouble` to `number | null`), `workloadScore`
- **`ScoredCandidate`** — `finalScore`, `rationale` (optional human-readable string from `buildRationale()`)
- **`AgentCandidate`** — `workerId` (via `ClassifiedCandidate.candidate()`)
- **`TrustScoreSource`** — `observations` (from `decisionCount(workerId, capabilityTag)`)

`exclusionReason` is derived: for EXCLUDED_PHASE3, the failing quality dimension name; for EXCLUDED_PHASE2B, "below threshold"; for BORDERLINE, "within borderline margin". Not present on engine records — computed at the REST endpoint (or by the consuming app when using `data` property).

`additionalScores` carries strategy-specific scoring inputs not covered by the structured fields. For `TrustWeightedAgentStrategy` with CBR active: `{ cbrBonus: 0.65 }`. For `SemanticAgentRoutingStrategy`: `{ semanticScore: 0.78 }`. The REST endpoint populates this from the strategy's scoring data. The component renders additional scores as labelled values in the Score Header (e.g., "Semantic: 0.78", "CBR bonus: 0.65"). They are NOT rendered as dynamic table columns — the alternatives table uses a fixed column set.

`strategyId` identifies which strategy produced the routing decision (`"trust-weighted"` or `"semantic"`), from `AgentRoutingStrategy.id()`. Used to label the strategy in the UI and to contextualise the scoring breakdown.

`RoutingPolicySummary` maps to `TrustRoutingPolicy` fields. Omitted fields: `fallbackBinding` (internal routing fallback, not relevant to decision explanation) and `evidentialCheckPhases` (attestation-time check, not relevant to routing display). Note: strategy-specific config (e.g., `semanticWeight` on `SemanticAgentRoutingStrategy`) is not on `TrustRoutingPolicy` and would need to be included in the REST endpoint response alongside the policy, or added to `RoutingRationaleData` as a separate config map.

## Component API

```typescript
@customElement('routing-rationale')
export class RoutingRationale extends DataSourceMixin(LiveRegionMixin(LitElement)) {
  // Data input (dual mode: property or endpoint)
  @property({ attribute: false }) data: RoutingRationaleData | null = null;

  // Customisation: typed config properties (per PP-20260713-8ea1af)
  @property({ type: String, attribute: 'score-label' }) scoreLabel = 'Trust Score';
  @property({ type: String, attribute: 'capability-label' }) capabilityLabel?: string;

  // Customisation: render callbacks (per PP-20260713-8ea1af)
  @property({ attribute: false }) renderCandidate?: (candidate: CandidateScore) => TemplateResult | undefined;

  // Events
  // routing.candidate-selected — emitted when a row in the alternatives table is activated
}
```

### Dual-Mode Lifecycle

Same pattern as similarity-panel and trust-score-panel, with trust-score-panel's side-channel pattern for non-table data:

```typescript
@state() private _rawData: RoutingRationaleData | null = null;
```

- **`resolveEndpoint()`** returns `undefined` when `this.data` is set, suppressing the fetch. When `data` is null and `endpoint` is set, returns the endpoint URL.
- **`willUpdate(changed)`** converts `this.data` to `this.dataSet` via `fromRows()` when the `data` property changes. Also sets `this._rawData = this.data` so non-table sections can access it uniformly regardless of mode.
- **`createSourceFactory()`** stores the full JSON response in `this._rawData` before converting candidates to a dataset via `fromRows()` and `sink.apply({ type: 'snapshot', dataset })`. Same pattern as trust-score-panel's `this._rawTrustData = data` inside its `createSourceFactory`.

Non-table sections (Score Header, Policy Summary) read from `this._rawData` — which is populated in both modes: from `this.data` in property mode, from the fetched response in endpoint mode. This avoids the data loss that would occur if only `this.dataSet` (the candidate rows) were available.

### Event Detail

`routing.candidate-selected` is emitted via `emitPagesEvent(this, 'routing.candidate-selected', detail)`:

```typescript
interface RoutingCandidateSelectedDetail {
  workerId: string;
  trustScore: number | null;
  finalScore: number;
  phase: CandidateScore['phase'];
}
```

## Pages-Table Integration

### Column Definitions

```typescript
const WORKER_COL     = columnId('workerId');
const TRUST_COL      = columnId('trustScore');
const WORKLOAD_COL   = columnId('workloadScore');
const PHASE_COL      = columnId('phase');
const OBS_COL        = columnId('observations');
const FINAL_COL      = columnId('finalScore');
const STATUS_COL     = columnId('status');
```

### Dataset Conversion

All candidates (`[data.selected, ...data.alternatives]`) are converted to a pages-table dataset via `fromRows()`. The selected candidate is tagged before conversion so the Status column can distinguish it from eligible alternatives:

```typescript
const selectedId = data.selected.workerId;
const allCandidates = [data.selected, ...data.alternatives];

const CANDIDATE_COLUMNS = [
  { id: WORKER_COL,   name: 'Worker',       type: ColumnType.TEXT,   getValue: (c: CandidateScore) => c.workerId },
  { id: TRUST_COL,    name: 'Trust',        type: ColumnType.NUMBER, getValue: (c: CandidateScore) => c.trustScore },
  { id: WORKLOAD_COL, name: 'Workload',     type: ColumnType.NUMBER, getValue: (c: CandidateScore) => c.workloadScore },
  { id: PHASE_COL,    name: 'Phase',        type: ColumnType.TEXT,   getValue: (c: CandidateScore) => c.phase },
  { id: OBS_COL,      name: 'Observations', type: ColumnType.NUMBER, getValue: (c: CandidateScore) => c.observations },
  { id: FINAL_COL,    name: 'Final Score',  type: ColumnType.NUMBER, getValue: (c: CandidateScore) => c.finalScore },
  { id: STATUS_COL,   name: 'Status',       type: ColumnType.TEXT,   getValue: (c: CandidateScore) => c.workerId === selectedId ? 'Selected' : c.exclusionReason ?? 'Eligible' },
];
```

Column renderers receive `CellValue` objects, not raw values. Each renderer checks `cell.type === 'NULL'` before accessing `.value`.

### Column Renderers

| Column | Renderer | Sortable |
|--------|----------|----------|
| Worker | Plain text or `renderCandidate` callback | true |
| Trust | Inline-styled bar (0–1 range) with threshold marker and borderline margin band; column header uses `scoreLabel`; `null` shows "—" | true |
| Workload | Inline-styled bar (0–1 range) | true |
| Phase | Inline-styled badge (see §Phase Badge Styles) | true |
| Observations | Plain number | true |
| Final Score | Inline-styled bar (0–1 range), no threshold marker | true |
| Status | "Selected" / "Eligible" badge or exclusion reason text | false |

Column renderers use inline styles — not CSS classes — because renderer output lives in pages-table's shadow DOM (lesson from #67).

### Table Config

```typescript
const TABLE_CONFIG: readonly TableColumnConfig[] = [
  { id: WORKER_COL, sortable: true },
  { id: TRUST_COL, sortable: true },
  { id: WORKLOAD_COL, sortable: true },
  { id: PHASE_COL, sortable: true },
  { id: OBS_COL, sortable: true },
  { id: FINAL_COL, sortable: true },
  { id: STATUS_COL, sortable: false },
];
```

## Visual Sections

### 0. Component Title

Displays the capability context at the top of the component:

```
Routing: code-review
```

The displayed name resolves as `capabilityLabel ?? _rawData?.capabilityTag`. When neither is available (loading state), the title area is omitted.

### 1. Score Header

Selected candidate's scores displayed as two horizontal bars:

- **Trust score bar**: labelled with `scoreLabel` (default "Trust Score"). Shows `trustScore` (0–1 range) with the `threshold` as a vertical marker and the `borderlineMargin` as a shaded band around the threshold. This is the actual comparison the engine makes for phase classification — trustScore vs threshold determines QUALIFIED/BORDERLINE/EXCLUDED.
- **Final score bar**: shows `finalScore` (0–1 range) WITHOUT a threshold marker, since the threshold applies to raw trustScore, not the blended finalScore. The blend formula is labelled (e.g., "60% trust + 40% workload" or "40% semantic + 36% trust + 24% workload" depending on `strategyId`).
- Maturity phase badge (BOOTSTRAP / QUALIFIED / BORDERLINE / EXCLUDED)
- Observation count and workload score
- When `additionalScores` contains entries, each is shown as a labelled value (e.g., "Semantic: 0.78", "CBR bonus: 0.65")
- When `renderCandidate` callback is provided, its output replaces the default worker ID display
- `rationale` string, when present, shown as secondary text below the score bars

For BOOTSTRAP candidates (no trustScore), the trust score bar is replaced with "No trust data — availability routing" and only the final score bar (which equals `workloadScore`) is shown.

### Phase Badge Styles

| Phase | Background | Text | Semantic |
|-------|-----------|------|----------|
| BOOTSTRAP | `--pages-neutral-3` (#e9ecef) | `--pages-neutral-11` (#495057) | Grey |
| QUALIFIED | `--pages-success-3` (#d4edda) | `--pages-success-11` (#155724) | Green |
| BORDERLINE | `--pages-warning-3` (#fff3cd) | `--pages-warning-11` (#856404) | Amber |
| EXCLUDED_PHASE2B | `--pages-danger-3` (#f8d7da) | `--pages-danger-11` (#721c24) | Red |
| EXCLUDED_PHASE3 | `--pages-danger-3` (#f8d7da) | `--pages-danger-11` (#721c24) | Red |

Uses the `--pages-*` numbered token system. The token scales (`accent`, `neutral`, `success`, `warning`, `danger`, `info`) are generated by `@casehubio/pages-ui-tokens` from `SEMANTIC_HUES` via `generateColourTokens()`. The numbered scale: `-3` for backgrounds, `-11` for text. Borders where needed use `-4` variants.

### 2. Alternatives Table

pages-table showing all candidates (selected highlighted at top). See §Pages-Table Integration for column definitions, renderers, and config.

The Trust column in the table includes the threshold marker (same as the Score Header trust bar), so consumers can visually compare each candidate's trustScore against the threshold. The Final Score column shows blended scores without a threshold marker.

Score bar renderers follow the same inline-style pattern as similarity-panel's similarity column renderer.

### 3. Policy Summary

Compact key-value row below the table:

```
Strategy: trust-weighted  |  Threshold: 0.70  |  Margin: ±0.10  |  Blend: 60% trust  |  Min observations: 10  |  CBR weight: 0%
```

When `qualityFloors` is non-empty, shows an additional line:

```
Quality floors: accuracy ≥ 0.80, completeness ≥ 0.70
```

When `bootstrapEscalationRequired` is true, shows a badge: "Bootstrap candidates require escalation".

## Accessibility

- **Score bars**: `role="img"` with `aria-label` describing the score value and context (e.g., "Trust score 0.82 out of 1.0, above threshold 0.70")
- **Phase badges**: aria-label includes phase name and meaning (e.g., "Phase: Borderline — score within margin of threshold"). Colour is never the sole indicator.
- **Threshold/margin markers**: visually decorative (`aria-hidden="true"`) since the score bar's aria-label already communicates the relationship
- **Selected/excluded status**: status column text provides the screen reader content directly
- **Loading/error states**: `LiveRegionMixin` in the extends chain provides `role="status"` with `aria-live="polite"` for state change announcements
- **Table**: pages-table provides built-in table ARIA semantics; no additional ARIA needed on the table itself

## Testing

- **Component title**: verify capability name displays from `capabilityTag`; verify `capabilityLabel` overrides `capabilityTag` when set; verify title omitted during loading
- **Score label**: verify `scoreLabel` appears on trust score bar and Trust column header; verify default "Trust Score"
- **Data rendering**: verify all columns render correctly from `data` property with known fixture data
- **Score bars**: verify trust score bar width matches trustScore; verify null trustScore renders "—" (not 0% bar); verify threshold marker position matches policy.threshold; verify final score bar has NO threshold marker
- **Phase badges**: verify each phase renders with correct token colours and text
- **Policy summary**: verify all policy fields display; verify strategyId label; verify qualityFloors line appears/hides based on data
- **Event emission**: verify `routing.candidate-selected` fires on row activation with correct detail shape
- **Dual-mode switching**: verify `data` set suppresses endpoint fetch; verify endpoint mode triggers fetch and renders
- **Loading/error/empty states**: verify loading spinner, error message, and empty state render correctly; verify LiveRegionMixin announces changes
- **Accessibility**: verify ARIA labels on score bars and phase badges; verify LiveRegionMixin announces state changes
- **Column renderers**: verify CellValue NULL handling in all renderers
- **Dataset conversion**: verify `fromRows()` produces correct column IDs and typed values from CandidateScore array
- **Status column**: verify selected candidate shows "Selected"; verify eligible alternatives show "Eligible"; verify excluded candidates show exclusion reason
- **Additional scores**: verify `additionalScores` entries render as labelled values in Score Header when present; verify absence renders nothing; verify no dynamic table columns are generated
- **Endpoint-mode data**: verify `_rawData` is populated from fetched response; verify Policy Summary and Score Header render correctly in endpoint mode (not just data-property mode)
- **Strategy variants**: verify trust-weighted and semantic decisions render correctly with different additionalScores

## Pattern Alignment

- **DataSourceMixin + LiveRegionMixin**: same lifecycle as similarity-panel, compliance-summary, trust-score-panel — `resolveEndpoint()`, `willUpdate()`, `createSourceFactory()` (see §Dual-Mode Lifecycle). LiveRegionMixin for accessible loading/error announcements (same as trust-score-panel).
- **Protocol PP-20260713-8ea1af**: typed config + render callbacks, no slots
- **Inline styles in renderers**: column renderers use inline styles for cross-shadow-DOM correctness
- **pages-event**: emits via `emitPagesEvent` for candidate selection
- **CSS custom properties**: `--pages-*` numbered tokens throughout (see §Phase Badge Styles)

## Package Structure

```
components/routing-rationale/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    routing-rationale.ts
    routing-rationale.test.ts
    types.ts
```

## Consumers

- **DevTown**: reviewer profile detail tab — `renderCandidate` shows GitHub username + avatar
- **AML**: investigator assignment rationale
- **Clinical**: agent selection rationale

## Not In Scope

- REST endpoint in engine (tracked as GitHub issue — see §Deferred Issues)
- Trend data / historical routing decisions
- Quality floor details beyond dimension names and minimum scores (individual dimension score values per candidate require additional engine API)
- Strategy-specific policy config (e.g., `semanticWeight`) — requires separate REST endpoint response field, tracked as part of the engine endpoint issue

## Deferred Issues

| Issue | Repo | Description |
|-------|------|-------------|
| TBD | casehub-engine | REST endpoint for routing decision data — exposes `RoutingRationaleData` shape from `TrustCandidateClassifier` + strategy scoring results. Must include `strategyId` from `AgentRoutingStrategy.id()` and `additionalScores` from strategy-specific scoring data. Blocks endpoint mode of this component. |
