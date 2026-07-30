import type { DebateStreamEntry, Snapshot, BrainstormOptionData, DocEntry } from '@casehubio/blocks-ui-document-workbench';

export const MOCK_ENTRIES: DebateStreamEntry[] = [
  { entryType: 'RAISE', content: 'The retry logic in §3.2 has no backoff — under load this will hammer the downstream service.', round: 1, agentRole: 'REV', timestamp: '2026-07-30T10:00:00Z', pointId: 'pt-1', priority: 'HIGH', scope: 'reliability', location: '§3.2' },
  { entryType: 'COUNTER', content: 'The downstream service has rate limiting. Exponential backoff adds complexity without clear benefit at current scale.', round: 1, agentRole: 'IMP', timestamp: '2026-07-30T10:00:30Z', pointId: 'pt-1' },
  { entryType: 'QUALIFY', content: 'Rate limiting protects the downstream, not us. Without backoff our thread pool saturates on retries. Adding jittered backoff is 5 lines.', round: 1, agentRole: 'REV', timestamp: '2026-07-30T10:01:00Z', pointId: 'pt-1' },
  { entryType: 'AGREE', content: 'Fair point on thread pool saturation. Will add jittered exponential backoff.', round: 1, agentRole: 'IMP', timestamp: '2026-07-30T10:01:30Z', pointId: 'pt-1' },
  { entryType: 'RAISE', content: 'No input validation on the document path parameter — potential path traversal.', round: 1, agentRole: 'REV', timestamp: '2026-07-30T10:02:00Z', pointId: 'pt-2', priority: 'HIGH', scope: 'security', location: '§5.1' },
  { entryType: 'RESTART_CONTEXT', content: '', round: 2, agentRole: 'SUPERVISOR', timestamp: '2026-07-30T10:05:00Z' },
  { entryType: 'RAISE', content: 'The comparison endpoint returns full document content — consider pagination for large files.', round: 2, agentRole: 'REV', timestamp: '2026-07-30T10:05:30Z', pointId: 'pt-3', priority: 'MEDIUM', scope: 'performance', location: '§7' },
  { entryType: 'COMMENT', content: 'Agreed with pt-1 resolution. The backoff implementation looks correct.', round: 2, agentRole: 'HUMAN', timestamp: '2026-07-30T10:06:00Z', pointId: 'pt-1' },
  { entryType: 'HUMAN_OVERRIDE', content: 'Accept pt-2 as-is — path validation already handled by the file API layer.', round: 2, agentRole: 'HUMAN', timestamp: '2026-07-30T10:06:30Z', pointId: 'pt-2' },
];

export const MOCK_SNAPSHOTS: Snapshot[] = [
  { label: 'Initial', round: 0, commitHash: 'abc123', documentPath: 'spec.md' },
  { label: 'Round 1 fixes', round: 1, commitHash: 'def456', documentPath: 'spec.md' },
  { label: 'Round 2 refinement', round: 2, commitHash: 'ghi789', documentPath: 'spec.md' },
];

export const MOCK_DOC_A = `# API Design Specification

## §3.2 Retry Strategy

When a downstream call fails, the client retries up to 3 times
with no delay between attempts.

## §5.1 Document API

The \`/api/file\` endpoint accepts a \`path\` query parameter
and returns the file content as plain text.

## §7 Comparison Endpoint

Returns both documents in full for client-side diffing.
`;

export const MOCK_DOC_B = `# API Design Specification

## §3.2 Retry Strategy

When a downstream call fails, the client retries up to 3 times
with jittered exponential backoff (base 200ms, max 5s).

## §5.1 Document API

The \`/api/file\` endpoint accepts a \`path\` query parameter,
validates it against a configurable root directory, and returns
the file content as plain text.

## §7 Comparison Endpoint

Returns both documents in full for client-side diffing.
Large files (>1MB) are streamed with chunked transfer encoding.
`;

export const MOCK_BRAINSTORM_OPTIONS: BrainstormOptionData[] = [
  { id: 'opt-1', title: 'WebSocket push model', description: 'Server pushes events to all connected clients via WebSocket. Real-time, low latency.', tradeoffs: 'Requires persistent connections. More server memory per client. Connection management complexity.', status: 'RECOMMENDED' },
  { id: 'opt-2', title: 'SSE (Server-Sent Events)', description: 'One-directional server push over HTTP. Simpler than WebSocket, auto-reconnect built in.', tradeoffs: 'One-directional only. Limited browser connections per domain. No binary support.', status: 'ACTIVE' },
  { id: 'opt-3', title: 'Long polling', description: 'Client holds an open HTTP request until server has data. Compatible with all infrastructure.', tradeoffs: 'Higher latency. More HTTP overhead. Scaling requires sticky sessions or shared state.', status: 'ELIMINATED' },
  { id: 'opt-4', title: 'Periodic polling', description: 'Client polls at fixed intervals. Simplest implementation.', tradeoffs: 'High latency (up to interval duration). Wasted requests when no changes. Not suitable for real-time UX.', status: 'ELIMINATED' },
];

export const MOCK_DOCUMENTS: DocEntry[] = [
  { path: '/specs/api-design.md', label: 'API Design Spec' },
  { path: '/specs/api-design-v2.md', label: 'API Design Spec v2' },
  { path: '/specs/data-model.md', label: 'Data Model' },
];
