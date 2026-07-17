import { html, nothing } from 'lit';
import { renderPropertyTree } from '@casehubio/blocks-ui-core';
import type { TimelineNode, TimelineStrategy, PaginationMeta } from '../types.js';

export type CaseHubEventType =
  | 'CASE_STARTED' | 'CASE_COMPLETED' | 'CASE_FAULTED' | 'CASE_CANCELLED' | 'CASE_SUSPENDED' | 'CASE_RESUMED'
  | 'TASK_CREATED' | 'TASK_ACTIVATED' | 'TASK_CLAIMED' | 'TASK_COMPLETED' | 'TASK_FAILED' | 'TASK_CANCELLED'
  | 'AGENT_ROUTED' | 'AGENT_DISPATCHED' | 'AGENT_COMPLETED' | 'AGENT_FAILED' | 'AGENT_TIMEOUT'
  | 'MILESTONE_REACHED' | 'MILESTONE_ACTIVATED' | 'MILESTONE_COMPLETED' | 'MILESTONE_FAILED' | 'SLA_VIOLATED'
  | 'ACTION_GATE_PENDING' | 'ACTION_GATE_APPROVED' | 'ACTION_GATE_REJECTED' | 'ACTION_GATE_TIMEOUT'
  | 'ORCHESTRATION_STARTED' | 'ORCHESTRATION_COMPLETED' | 'ORCHESTRATION_ESCALATED' | 'ORCHESTRATION_FAILED'
  | 'TIMER_SCHEDULED' | 'TIMER_FIRED' | 'TIMER_CANCELLED';

export type EventStreamType = 'CASE' | 'WORKER' | 'TIMER' | 'SYSTEM' | 'ORCHESTRATION';

export type NodeCategory = 'lifecycle' | 'task' | 'agent' | 'milestone' | 'action-gate' | 'orchestration' | 'timer';

export interface CaseEvent {
  eventType: string;
  streamType: string;
  timestamp: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

export interface EventLogEntryResponse {
  eventType: CaseHubEventType;
  streamType: EventStreamType;
  timestamp: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

const DEFAULT_STREAM_TYPES: string[] = ['CASE', 'WORKER', 'ORCHESTRATION', 'TIMER', 'SYSTEM'];

export function categorizeEvent(eventType: string): NodeCategory {
  if (eventType.startsWith('CASE_')) return 'lifecycle';
  if (eventType.startsWith('TASK_')) return 'task';
  if (eventType.startsWith('AGENT_')) return 'agent';
  if (eventType.startsWith('MILESTONE_') || eventType === 'SLA_VIOLATED') return 'milestone';
  if (eventType.startsWith('ACTION_GATE_')) return 'action-gate';
  if (eventType.startsWith('ORCHESTRATION_')) return 'orchestration';
  if (eventType.startsWith('TIMER_')) return 'timer';
  return 'lifecycle';
}

export function isCompactModeEvent(eventType: string): boolean {
  const category = categorizeEvent(eventType);
  return category === 'lifecycle' || category === 'milestone';
}

function isPagedResponse(data: unknown): data is PagedResponse<CaseEvent> {
  return data != null && typeof data === 'object' && 'content' in data && Array.isArray((data as PagedResponse<CaseEvent>).content);
}

export function eventChronologyStrategy(options?: {
  categorize?: (eventType: string) => string;
  streamTypes?: string[];
}): TimelineStrategy<CaseEvent[]> {
  const cat = options?.categorize ?? categorizeEvent;

  return {
    toNodes(data: CaseEvent[]): TimelineNode[] {
      return data.map((event, i) => ({
        key: `event-${i}`,
        label: event.eventType.replace(/_/g, ' '),
        status: 'completed' as const,
        timestamp: event.timestamp,
        actor: event.metadata?.workerName as string | undefined,
        detail: event,
        category: event.streamType,
      }));
    },
    transformData(raw: unknown): CaseEvent[] {
      if (isPagedResponse(raw)) return raw.content;
      return raw as CaseEvent[];
    },
    renderNode(node: TimelineNode) {
      const event = node.detail as CaseEvent | undefined;
      const eventCategory = event ? cat(event.eventType) : 'lifecycle';
      return html`<span class="event-type-badge ${eventCategory}">${node.label}</span>`;
    },
    renderDetail(node: TimelineNode) {
      const event = node.detail as CaseEvent | undefined;
      return html`${renderPropertyTree(event?.payload)}`;
    },
    defaultLayout: 'vertical',
    filterCategories: options?.streamTypes ?? DEFAULT_STREAM_TYPES,
    supportsPagination: true,
    extractPaginationMeta(raw: unknown): PaginationMeta | undefined {
      if (isPagedResponse(raw)) {
        return { page: raw.page, totalPages: raw.totalPages, totalElements: raw.totalElements };
      }
      return undefined;
    },
  };
}
