# UI Primitives Batch — Design Spec

**Date:** 2026-07-06
**Branch:** issue-13-ui-primitives-batch
**Covers:** #13, #12, #8, #16

Four deliverables on one branch: three new standalone components and a cleanup pass across existing components from the Epic #4 review.

Build order: #8 → #12 → #13 → #16 (bottom-up by dependency — #13 consumes #8's `<sla-indicator>`).

---

## 1. `<sla-indicator>` (#8)

**Package:** `@casehubio/blocks-ui-sla-indicator`
**Directory:** `components/sla-indicator/`

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `deadline` | `string` | required | ISO 8601 timestamp |
| `slaWindow` | `number \| null` | `null` | Total SLA duration in ms (enables %-based thresholds) |
| `warningThreshold` | `number` | `0.25` | Fraction remaining that triggers amber |
| `criticalThreshold` | `number` | `0.10` | Fraction remaining that triggers red |
| `escalationStage` | `string \| null` | `null` | Current escalation level label |
| `compact` | `boolean` | `true` | Inline mode (rows) vs expanded (detail panels) |

### Visual States

| State | Condition | Colour | Text |
|-------|-----------|--------|------|
| `normal` | >warningThreshold remaining | success scale | `2d 4h` |
| `warning` | ≤warningThreshold, >criticalThreshold | warning scale | `47m` |
| `critical` | ≤criticalThreshold, not breached | danger scale | `3m 12s` |
| `breached` | past deadline | danger scale + pulse | `Breached 3h ago` |

When `slaWindow` is not provided, absolute fallbacks: warning at 1h remaining, critical at 15m.

Countdown granularity increases as deadline approaches: days+hours → hours+minutes → minutes+seconds (below 1h).

### Timer

Shared timer via `SharedTimerController` (new module in `packages/blocks-ui-core/src/timers/`). A single module-level `setInterval` at 1s serves all `<sla-indicator>` instances — each instance registers a tick callback via `SharedTimerController.subscribe(callback)` in `connectedCallback` and unsubscribes in `disconnectedCallback`. The shared timer starts when the first subscriber connects and stops when the last disconnects. `visibilitychange` pause/resume is handled once on the shared timer, not per-instance.

Export: `subscribe`/`unsubscribe` exported from `packages/blocks-ui-core/src/timers/index.ts` and re-exported from the core barrel (`packages/blocks-ui-core/src/index.ts`).

### Events

Topic constant: `SlaIndicatorTopics.STATE_CHANGED` = `'sla.state-changed'` (exported from component package).

`pages-event` topic `sla.state-changed` with `{ state: 'normal'|'warning'|'critical'|'breached', deadline }` — fires once per threshold crossing, not every tick. Also fires once on initial render (`connectedCallback`) with the computed initial state, so consumers that mount a component with an already-breached deadline still receive the event.

### Escalation Badge

Pill rendered inline after countdown text when `escalationStage` is set. Uses neutral background with danger text.

### Tooltip

`title` attribute with absolute datetime: `"Deadline: 2026-07-08 14:30 UTC"`.

### Accessibility

- `role="timer"`, `aria-label` with full readable text ("2 days 4 hours remaining")
- `@media (prefers-reduced-motion: reduce)`: no pulse animation
- No `LiveRegionMixin` — `role="timer"` already provides screen reader updates via `aria-label` changes. Adding `LiveRegionMixin` would create double announcements.

### configure()

```typescript
configure(props: { deadline?: string; slaWindow?: number | null; warningThreshold?: number; criticalThreshold?: number; escalationStage?: string | null; compact?: boolean }): void
```

---

## 2. `<kpi-metric-row>` (#12)

**Package:** `@casehubio/blocks-ui-kpi-metric-row`
**Directory:** `components/kpi-metric-row/`

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `metrics` | `MetricDefinition[]` | `[]` | Array of metric objects |
| `endpoint` | `string \| null` | `null` | REST URL returning `MetricDefinition[]` |
| `columns` | `number \| null` | `null` | Fixed cards per row (null = auto-fit) |

### MetricDefinition

```typescript
interface MetricDefinition {
  key: string;
  value: number | string;
  label: string;
  unit?: string;
  trend?: { direction: 'up' | 'down' | 'stable'; delta: string };
  sparkline?: number[];
  status?: 'normal' | 'warning' | 'critical';
}
```

### Layout

CSS Grid: `grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))`. When `columns` is set: `repeat(N, 1fr)`. Density-compact mode lowers minmax to 120px.

### Card Rendering

- Value: `font-size-2xl`, `font-weight-bold`, unit as smaller inline suffix
- Label: below value, muted text
- Trend: directional arrow (▲/▼/—) + delta string, coloured green (up-good or down-bad context not assumed — colour follows `status` if set, otherwise neutral)
- Status: left border colour on card (success/warning/danger)
- Sparkline: inline SVG `<polyline>` with `<linearGradient>` fill, 48×20px viewBox, stroke uses status colour or accent

### Sparkline Implementation

Normalize data points to SVG viewBox coordinates. Render `<polyline>` for the line, closed `<polygon>` below for gradient fill. No charting library.

### Events

Topic constant: `KpiMetricRowTopics.CARD_CLICKED` = `'kpi.card-clicked'` (exported from component package).

`pages-event` topic `kpi.card-clicked` with `{ key, value, label }` on card click/Enter/Space.

### Endpoint Mode

Fetches on `connectedCallback` when `endpoint` is set. `@state() _loading` drives skeleton shimmer. No auto-polling — consumer calls `refresh()` or re-sets `endpoint`.

Skeleton: renders `columns` skeleton cards if set, otherwise 3 default skeleton cards.

### Empty & Error States

- `metrics` is empty array and no `endpoint` → render "No metrics available" muted text, centered
- Endpoint returns empty array → same empty state
- Endpoint returns error → inline error message within the component area (not per-card)

### Accessibility

- Container: `role="list"`, cards: `role="listitem"`
- Each card: `aria-label` combining label, value, unit, trend
- Sparklines: `aria-hidden="true"`
- Clickable cards: `tabindex="0"`, Enter/Space handlers
- `LiveRegionMixin`: `announce()` on card click — "Selected [label]: [value] [unit]"

### configure()

```typescript
configure(props: { metrics?: MetricDefinition[]; endpoint?: string | null; columns?: number | null }): void
```

---

## 3. `<approval-gate>` (#13)

**Package:** `@casehubio/blocks-ui-approval-gate`
**Directory:** `components/approval-gate/`

### Dependencies

- `"@casehubio/blocks-ui-sla-indicator": "workspace:*"` in `package.json`
- `"@casehubio/blocks-ui-core": "workspace:*"` in `package.json`
- TypeScript project reference to `../../components/sla-indicator` in `tsconfig.json`
- TypeScript project reference to `../../packages/blocks-ui-core` in `tsconfig.json`
- Source import: `import '@casehubio/blocks-ui-sla-indicator'` (side-effect registration)

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `gateId` | `string` | required | Work item or gate identifier |
| `endpoint` | `string` | required | REST API base URL |
| `identity` | `WorkIdentity` | required | Current user identity (for voted-state detection) |
| `prompt` | `string` | required | Decision question text |
| `contextText` | `string` | `''` | Longer explanation below prompt |
| `outcomes` | `OutcomeDefinition[]` | approve/reject pair (see Default Outcomes) | Configurable action set |
| `quorum` | `QuorumConfig \| null` | `null` | M-of-N configuration |
| `deadline` | `string \| null` | `null` | ISO timestamp for `<sla-indicator>` |
| `slaWindow` | `number \| null` | `null` | Passed through to `<sla-indicator>` |
| `history` | `GateDecision[]` | `[]` | Previous decisions for context |
| `data` | `Record<string, unknown> \| null` | `null` | Fallback evidence as key-value pairs |
| `requireConfirmation` | `boolean` | `true` | Show confirmation dialog |

### Types

```typescript
interface OutcomeDefinition {
  key: string;
  label: string;
  variant: 'success' | 'danger' | 'neutral';
}

interface QuorumConfig {
  required: number;
  total: number;
  voters: VoterStatus[];
}

interface VoterStatus {
  id: string;
  name: string;
  status: 'voted' | 'pending';
  outcome?: string;
}

interface GateDecision {
  timestamp: string;
  actor: string;
  outcome: string;
}
```

### Default Outcomes

```typescript
const DEFAULT_OUTCOMES: OutcomeDefinition[] = [
  { key: 'approve', label: 'Approve', variant: 'success' },
  { key: 'reject', label: 'Reject', variant: 'danger' },
];
```

The `key` values appear in the REST body (`{ outcome: 'approve' }`) and the `gate.decided` event payload. Consumers override the full array for domain-specific outcomes (e.g. `{ key: 'authorise', label: 'Authorise', variant: 'success' }` for PI gates).

### Layout (top to bottom)

1. **Header** — prompt text + `<sla-indicator>` (if deadline set)
2. **Context** — contextText paragraph
3. **Evidence** — `<slot name="evidence">`; fallback to inline key-value renderer for `data` property when no slotted content (detected via `slotchange`)
4. **Quorum bar** (conditional) — progress bar M/N, voter avatar list with voted/pending badges
5. **History** (conditional) — collapsible `<details>` with previous decision list
6. **Action bar** — outcome buttons + "Request more information" link
7. **Confirmation dialog** — `<blocks-confirm-dialog>` (shared utility, see below)

### Evidence Slot

```html
<approval-gate prompt="Approve SUSAR safety assessment?">
  <div slot="evidence"><!-- domain content --></div>
</approval-gate>
```

No slotted content → renders `data` as key-value pairs directly (label from key, value stringified). This is an inline renderer within the approval-gate component, not `<schema-form>` — schema-form requires a `.schema` property that the approval-gate does not have. For rich evidence rendering (nested objects, formatted dates, custom layouts), consumers slot in their own content, which may include a `<schema-form>` with a proper schema if the parent has one (e.g. from `WorkItemResponse.inputDataSchema`).

### Actions

- **Outcome button** → if `requireConfirmation`, open `<blocks-confirm-dialog persistent>` with reason textarea → on confirm: PUT `${endpoint}/workitems/${gateId}/complete` body `{ outcome, resolution? }` (aligns with `CompleteRequest`) → emit `pages-event` topic `gate.decided` with `{ gateId, outcome, resolution }`
- **Request more information** → inline note input → emit `pages-event` topic `gate.info-requested` with `{ gateId, note }` (parent handles note persistence, consistent with `work-item.note-added` pattern in `work-item-detail`)
- Buttons disabled during submit, error state rendered inline

### Already-Decided State

The component matches `identity.userId` against `quorum.voters[].id` to detect whether the current user has already voted. When a matching `VoterStatus` has `status: 'voted'`:

- Action buttons are disabled
- A banner above the action bar shows "You voted: [outcome label]" with the user's previous vote
- The quorum bar highlights the current user's entry

When `quorum` is null (non-quorum gate), the `history` array is checked for a matching `actor === identity.userId` entry instead.

### Quorum Display

Progress bar with filled/empty segments. Voter list below with name + status badge. Current user's entry highlighted.

Quorum freshness is the parent's responsibility — the parent re-sets the `quorum` property when voter state changes (e.g. via SSE subscription to the gate's work item events). The component does not poll or subscribe to any event stream for quorum updates.

### Event Topics

Topic constants: `ApprovalGateTopics.DECIDED` = `'gate.decided'`, `ApprovalGateTopics.INFO_REQUESTED` = `'gate.info-requested'` (exported from component package).

### Keyboard & Accessibility

- Tab order: prompt → evidence → action buttons
- Enter/Space on buttons triggers action
- Escape closes confirmation dialog
- Focus trapped in dialog (FocusTrapMixin)
- Buttons: `aria-describedby` pointing to prompt
- Dialog: `role="alertdialog"`, `aria-modal="true"`
- Quorum bar: `role="progressbar"`, `aria-valuenow`/`aria-valuemax`
- `LiveRegionMixin`: `announce()` on decision submit — "Decision submitted: [outcome label]"; on submit error — "Decision failed: [error]"

### configure()

```typescript
configure(props: {
  gateId?: string; endpoint?: string; identity?: WorkIdentity;
  prompt?: string; contextText?: string; outcomes?: OutcomeDefinition[];
  quorum?: QuorumConfig | null; deadline?: string | null;
  slaWindow?: number | null; history?: GateDecision[];
  data?: Record<string, unknown> | null; requireConfirmation?: boolean;
}): void
```

---

## 4. Shared Utility: `<blocks-confirm-dialog>`

**Location:** `packages/blocks-ui-core/src/confirm-dialog/`

A lightweight confirmation dialog reused by `<approval-gate>` (#13) and the batch cancel fix (#16).

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `open` | `boolean` | `false` | Visibility toggle |
| `heading` | `string` | `'Confirm'` | Dialog heading |
| `message` | `string` | `''` | Body text |
| `confirmLabel` | `string` | `'Confirm'` | Primary button text |
| `cancelLabel` | `string` | `'Cancel'` | Secondary button text |
| `confirmVariant` | `'success' \| 'danger' \| 'neutral'` | `'danger'` | Primary button colour |
| `showReason` | `boolean` | `false` | Show optional reason textarea |
| `persistent` | `boolean` | `false` | When true, clicking outside does NOT dismiss the dialog |

### Events

- `confirm` — detail: `{ reason?: string }`
- `cancel` — no detail

### Behaviour

- Focus trapped when open (FocusTrapMixin)
- Escape closes (emits `cancel`) — always, regardless of `persistent`
- Click outside: if `persistent` is false (default), closes and emits `cancel`; if `persistent` is true, click outside is ignored
- `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby` pointing to heading

### Export

Exported from `packages/blocks-ui-core/src/confirm-dialog/index.ts` and re-exported from the core barrel (`packages/blocks-ui-core/src/index.ts`). Same pattern as `schema-form` — importing the module triggers `@customElement` side-effect registration.

---

## 5. Cleanup Pass (#16)

All items from the Epic #4 final review, addressed in existing component files.

### 5.1 IntersectionObserver deferred loading

**File:** `components/work-item-inbox/src/queue-pill-bar.ts`

Wrap `_loadQueues()` in an IntersectionObserver check. On `connectedCallback`, create an observer on `this`. When intersecting for the first time, call `_loadQueues()` and disconnect. If already visible on connect (e.g. active tab), load immediately.

### 5.2 Workbench container-type

**File:** `components/work-item-workbench/src/work-item-workbench.ts`

Add `container-type: inline-size` to `:host` CSS.

### 5.3 Schema-form plugin type safety

**Files:** `packages/blocks-ui-core/src/schema-form/schema-form.ts`, `packages/blocks-ui-core/src/schema-form/field-renderers.ts`

**Unify schema types:** Extract the local `FieldSchema` (field-renderers.ts) and `SchemaObject` (schema-form.ts) into a single exported `FieldSchema` type in a new `packages/blocks-ui-core/src/schema-form/types.ts` file. The unified type includes `required?: readonly string[]` (from `SchemaObject`). Both files import from `./types.js`.

Define `FieldRendererElement` interface:
```typescript
interface FieldRendererElement extends HTMLElement {
  value: unknown;
  schema: FieldSchema;
  mode: 'display' | 'edit';
}
```

Update `FieldRegistry` generic constraint. Remove three `as any` casts. Both `FieldRendererElement` and `FieldSchema` are exported from `schema-form/index.ts`.

### 5.4 Schema-form date/datetime fields

**File:** `packages/blocks-ui-core/src/schema-form/field-renderers.ts`

Add format detection in edit mode: `format: "date"` → `<input type="date">`, `format: "date-time"` → `<input type="datetime-local">`. Display mode: `Intl.DateTimeFormat` for locale-appropriate rendering.

### 5.5 Schema-form edit mode tests

**File:** `packages/blocks-ui-core/src/schema-form/schema-form.test.ts`

Add tests: text input rendering, number input, boolean checkbox, enum select, textarea for long strings, date/datetime inputs, `schema-form-change` events, `submit()` and `schema-form-submit` event, required field validation.

### 5.6 LiveRegionMixin integration

**Files:** `components/work-item-inbox/src/work-item-inbox.ts`, `components/work-item-detail/src/work-item-detail.ts`

Add `LiveRegionMixin` to both component class chains. Wire `announce()` calls for: claim success/failure, completion, escalation, delegation, batch results, SSE status, errors.

Also resolves the TODO at `work-item-inbox.ts:919` — the `claimItem()` catch block currently only logs to console. Replace with `this.announce('Failed to claim item', 'assertive')` and set an `@state() _claimError` to render an inline error banner that auto-dismisses after 5s. This addresses the TODO without misusing `<blocks-confirm-dialog>` (which is for confirmations, not transient error feedback).

**New components:**
- `<sla-indicator>`: **excluded** from LiveRegionMixin — `role="timer"` already provides screen reader updates
- `<kpi-metric-row>`: announce on card click — "Selected [label]: [value] [unit]"
- `<approval-gate>`: announce on decision submit — "Decision submitted: [outcome label]"; on error — "Decision failed: [error]"

### 5.7 Detail tabs aria-controls

**File:** `components/work-item-detail/src/work-item-detail.ts`

Add `id` to each tabpanel, `aria-controls` to each tab, `aria-labelledby` to each panel.

### 5.8 Hardcoded spacing

**Files:** `components/work-item-inbox/src/inbox-filter-bar.ts`, `components/work-item-inbox/src/inbox-summary-bar.ts`

Replace ~13 hardcoded pixel values with `var(--blocks-space-*)` and `var(--blocks-font-size-*)` tokens.

### 5.9 Batch cancel styled dialog

**File:** `components/work-item-inbox/src/work-item-inbox.ts`

Replace `confirm()` at line 731 with `<blocks-confirm-dialog>` (from §4). Add the dialog to the component's render tree, wire open/close state and confirm/cancel handlers.

### 5.10 SLA indicator

Covered by §1 (#8). No additional work.

---

## Shared Patterns Across All New Components

- Extend `LitElement` (or mixin chain ending in `LitElement`)
- `@customElement('tag-name')` decorator
- Inline `static override styles = css\`...\`` using `var(--blocks-*)` tokens throughout
- `HTMLElementTagNameMap` augmentation
- `.js` extensions on all import paths
- `@property()` for public API, `@state()` for internal state (`_` prefix)
- `pages-event` via `emitPagesEvent()` / `onPagesEvent()` from core
- Subscribe in `connectedCallback`, unsubscribe in `disconnectedCallback`
- `configure(props)` method for programmatic property setup (required for `casehub-pages` `registerPanel`/`hostPanel` integration — all existing components implement this)
- Event topic constants exported from each component package (e.g. `SlaIndicatorTopics`, `KpiMetricRowTopics`, `ApprovalGateTopics`)
- Tests with vitest + jsdom + `@open-wc/testing`
- Package structure: `src/`, `dist/`, `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`
- TypeScript project reference to `../../packages/blocks-ui-core`
- Root `tsconfig.json` updated with new references
