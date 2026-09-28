export const EvolutionEventTopics = {
  DENY_PATTERN_CHANGED: 'evolution:deny-pattern-changed',
  WATCH_PATTERN_CHANGED: 'evolution:watch-pattern-changed',
  GATE_POLICY_CHANGED: 'evolution:gate-policy-changed',
  GATE_RESOLVED: 'evolution:gate-resolved',
  STREAM_CHANGED: 'evolution:stream-changed',
} as const;

export function emitEvolutionEvent<T>(target: EventTarget, topic: string, payload: T): void {
  target.dispatchEvent(new CustomEvent('pages-event', {
    bubbles: true, composed: true,
    detail: { topic, payload },
  }));
}
