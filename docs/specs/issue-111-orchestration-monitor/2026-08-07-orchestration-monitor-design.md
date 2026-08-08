# Orchestration Monitor Design

**Issue:** casehubio/blocks-ui#111
**Date:** 2026-08-07
**Status:** Approved

## Summary

UI representation for the `io.casehub.blocks.agentic` orchestration framework (~80 Java source files). Two fundamentally different data flows — live execution state (SSE push) and historical audit trail (REST pull) — become separate, composable components joined by an orchestration workbench.

## Architecture: Extend blocks-ui-core + two new components

- Orchestration types in `blocks-ui-core/src/types/orchestration.ts`
- Status domain registrations for `execution`, `agent`, `pattern` in `status.ts`
- New orchestration-events strategy in `blocks-timeline/src/strategies/`
- New `components/execution-monitor/` (SSE-driven live monitor)
- New `components/orchestration-workbench/` (composition shell)

## 1. Domain Types (`blocks-ui-core/src/types/orchestration.ts`)

TypeScript types mirroring the Java `io.casehub.blocks.agentic` domain model.

### Execution lifecycle

```typescript
export type ExecutionState =
  | 'IDLE' | 'RUNNING' | 'WAITING_FOR_AGENT'
  | 'WAITING_FOR_EVENT' | 'COMPLETE' | 'FAULTED' | 'CANCELLED';

export type ExecutionResult = 'COMPLETED' | 'FAILED' | 'ESCALATED' | 'CANCELLED';
```

### Agents

```typescript
export type AgentRefType = 'WORKER' | 'CHANNEL' | 'HUMAN' | 'EXTERNAL' | 'COMPOSED';
export type AgentResultStatus = 'SUCCESS' | 'FAILURE' | 'TIMEOUT' | 'DECLINED';

export interface AgentRef {
  readonly id: string;
  readonly type: AgentRefType;
  readonly name?: string;
}

export interface AgentResult {
  readonly agentRef: AgentRef;
  readonly status: AgentResultStatus;
  readonly detail?: string;
  readonly error?: string;
  readonly duration?: number;
}
```

### Patterns

```typescript
export type PatternType =
  | 'SEQUENCE' | 'PARALLEL' | 'LOOP' | 'CONDITIONAL'
  | 'SUPERVISOR' | 'DEBATE' | 'VOTING' | 'HTN';
```

### Execution model and failure policy

```typescript
export interface ExecutionModel {
  readonly pattern: PatternType;
  readonly routingStrategy?: string;
  readonly decompositionStrategy?: string;
  readonly activationStrategy?: string;
  readonly aggregationStrategy?: string;
  readonly terminationStrategy?: string;
  readonly failurePolicy: FailurePolicy;
}

export type RoutingFailureAction = 'FAIL' | 'RETRY_BROADER' | 'ESCALATE';
export type AggregationFailureAction = 'FAIL' | 'ESCALATE' | 'RETRY_DIFFERENT';

export interface FailurePolicy {
  readonly routingFailureAction: RoutingFailureAction;
  readonly aggregationFailureAction: AggregationFailureAction;
  readonly agentRetryPolicy?: AgentRetryPolicy;
}

export type BackoffStrategy = 'FIXED' | 'LINEAR' | 'EXPONENTIAL';

export interface AgentRetryPolicy {
  readonly maxRetries: number;
  readonly backoffStrategy: BackoffStrategy;
  readonly initialDelayMs?: number;
}
```

> **Naming note:** `ExecutionState.COMPLETE` vs `ExecutionResult.COMPLETED` — these mirror the Java sealed interfaces. `COMPLETE` is a state (the execution has reached completion); `COMPLETED` is a result outcome (the execution completed successfully, as opposed to FAILED/ESCALATED/CANCELLED). The distinction is intentional.

### Orchestration audit events

```typescript
export type OrchestrationEventType =
  | 'EXECUTION_STARTED' | 'ROUTING_DECISION' | 'ACTIVATION_EVALUATED'
  | 'AGENT_DISPATCHED' | 'AGENT_RESULT' | 'AGENT_FAILED'
  | 'AGGREGATION_COMPLETED' | 'TERMINATION_EVALUATED' | 'EXECUTION_COMPLETED';

export interface OrchestrationAuditEvent {
  readonly id: string;
  readonly eventType: OrchestrationEventType;
  readonly executionId: string;
  readonly timestamp: string;
  readonly iteration?: number;
  readonly payload: OrchestrationPayload;
}

export type OrchestrationPayload =
  | RoutingDecisionPayload
  | ActivationPayload
  | AggregationPayload
  | TerminationPayload
  | AgentDispatchPayload
  | AgentResultPayload
  | ExecutionStartedPayload
  | ExecutionCompletedPayload;
```

### Typed event payloads (discriminated union)

Each payload interface carries a `type` discriminant matching `OrchestrationEventType`. The `OrchestrationPayload` union (on `OrchestrationAuditEvent.payload`) enables narrowing via `event.payload.type`.

```typescript
export interface ExecutionStartedPayload {
  readonly type: 'EXECUTION_STARTED';
  readonly model: ExecutionModel;
}

export type RoutingOutcome = 'SELECTED' | 'UNRESOLVABLE' | 'ESCALATE';

export interface RoutingDecisionPayload {
  readonly type: 'ROUTING_DECISION';
  readonly outcome: RoutingOutcome;
  readonly selectedAgents?: readonly AgentRef[];
  readonly reason?: string;
}

export interface ActivationPayload {
  readonly type: 'ACTIVATION_EVALUATED';
  readonly conditionMet: boolean;
  readonly conditionExpression?: string;
}

export interface AgentDispatchPayload {
  readonly type: 'AGENT_DISPATCHED';
  readonly agentRef: AgentRef;
}

export interface AgentResultPayload {
  readonly type: 'AGENT_RESULT' | 'AGENT_FAILED';
  readonly agentRef: AgentRef;
  readonly status: AgentResultStatus;
  readonly detail?: string;
  readonly error?: string;
  readonly duration?: number;
}

export type AggregationOutcome = 'RESOLVED' | 'PARTIAL' | 'DEADLOCKED';

export interface AggregationPayload {
  readonly type: 'AGGREGATION_COMPLETED';
  readonly outcome: AggregationOutcome;
  readonly remainingCount?: number;
}

export type TerminationOutcome = 'CONTINUE' | 'COMPLETE' | 'FAILED' | 'ESCALATE';

export interface TerminationPayload {
  readonly type: 'TERMINATION_EVALUATED';
  readonly outcome: TerminationOutcome;
  readonly reason?: string;
}

export interface ExecutionCompletedPayload {
  readonly type: 'EXECUTION_COMPLETED';
  readonly result: ExecutionResult;
  readonly reason?: string;
}
```

### Live snapshot (SSE data shape)

```typescript
export interface ExecutionSnapshot {
  readonly executionId: string;
  readonly state: ExecutionState;
  readonly model: ExecutionModel;
  readonly result?: ExecutionResult;
  readonly activeAgents: readonly AgentRef[];
  readonly completedAgents: readonly AgentResult[];
  readonly iteration?: number;
  readonly startedAt?: string;
  readonly completedAt?: string;
}
```

## 2. Status Registry Domains

Three new domains registered in `blocks-ui-core/src/types/status.ts`.

### `execution` domain (7 states)

| Key | Category | Icon | Extras |
|-----|----------|------|--------|
| `execution:IDLE` | neutral | `○` | |
| `execution:RUNNING` | active | `▶` | pulse, border |
| `execution:WAITING_FOR_AGENT` | warning | `⏳` | border |
| `execution:WAITING_FOR_EVENT` | warning | `⏳` | |
| `execution:COMPLETE` | success | `✓` | |
| `execution:FAULTED` | danger | `!` | pulse |
| `execution:CANCELLED` | neutral | `/` | |

### `agent` domain (4 statuses)

| Key | Category | Icon |
|-----|----------|------|
| `agent:SUCCESS` | success | `✓` |
| `agent:FAILURE` | danger | `✗` |
| `agent:TIMEOUT` | warning | `⌛` |
| `agent:DECLINED` | neutral | `🚫` |

### `pattern` domain (8 types)

| Key | Category | Icon |
|-----|----------|------|
| `pattern:SEQUENCE` | info | `→` |
| `pattern:PARALLEL` | info | `⇉` |
| `pattern:LOOP` | info | `↻` |
| `pattern:CONDITIONAL` | info | `◇` |
| `pattern:SUPERVISOR` | info | `◎` |
| `pattern:DEBATE` | info | `⇌` |
| `pattern:VOTING` | info | `☐` |
| `pattern:HTN` | info | `▦` |

All patterns use `info` category — they describe structure, not state. Icon differentiation is what matters.

## 3. Orchestration Events Timeline Strategy

New file: `blocks-timeline/src/strategies/orchestration-events.ts`

Exports `orchestrationEventsStrategy: TimelineStrategy<OrchestrationAuditEvent[]>`.

### Event-to-node mapping

| EventType | Label | Status | Detail rendering |
|-----------|-------|--------|-----------------|
| `EXECUTION_STARTED` | "Execution started" | `active` | Pattern type, execution model summary |
| `ROUTING_DECISION` | "Routing: {outcome}" | `completed` if SELECTED, `failed` if UNRESOLVABLE/ESCALATE | Selected agents with reasons |
| `ACTIVATION_EVALUATED` | "Activation: {met/unmet}" | `completed` if met, `skipped` if not | Condition expression |
| `AGENT_DISPATCHED` | "Dispatched: {agentName}" | `active` | Agent type badge, ref details |
| `AGENT_RESULT` | "Result: {agentName}" | `completed` | Status badge, duration, detail |
| `AGENT_FAILED` | "Failed: {agentName}" | `failed` | Error message, retry policy status |
| `AGGREGATION_COMPLETED` | "Aggregation: {outcome}" | `completed`/`active`/`failed` | Remaining count for PARTIAL |
| `TERMINATION_EVALUATED` | "Termination: {outcome}" | `completed`/`active`/`failed` | Reason, iteration count |
| `EXECUTION_COMPLETED` | "Execution completed" | from result | Final result, duration |

### Strategy properties

- `defaultLayout: 'vertical'` — decision chains read top-to-bottom
- `filterCategories` mapped to event types:
  - `routing` → `ROUTING_DECISION`
  - `activation` → `ACTIVATION_EVALUATED`
  - `dispatch` → `AGENT_DISPATCHED`, `AGENT_RESULT`, `AGENT_FAILED`
  - `aggregation` → `AGGREGATION_COMPLETED`
  - `termination` → `TERMINATION_EVALUATED`, `EXECUTION_STARTED`, `EXECUTION_COMPLETED`
- `supportsPagination: true` — long orchestrations with many iterations
- `transformData`: identity (expects `OrchestrationAuditEvent[]`)

### Iteration grouping

When `iteration` is present (LOOP/DEBATE patterns), nodes include `category: 'iteration-{n}'` for visual grouping per iteration cycle.

### Detail rendering

Uses `renderDetail` on the strategy with inline styles (per component customisation protocol PP-20260713-8ea1af):
- ROUTING_DECISION: score summary, agent list with type badges
- AGENT_DISPATCHED/RESULT/FAILED: agent type icon + StatusBadge
- AGGREGATION: progress indicator (resolved/remaining)

## 4. Execution Monitor (`components/execution-monitor/`)

Single component `<blocks-execution-monitor>` — SSE-driven live execution state with dual data mode.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `endpoint` | `string` | SSE endpoint base URL |
| `data` | `ExecutionSnapshot` | Inline data (bypasses SSE) |
| `executionId` | `string` | Constructs SSE URL: `${endpoint}/${executionId}/state` |
| `selectionTopic` | `string` | Topic for agent selection events |
| `staleThresholdMs` | `number` | Staleness warning threshold (default 30000) |
| `renderAgent` | `(agent: AgentRef, result?: AgentResult) => TemplateResult \| undefined` | Override agent row rendering |
| `renderModel` | `(model: ExecutionModel) => TemplateResult \| undefined` | Override model section rendering |

### Data flow

- **SSE mode** (`endpoint` + `executionId` set, `data` absent): SSEManager subscribes to `${endpoint}/${executionId}/state`. Handler parses `ExecutionSnapshot` payloads, updates internal `_snapshot` state. Subscribe on `connectedCallback`, unsubscribe on `disconnectedCallback`, teardown+resubscribe on `executionId` change.
- **Inline mode** (`data` set): Renders from `data` property. SSE not activated.

### Rendering layout

```
┌──────────────────────────────────────────┐
│ ● RUNNING          → PARALLEL            │  state badge + pattern badge (StatusBadge)
│ Started 2m 31s ago                       │  elapsed time from startedAt
├──────────────────────────────────────────┤
│ Execution Model                          │
│ Routing: trust-weighted  Agg: majority   │  strategy summary from ExecutionModel
│ Failure: RETRY_BROADER / ESCALATE        │  failure policy summary
├──────────────────────────────────────────┤
│ Agents                            3 / 5  │  completed / total header
│ ┌─ worker-1  [WORKER]    ✓ SUCCESS  1.2s │
│ ├─ worker-2  [WORKER]    ▶ active        │  active agents (no result yet)
│ ├─ channel-3 [CHANNEL]   ✗ FAILURE  0.8s │
│ ├─ human-4   [HUMAN]     ⏳ waiting      │
│ └─ ext-5     [EXTERNAL]  ✓ SUCCESS  3.1s │
├──────────────────────────────────────────┤
│ Iteration 3 of LOOP                     │  only for LOOP/DEBATE patterns
└──────────────────────────────────────────┘
```

When complete, the header shows `ExecutionResult` with a result badge replacing elapsed timer.

### Agent roster

Inline rendering (compact list, not pages-table). Each row: agent name, type badge, result status badge (StatusBadge with `agent` domain), duration if completed. Agent click emits `selectionTopic` event with agent ref.

### Lifecycle

- SSE reconnection via SSEManager (exponential backoff built in)
- Connection status indicator when SSE disconnects
- Staleness warning if no update for `staleThresholdMs` (uses `setInterval` + `disconnectedCallback` cleanup, same approach as blocks-dag-viewer's staleness timer)
- **`executionId` change ordering:** unsubscribe from old SSE URL before subscribing to new one. Reset `_snapshot` to `undefined` between unsubscribe and subscribe to avoid rendering stale state for the wrong execution.

## 5. Orchestration Workbench (`components/orchestration-workbench/`)

Composition shell `<blocks-orchestration-workbench>` — split-workbench with execution-monitor (left) + blocks-timeline with orchestration strategy (right).

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `endpoint` | `string` | Base API endpoint |
| `executionId` | `string` | Target execution |
| `data` | `{ snapshot: ExecutionSnapshot, events: OrchestrationAuditEvent[] }` | Inline data mode |
| `selectionTopic` | `string` | Default: `'orchestration'` |

### Layout

```
┌─────────────────────────┬──────────────────────────────────┐
│   execution-monitor     │   blocks-timeline                │
│   (live state)          │   (orchestration-events strategy) │
│                         │                                  │
│   ● RUNNING  → PARALLEL │   ○ Execution started            │
│   Agents: 3/5           │   ● Routing: SELECTED            │
│   ...                   │   ○ Activation: met              │
│                         │   ● Dispatched: worker-1         │
│                         │   ...                            │
└─────────────────────────┴──────────────────────────────────┘
```

### Coordination

- Agent selection in execution-monitor emits on `selectionTopic`. Timeline scrolls to and highlights events involving that agent.
- Timeline node selection emits back. Execution-monitor highlights the corresponding agent.
- `KeyboardShortcutMixin` for overlay toggle.

### Data flow

- **Endpoint mode:** `${endpoint}/${executionId}/state` → execution-monitor SSE. `${endpoint}/${executionId}/audit-events` → blocks-timeline endpoint.
- **Inline mode:** `data.snapshot` → execution-monitor. `data.events` → blocks-timeline.
- **Temporal note:** The SSE stream (live state) and REST endpoint (audit events) have different latency characteristics. The execution-monitor may show a state transition before the corresponding audit event appears in the timeline. This is expected — the timeline reflects persisted ledger entries, while the monitor reflects in-memory execution state.

### Consumption tiers

1. **Standalone:** `<blocks-orchestration-workbench endpoint="/api" execution-id="abc123">`
2. **Panel-hosted:** `configure({ endpoint, executionId, identity })`
3. **Inline demo:** `<blocks-orchestration-workbench .data=${{ snapshot, events }}>`

## 6. Integration Points

### Routing rationale

ROUTING_DECISION events in the timeline render a summary. For drill-down, the workbench can configure a `renderRoutingDetail` callback that renders `<blocks-routing-rationale>` inline, passing the routing decision payload as its `data` property. Reuses routing-rationale's score bars, candidate table, and policy summary.

### Audit trail viewer

Orchestration events are persisted as ledger entries by `LedgerExecutionListener`. However, the orchestration timeline consumes a dedicated REST endpoint (`/audit-events`) that returns `OrchestrationAuditEvent[]` with typed payloads — not the raw `LedgerEntry` format. Audit-trail-viewer continues to show the raw ledger view with Merkle verification, attestations, and GDPR erasure. The two components show overlapping data from different API perspectives. No changes to audit-trail-viewer needed.

### KPI metric row

No direct coupling. `MetricsListener` produces OTel data feeding KPI endpoints independently. Apps place `kpi-metric-row` alongside the workbench with orchestration metric endpoints (agent latency, failure rate, routing count).

### Status badge consistency

All domain registrations (`execution`, `agent`, `pattern`) use StatusBadge. Any platform component displays execution states via `<status-badge domain="execution" state="RUNNING">` — no orchestration-specific imports beyond blocks-ui-core.

### Side-effect registration

Orchestration domain registrations (30 entries across 3 domains) added to `status.ts` alongside existing domains. Activate on blocks-ui-core import — no separate registration step.

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Separate live monitor + audit timeline | Different data flows (SSE push vs REST pull), independent reuse |
| Timeline strategy (not extending audit-trail-viewer) | Decision chain is a connected sequence, not a flat table. Timeline's vertical layout, node status, detail expansion fit naturally |
| Status registry for all three domains | Consistent with platform pattern. StatusBadge renders everything — zero new badge components. Pattern domain is static metadata (not dynamic status) but StatusBadge handles it correctly — the registry is a lookup table, not a state machine |
| SSEManager (not EventStreamController) | EventStreamController is WebSocket-based (GE-20260806-10d369). SSEManager is the correct SSE primitive |
| Dual data mode on all components | Test harness and demo usage without running backend. Established blocks-ui pattern |
| Types in blocks-ui-core | Cross-cutting: used by execution-monitor, timeline strategy, potentially audit-trail-viewer and kpi-metric-row. Follows commitment/trust type pattern |

## Garden Entries Referenced

- **GE-20260806-10d369** — EventStreamController is WebSocket, not SSE. Use SSEManager.
- **GE-20260806-1f881e** — SSEManager eventNames filters on SSE protocol-level named events, not JSON payload type. Client-side filtering required.
- **GE-20260525-f09688** — CaseHubRuntime.eventLog() WORKER_EXECUTION_COMPLETED events lack workerName. Use WORKER_SCHEDULED for agent identification.

## File Inventory

| File | What |
|------|------|
| `packages/blocks-ui-core/src/types/orchestration.ts` | Domain types |
| `packages/blocks-ui-core/src/types/status.ts` | +30 registry entries (3 domains) |
| `components/blocks-timeline/src/strategies/orchestration-events.ts` | Timeline strategy |
| `components/blocks-timeline/src/strategies/orchestration-events.test.ts` | Strategy tests |
| `components/execution-monitor/package.json` | New component package |
| `components/execution-monitor/tsconfig.json` | TypeScript config |
| `components/execution-monitor/src/execution-monitor.ts` | Main component |
| `components/execution-monitor/src/execution-monitor.test.ts` | Component tests |
| `components/execution-monitor/src/types.ts` | Component-local types (if any) |
| `components/execution-monitor/src/index.ts` | Public exports |
| `components/orchestration-workbench/package.json` | New component package |
| `components/orchestration-workbench/tsconfig.json` | TypeScript config |
| `components/orchestration-workbench/src/orchestration-workbench.ts` | Main component |
| `components/orchestration-workbench/src/orchestration-workbench.test.ts` | Component tests |
| `components/orchestration-workbench/src/index.ts` | Public exports |
