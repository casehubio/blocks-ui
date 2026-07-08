# casehub-blocks-ui

Shared UI components for CaseHub applications — composed from [casehub-pages](https://github.com/casehubio/casehub-pages) primitives.

Domain-aware Web Components that multiple CaseHub applications reuse. Each component consumes `casehub-pages` APIs (`registerPanel`, `pages-event`, dataset contracts) but knows nothing about a specific app's domain model. The UI parallel to [casehub-blocks](https://github.com/casehubio/blocks) (shared Java coordination patterns).

## Components

### Layout Primitives

| Component | Tag | Package | Description |
|-----------|-----|---------|-------------|
| Split Workbench | `<split-workbench>` | `@casehubio/blocks-ui-split-workbench` | Generic split-pane layout shell — draggable divider, responsive collapse, selection-topic event coordination, ARIA regions. Accepts any children via named slots (`list`, `detail`, `header`) |
| List Pane | `<list-pane>` | `@casehubio/blocks-ui-list-pane` | Generic data-table wrapper — DataEndpointMixin data fetching, single-selection, paginated mode, client-sort/filter, `{topic}:selected` events, `{topic}:refresh` listener |
| Detail Pane | `<detail-pane>` | `@casehubio/blocks-ui-detail-pane` | Generic tabbed detail container — tabs via `TabDefinition[]` property, single `item` property contract, lazy element creation with caching, ARIA tablist, keyboard navigation, badges |
| Data Table | `<pages-data-table>` | `@casehubio/blocks-ui-data-table` | Generic table — 3 display modes (auto/paginated/scroll), CSS Grid, virtual scroll, ColumnDef\<R\> data model, multi-mode selection, client-side sort and filter, column visibility, ARIA grid, 2D keyboard nav |

### Work Items

| Component | Tag | Package | Description |
|-----------|-----|---------|-------------|
| Work Item Inbox | `<work-item-inbox>` | `@casehubio/blocks-ui-work-item-inbox` | Queue-scoped inbox — three-tab perspective (My Work/Claimable/All), filter bar with counts, summary bar, queue pill bar, scope context bar, SSE lifecycle, batch operations |
| Work Item Detail | `<work-item-detail>` | `@casehubio/blocks-ui-work-item-detail` | Detail panel — action bar, activity tab, relations tab (outgoing + incoming, full relation type semantics) |
| Work Item Workbench | `<work-item-workbench>` | `@casehubio/blocks-ui-work-item-workbench` | Domain wrapper — uses `<split-workbench>` with inbox + detail slotted in, keyboard shortcuts |
| Work Item Row | `<work-item-row>` | `@casehubio/blocks-ui-work-item-row` | Single work item row — priority badge, status indicator, overdue/breach markers |

### Notifications

| Component | Tag | Package | Description |
|-----------|-----|---------|-------------|
| Notification Bell | `<notification-bell>` | `@casehubio/blocks-ui-notification-inbox` | Bell icon with unread count badge, dropdown inbox overlay |
| Notification Inbox | `<notification-inbox>` | `@casehubio/blocks-ui-notification-inbox` | Notification list — inbox/archive tabs, category and severity filters, SSE real-time updates, batch mark-read/dismiss |
| Subscription List | `<subscription-list>` | `@casehubio/blocks-ui-notification-inbox` | CRUD for notification subscriptions — event type selection, constraint editing, target channel configuration |

### Operational Indicators

| Component | Tag | Package | Description |
|-----------|-----|---------|-------------|
| SLA Indicator | `<sla-indicator>` | `@casehubio/blocks-ui-sla-indicator` | Deadline countdown — breach state, escalation badge, threshold-based colour transitions, SharedTimerController |
| KPI Metric Row | `<kpi-metric-row>` | `@casehubio/blocks-ui-kpi-metric-row` | Metric card grid — sparklines, trends, status colours, density property (comfortable/compact/dense), reactive endpoint |
| Approval Gate | `<approval-gate>` | `@casehubio/blocks-ui-approval-gate` | Structured decision point — quorum tracking, evidence slots, SLA integration, confirmation dialog |

### Audit, Trust & Case Lifecycle

| Component | Tag | Package | Description |
|-----------|-----|---------|-------------|
| Audit Trail Viewer | `<audit-trail-viewer>` | `@casehubio/blocks-ui-audit-trail-viewer` | Chronological ledger entries — data-table list, expandable detail with attestations, Merkle verification banner, actor/type/date filters, GDPR erasure handling |
| Case Timeline | `<case-timeline>` | `@casehubio/blocks-ui-case-timeline` | Case lifecycle visualisation — vertical timeline with typed event nodes (30+ CaseHubEventTypes), compact strip mode for dashboards, stream type filter |
| Trust Score Panel | `<trust-score-panel>` | `@casehubio/blocks-ui-trust-score-panel` | Trust score display — SVG gauge, per-capability breakdown table, trend line (pages-viz chart), maturity phase badges, compact badge mode |

### Core Utilities

| Component | Tag | Package | Description |
|-----------|-----|---------|-------------|
| Confirm Dialog | `<blocks-confirm-dialog>` | `@casehubio/blocks-ui-core` | Modal confirmation — heading, message, confirm/cancel with variant styling |
| Schema Form | `<schema-form>` | `@casehubio/blocks-ui-core` | Dynamic form from JSON field schema — display and edit modes, extensible field registry |

## Infrastructure (`@casehubio/blocks-ui-core`)

| Module | What it provides |
|--------|-----------------|
| Tokens | CSS custom properties via `--pages-*` — re-exported from `@casehubio/pages-ui-tokens` |
| Mixins | `FocusTrapMixin`, `KeyboardShortcutMixin`, `LiveRegionMixin`, `RovingTabindexMixin` (with direction support), `DataEndpointMixin` |
| Events | `emitPagesEvent`, `onPagesEvent` — re-exported from `@casehubio/pages-component`. Domain topics: `WorkItemEventTopics`, `NotificationEventTopics` |
| Types | `WorkIdentity`, `WorkItemResponse`, `DatasetContract` (re-exported from `@casehubio/pages-data`) |
| Timers | `SharedTimerController` — singleton 1-second tick for SLA countdowns |

## REST APIs Consumed

| Components | API Source | Endpoints |
|------------|-----------|-----------|
| Work Item \* | casehub-work | `/workitems/*`, `/workitems/events` (SSE), `/workitems/{id}/relations` |
| Notification \* | Per-app notification service | `/notifications/*`, `/notifications/stream` (SSE), `/subscriptions/*` |
| Audit Trail Viewer | casehub-ledger | `/api/v1/ledger/entries`, `/api/v1/ledger/verify`, `/api/v1/ledger/entries/{id}/attestations` |
| Case Timeline | casehub-engine (via scaffold) | `/api/v1/cases/{caseId}/events` |
| Trust Score Panel | casehub-ledger | `/api/v1/ledger/trust/{actorId}`, `/api/v1/ledger/trust/{actorId}/capability/{tag}` |
| KPI Metric Row | Consumer-provided | Any endpoint returning `MetricDefinition[]` |

## Build

```bash
yarn install
yarn build
yarn typecheck
yarn test
```

## Development

```bash
yarn examples     # starts dev server at localhost:3000
```

The examples app showcases every component with mock data and interactive controls.

## Documentation

- [PLATFORM.md](https://raw.githubusercontent.com/casehubio/parent/main/docs/PLATFORM.md) — full platform architecture
- [casehub-pages](https://github.com/casehubio/casehub-pages) — pages framework
- [casehub-blocks](https://github.com/casehubio/blocks) — shared Java coordination patterns
