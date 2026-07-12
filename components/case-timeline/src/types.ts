/**
 * Case event types from casehub-engine event log
 */
export type CaseHubEventType =
  // Case lifecycle
  | 'CASE_STARTED'
  | 'CASE_COMPLETED'
  | 'CASE_FAULTED'
  | 'CASE_CANCELLED'
  | 'CASE_SUSPENDED'
  | 'CASE_RESUMED'

  // Tasks
  | 'TASK_CREATED'
  | 'TASK_ACTIVATED'
  | 'TASK_CLAIMED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'TASK_CANCELLED'

  // Agent activity
  | 'AGENT_ROUTED'
  | 'AGENT_DISPATCHED'
  | 'AGENT_COMPLETED'
  | 'AGENT_FAILED'
  | 'AGENT_TIMEOUT'

  // Milestones
  | 'MILESTONE_REACHED'
  | 'MILESTONE_ACTIVATED'
  | 'MILESTONE_COMPLETED'
  | 'MILESTONE_FAILED'
  | 'SLA_VIOLATED'

  // Action gates
  | 'ACTION_GATE_PENDING'
  | 'ACTION_GATE_APPROVED'
  | 'ACTION_GATE_REJECTED'
  | 'ACTION_GATE_TIMEOUT'

  // Orchestration
  | 'ORCHESTRATION_STARTED'
  | 'ORCHESTRATION_COMPLETED'
  | 'ORCHESTRATION_ESCALATED'
  | 'ORCHESTRATION_FAILED'

  // Timers
  | 'TIMER_SCHEDULED'
  | 'TIMER_FIRED'
  | 'TIMER_CANCELLED';

/**
 * Event stream categorization
 */
export type EventStreamType = 'CASE' | 'WORKER' | 'TIMER' | 'SYSTEM' | 'ORCHESTRATION';

/**
 * Case event from EventLog API
 */
export interface CaseEvent {
  eventType: CaseHubEventType;
  streamType: EventStreamType;
  timestamp: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Backend response format (paginated)
 */
export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/**
 * Backend EventLogEntry response
 */
export interface EventLogEntryResponse {
  eventType: CaseHubEventType;
  streamType: EventStreamType;
  timestamp: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Node category for rendering (maps event types to visual style)
 */
export type NodeCategory =
  | 'lifecycle'
  | 'task'
  | 'agent'
  | 'milestone'
  | 'action-gate'
  | 'orchestration'
  | 'timer';

/**
 * Map event type to node category
 */
export function categorizeEvent(eventType: CaseHubEventType): NodeCategory {
  if (eventType.startsWith('CASE_')) return 'lifecycle';
  if (eventType.startsWith('TASK_')) return 'task';
  if (eventType.startsWith('AGENT_')) return 'agent';
  if (eventType.startsWith('MILESTONE_') || eventType === 'SLA_VIOLATED') return 'milestone';
  if (eventType.startsWith('ACTION_GATE_')) return 'action-gate';
  if (eventType.startsWith('ORCHESTRATION_')) return 'orchestration';
  if (eventType.startsWith('TIMER_')) return 'timer';
  return 'lifecycle';
}

/**
 * Determine if event should be shown in compact mode
 * (lifecycle + milestones only)
 */
export function isCompactModeEvent(eventType: CaseHubEventType): boolean {
  const category = categorizeEvent(eventType);
  return category === 'lifecycle' || category === 'milestone';
}
