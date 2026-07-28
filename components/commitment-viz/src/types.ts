import type { CommitmentState, CommitmentRecord, StateCategory } from '@casehubio/blocks-ui-core';

export type { CommitmentState, CommitmentRecord, StateCategory };

export interface DecorableMessage {
  readonly id: string;
  readonly correlationId?: string;
}

export interface TransitionRecord {
  readonly from: CommitmentState;
  readonly to: CommitmentState;
  readonly actor?: string;
  readonly timestamp: string;
}

export interface RangeDecoration {
  readonly correlationId: string;
  readonly state: CommitmentState;
  readonly category: StateCategory;
  readonly startMessageId: string;
  readonly endMessageId?: string;
  readonly messageIds: readonly string[];
}
