# Clinical UI Promotion — blocks-ui Design

**Issue:** #38 (epic), #58–#63 (individual components)
**Branch:** issue-38-clinical-ui-promotion
**Date:** 2026-07-14

## Summary

Promote 5 clinical-local Lit web components to blocks-ui as shared platform components, plus add a `commitmentLifecycleStrategy()` factory to blocks-timeline. This requires targeted additions to blocks-ui-core (a fetch utility and an empty dataset signal), then building each component on the existing DataSourceMixin foundation.

## Decisions

- **No mixin property additions** — DataSourceMixin stays focused on the read pipeline (endpoint → source → sink → loading/error/dataSet). Non-tabular components store typed data privately (trust-score-panel pattern). Mutation is component-local.
- **Foundation-first** — Add `createTypedFetchSource` utility and `EMPTY_DATASET` to blocks-ui-core, then build components on them.
- **commitment-lifecycle is a strategy, not a component** — Per issue #58, add `commitmentLifecycleStrategy()` to blocks-timeline alongside `eventChronologyStrategy` and `stateProgressionStrategy`. This is NOT a new component.
- **Separate packages** — Each component gets its own `components/<name>/` directory and `@casehubio/blocks-ui-<name>` package. Gap analysis assessed complementary pairs (trust-feedback-display / trust-score-panel, sla-breach-policy / sla-indicator, compliance-summary / audit-trail-viewer) and concluded SEPARATE for each.
- **Customisation protocol PP-20260713-8ea1af** — Typed config properties + render callbacks. No slots for content.

## Part 1: blocks-ui-core Additions

### Current architecture

```
Component
  → DataSourceMixin (endpoint, loading/error, createSourceFactory())
    → DataSourceAdapter (Lit ReactiveController wrapper)
      → DataSourceController (pages — connect/disconnect lifecycle)
        → SourceFactory → fetchSource() → extractDataSet() → TypedDataSet → sink.apply()
```

The pipeline is typed: `dataSet` is `TypedDataSet | undefined` throughout (DataSourceMixin line 31, DataSourceAdapter line 33, DataSourceController). The tabular assumption lives in `fetchSource()` → `extractDataSet()`. Components needing non-tabular data override `createSourceFactory()` to bypass `extractDataSet` while still producing a valid `TypedDataSet` (or `EMPTY_DATASET`) for the controller. trust-score-panel demonstrates this established pattern: it stores raw JSON privately as `@state() private _rawTrustData: TrustScoreResponse | null`, converts capability scores to `TypedDataSet` via `fromRows()` from `@casehubio/pages-data`, and passes that to the sink.

### Additions (all additive, no changes to DataSourceMixin's existing API)

#### 1. `createTypedFetchSource<T>()` utility

```typescript
function createTypedFetchSource<T>(
  url: string,
  handler: (data: T, sink: DataSink, signal: AbortSignal) => void,
  options?: { method?: string; headers?: Record<string, string> }
): DataSource
```

Exported from blocks-ui-core alongside `fetchSource`. Handles AbortController lifecycle, signal checking, and error propagation to the sink — the same boilerplate that trust-score-panel's `createSourceFactory()` override manages manually (~20 lines per component). The handler receives parsed JSON + sink and decides what to do: store data privately, convert to `TypedDataSet` via `fromRows()`, call `sink.apply()`, or any combination.

**Integration with DataSourceMixin:** Components use `createTypedFetchSource` inside their `createSourceFactory()` override. It produces a `DataSource` (same type as `fetchSource` returns), which the factory wraps:

```typescript
// Non-tabular: store raw data privately, signal completion with EMPTY_DATASET
override createSourceFactory(): SourceFactory {
  return (url) => createTypedFetchSource<MyResponse>(url, (data, sink) => {
    this._myData = data;
    sink.apply({ type: 'snapshot', dataset: EMPTY_DATASET });
  });
}

// Tabular: convert to TypedDataSet via fromRows()
override createSourceFactory(): SourceFactory {
  return (url) => createTypedFetchSource<Item[]>(url, (data, sink) => {
    const dataset = fromRows(data, MY_COLUMNS);
    sink.apply({ type: 'snapshot', dataset });
  });
}

// Both: store raw data AND produce tabular (trust-score-panel pattern)
override createSourceFactory(): SourceFactory {
  return (url) => createTypedFetchSource<TrustScoreResponse>(url, (data, sink) => {
    this._rawTrustData = data;
    const dataset = fromRows(Object.entries(data.capabilityScores), CAPABILITY_COLUMNS);
    sink.apply({ type: 'snapshot', dataset });
  });
}
```

#### 2. `EMPTY_DATASET` constant

```typescript
import { fromRows } from '@casehubio/pages-data/dist/dataset/conversion.js';
import type { TypedDataSet } from '@casehubio/pages-data/dist/dataset/types.js';

export const EMPTY_DATASET: TypedDataSet = fromRows([], []);
```

Exported from blocks-ui-core. A `TypedDataSet` with zero columns and zero rows. Components that fetch non-tabular data use it to signal completion to the DataSourceController without producing tabular data. After `sink.apply({ type: 'snapshot', dataset: EMPTY_DATASET })`:
- `loading` → `false` (controller lifecycle)
- `dataSet` → `EMPTY_DATASET` (controller sets it)
- Component renders from its private typed state

Consumer state distinctions:
- `dataSet === undefined` → no data loaded yet (initial state)
- `loading === true` → fetch in progress
- `loading === false && dataSet !== undefined` → loaded (tabular or non-tabular)

#### 3. Shared type exports

Move `TrustLevel` type and `trustLevelFromScore()` function from `@casehubio/blocks-ui-trust-score-panel/types` to blocks-ui-core (per issue #60). Both trust-score-panel and trust-feedback-display need these; a cross-component dependency is wrong.

```typescript
export type TrustLevel = 'high' | 'adequate' | 'low' | 'none';
export function trustLevelFromScore(score: number | undefined): TrustLevel;
```

trust-score-panel re-exports from blocks-ui-core for backward compatibility.

#### 4. Shared pulse animation

```typescript
// blocks-ui-core/src/styles/animations.ts
import { css } from 'lit';
export const pulseAnimation = css`
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  @media (prefers-reduced-motion: reduce) {
    .pulse { animation: none; }
  }
`;
```

Used by sla-indicator (already defines this animation at line 100), sla-breach-policy, and blocks-timeline horizontal renderer. Extracted to eliminate duplication across three components that currently define identical `@keyframes pulse`.

#### 5. Existing DataSourceMixin API unchanged

`endpoint`, `loading`, `error`, `dataSet`, `createSourceFactory()`, `resolveEndpoint()`, `syncEndpoint()`, `configure()` all work exactly as before. No new properties added to the mixin. No mutation channel — the single mutation component (gdpr-erasure-action) manages its own POST state locally.

### How each component uses the data layer

| Component | Data approach | Private typed state | Produces TypedDataSet |
|-----------|--------------|---------------------|----------------------|
| commitmentLifecycleStrategy | blocks-timeline strategy with `transformData` | N/A (strategy, not component) | N/A |
| similarity-panel | `createTypedFetchSource` in `createSourceFactory()` | — | Yes, via `fromRows()` |
| compliance-summary | `createTypedFetchSource` in `createSourceFactory()` | — | Yes, via `fromRows()` |
| trust-feedback-display | `gateDecision` property injection (primary) | `_gateDecision` for endpoint path | EMPTY_DATASET for endpoint path |
| sla-breach-policy | `tiers` property injection (primary) | `_tiers` for endpoint path | EMPTY_DATASET for endpoint path |
| gdpr-erasure-action | No DataSourceMixin. Own fetch POST with local state. | `_receipt: ErasureReceipt` | N/A |

## Part 2: Component & Strategy Designs

### Promotion transformation

All 6 clinical source components lack `@customElement()` decorators, `declare global { HTMLElementTagNameMap }`, and `customElements.define()` calls — they are exported as bare classes (e.g., `export class ClinicalCommitmentLifecycle extends LitElement`). Promotion requires adding these as a mechanical transformation following existing blocks-ui patterns (see trust-score-panel, list-pane, blocks-timeline).

### Common pattern

All promoted components follow: `@customElement()` decorator, `declare global { HTMLElementTagNameMap }`, `--pages-*` CSS tokens (no hardcoded hex colours), `emitPagesEvent` from blocks-ui-core, exported topic constants.

**ARIA per component:**
- **Tabular components** (similarity-panel, compliance-summary): `<pages-table>` handles its own ARIA — no additional roles needed on the wrapper.
- **sla-breach-policy:** `role="list"` on the tier container, `role="listitem"` on each tier card.
- **trust-feedback-display:** `role="region"` with `aria-label="Gate decision"` on the card container.
- **gdpr-erasure-action:** `role="alert"` with `aria-live="assertive"` on the confirmation warning. `<form>` has implicit form semantics — no explicit `role="form"`.

### Strategy: `commitmentLifecycleStrategy` (#58)

Added to blocks-timeline (`components/blocks-timeline/src/strategies/commitment-lifecycle.ts`) alongside `eventChronologyStrategy` and `stateProgressionStrategy`. This is NOT a new component — it extends the existing strategy pattern per issue #58.

```typescript
const COMMITMENT_STAGES: readonly StageConfig[] = [
  { key: 'COMMANDED', label: 'Commanded' },
  { key: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { key: 'DONE', label: 'Done', terminal: 'success' },
  { key: 'DECLINED', label: 'Declined', terminal: 'failure' },
];

interface CommitmentState {
  id: string;
  currentStage: string;
  stages: Array<{ key: string; actor?: string; timestamp?: string; status: string }>;
  messages?: Array<{ sender: string; content: string; timestamp: string }>;
}

function commitmentLifecycleStrategy(options?: {
  stages?: StageConfig[];
  resolveStatus?: ResolveStatus;
}): TimelineStrategy<CommitmentState>
```

- **Default stages:** COMMANDED → ACKNOWLEDGED → DONE → DECLINED (overridable via `options.stages`)
- **Default `resolveStatus`:** `linearResolveStatus` — commitment pipelines are linear progressions
- **`transformData`:** Maps `CommitmentState` → `StateData` by renaming `currentStage` → `currentState` and mapping `stages` → `transitions`
- **Default layout:** horizontal
- **Messages section:** Not part of the strategy. The `TimelineStrategy` interface provides `renderDetail` for per-node detail, but messages are a section-level concept below the entire timeline. Consumers render messages alongside the timeline via standard Lit composition:

```typescript
<blocks-timeline
  endpoint="/api/commitments/456"
  .strategy=${commitmentLifecycleStrategy()}
></blocks-timeline>
${commitmentData?.messages?.length ? html`
  <div class="messages">
    ${commitmentData.messages.map(m => html`...`)}
  </div>
` : ''}
```

**Custom stages (DevTown #41):**
```typescript
<blocks-timeline
  .strategy=${commitmentLifecycleStrategy({ stages: DEVTOWN_STAGES })}
  .data=${commitmentData}
></blocks-timeline>
```

### Group A — Tabular (pages-table)

**Dual data mode (tabular):** Both components in this group extend `DataSourceMixin(LitElement)` and support two data paths: property injection (`data` / `requirements` prop) and endpoint fetch. The pattern mirrors Group B's dual mode but produces `TypedDataSet` via `fromRows()` instead of signalling `EMPTY_DATASET`.

The mechanics:
1. **`resolveEndpoint()` override:** Returns `undefined` when the data prop is set, suppressing the fetch.
2. **`willUpdate` conversion:** When the data prop changes, converts the array to `TypedDataSet` via `fromRows()` and assigns to `this.dataSet` — the same property the endpoint path populates via the sink.
3. **Precedence:** Prop wins over endpoint. Once `data` is set, the endpoint is dormant.
4. **Convergence:** Both paths produce the same result — `this.dataSet` contains a `TypedDataSet` built from `fromRows()`. The render method and pages-table see no difference.

```typescript
// similarity-panel example:
override resolveEndpoint(): string | undefined {
  if (this.data) return undefined;  // prop set → suppress fetch
  return this.endpoint;
}

override willUpdate(changed: PropertyValues): void {
  super.willUpdate(changed);
  if (changed.has('data') && this.data) {
    this.dataSet = fromRows(this.data, PRECEDENT_COLUMNS);
  }
}

override createSourceFactory(): SourceFactory {
  return (url) => createTypedFetchSource<Precedent[]>(url, (data, sink) => {
    const dataset = fromRows(data, PRECEDENT_COLUMNS);
    sink.apply({ type: 'snapshot', dataset });
  });
}
```

#### `<similarity-panel>` (#59)

Renamed from `cbr-precedents-panel` per issue #59's rename consideration. The `cbr-` prefix ties the component to case-based reasoning, but the data contract (`caseId`, `similarity`, `outcome`, `resolutionTime`) is algorithm-agnostic — any similarity-based retrieval system (CBR, AML investigation precedents, DevTown #41) produces this shape.

- **Tag:** `similarity-panel`
- **Class:** `SimilarityPanel extends DataSourceMixin(LitElement)`
- **Data:** DataSourceMixin → `createTypedFetchSource<Precedent[]>` inside `createSourceFactory()` → `fromRows()` → pages-table. Also accepts `data: Precedent[]` direct injection (see dual data mode above).
- **Props:** `endpoint`, `columns: ColumnDef[]` (typed config), `emptyMessage`, `data: Precedent[]`
- **Events:** `precedent.selected` — caseId, similarity, outcome
- **Customisation:** `columns` typed config + column renderer map

**Column definitions (via `fromRows()`):**
```typescript
const CASE_ID_COL = columnId('caseId');
const SIMILARITY_COL = columnId('similarity');
const OUTCOME_COL = columnId('outcome');
const RESOLUTION_COL = columnId('resolutionTime');

const PRECEDENT_COLUMNS = [
  { id: CASE_ID_COL, name: 'Case', type: ColumnType.TEXT, getValue: (p: Precedent) => p.caseId },
  { id: SIMILARITY_COL, name: 'Similarity', type: ColumnType.NUMBER, getValue: (p: Precedent) => p.similarity },
  { id: OUTCOME_COL, name: 'Outcome', type: ColumnType.TEXT, getValue: (p: Precedent) => p.outcome },
  { id: RESOLUTION_COL, name: 'Resolution', type: ColumnType.TEXT, getValue: (p: Precedent) => p.resolutionTime },
];
```

**Column renderers** (built into the component, not exported as defaults):
- `SIMILARITY_COL` → percentage bar with fill width proportional to score + numeric label
- `OUTCOME_COL` → colour-coded badge (resolved → `--pages-success-*`, pending → `--pages-warning-*`, escalated → `--pages-orange-*`)

#### `<compliance-summary>` (#61)

Regulation × requirement × mechanism × status × evidence grid via `<pages-table>`.

- **Tag:** `compliance-summary`
- **Class:** `ComplianceSummary extends DataSourceMixin(LitElement)`
- **Data:** DataSourceMixin → `createTypedFetchSource<RequirementDefinition[]>` inside `createSourceFactory()` → `fromRows()` → pages-table. Also accepts `requirements: RequirementDefinition[]` direct injection (see dual data mode above).
- **Props:** `endpoint`, `requirements: RequirementDefinition[]`
- **Events:** `compliance.requirement-selected` — regulation, requirement, status
- **Customisation:** typed `RequirementDefinition`, column renderer for status badge.

**Column definitions (via `fromRows()`):**
```typescript
const REGULATION_COL = columnId('regulation');
const REQUIREMENT_COL = columnId('requirement');
const MECHANISM_COL = columnId('mechanism');
const STATUS_COL = columnId('status');
const EVIDENCE_COL = columnId('evidence');

const REQUIREMENT_COLUMNS = [
  { id: REGULATION_COL, name: 'Regulation', type: ColumnType.TEXT, getValue: (r) => r.regulation },
  { id: REQUIREMENT_COL, name: 'Requirement', type: ColumnType.TEXT, getValue: (r) => r.requirement },
  { id: MECHANISM_COL, name: 'Mechanism', type: ColumnType.TEXT, getValue: (r) => r.mechanism },
  { id: STATUS_COL, name: 'Status', type: ColumnType.TEXT, getValue: (r) => r.status },
  { id: EVIDENCE_COL, name: 'Evidence', type: ColumnType.TEXT, getValue: (r) => r.evidenceUrl ?? '' },
];
```

**Column renderers** (built into the component, not exported as defaults):
- `STATUS_COL` → colour-coded badge using status token mapping below
- `EVIDENCE_COL` → clickable link or dash: non-empty values render as `<a href="${url}" target="_blank" rel="noopener">View</a>` styled with `--pages-accent-9`; empty values render as `—` in `--pages-neutral-9`

**Status token mapping** (replaces hardcoded hex from clinical source):

| Status | Badge background | Badge text | Fallback |
|--------|-----------------|------------|----------|
| MET | `--pages-success-3` | `--pages-success-11` | `#d4edda` / `#155724` |
| PARTIAL | `--pages-warning-3` | `--pages-warning-11` | `#fff3cd` / `#856404` |
| GAP | `--pages-orange-3` | `--pages-orange-11` | `#ffe5d0` / `#8a4000` |
| BREACHED | `--pages-danger-3` | `--pages-danger-11` | `#f8d7da` / `#721c24` |

### Group B — Non-tabular (property injection)

**Dual data mode:** Both components in this group extend `DataSourceMixin(LitElement)` and support two data paths: property injection (primary) and endpoint fetch (standalone). This follows trust-score-panel's established pattern (`trust-score-panel.ts:200-213`).

The mechanics:
1. **Class hierarchy:** `extends DataSourceMixin(LitElement)` — required for the endpoint path to work (provides `endpoint`, `loading`, `error`, `dataSet`, `createSourceFactory()`, `resolveEndpoint()`, `syncEndpoint()`)
2. **`resolveEndpoint()` override:** Returns `undefined` when the primary prop is set, suppressing the fetch. This is the same gate trust-score-panel uses via `_hasPreFetchedData()`.
3. **Precedence:** When both prop AND endpoint are set, prop wins (no fetch). The endpoint path is for standalone use where no parent component provides the data.
4. **`createSourceFactory()` override:** Uses `createTypedFetchSource` to parse JSON, store it privately, and signal `EMPTY_DATASET` via the sink.
5. **Render methods:** Prefer the primary prop over fetched data: `this.gateDecision ?? this._gateDecision` (or `this.tiers ?? this._tiers`).

```typescript
// trust-feedback-display example:
override resolveEndpoint(): string | undefined {
  if (this.gateDecision) return undefined;  // prop set → suppress fetch
  return this.endpoint;
}

override createSourceFactory(): SourceFactory {
  return (url) => createTypedFetchSource<GateDecision>(url, (data, sink) => {
    this._gateDecision = data;
    sink.apply({ type: 'snapshot', dataset: EMPTY_DATASET });
  });
}
```

#### `<trust-feedback-display>` (#60)

Post-gate trust score delta — card (full) or inline (compact).

- **Tag:** `trust-feedback-display`
- **Class:** `TrustFeedbackDisplay extends DataSourceMixin(LitElement)`
- **Data:** Primarily `gateDecision: GateDecision` property. Also supports DataSourceMixin endpoint → private `@state() _gateDecision: GateDecision | null` storage + `EMPTY_DATASET` signal for standalone use.
- **Props:** `gateDecision: GateDecision`, `compact: boolean`, `endpoint`
- **Events:** none (display-only)
- **Customisation:** `compact` mode. `GateDecision` typed config.

**Promoted `GateDecision` interface** (exported from `types.ts`):
```typescript
export interface GateDecision {
  readonly decision: string;
  readonly actor: string;          // generalised from clinical's 'investigator'
  readonly attestation: string;
  readonly trustScoreBefore: number;
  readonly trustScoreAfter: number;
  readonly dimension: string;
}
```

**Type sharing:** `TrustLevel` and `trustLevelFromScore()` imported from blocks-ui-core (moved from trust-score-panel per issue #60). Used for trust delta rendering.

#### `<sla-breach-policy>` (#63)

Breach escalation tiers as a vertical list with active-tier highlighting.

- **Tag:** `sla-breach-policy`
- **Class:** `SlaBreachPolicy extends DataSourceMixin(LitElement)`
- **Data:** Primarily `tiers: TierDefinition[]` property. Also supports DataSourceMixin endpoint → private `@state() _tiers: TierDefinition[] | null` storage + `EMPTY_DATASET` signal.
- **Props:** `tiers: TierDefinition[]`, `timeRemaining: number`, `deadline: string` (optional), `endpoint`
- **Events:** none (display-only)
- **Customisation:** `tiers` typed config with threshold, label, consequence, optional regulation.

**Composition with sla-indicator** (per issue #63): When `deadline` is set, the component internally instantiates `<sla-indicator>` for a live countdown alongside the policy tier list:
```typescript
${this.deadline ? html`<sla-indicator .deadline=${this.deadline} compact></sla-indicator>` : nothing}
```

**Shared pulse animation** (per issue #63): Imports `pulseAnimation` from blocks-ui-core instead of defining its own `@keyframes pulse`. The clinical commitment-lifecycle (line 54) and sla-breach-policy-indicator (lines 91-98) define identical animations — this duplication is eliminated by the shared module. Includes `prefers-reduced-motion` support matching sla-indicator's existing implementation.

### Group C — Interactive (mutation)

#### `<gdpr-erasure-action>` (#62)

Three-phase form: input → confirmation → receipt.

- **Tag:** `gdpr-erasure-action`
- **Class:** `GdprErasureAction`
- **Extends:** `LitElement` directly — does NOT extend DataSourceMixin. The component has no read-path fetch; it only performs a destructive POST. Mutation state (`_loading`, `_error`, `_receipt`) is managed locally, matching the clinical source component's existing approach.
- **Data:** Own `_performErasure()` method for POST. Returns `ErasureReceipt`.
- **Props:** `endpoint`, `subjectLabel` (e.g., "Patient", "Customer"), `reasonOptions: string[]`
- **Events:** `gdpr.erasure-completed` — subjectId, reason, status
- **Customisation:** `subjectLabel` + `reasonOptions` typed config.

**Confirmation via `blocks-confirm-dialog`:** The clinical source component builds an inline confirmation UI (warning div with confirm/cancel buttons). The promoted version replaces this with `blocks-confirm-dialog` from blocks-ui-core — a modal dialog with focus trap, escape-to-dismiss, and overlay click handling via `FocusTrapMixin`.

```typescript
@state() private _confirmPending = false;
@state() private _pendingSubjectId = '';
@state() private _pendingReason = '';

// In render():
<blocks-confirm-dialog
  .open=${this._confirmPending}
  heading="Confirm Data Erasure"
  .message=${`Permanently erase all data for ${this.subjectLabel} "${this._pendingSubjectId}"?\nReason: ${this._pendingReason}\n\nThis action cannot be undone.`}
  confirmLabel="Erase Data"
  confirmVariant="danger"
  persistent
  @confirm=${this._performErasure}
  @cancel=${this._cancelErasure}
></blocks-confirm-dialog>
```

- **`confirmVariant="danger"`** — red destructive button styling (irreversible data erasure)
- **`persistent`** — prevents accidental overlay-click dismiss; user must explicitly click Erase Data or Cancel (or press Escape)
- **`message`** — composed from the pending subject ID and selected reason, making the user confirm exactly what they're erasing
- **`@confirm`** → `_performErasure()` — performs the POST to `${this.endpoint}/${subjectId}` with reason
- **`@cancel`** → `_cancelErasure()` — resets `_confirmPending` to `false`, returns to the input phase
- **`showReason`** is NOT used — gdpr-erasure-action collects the reason in its own form (with `reasonOptions` dropdown), not in the dialog's textarea

## Part 3: Package Structure

### Per-component layout

```
components/<name>/
  package.json          @casehubio/blocks-ui-<name>
  tsconfig.json         extends ../../tsconfig.base.json, refs blocks-ui-core
  tsconfig.build.json   extends tsconfig.json, excludes tests
  vitest.config.ts      jsdom, conditional pages aliases
  src/
    index.ts            re-exports types + component
    types.ts            exported interfaces
    <name>.ts           component
    <name>.test.ts      tests
```

Dependencies: `@casehubio/blocks-ui-core` (workspace:*), `lit`. Tabular components add `@casehubio/pages-data`, `@casehubio/pages-table`. sla-breach-policy adds `@casehubio/blocks-ui-sla-indicator`.

**Strategy (not a separate package):** `commitmentLifecycleStrategy` lives in `components/blocks-timeline/src/strategies/commitment-lifecycle.ts` and is re-exported from the blocks-timeline package index.

**5 new component packages:** similarity-panel, compliance-summary, trust-feedback-display, sla-breach-policy, gdpr-erasure-action. Root `tsconfig.json` gets 5 new references. Workspaces glob already covers `components/*`.

### Test coverage

#### blocks-ui-core additions tests

- createTypedFetchSource — fetch boilerplate, abort on disconnect, error propagation, handler receives parsed JSON and sink
- EMPTY_DATASET — is a valid TypedDataSet with 0 columns/rows, signals completion, loading transitions correctly

#### commitmentLifecycleStrategy tests (in blocks-timeline)

- Default stages (COMMANDED → ACKNOWLEDGED → DONE → DECLINED)
- Custom stages via options
- transformData maps CommitmentState → StateData (currentStage → currentState, stages → transitions)
- linearResolveStatus for positional ordering
- Integration with blocks-timeline component rendering

#### Per-component tests

- **similarity-panel:** pages-table renders fromRows data, similarity bar width proportional to score, outcome badge classes with --pages-* tokens, row click emits precedent.selected, empty message, column config customisation, endpoint vs data property
- **compliance-summary:** pages-table renders fromRows data, status badge token colours per value (MET/PARTIAL/GAP/BREACHED), evidence link/dash, empty state, endpoint vs property, requirement-selected event
- **trust-feedback-display:** full mode card rows, compact mode inline, decision/attestation badge classes, trust delta arrows (up/down/neutral), no-data state, `actor` field (not `investigator`), GateDecision type exports, TrustLevel import from blocks-ui-core
- **gdpr-erasure-action:** form validation, confirmation via blocks-confirm-dialog, POST on confirm, receipt on success, error on failure, loading disables form, reset, erasure-completed event, subjectLabel/reasonOptions customisation, does NOT extend DataSourceMixin
- **sla-breach-policy:** all tiers render, active tier class, threshold display, consequence/regulation text, empty state, `deadline` prop renders embedded sla-indicator, shared pulseAnimation import

## Part 4: Examples Showcase

Each component/strategy gets an interactive demo page in the examples app. Follows the existing pattern: page component with controls, mock data, event logging, and multiple variations exercising all props and modes.

### Per-component showcase pages

Each page is a Lit element in `examples/src/pages/<name>-page.ts` registered via `@customElement('<name>-page')`.

| Component | Page file | Mock data file | Key demo scenarios |
|-----------|-----------|---------------|-------------------|
| commitmentLifecycleStrategy | `commitment-lifecycle-page.ts` | `commitments.json` | Multiple commitment states via blocks-timeline; custom stages; consumer-composed message section; endpoint template with ID switching |
| similarity-panel | `similarity-panel-page.ts` | `precedents.json` | Various similarity ranges; outcome types (resolved/pending/escalated); column config customisation; empty state; row selection events |
| trust-feedback-display | `trust-feedback-page.ts` | (inline data) | Approved/rejected decisions; endorsed/overruled attestations; trust score up/down/neutral; full vs compact mode; all badge combinations |
| compliance-summary | `compliance-summary-page.ts` | `compliance.json` | All status values with --pages-* token colours; with/without evidence URLs; mixed status grid |
| gdpr-erasure-action | `gdpr-erasure-page.ts` | (mock fetch) | Full form flow: input → confirm → receipt; error state; custom subjectLabel ("Patient", "Entity"); custom reasonOptions; mock endpoint |
| sla-breach-policy | `sla-breach-policy-page.ts` | (inline data) | Multiple tier configurations; active tier highlighting with adjustable timeRemaining; deadline prop with live sla-indicator countdown |

### Registration (3 files to update)

**`examples/src/shell.ts`** — add 6 entries to NAV array under Components:
```typescript
{ id: 'commitment-lifecycle', label: 'Commitment Lifecycle', hash: '#components/commitment-lifecycle' },
{ id: 'similarity-panel', label: 'Similarity Panel', hash: '#components/similarity-panel' },
{ id: 'trust-feedback', label: 'Trust Feedback', hash: '#components/trust-feedback' },
{ id: 'compliance-summary', label: 'Compliance Summary', hash: '#components/compliance-summary' },
{ id: 'gdpr-erasure', label: 'GDPR Erasure', hash: '#components/gdpr-erasure' },
{ id: 'sla-breach-policy', label: 'SLA Breach Policy', hash: '#components/sla-breach-policy' },
```

Plus 6 cases in `renderPage()` switch.

**`examples/src/main.ts`** — add 6 page imports.

**`examples/mock-data/`** — add JSON files for components that fetch data (commitments.json, precedents.json, compliance.json).

### Showcase testing

Each example page is verified by running the dev server (`yarn examples`) and visually confirming:
- All demo scenarios render correctly
- Controls (mode toggles, data switches) work
- Events emit and appear in event logs
- Light/dark theme works
- Comfortable/compact density works

## Ordering

1. blocks-ui-core additions (createTypedFetchSource, EMPTY_DATASET, TrustLevel/trustLevelFromScore, pulseAnimation) + tests
2. commitmentLifecycleStrategy in blocks-timeline + tests
3. Tabular components: similarity-panel, compliance-summary
4. Non-tabular components: trust-feedback-display, sla-breach-policy
5. Interactive component: gdpr-erasure-action
6. Example showcase pages + mock data for all 6 demos
7. Root tsconfig.json references, yarn install, build + typecheck
