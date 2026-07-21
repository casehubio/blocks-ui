import type { CommitmentState } from './types.js';

export interface RawCommitment {
  id: string;
  correlationId: string;
  state: string;
  requester?: string;
  obligor?: string;
  expiresAt?: string | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  createdAt?: string | null;
}

export interface CommitmentRecord {
  readonly state: CommitmentState;
  readonly deadline?: string;
  readonly acknowledgedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toCommitmentRecord(raw: RawCommitment): CommitmentRecord {
  const timestamps = [raw.resolvedAt, raw.acknowledgedAt, raw.createdAt]
    .filter((t): t is string => t != null);
  const updatedAt = timestamps.length > 0
    ? timestamps.reduce((a, b) => a > b ? a : b)
    : raw.createdAt ?? new Date().toISOString();

  return {
    state: raw.state as CommitmentState,
    ...(raw.expiresAt != null ? { deadline: raw.expiresAt } : {}),
    ...(raw.acknowledgedAt != null ? { acknowledgedAt: raw.acknowledgedAt } : {}),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt,
  };
}

export function toCommitmentMap(
  commitments: RawCommitment[]
): Map<string, CommitmentRecord> {
  const map = new Map<string, CommitmentRecord>();
  for (const c of commitments) {
    map.set(c.correlationId, toCommitmentRecord(c));
  }
  return map;
}
