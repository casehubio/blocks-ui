import type { NodeDecoration } from '@casehubio/graph-core';

const ACTIVE_STATES = new Set(['PENDING', 'RUNNING', 'DELEGATED', 'SUSPENDED']);

export function isActiveStatus(status: string): boolean {
  return ACTIVE_STATES.has(status);
}

export const TASK_STATUS_DECORATIONS: Record<string, NodeDecoration> = {
  PENDING:   { badge: { icon: '○', color: '#9ca3af' } },
  RUNNING:   { badge: { icon: '▶', color: '#22c55e', pulse: true }, border: { style: 'solid', color: '#22c55e' } },
  DELEGATED: { badge: { icon: '→', color: '#3b82f6' }, border: { style: 'solid', color: '#3b82f6' } },
  SUSPENDED: { badge: { icon: '⏸', color: '#eab308' }, border: { style: 'solid', color: '#eab308' } },
  COMPLETED: { badge: { icon: '✓', color: '#22c55e' } },
  FAULTED:   { badge: { icon: '!', color: '#ef4444' } },
  REJECTED:  { badge: { icon: '✕', color: '#f97316' } },
  OBSOLETE:  { badge: { icon: '—', color: '#9ca3af' } },
  CANCELLED: { badge: { icon: '/', color: '#9ca3af' } },
};

export const MILESTONE_STATUS_DECORATIONS: Record<string, NodeDecoration> = {
  PENDING:   { badge: { icon: '○', color: '#9ca3af' } },
  ACTIVE:    { badge: { icon: '◉', color: '#3b82f6', pulse: true } },
  COMPLETED: { badge: { icon: '✓', color: '#22c55e' } },
};

export const UNKNOWN_DECORATION: NodeDecoration = {
  badge: { icon: '?', color: '#9ca3af' },
};

export const TERMINAL_SEVERITY: Record<string, number> = {
  COMPLETED: 1,
  OBSOLETE: 2,
  CANCELLED: 3,
  REJECTED: 4,
  FAULTED: 5,
};

export const ACTIVE_WORST_PRIORITY: Record<string, number> = {
  PENDING: 1,
  RUNNING: 2,
  DELEGATED: 3,
  SUSPENDED: 4,
};
