export type TaskStatus = 'PENDING' | 'RUNNING' | 'DELEGATED' | 'SUSPENDED'
  | 'COMPLETED' | 'FAULTED' | 'REJECTED' | 'OBSOLETE' | 'CANCELLED';

export type MilestoneLifecycleStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED';

export interface PlanItemSnapshot {
  readonly id: string;
  readonly bindingName: string;
  readonly status: TaskStatus;
  readonly createdAt: string;
}

export interface MilestoneSnapshot {
  readonly name: string;
  readonly status: MilestoneLifecycleStatus;
}

export interface CaseRuntimeState {
  readonly planItems: readonly PlanItemSnapshot[];
  readonly milestones: readonly MilestoneSnapshot[];
  readonly timestamp: string;
  readonly caseStatus?: string;
}
