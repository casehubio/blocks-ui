import type { QueueView } from './work-item.js';

export interface PagesEventDetail<T = unknown> {
  readonly topic: string;
  readonly payload: T;
}

export function emitPagesEvent<T>(target: EventTarget, topic: string, payload: T): void {
  target.dispatchEvent(
    new CustomEvent<PagesEventDetail<T>>('pages-event', {
      bubbles: true,
      composed: true,
      detail: { topic, payload },
    }),
  );
}

export function onPagesEvent<T>(
  target: EventTarget,
  topic: string,
  handler: (payload: T) => void,
): () => void {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<PagesEventDetail<T>>).detail;
    if (detail.topic === topic) handler(detail.payload);
  };
  target.addEventListener('pages-event', listener);
  return () => target.removeEventListener('pages-event', listener);
}

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
