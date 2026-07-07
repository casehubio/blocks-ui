import type { QueueView } from './work-item.js';

// Event helpers — canonical implementations live in @casehubio/pages-component
export { emitPagesEvent, onPagesEvent, type PagesEventDetail } from '@casehubio/pages-component';

// Navigation event topics (pages-events handle navigation only, not data state)
export const WorkItemEventTopics = {
  SELECTED: 'work-item.selected',
  DESELECTED: 'work-item.deselected',
  QUEUE_SCOPE_CHANGED: 'queue.scope-changed',
} as const;

export interface WorkItemSelectedPayload {
  readonly workItemId: string;
}

export interface QueueScopeChangedPayload {
  readonly queue: QueueView | null;
}
