import type { NodeDecoration } from '@casehubio/graph-core';
import type { CaseRuntimeState, PlanItemSnapshot } from './types.js';
import {
  TASK_STATUS_DECORATIONS,
  MILESTONE_STATUS_DECORATIONS,
  UNKNOWN_DECORATION,
  TERMINAL_SEVERITY,
  ACTIVE_WORST_PRIORITY,
  isActiveStatus,
} from './badge-mappings.js';

function aggregateBinding(items: readonly PlanItemSnapshot[]): NodeDecoration {
  const activeItems = items.filter(i => isActiveStatus(i.status));
  const count = items.length > 1 ? items.length : undefined;

  let statusKey: string;

  if (activeItems.length > 0) {
    statusKey = activeItems.reduce((worst, item) =>
      (ACTIVE_WORST_PRIORITY[item.status] ?? 0) > (ACTIVE_WORST_PRIORITY[worst.status] ?? 0) ? item : worst,
    ).status;
  } else {
    const sorted = [...items].sort((a, b) => {
      const timeDiff = b.createdAt.localeCompare(a.createdAt);
      if (timeDiff !== 0) return timeDiff;
      return (TERMINAL_SEVERITY[b.status] ?? 0) - (TERMINAL_SEVERITY[a.status] ?? 0);
    });
    statusKey = sorted[0]!.status;
  }

  const base = TASK_STATUS_DECORATIONS[statusKey] ?? UNKNOWN_DECORATION;
  const tooltip = buildTooltip(items);

  return {
    ...base,
    badge: count !== undefined ? { ...base.badge!, count } : { ...base.badge! },
    tooltip,
  };
}

function buildTooltip(items: readonly PlanItemSnapshot[]): string {
  if (items.length === 1) {
    return items[0]!.status.toLowerCase();
  }
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item.status.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const parts = Array.from(counts.entries()).map(([status, n]) => `${n} ${status}`);
  return `${items.length} plan items: ${parts.join(', ')}`;
}

export function toDecorations(state: CaseRuntimeState): ReadonlyMap<string, NodeDecoration> {
  const decorations = new Map<string, NodeDecoration>();

  const byBinding = new Map<string, PlanItemSnapshot[]>();
  for (const item of state.planItems) {
    const list = byBinding.get(item.bindingName);
    if (list) {
      list.push(item);
    } else {
      byBinding.set(item.bindingName, [item]);
    }
  }

  for (const [bindingName, items] of byBinding) {
    decorations.set(`binding:${bindingName}`, aggregateBinding(items));
  }

  for (const milestone of state.milestones) {
    const base = MILESTONE_STATUS_DECORATIONS[milestone.status] ?? UNKNOWN_DECORATION;
    decorations.set(`milestone:${milestone.name}`, { ...base, tooltip: milestone.status.toLowerCase() });
  }

  return decorations;
}
