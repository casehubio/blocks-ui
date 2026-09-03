import type { TabDefinition } from '@casehubio/blocks-ui-detail-pane';

export type { TabDefinition };

export interface WorkspaceDefinition {
  capabilityTag: string;
  tagName: string;
  label?: string;
  icon?: string;
}

export interface WorkerTaskResponse {
  taskId: string;
  capabilityTag: string;
  caseId: string;
  assigneeId?: string;
  dispatchedAt: string;
  commandParams: Record<string, unknown>;
  investigationSummary: Record<string, unknown>;
}

export interface WorkerTaskSubmission {
  type: 'RESPONSE' | 'DONE' | 'DECLINE';
  taskId: string;
  result?: {
    fields: Record<string, unknown>;
    confidence: number;
  };
  declineReason?: string;
  declineDetail?: string;
}

export interface WorkerTaskClaimRequest {
  taskId: string;
}

export interface WorkerTaskContext {
  taskId: string;
  capabilityTag: string;
  caseId: string;
  commandParams: Record<string, unknown>;
  investigationSummary: Record<string, unknown>;
}

export interface WorkspaceResultEvent extends CustomEvent {
  detail: {
    fields: Record<string, unknown>;
    confidence: number;
  };
}

export const WorkerTaskEventTopics = {
  SELECTED: 'worker-task:selected',
  DESELECTED: 'worker-task:deselected',
  CLAIMED: 'worker-task:claimed',
  RESPONDED: 'worker-task:responded',
  DECLINED: 'worker-task:declined',
} as const;
