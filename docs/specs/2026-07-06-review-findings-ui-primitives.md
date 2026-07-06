# Review Findings — UI Primitives Batch

**Date:** 2026-07-06
**Issue:** #23
**Branch:** issue-23-review-findings-ui-primitives

Addresses five findings from the final review of the UI primitives batch (#13, #12, #8, #16). One finding (density-compact) deferred to #24.

---

## 1. sla-indicator invalid date guard

**Problem:** Setting `deadline` to a non-ISO string causes three failures:
- `_computeState()` returns `'normal'` (green) because `NaN` fails all threshold comparisons
- `formatBreach(NaN)` renders `"Breached NaNm ago"`
- `new Date("garbage").toISOString()` in `render()` throws `RangeError`, crashing the render

**Fix:** Track deadline validity as `@state()` — compute once in `_update()`, check in `render()`. This consolidates validity logic into `_update()` (the single source of truth for deadline evaluation), eliminates redundant `Date` construction on every render cycle (including 1-second timer ticks), and ensures internal state (`_remaining`, `_state`) is coherent when rendering nothing.

New state field:
```typescript
@state() private _deadlineValid = true;
```

`_update()` — set validity flag, reset internal state on invalid, and warn once on transition:
```typescript
const deadlineMs = new Date(this.deadline).getTime();
if (isNaN(deadlineMs)) {
  if (this._deadlineValid) {
    console.warn(`sla-indicator: invalid deadline value "${this.deadline}"`);
  }
  this._deadlineValid = false;
  this._remaining = 0;
  this._state = 'normal';
  return;
}
this._deadlineValid = true;
```

The warn is guarded by `this._deadlineValid` so it fires exactly once per transition to invalid — not on every `SharedTimerController` tick (which calls `_update()` at 1Hz).

`render()` — check flag instead of re-parsing Date:
```typescript
if (!this.deadline || !this._deadlineValid) return nothing;
```

The `console.warn` makes misconfiguration observable — non-empty invalid deadlines are always programmer errors, not user input. The empty-string case is handled by the existing `if (!this.deadline) return;` guard in `_update()` before the NaN check, so the warn only fires for genuinely invalid date strings.

**Tests (3):**
- Invalid date string renders nothing (no shadow DOM content)
- Invalid date does not emit `sla.state-changed` event
- Valid-to-invalid transition: set valid deadline → assert renders countdown → set invalid deadline → assert renders nothing and no new state event emitted

---

## 2. approval-gate aria-valuemin

**Problem:** Progressbar in `_renderQuorum()` lacks explicit `aria-valuemin="0"`. ARIA default is 0, but explicit is better for audit tools.

**Fix:** Add `aria-valuemin="0"` attribute to the progressbar element.

**Tests:** Update existing quorum test assertion to verify `aria-valuemin` is present.

---

## 3. approval-gate error path tests

**Problem:** `_submitDecision` catch block (sets `_error`, calls `announce()`) has no test coverage.

**Fix:** Two new tests using `requireConfirmation = false` to exercise `_submitDecision` directly:
- HTTP error: mock fetch returning `{ ok: false, status: 500 }` → verify `.error` renders "HTTP 500", buttons re-enabled, and `announce()` called with `'Decision failed: HTTP 500'` and `'assertive'` politeness
- Network error: mock fetch rejecting → verify `.error` renders error message, buttons re-enabled, and `announce()` called with assertive politeness

Each test also verifies the error-clear-on-retry cycle: after the error, click an outcome button again (with a new mock that succeeds) → assert the previous `.error` element clears before the new request fires. This exercises the `_error = null` at the start of `_submitDecision`.

**Fetch mock pattern:** Use `vi.stubGlobal('fetch', vi.fn()...)` — this integrates with vitest's automatic restoration via `vi.restoreAllMocks()`. Add `vi.restoreAllMocks()` to `afterEach` in this test file. Also fix the existing test at line 136 that assigns `globalThis.fetch` directly — replace with `vi.stubGlobal`.

This pattern applies to all test files that mock fetch (approval-gate, kpi-metric-row). The sla-indicator test file does not mock fetch but benefits from adding `vi.restoreAllMocks()` to its `afterEach` alongside the existing `vi.useRealTimers()` to future-proof against additions.

---

## 4. kpi-metric-row endpoint mode tests

**Problem:** Endpoint mode (`_fetchMetrics`, loading skeleton, error state, `refresh()`) is entirely untested.

**Fix:** Five new tests:
- Loading skeleton: mock fetch with a **non-resolving** promise (`vi.fn(() => new Promise(() => {}))`) to hold `_loading = true` for assertion. Assert `.skeleton-card` elements render. A resolving mock would complete the `_loading = true → false` transition within a single Lit update cycle, making the skeleton unassertable.
- Successful fetch: mock fetch resolving with `MetricDefinition[]`, assert cards render after `updateComplete`
- Fetch error: mock fetch rejecting, assert `.error` element renders
- `refresh()`: initial fetch with first mock, replace with new mock via `vi.stubGlobal`, call `refresh()`, assert new data renders
- Endpoint change without `refresh()`: set `endpoint`, await initial fetch, change `endpoint` to a new URL, await `updateComplete` — assert fetch was **not** called again. This documents the current behavior that endpoint changes after mount require an explicit `refresh()` call (tracked as #25 for reactive fix).

**Fetch mock pattern:** Use `vi.stubGlobal('fetch', ...)` with `vi.restoreAllMocks()` in `afterEach` (same pattern as §3).

---

## 5. Deferred: kpi-metric-row density-compact

Spec mentions "Density-compact mode lowers minmax to 120px" but never defines a `density` property in the Properties table. Aspirational note, not a requirement.

Deferred to #24 — requires design of property API, interaction with `columns`, and value semantics.
