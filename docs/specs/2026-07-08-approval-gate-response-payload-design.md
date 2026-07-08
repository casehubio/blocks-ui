# Approval Gate Response Payload — Design Spec

**Issue:** #40
**Date:** 2026-07-08
**Status:** Approved

## Problem

The `<approval-gate>` component's `_submitDecision` method sends a PUT to
complete a gate decision but discards the HTTP response body. The `gate.decided`
event carries only client-side data (`gateId`, `outcome`, `resolution`).
Consumers needing post-decision server data (trust score delta, attestation
results, governance context) must make a separate fetch.

Additionally, HTTP error responses discard their body — the user sees "HTTP 409"
instead of a meaningful server error message like "Gate already completed by
another voter."

## Design

### Typed event payload

Define a typed payload interface co-located with `ApprovalGateTopics` in
`approval-gate.ts`:

```typescript
export interface GateDecidedPayload {
  readonly gateId: string;
  readonly outcome: string;
  readonly resolution?: string;
  readonly serverData: unknown;
}
```

`serverData` is typed as `unknown` because the component's `endpoint` is
configurable — different backends (clinical SUSAR gate, AML SAR gate) return
domain-enriched responses beyond `WorkItemResponse`.

### Success path — include server data in event

After the `response.ok` check, parse the body with a catch fallback:

```typescript
const serverData: unknown = await response.json().catch(() => null);
```

Include it in the event payload:

```typescript
emitPagesEvent(this, ApprovalGateTopics.DECIDED, {
  gateId: this.gateId,
  outcome: outcomeKey,
  resolution,
  serverData,
} satisfies GateDecidedPayload);
```

- `serverData` is always present — `null` when body can't be parsed
- No Content-Type checking — try/catch handles 204, empty body, non-JSON
- Event always fires on HTTP success — server data is supplementary
- Backward compatible — existing consumers destructure only known fields

### Error path — use server error messages

Replace the bare `throw new Error(`HTTP ${response.status}`)` with:

```typescript
const errorBody: unknown = await response.json().catch(() => null);
const serverMessage =
  errorBody !== null && typeof errorBody === 'object' && !Array.isArray(errorBody)
    ? (errorBody as Record<string, unknown>).error ?? (errorBody as Record<string, unknown>).message
    : null;
throw new Error(
  typeof serverMessage === 'string' && serverMessage
    ? serverMessage
    : `HTTP ${response.status}`
);
```

Precedence: `body.error` → `body.message` → `HTTP ${status}` fallback.
No new UI — existing error rendering and screen reader announce handle it.

## Test plan

1. Success with JSON body → `serverData` field contains parsed data
2. Success with empty/non-JSON body → `serverData` is `null`, event still fires
3. HTTP error with JSON error body → error message uses `error` field from server
4. HTTP error with JSON body using `message` field → error message uses `message`
5. HTTP error with no parseable body → falls back to `HTTP ${status}`
6. HTTP error with JSON array body → falls back to `HTTP ${status}`
7. HTTP error with `{ "error": "" }` → falls back to `HTTP ${status}`
8. Existing tests continue to pass (backward compat)

## Scope

Two changes in `_submitDecision`:
1. Parse and include response body in `gate.decided` event payload
2. Parse error response body for human-readable error messages

One new export:
- `GateDecidedPayload` interface from `approval-gate.ts`

No new UI, no new properties, no new events.
