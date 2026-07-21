import type { RoutingRationaleData, CandidateScore } from '@casehubio/blocks-ui-routing-rationale';
import type { GateDecision } from '@casehubio/blocks-ui-trust-feedback-display';
import type { TableColumnConfig, ColumnRenderer } from '@casehubio/pages-table';
import type { ColumnId } from '@casehubio/pages-data/dist/dataset/types.js';
import type { TemplateResult } from 'lit';

export type { RoutingRationaleData, CandidateScore, GateDecision };

export interface RoutingDecisionSummary {
  readonly id: string;
  readonly timestamp: string;
  readonly capabilityTag: string;
  readonly selectedWorkerId: string;
  readonly finalScore: number;
  readonly phase: CandidateScore['phase'];
}

export interface RoutingDecisionDetail {
  readonly rationale: RoutingRationaleData;
  readonly feedback: readonly GateDecision[];
}

export interface TrustWorkbenchConfig {
  readonly routingColumns?: readonly TableColumnConfig[];
  readonly routingColumnRenderers?: ReadonlyMap<ColumnId, ColumnRenderer>;
  readonly renderCandidate?: (candidate: CandidateScore) => TemplateResult | undefined;
}
