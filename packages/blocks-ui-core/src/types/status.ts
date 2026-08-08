export type StateCategory = 'active' | 'info' | 'success' | 'danger'
  | 'neutral' | 'transfer' | 'warning';

export interface StatusDescriptor {
  readonly category: StateCategory;
  readonly icon: string;
  readonly label?: string;
  readonly pulse?: boolean;
  readonly border?: boolean;
}

export const FALLBACK_DESCRIPTOR: StatusDescriptor = { category: 'neutral', icon: '?' };

const REGISTRY = new Map<string, StatusDescriptor>([
  ['*:PENDING',    { category: 'neutral', icon: '○' }],
  ['*:RUNNING',    { category: 'success', icon: '▶', pulse: true, border: true }],
  ['*:COMPLETED',  { category: 'success', icon: '✓' }],
  ['*:FAULTED',    { category: 'danger',  icon: '!' }],
  ['*:CANCELLED',  { category: 'neutral', icon: '/' }],
  ['*:SUSPENDED',  { category: 'warning', icon: '⏸', border: true }],

  ['case:STARTING', { category: 'info',    icon: '◐' }],
  ['case:WAITING',  { category: 'warning', icon: '⏳' }],

  ['task:DELEGATED', { category: 'info',    icon: '→', border: true }],
  ['task:REJECTED',  { category: 'warning', icon: '✕' }],
  ['task:OBSOLETE',  { category: 'neutral', icon: '—' }],

  ['work:DECLINED', { category: 'neutral', icon: '🚫' }],
  ['work:FAILED',   { category: 'danger',  icon: '✗' }],
  ['work:EXPIRED',  { category: 'warning', icon: '⌛' }],

  ['workitem:ASSIGNED',    { category: 'info',    icon: '●' }],
  ['workitem:IN_PROGRESS', { category: 'active',  icon: '◐', border: true }],
  ['workitem:DELEGATED',   { category: 'info',    icon: '→', border: true }],
  ['workitem:REJECTED',    { category: 'warning', icon: '✕' }],
  ['workitem:ESCALATED',   { category: 'warning', icon: '↑' }],
  ['workitem:OBSOLETE',    { category: 'neutral', icon: '—' }],
  ['workitem:EXPIRED',     { category: 'warning', icon: '⌛' }],

  ['milestone:ACTIVE', { category: 'info', icon: '◉', pulse: true }],

  ['outcome:SUCCESS',   { category: 'success', icon: '✓' }],
  ['outcome:DECLINED',  { category: 'neutral', icon: '🚫' }],
  ['outcome:FAILED',    { category: 'danger',  icon: '✗' }],
  ['outcome:EXPIRED',   { category: 'warning', icon: '⌛' }],
  ['outcome:ESCALATED', { category: 'warning', icon: '↑' }],
  ['outcome:COMPLETED', { category: 'success', icon: '✓' }],

  ['group:IN_PROGRESS', { category: 'active',  icon: '◐' }],
  ['group:COMPLETED',   { category: 'success', icon: '✓' }],
  ['group:REJECTED',    { category: 'danger',  icon: '✕' }],

  ['sla:NOT_STARTED', { category: 'neutral', icon: '○' }],
  ['sla:ON_TRACK',    { category: 'success', icon: '✓' }],
  ['sla:BREACHED',    { category: 'danger',  icon: '!', pulse: true }],

  ['node:DISPATCHED', { category: 'info',    icon: '→' }],
  ['node:SKIPPED',    { category: 'neutral', icon: '⏭' }],
  ['node:FAILED',     { category: 'danger',  icon: '✗' }],

  ['session:ACTIVE',  { category: 'success', icon: '▶' }],
  ['session:WAITING', { category: 'warning', icon: '⏳' }],
  ['session:IDLE',    { category: 'neutral', icon: '○' }],

  ['commitment:OPEN',         { category: 'active',   icon: '⏳' }],
  ['commitment:ACKNOWLEDGED', { category: 'info',     icon: '📋' }],
  ['commitment:FULFILLED',    { category: 'success',  icon: '✓' }],
  ['commitment:FAILED',       { category: 'danger',   icon: '✗' }],
  ['commitment:DECLINED',     { category: 'neutral',  icon: '🚫' }],
  ['commitment:DELEGATED',    { category: 'transfer', icon: '↳' }],
  ['commitment:EXPIRED',      { category: 'warning',  icon: '⌛' }],

  ['execution:IDLE',              { category: 'neutral', icon: '○' }],
  ['execution:RUNNING',           { category: 'active',  icon: '▶', pulse: true, border: true }],
  ['execution:WAITING_FOR_AGENT', { category: 'warning', icon: '⏳', border: true }],
  ['execution:WAITING_FOR_EVENT', { category: 'warning', icon: '⏳' }],
  ['execution:COMPLETE',          { category: 'success', icon: '✓' }],
  ['execution:FAULTED',           { category: 'danger',  icon: '!', pulse: true }],
  ['execution:CANCELLED',         { category: 'neutral', icon: '/' }],

  ['agent:SUCCESS',  { category: 'success', icon: '✓' }],
  ['agent:FAILURE',  { category: 'danger',  icon: '✗' }],
  ['agent:TIMEOUT',  { category: 'warning', icon: '⌛' }],
  ['agent:DECLINED', { category: 'neutral', icon: '🚫' }],

  ['pattern:SEQUENCE',    { category: 'info', icon: '→' }],
  ['pattern:PARALLEL',    { category: 'info', icon: '⇉' }],
  ['pattern:LOOP',        { category: 'info', icon: '↻' }],
  ['pattern:CONDITIONAL', { category: 'info', icon: '◇' }],
  ['pattern:SUPERVISOR',  { category: 'info', icon: '◎' }],
  ['pattern:DEBATE',      { category: 'info', icon: '⇌' }],
  ['pattern:VOTING',      { category: 'info', icon: '☐' }],
  ['pattern:HTN',         { category: 'info', icon: '▦' }],
]);

export function registerStatus(domain: string, state: string, descriptor: StatusDescriptor): void {
  REGISTRY.set(`${domain}:${state}`, descriptor);
}

export function lookupStatus(domain: string | undefined, state: string): StatusDescriptor {
  if (domain) {
    const exact = REGISTRY.get(`${domain}:${state}`);
    if (exact) return exact;
  }
  return REGISTRY.get(`*:${state}`) ?? FALLBACK_DESCRIPTOR;
}
