export interface LedgerEntry {
  id: string;
  subjectId: string;
  tenancyId: string;
  sequenceNumber: number;
  entryType: string;
  actorId: string | null;
  actorType: string | null;
  actorRole: string | null;
  occurredAt: string;
  digest: string;
  traceId: string | null;
  causedByEntryId: string | null;
  payload: unknown | null;
}

export interface Attestation {
  id: string;
  ledgerEntryId: string;
  subjectId: string;
  attestorId: string;
  attestorType: string;
  verdict: 'SOUND' | 'FLAGGED' | 'ENDORSED' | 'CHALLENGED';
  evidence: unknown;
  confidence: number;
  capabilityTag: string | null;
  occurredAt: string;
}

export interface VerificationResult {
  subjectId: string;
  treeRoot: string;
  verified: boolean;
  redactedCount?: number;
}

export type EntryTypeFilter = 'COMMAND' | 'EVENT' | 'ATTESTATION';
