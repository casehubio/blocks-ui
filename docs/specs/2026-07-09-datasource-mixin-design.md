# DataSourceMixin — Lit Adapter for DataSourceController

**Issue:** #44
**Date:** 2026-07-09
**Status:** Design

## Problem

Every `DataEndpointMixin` consumer reimplements the same state machine:
set loading, clear error, fetch, set data, clear loading, handle failure,
set error, clear data. That's ~80% of the code. The remaining ~20% — URL
construction, response parsing, auth headers — is genuine domain logic.

`DataSourceController` (shipped in pages#145) is a framework-agnostic
state machine that handles the 80%. blocks-ui needs a Lit binding that
bridges the controller to web component lifecycle and reactivity.

## Architecture

Two-layer Lit binding. Each layer serves a distinct use case.

```
DataSourceController (pages-component, exists)
       ↓ wraps
DataSourceAdapter (blocks-ui-core, new) — Lit ReactiveController
       ↓ uses
DataSourceMixin (blocks-ui-core, new) — convenience mixin
```

A third piece — `fetchSource` — provides a simple JSON-fetching DataSource
for blocks-ui components that work with domain-typed objects rather than
TypedDataSet.

### Dual-mode operation

Both the adapter and mixin satisfy the `DataReceiver` contract (read-write
`loading`, `dataSet`, `error`). This enables two hosting modes:

- **Standalone:** Component receives `endpoint` as HTML attribute or via
  `configure()`, self-fetches via the source factory.
- **Hosted (pipeline push):** Pages runtime wraps the component in
  `createHostPanelProxy` and pushes data via `DataReceiver` setters.
  The proxy calls `component.dataSet = result`, `component.loading = true`,
  etc. — the mixin's setters delegate to the adapter, which delegates to the
  controller, preserving the mutual-clearing invariant.

VizTarget properties (`totalRows`, `activeSort`, `activePage`) are not
surfaced on the adapter or mixin. blocks-ui components self-fetch and
parse their own responses — they don't participate in the pages data-table
pipeline. The underlying `DataSourceController` implements `VizTarget`;
the `adapter.controller` escape hatch provides access if ever needed.

### Layer selection

| Component pattern | Layer | Why |
|-------------------|-------|-----|
| Single data source, endpoint as HTML attribute | DataSourceMixin | Common case — one line |
| Multiple data sources (audit-trail-viewer) | DataSourceAdapter directly | Symmetric composition |
| Non-Lit or framework-agnostic | DataSourceController directly | No Lit dependency |

## fetchSource

Raw JSON DataSource for blocks-ui components. pages' `restSource` delivers
`TypedDataSet` via `extractDataSet()` — correct for pages-viz charts and
data-table pipelines. blocks-ui domain components (audit-trail-viewer,
case-timeline, trust-score-panel) work with domain-typed JSON objects.
`fetchSource` fills that gap.

**File:** `packages/blocks-ui-core/src/data-source/fetch-source.ts`

```typescript
import type { DataSource, DataSink } from "@casehubio/pages-data";

export interface FetchSourceOptions {
  readonly method?: string;
  readonly headers?: Record<string, string> | (() => Record<string, string>);
  readonly body?: string;
  readonly fetchFn?: typeof globalThis.fetch;
}

/**
 * fetchSource controllers receive only snapshot events. The snapshot's
 * dataset field is raw JSON (unknown), not TypedDataSet. Do not connect
 * push sources (SSE, WebSocket) to a controller backed by fetchSource —
 * their append/replace/remove handlers expect TypedDataSet methods.
 */
export function fetchSource(url: string, options?: FetchSourceOptions): DataSource {
  let abort: AbortController | undefined;
  return {
    connect(sink: DataSink) {
      abort = new AbortController();
      const doFetch = options?.fetchFn ?? globalThis.fetch.bind(globalThis);
      const headers = typeof options?.headers === 'function'
        ? options.headers()
        : options?.headers;
      doFetch(url, {
        method: options?.method,
        headers,
        body: options?.body,
        signal: abort.signal,
      })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(data => sink.apply({ type: "snapshot", dataset: data as never }))
        .catch(err => {
          if (err.name !== "AbortError") {
            sink.error({ message: err.message, permanent: true });
          }
        });
    },
    disconnect() {
      abort?.abort();
      abort = undefined;
    },
  };
}
```

### Type assertion note

`sink.apply()` expects `SnapshotEvent.dataset: TypedDataSet`. `fetchSource`
passes raw JSON. The controller's snapshot handler does
`this.dataSet = event.dataset` — no TypedDataSet methods are called. The
`as never` assertion is intentionally narrow: it satisfies the type constraint
at the call site without widening to `any`, making it visible to `--noUncheckedIndexedAccess`
and other strict checks. Components cast `this.dataSet` (or `adapter.dataSet`)
to their domain type.

**Constraint:** Controllers backed by `fetchSource` must only receive snapshot
events. Connecting a push source (SSE, WebSocket) that sends `append`/`replace`/
`remove` events would fail at runtime — those handlers call TypedDataSet methods
(`ds.columns`, `r.cell()`) that don't exist on raw JSON.

## DataSourceAdapter

Lit `ReactiveController` wrapping `DataSourceController`. Same pattern as
the existing `EventStreamController` in blocks-ui-core.

**File:** `packages/blocks-ui-core/src/data-source/data-source-adapter.ts`

```typescript
import type { ReactiveController, ReactiveControllerHost } from "lit";
import {
  DataSourceController,
  type DataSourceControllerOptions,
} from "@casehubio/pages-component";

export class DataSourceAdapter implements ReactiveController {
  readonly controller: DataSourceController;

  constructor(
    private readonly host: ReactiveControllerHost,
    options?: DataSourceControllerOptions,
  ) {
    this.controller = new DataSourceController({
      ...options,
      onChange: () => {
        options?.onChange?.();
        host.requestUpdate();
      },
    });
    host.addController(this);
  }

  get endpoint(): string | undefined { return this.controller.endpoint; }
  set endpoint(v: string | undefined) { this.controller.endpoint = v; }

  get loading(): boolean { return this.controller.loading; }
  set loading(v: boolean) { this.controller.loading = v; }
  get error(): string { return this.controller.error; }
  set error(v: string) { this.controller.error = v; }
  get dataSet(): unknown { return this.controller.dataSet; }
  set dataSet(v: unknown) { this.controller.dataSet = v; }

  get source() { return this.controller.source; }
  set source(s) { this.controller.source = s; }

  hostConnected(): void { this.controller.connect(); }
  hostDisconnected(): void { this.controller.disconnect(); }

  refresh(): void { this.controller.refresh(); }
  dispose(): void { this.controller.dispose(); }
}
```

### Direct composition (multi-controller)

```typescript
class AuditTrailViewer extends LiveRegionMixin(LitElement) {
  readonly entries = new DataSourceAdapter(this, {
    sourceFactory: (url, id) => fetchSource(url),
  });
  readonly verify = new DataSourceAdapter(this, {
    sourceFactory: (url, id) => fetchSource(url),
  });
  // Lifecycle automatic — no manual connect/disconnect
}
```

## DataSourceMixin

Convenience mixin for the common case: single data source, `endpoint` as
HTML attribute, hosted mode via `configure()`.

**File:** `packages/blocks-ui-core/src/data-source/data-source-mixin.ts`

```typescript
import type { LitElement, PropertyValues } from "lit";
import { property } from "lit/decorators.js";
import { DataSourceAdapter } from "./data-source-adapter.js";
import { fetchSource, type FetchSourceOptions } from "./fetch-source.js";
import type { SourceFactory } from "@casehubio/pages-component";

type Constructor<T = {}> = new (...args: any[]) => T;

export function DataSourceMixin<T extends Constructor<LitElement>>(Base: T) {
  class DataSourceHost extends Base {
    protected createSourceFactory(): SourceFactory {
      return (url, _id) => fetchSource(url);
    }

    readonly dataSource: DataSourceAdapter = new DataSourceAdapter(this, {
      sourceFactory: this.createSourceFactory(),
    });

    @property({ type: String }) endpoint?: string;

    get loading(): boolean { return this.dataSource.loading; }
    set loading(v: boolean) { this.dataSource.loading = v; }
    get error(): string { return this.dataSource.error; }
    set error(v: string) { this.dataSource.error = v; }
    get dataSet(): unknown { return this.dataSource.dataSet; }
    set dataSet(v: unknown) { this.dataSource.dataSet = v; }

    protected resolveEndpoint(): string | undefined {
      return this.endpoint;
    }

    private _configuring = false;

    protected syncEndpoint(): void {
      if (this._configuring) return;
      this.dataSource.endpoint = this.resolveEndpoint();
    }

    override willUpdate(changed: PropertyValues): void {
      super.willUpdate(changed);
      if (changed.has("endpoint")) {
        this.syncEndpoint();
      }
    }

    configure(props: Record<string, unknown>): void {
      this._configuring = true;
      if (props.endpoint !== undefined) this.endpoint = props.endpoint as string;
      queueMicrotask(() => {
        this._configuring = false;
        this.syncEndpoint();
        this.dataSource.refresh();
      });
    }
  }

  return DataSourceHost as unknown as Constructor<{
    endpoint?: string;
    loading: boolean;
    error: string;
    dataSet: unknown;
    dataSource: DataSourceAdapter;
    resolveEndpoint(): string | undefined;
    syncEndpoint(): void;
    configure(props: Record<string, unknown>): void;
  }> & T;
}
```

### Endpoint resolution

`endpoint` is a Lit `@property` (HTML attribute). The mixin does NOT
delegate it to the controller in the setter — that would trigger an
immediate fetch before `willUpdate` can intervene. Instead:

1. Setter stores the value and marks the property dirty
2. `willUpdate` calls `syncEndpoint()` → `resolveEndpoint()` → sets
   controller endpoint
3. Components that derive URLs from `endpoint` + other state override
   `resolveEndpoint()`

This avoids double-fetch when both endpoint and a derived parameter
(e.g. actorId) change in the same update cycle.

### Reactivity

`loading`, `error`, `dataSet` are getter/setter pairs — not `@state()`. The
getters read from the adapter; the setters delegate to the adapter (and
through it to the controller), satisfying the `DataReceiver` contract for
hosted pipeline push. The controller fires `onChange` → `requestUpdate()`
→ Lit re-renders → getters read current state. No reactive backing field
needed.

### configure() batching

`configure()` sets a `_configuring` flag. The guard lives inside
`syncEndpoint()` — not in `willUpdate` — so it covers all call sites:
mixin willUpdate, sub-class willUpdate overrides, and any future callers.
Sub-classes that call `this.syncEndpoint()` in their own `willUpdate`
(e.g. trust-score-panel on `actorId` change) are automatically suppressed
during configure without needing to know about the flag.

A microtask defers `syncEndpoint()` + `refresh()` until after the Lit
update cycle, ensuring all properties are settled before the fetch.
`refresh()` disconnects and reconnects the source — if headers were
provided as a function (see §fetchSource), the function is re-evaluated
on each `connect()`, picking up any changed state (e.g. identity).

This matches the existing `DataEndpointMixin._configurePending` pattern
and satisfies the `ConfigurablePanel` re-entry contract: same-endpoint
re-configuration with changed non-endpoint props (e.g. `identity`) still
triggers a re-fetch with fresh headers.

## Consumer migration

### list-pane (simple — mixin, no overrides)

```typescript
import { DataSourceMixin, emitPagesEvent, onPagesEvent } from '@casehubio/blocks-ui-core';

@customElement('list-pane')
export class ListPane extends DataSourceMixin(LitElement) {
  // endpoint, loading, error, dataSet from mixin
  // No fetchData(), no fetchFn, no abortSignal

  @state() private _rows: readonly unknown[] = [];
  @state() private _totalRows: number | null = null;
  private _lastDataSet: unknown = undefined;

  override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (this.dataSet !== this._lastDataSet) {
      this._lastDataSet = this.dataSet;
      const data = this.dataSet as any;
      if (Array.isArray(data)) {
        this._rows = data;
        this._totalRows = null;
      } else if (data && Array.isArray(data.items)) {
        this._rows = data.items;
        this._totalRows = data.total;
      } else {
        this._rows = [];
        this._totalRows = null;
      }
    }
  }

  override render() {
    if (!this.loading && this._rows.length === 0 && !this.error) {
      return html`<div class="empty">${this.emptyMessage}</div>`;
    }

    return html`
      <pages-data-table
        .rows=${this._rows}
        .columns=${this.columns}
        .totalRows=${this._totalRows}
        .loading=${this.loading}
        ...
      ></pages-data-table>
    `;
  }
}
```

**What changes:**
- `DataEndpointMixin(LitElement)` → `DataSourceMixin(LitElement)`
- Delete `fetchData()` — controller + fetchSource handles fetch
- Delete `fetchFn`, `abortSignal` usage
- Derive `_rows` / `_totalRows` in `willUpdate` when dataSet changes
  (once per data arrival, not every render cycle)
- `refresh()` calls `this.dataSource.refresh()`

### trust-score-panel (URL derivation — override resolveEndpoint)

```typescript
@customElement('trust-score-panel')
export class TrustScorePanel extends DataSourceMixin(LiveRegionMixin(LitElement)) {
  @property({ type: String, attribute: 'actor-id' }) actorId?: string;
  @property({ type: String }) mode: 'full' | 'compact' = 'full';
  @property({ type: Number }) score?: number;
  @property({ type: String }) trustLevel?: TrustLevel;

  private _hasPreFetchedData(): boolean {
    return this.mode === 'compact' && this.score !== undefined && this.trustLevel !== undefined;
  }

  protected override resolveEndpoint(): string | undefined {
    if (this._hasPreFetchedData()) return undefined;
    if (!this.endpoint || !this.actorId) return undefined;
    return `${this.endpoint}/trust/${this.actorId}`;
  }

  override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('actorId')) this.syncEndpoint();
  }

  // render reads this.dataSet as TrustScoreResponse
}
```

**What changes:**
- Delete `fetchData()`, `fetchFn`, `abortSignal`
- `_hasPreFetchedData()` preserved — `resolveEndpoint()` returns `undefined`
  when pre-fetched data is available, preventing unnecessary network fetch
- Override `resolveEndpoint()` to derive `/trust/{actorId}`
- Call `syncEndpoint()` in willUpdate when actorId changes
- Read `this.dataSet as TrustScoreResponse` instead of `this._trustData`
- Pre-fetched data mode (`score` + `trustLevel` props) stays — renders
  from props when available, falls back to dataSet
- trust-score-panel doesn't use identity for authentication (no tenancy
  headers — confirmed in source) — no configure override needed.

### case-timeline (URL derivation + custom headers)

```typescript
@customElement('case-timeline')
export class CaseTimeline extends DataSourceMixin(LiveRegionMixin(LitElement)) {
  @property({ type: String, attribute: 'case-id' }) caseId?: string;
  @property({ type: Object }) identity?: WorkIdentity;

  protected override createSourceFactory(): SourceFactory {
    return (url, _id) => fetchSource(url, {
      headers: () => ({
        'Content-Type': 'application/json',
        ...(this.identity?.tenancyId && { 'X-Tenancy-ID': this.identity.tenancyId }),
      }),
    });
  }

  protected override resolveEndpoint(): string | undefined {
    if (!this.endpoint || !this.caseId) return undefined;
    return `${this.endpoint}/cases/${this.caseId}/events`;
  }

  override configure(props: Record<string, unknown>): void {
    if (props.caseId !== undefined) this.caseId = props.caseId as string;
    if (props.identity !== undefined) this.identity = props.identity as WorkIdentity;
    super.configure(props);
  }

  override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('caseId')) this.syncEndpoint();
  }

  // render reads this.dataSet — extracts .content for events
}
```

**What changes:**
- Delete `fetchData()`, `fetchFn`, `abortSignal`
- Override `createSourceFactory()` for tenancy headers
- Override `resolveEndpoint()` to derive `/cases/{caseId}/events`
- Override `configure()` to propagate `caseId` and `identity` before
  calling `super.configure()` (which defers syncEndpoint + refresh)
- `identity` declared on the component, not inherited from mixin
- Read `this.dataSet` instead of `this._events`

### audit-trail-viewer (multi-controller — adapter directly)

```typescript
@customElement('audit-trail-viewer')
export class AuditTrailViewer extends LiveRegionMixin(LitElement) {
  @property({ type: String }) endpoint?: string;
  @property({ type: Object }) identity?: WorkIdentity;
  @property({ type: String, attribute: 'subject-id' }) subjectId?: string;
  @property({ type: String, attribute: 'actor-id' }) actorId?: string;

  readonly entries = new DataSourceAdapter(this, {
    sourceFactory: (url, _id) => fetchSource(url),
  });
  readonly verify = new DataSourceAdapter(this, {
    sourceFactory: (url, _id) => fetchSource(url),
  });

  override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('endpoint') || changed.has('subjectId') ||
        changed.has('identity') || changed.has('_dateFrom') ||
        changed.has('_dateTo')) {
      this._updateEndpoints();
    }
  }

  private _updateEndpoints(): void {
    if (!this.endpoint || !this.subjectId || !this.identity) {
      this.entries.endpoint = undefined;
      this.verify.endpoint = undefined;
      return;
    }

    const entriesUrl = new URL(`${this.endpoint}/api/v1/ledger/entries`);
    entriesUrl.searchParams.set('subjectId', this.subjectId);
    entriesUrl.searchParams.set('tenancyId', this.identity.tenancyId);
    if (this._dateFrom) entriesUrl.searchParams.set('from', this._dateFrom);
    if (this._dateTo) entriesUrl.searchParams.set('to', this._dateTo);

    const verifyUrl = new URL(`${this.endpoint}/api/v1/ledger/verify`);
    verifyUrl.searchParams.set('subjectId', this.subjectId);

    this.entries.endpoint = entriesUrl.toString();
    this.verify.endpoint = verifyUrl.toString();
  }

  configure(props: Record<string, unknown>): void {
    if (props.endpoint !== undefined) this.endpoint = props.endpoint as string;
    if (props.subjectId !== undefined) this.subjectId = props.subjectId as string;
    if (props.actorId !== undefined) this.actorId = props.actorId as string;
    if (props.identity !== undefined) this.identity = props.identity as WorkIdentity;
    queueMicrotask(() => {
      this._updateEndpoints();
      this.entries.refresh();
      this.verify.refresh();
    });
  }

  override render() {
    if (this.entries.loading) return html`...loading...`;
    if (this.entries.error) return html`...error: ${this.entries.error}...`;

    const entries = this.entries.dataSet as LedgerEntry[];
    const verification = this.verify.dataSet as VerificationResult | undefined;
    const verifyFailed = !this.verify.loading && this.verify.error;

    return html`
      ${verifyFailed
        ? html`<div class="verification-banner failed">Verification unavailable: ${this.verify.error}</div>`
        : this.verify.loading
          ? html`<div class="verification-banner">Verifying chain integrity...</div>`
          : this._renderVerificationBanner(verification)}
      ${this._renderFilterControls()}
      ...entries table...
    `;
  }
}
```

**What changes:**
- `DataEndpointMixin(LitElement)` → direct `LitElement` (no mixin)
- Two `DataSourceAdapter` instances replace the single mixin
- Delete `fetchData()`, `_fetchAttestations()` fetch lifecycle
- URL construction stays (domain logic) but moves to `_updateEndpoints()`
- Parallel fetch is implicit — two adapters fetch independently
- Partial state: entries can render while verification is still loading
  (improvement over current all-or-nothing Promise.all)
- Verification errors handled explicitly — banner shows "Verification
  unavailable" with error message instead of silently dropping

## What gets removed

| Removed | Why |
|---------|-----|
| `DataEndpointMixin` | Replaced by DataSourceMixin + DataSourceAdapter |
| `abstract fetchData()` | Controller + source handle fetch lifecycle |
| `fetchFn` property | Testing: inject via `FetchSourceOptions.fetchFn` |
| `abortSignal` property | Source manages its own abort controller |
| `sseManager` property | Dead code — no consumer used it |
| `sseUrl()` / `handleSSEEvent()` | Dead code — SSE endpoints use `sse://` URL scheme |
| `SSEManager` import | No longer needed in the data-source module |
| `identity` on the mixin | Components that need it declare their own property |
| `_configurePending` name | Renamed to `_configuring` — same pattern, guard moved into `syncEndpoint()` |

**Pre-release: delete, not deprecate.** No backward-compatibility shim.

## File inventory

### New files

| File | Contents |
|------|----------|
| `packages/blocks-ui-core/src/data-source/fetch-source.ts` | fetchSource DataSource implementation |
| `packages/blocks-ui-core/src/data-source/data-source-adapter.ts` | DataSourceAdapter ReactiveController |
| `packages/blocks-ui-core/src/data-source/data-source-mixin.ts` | DataSourceMixin convenience mixin |
| `packages/blocks-ui-core/src/data-source/index.ts` | Barrel exports |
| `packages/blocks-ui-core/src/data-source/fetch-source.test.ts` | fetchSource unit tests |
| `packages/blocks-ui-core/src/data-source/data-source-adapter.test.ts` | Adapter lifecycle tests |
| `packages/blocks-ui-core/src/data-source/data-source-mixin.test.ts` | Mixin integration tests |

### Deleted files

| File | Reason |
|------|--------|
| `packages/blocks-ui-core/src/data-endpoint/data-endpoint.ts` | Replaced by data-source module |
| `packages/blocks-ui-core/src/data-endpoint/data-endpoint.test.ts` | Replaced by new tests |
| `packages/blocks-ui-core/src/data-endpoint/index.ts` | Replaced by data-source index |

### Modified files

| File | Change |
|------|--------|
| `packages/blocks-ui-core/src/index.ts` | `data-endpoint` → `data-source` |
| `components/list-pane/src/list-pane.ts` | Migrate to DataSourceMixin |
| `components/trust-score-panel/src/trust-score-panel.ts` | Migrate to DataSourceMixin + resolveEndpoint |
| `components/case-timeline/src/case-timeline.ts` | Migrate to DataSourceMixin + sourceFactory |
| `components/audit-trail-viewer/src/audit-trail-viewer.ts` | Migrate to DataSourceAdapter (×2) |
| `CLAUDE.md` | Update blocks-ui-core description |
| `README.md` | Update DataEndpointMixin references |

## Testing strategy

### fetchSource

- Delivers JSON response as dataSet via sink.apply
- Sets loading via sink (indirectly — controller tracks)
- Calls sink.error on HTTP failure
- Calls sink.error on network failure
- Abort on disconnect — no sink calls after disconnect
- Static headers passed through
- Dynamic headers (function) evaluated on each connect
- Custom fetchFn used when provided

### DataSourceAdapter

- hostConnected calls controller.connect
- hostDisconnected calls controller.disconnect
- onChange triggers host.requestUpdate
- Endpoint proxy delegates to controller
- Loading/error/dataSet getters reflect controller state
- Loading/error/dataSet setters delegate to controller (DataReceiver)
- Refresh delegates to controller.refresh
- Multiple adapters on one host — both get lifecycle

### DataSourceMixin

- Endpoint as HTML attribute triggers fetch via willUpdate
- resolveEndpoint override derives URL correctly
- syncEndpoint suppressed during configure (guard inside syncEndpoint)
- syncEndpoint re-derives when non-endpoint deps change
- configure() sets properties, defers syncEndpoint + refresh via microtask
- configure() with same endpoint but changed identity triggers re-fetch
- Sub-class willUpdate syncEndpoint calls suppressed during configure
- loading/error/dataSet getters reflect adapter state
- loading/error/dataSet setters delegate to adapter (DataReceiver)
- createSourceFactory override provides custom headers
- No fetch when endpoint is undefined/null

### Consumer tests

Each migrated component's existing test file updated:
- Mock fetchSource via FetchSourceOptions.fetchFn
- Verify data renders from dataSet
- Verify loading/error states
- Verify URL derivation (resolveEndpoint)
- Verify configure() sets endpoint and triggers fetch

## Acceptance criteria

- [ ] `fetchSource` delivers raw JSON through DataSource interface
- [ ] `DataSourceAdapter` implements Lit ReactiveController with lifecycle
- [ ] `DataSourceAdapter` satisfies `DataReceiver` (read-write loading, error, dataSet)
- [ ] `DataSourceMixin` provides endpoint, loading, error, dataSet (read-write), configure
- [ ] `resolveEndpoint()` hook supports URL derivation
- [ ] `createSourceFactory()` hook supports custom headers/auth
- [ ] list-pane migrated — renders from dataSet
- [ ] trust-score-panel migrated — resolveEndpoint derives /trust/{actorId}
- [ ] case-timeline migrated — sourceFactory provides tenancy headers
- [ ] audit-trail-viewer migrated — two DataSourceAdapters, independent lifecycle
- [ ] No direct SSEManager imports remain in data-source module
      (Note: issue #44 says "blocks-ui components" — narrowed to
      data-source module because SSE-using components like work-item-inbox,
      notification-bell manage SSEManager directly and are orthogonal to
      DataEndpointMixin. The mixin's SSE integration was dead code. See
      blog post "The SSE Question Had the Wrong Premise" for analysis.)
- [ ] DataEndpointMixin deleted (not deprecated)
- [ ] All existing component tests pass with new mixin/adapter
- [ ] `configure()` re-entry triggers re-fetch even with unchanged endpoint
- [ ] `yarn build && yarn typecheck && yarn test` green
