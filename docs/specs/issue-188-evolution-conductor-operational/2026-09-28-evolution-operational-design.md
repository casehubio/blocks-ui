# Evolution Conductor UI — Operational Completeness

**Epic:** casehubio/blocks-ui#188
**Branch:** issue-188-evolution-conductor-operational
**Date:** 2026-09-28

## Context

The initial evolution conductor UI epic (#174) delivered three configuration editors (#175-#177), a workbench shell (#178), and a sample page (#179). The workbench has a KPI summary bar and three tabs (Streams, Inbox, Configuration), but Streams and Inbox render placeholder content. This epic makes the workbench operationally complete: real data tables with actions, audit and health views, editor previews, and responsive layout.

## Architecture

### Root Problem

The evolution workbench uses `blocks-detail-pane` in standalone mode for its tabs, but detail-pane was designed for item-detail views — it creates tab elements from `tagName` via `document.createElement()` and sets `.item` on each. The workbench is a dashboard, not an item-detail view. There is no "selected item." The standalone mode hack (`this._item = {}`) papers over this mismatch.

The fix is PP-20260713-8ea1af mechanism #2 (render callbacks): extend `TabDefinition` with an optional `renderContent` callback. When present, detail-pane renders the callback's output instead of creating an element. This preserves detail-pane's tested ARIA tab bar, keeps custom tab support via `tagName` fallback, and lets the workbench pass data directly through Lit template closures.

### Component Decomposition

```
detail-pane (tab bar, ARIA, keyboard nav)
  └─ TabDefinition.renderContent callbacks
       ├── blocks-evolution-streams  ← NEW standalone component in evolution-config
       ├── blocks-evolution-inbox    ← NEW standalone component in evolution-config
       ├── inline: 3 editors         (existing, moved from dead _renderTabContent)
       ├── inline: audit-trail-viewer (configured with evolution endpoint)
       ├── inline: trust-score-panel  (configured with componentScores)
       └── custom tabs: tagName fallback (unchanged)

evolution-config package:
  ├── types.ts              (existing — all domain types)
  ├── api.ts                (existing — EvolutionApi)
  ├── events.ts             (existing — event topics)
  ├── deny-pattern-editor   (existing, gains preview via streams prop)
  ├── watch-pattern-editor  (existing)
  ├── gate-policy-editor    (existing, gains impact preview via streams prop)
  ├── evolution-streams     ← NEW
  └── evolution-inbox       ← NEW
```

### Data Flow

```
EvolutionApi
  │
  ├── getEvolutionState() ──→ workbench._fetchedState
  │                              ├── KPI summary bar (healthScore, counts, circuitBreaker)
  │                              ├── tab badges (activeImprovementCount, pendingInboxCount)
  │                              └── Health tab (componentScores → trust-score-panel)
  │
  ├── getStreamProgress() ──→ workbench passes to:
  │                              ├── blocks-evolution-streams (table data)
  │                              ├── deny-pattern-editor.streams (preview)
  │                              └── gate-policy-editor.streams (impact preview)
  │
  ├── getInbox() ──────────→ blocks-evolution-inbox (table data)
  │
  └── mutations ───────────→ emitEvolutionEvent() → workbench._refreshState()
       (resolveGate, blockImprovement, addDenyPattern, etc.)
```

## Component Specifications

### 1. TabDefinition Enhancement (detail-pane)

Extend the `TabDefinition` interface:

```typescript
export interface TabDefinition {
  id: string;
  label: string;
  tagName: string;
  order?: number;
  badge?: (item: unknown) => string | null;
  renderContent?: (item: unknown) => TemplateResult;  // NEW
}
```

In detail-pane's render method, when the active tab has `renderContent`, call it instead of `_getOrCreateTabElement`. The `tagName` field remains required for backward compatibility but is ignored when `renderContent` is present. The change is ~10 lines in detail-pane.ts.

### 2. blocks-evolution-streams

**Tag:** `blocks-evolution-streams`
**Package:** `@casehubio/blocks-ui-evolution-config`
**File:** `components/evolution-config/src/evolution-streams.ts`

**Props:**

| Property | Type | Mode |
|----------|------|------|
| `endpoint` | `string` | Endpoint — fetches via `EvolutionApi.getStreamProgress()` |
| `caseId` | `string` | Required for endpoint mode |
| `tenancyId` | `string` | Required for endpoint mode |
| `streams` | `readonly ImprovementStreamView[]` | Inline — passed directly |
| `readonly` | `boolean` | Disables actions when true |

**Columns:**

| Column | Type | Renderer |
|--------|------|----------|
| Category | TEXT | Badge with category colour |
| Target | TEXT | Monospace code span |
| Current Stage | TEXT | Stage name from StageDescriptor |
| Blocked | TEXT | Block icon + blocker ID when present |
| Conflict | TEXT | Warning badge when `conflictBlocked` |
| Started | TEXT | Relative timestamp |

**Actions (per-row, unless readonly):**
- **Block**: opens a dialog to enter `blockedBy` improvement ID, calls `EvolutionApi.blockImprovement()`
- **Unblock**: calls `EvolutionApi.unblockImprovement()` with confirmation

**Events:** Emits `evolution:stream-changed` after block/unblock. Workbench listens and refreshes state.

**ARIA:** `role="region"`, `aria-label="Improvement streams"`, `aria-busy` during fetch.

### 3. blocks-evolution-inbox

**Tag:** `blocks-evolution-inbox`
**Package:** `@casehubio/blocks-ui-evolution-config`
**File:** `components/evolution-config/src/evolution-inbox.ts`

**Props:**

| Property | Type | Mode |
|----------|------|------|
| `endpoint` | `string` | Endpoint — fetches via `EvolutionApi.getInbox()` |
| `caseId` | `string` | Required for endpoint mode |
| `tenancyId` | `string` | Required for endpoint mode |
| `inbox` | `readonly ConductorInboxEntry[]` | Inline — passed directly |
| `readonly` | `boolean` | Disables actions when true |

**Columns:**

| Column | Type | Renderer |
|--------|------|----------|
| Stage | TEXT | Stage name |
| Category | TEXT | Badge |
| Summary | TEXT | Truncated text, full on hover |
| Confidence | NUMBER | Bar renderer (0-1 scale, colour thresholds) |
| Escalation | TEXT | Trigger badges (CATEGORY_RULE / WATCH_PATTERN / CONFIDENCE_SCORE) |
| Status | TEXT | 6-value status badge (colours per status) |
| Queued | TEXT | Relative timestamp |
| Timeout | TEXT | Countdown remaining or "—" if null |

**Status badge colours:**

| Status | Colour |
|--------|--------|
| PENDING | `--pages-warning-*` (amber) |
| APPROVED | `--pages-success-*` (green) |
| REJECTED | `--pages-danger-*` (red) |
| REDIRECTED | `--pages-accent-*` (blue) |
| TIMED_OUT | `--pages-neutral-*` (grey) |
| AUTO_APPROVED | `--pages-success-*` (green, lighter) |

**Actions (PENDING rows only, unless readonly):**
- **Approve**: calls `EvolutionApi.resolveGate(entryId, 'APPROVED', reason?, feedback?)`
- **Reject**: opens dialog with reason (required) and feedback (optional) fields, calls `EvolutionApi.resolveGate(entryId, 'REJECTED', reason, feedback)`

Both actions use `pages-confirm-dialog` for the reason/feedback form.

**Events:** Emits `evolution:gate-resolved` after resolution. Workbench listens via existing `EvolutionEventTopics.GATE_RESOLVED`.

**ARIA:** `role="region"`, `aria-label="Conductor inbox"`, `aria-busy` during fetch.

### 4. Workbench Refactor

**Remove:**
- `blocks-detail-pane` import (replaced by keeping detail-pane but using render callbacks)
- Dead `_renderTabContent` method
- `tagName: 'div'` tab definitions

**Change `_builtInTabs()`:**

```typescript
private _builtInTabs(): TabDefinition[] {
  return [
    { id: 'streams', label: 'Streams', tagName: 'div', order: 10,
      badge: () => { /* activeImprovementCount */ },
      renderContent: () => this._renderStreams() },
    { id: 'inbox', label: 'Inbox', tagName: 'div', order: 20,
      badge: () => { /* pendingInboxCount */ },
      renderContent: () => this._renderInbox() },
    { id: 'audit', label: 'Audit', tagName: 'div', order: 30,
      renderContent: () => this._renderAudit() },
    { id: 'config', label: 'Configuration', tagName: 'div', order: 40,
      renderContent: () => this._renderConfig() },
    { id: 'health', label: 'Health', tagName: 'div', order: 50,
      renderContent: () => this._renderHealth() },
  ];
}
```

**Render methods** (each 10-30 lines):

- `_renderStreams()`: `<blocks-evolution-streams .streams=${...} .endpoint=${...} ...>`
- `_renderInbox()`: `<blocks-evolution-inbox .inbox=${...} .endpoint=${...} ...>`
- `_renderAudit()`: `<blocks-audit-trail-viewer .endpoint=${auditEndpoint} ...>`
- `_renderConfig()`: existing 3-editor composition (deny-pattern, watch-pattern, gate-policy), now passing `.streams` to editors for preview
- `_renderHealth()`: `<blocks-trust-score-panel .score=${healthScore} mode="full" ...>` with `componentScores` mapped to breakdown data

**New event listener:** `evolution:stream-changed` — triggers `_refreshState()`.

**New data fetch:** `_fetchStreams()` called alongside `_fetchState()` when in endpoint mode.

### 5. Editor Previews

#### 5a. Deny-Pattern Testing (#181)

**New prop on `DenyPatternEditor`:**

```typescript
@property({ type: Array, attribute: false }) streams?: readonly ImprovementStreamView[];
```

**Behaviour:** When `_showAddForm` is true and the user types a pattern, filter `streams` for entries where `target` contains the pattern (case-insensitive substring). Show a "Preview: N active streams would be denied" summary with a collapsible list of matching stream targets.

If no `streams` prop is provided, the preview section is hidden.

#### 5b. Gate-Policy Impact Preview (#182)

**New prop on `GatePolicyEditor`:**

```typescript
@property({ type: Array, attribute: false }) streams?: readonly ImprovementStreamView[];
```

**Behaviour:** When a stage's gate mode is changed (before saving), show a preview section: "N active improvements at stage X would be [auto-approved / gated / notified]." Filter `streams` by `currentStage` matching the edited stage, then apply the proposed gate mode.

If no `streams` prop is provided, the preview section is hidden.

### 6. Responsive Layout (#185)

**CSS container queries on the workbench host:**

```css
:host {
  container-type: inline-size;
  container-name: evolution-workbench;
}

@container evolution-workbench (max-width: 600px) {
  .metric-grid { gap: 8px; }
  .metric-card { min-width: 60px; }
  .metric-value { font-size: 18px; }
  .metric-label { font-size: 10px; }
}

@container evolution-workbench (max-width: 400px) {
  .metric-grid { flex-direction: column; }
}
```

Tab bar gains `overflow-x: auto` and `scrollbar-width: none` for horizontal scroll at narrow widths (already reasonable default).

## Engine API Status

The `EvolutionMcpAdapter` in the engine has all methods needed for Streams and Inbox tabs:
- `getStreamProgress`, `getInbox`, `resolveGate`, `blockImprovement`, `unblockImprovement`

Three read endpoints are still missing (engine #1186-#1188: `getWatchPatterns`, `getStages`, `getCategories`, `getGatePolicy`). These affect only the config editors' self-fetch mode, not the new tabs. The UI's `EvolutionApi` already has client stubs — they'll work once the engine issues land.

## Implementation Order

1. **detail-pane renderContent** — unblocks all tab work
2. **blocks-evolution-streams + Streams tab** (#186)
3. **blocks-evolution-inbox + Inbox tab** (#187)
4. **Audit tab + Health tab** (#183, #184) — thin composition
5. **Editor previews** (#181, #182) — extend editors with streams prop
6. **Responsive layout** (#185) — CSS container queries

## Testing Strategy

Each component gets its own test file verifying:
- **Rendering:** columns render with sample data, status badges have correct colours
- **Actions:** block/unblock and approve/reject call EvolutionApi with correct args
- **Events:** mutations emit the correct evolution event topics
- **Dual data mode:** inline data renders, endpoint mode triggers fetch
- **ARIA:** role, aria-label, aria-busy assertions
- **Readonly mode:** actions hidden when `readonly` is true

detail-pane gets a test for `renderContent` callback rendering alongside existing `tagName` tests.

Workbench tests verify tab switching renders the correct content and that event-driven refresh works.

## Schema Registry

New components register in `BlocksComponentRegistry`:
- `blocks-evolution-streams` → `EvolutionStreamsProps`
- `blocks-evolution-inbox` → `EvolutionInboxProps`

Run `yarn workspace @casehubio/blocks-ui-schema run generate` after adding entries.

## References

- `components/evolution-workbench/src/evolution-workbench.ts` — existing workbench shell
- `components/evolution-config/src/types.ts` — domain types (ImprovementStreamView, ConductorInboxEntry, etc.)
- `components/evolution-config/src/api.ts` — EvolutionApi with all needed methods
- `components/evolution-config/src/events.ts` — EvolutionEventTopics
- `components/detail-pane/src/types.ts` — TabDefinition interface
- `components/detail-pane/src/detail-pane.ts` — tab rendering logic
- `engine/src/main/java/io/casehub/engine/rest/service/EvolutionMcpAdapter.java` — engine API surface
- PP-20260713-8ea1af — component-customisation-pattern protocol (render callbacks)
- PP-20260907-fd8ee7 — component-registry-props protocol (Props + BlocksComponentRegistry)
- decision-review R1-01, R1-02 — custom tab rendering path, render callback solution
