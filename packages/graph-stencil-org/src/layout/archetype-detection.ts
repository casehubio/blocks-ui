import type { GraphModel, GraphNode, GraphEdge } from '@casehubio/graph-core';

export type ArchetypeName =
  | 'simple-structure'
  | 'hierarchy'
  | 'professional-bureaucracy'
  | 'tiered-escalation'
  | 'divisional-holarchy'
  | 'federation'
  | 'pipeline'
  | 'coalition'
  | 'matrix'
  | 'market';

export type OrgLayoutStrategy =
  | 'star'
  | 'tree'
  | 'circular'
  | 'layered'
  | 'nested'
  | 'hub-spoke'
  | 'flow'
  | 'radial'
  | 'grid'
  | 'force';

export interface ArchetypeHint {
  archetype: ArchetypeName;
  confidence: 'high' | 'medium' | 'low';
  layout: OrgLayoutStrategy;
}

const ARCHETYPE_LAYOUT: Readonly<Record<ArchetypeName, OrgLayoutStrategy>> = {
  'simple-structure': 'star',
  'hierarchy': 'tree',
  'professional-bureaucracy': 'circular',
  'tiered-escalation': 'layered',
  'divisional-holarchy': 'nested',
  'federation': 'hub-spoke',
  'pipeline': 'flow',
  'coalition': 'radial',
  'matrix': 'grid',
  'market': 'radial',
};

function edgesByKind(edges: readonly GraphEdge[]): Map<string, GraphEdge[]> {
  const map = new Map<string, GraphEdge[]>();
  for (const e of edges) {
    const kind = (e.properties?.['kind'] as string | undefined) ?? '';
    let list = map.get(kind);
    if (!list) {
      list = [];
      map.set(kind, list);
    }
    list.push(e);
  }
  return map;
}

function supervisesTreeDepth(edges: readonly GraphEdge[]): number {
  const supervises = edges.filter(e => e.properties?.['kind'] === 'SUPERVISES');
  if (supervises.length === 0) return 0;

  const children = new Map<string, string[]>();
  const allTargets = new Set<string>();
  for (const e of supervises) {
    let list = children.get(e.source);
    if (!list) {
      list = [];
      children.set(e.source, list);
    }
    list.push(e.target);
    allTargets.add(e.target);
  }

  const roots = [...children.keys()].filter(k => !allTargets.has(k));
  if (roots.length === 0) return 1;

  function depth(nodeId: string): number {
    const kids = children.get(nodeId);
    if (!kids || kids.length === 0) return 1;
    let max = 0;
    for (const kid of kids) {
      const d = depth(kid);
      if (d > max) max = d;
    }
    return 1 + max;
  }

  let maxDepth = 0;
  for (const root of roots) {
    const d = depth(root);
    if (d > maxDepth) maxDepth = d;
  }
  return maxDepth;
}

function isLinearDelegatesToChain(edges: readonly GraphEdge[]): boolean {
  const delegates = edges.filter(e => e.properties?.['kind'] === 'DELEGATES_TO');
  if (delegates.length < 2) return false;

  const sourceCount = new Map<string, number>();
  const targetCount = new Map<string, number>();
  for (const e of delegates) {
    sourceCount.set(e.source, (sourceCount.get(e.source) ?? 0) + 1);
    targetCount.set(e.target, (targetCount.get(e.target) ?? 0) + 1);
  }

  for (const count of sourceCount.values()) {
    if (count > 1) return false;
  }
  for (const count of targetCount.values()) {
    if (count > 1) return false;
  }

  const reportsBack = edges.some(e => e.properties?.['kind'] === 'REPORTS_TO');
  if (reportsBack) return false;

  return true;
}

function hasMultiUnitAgents(nodes: readonly GraphNode[]): boolean {
  const agentUnits = new Map<string, Set<string>>();
  for (const n of nodes) {
    if (n.type !== 'org-agent') continue;
    const agentId = n.properties['agentId'] as string;
    const unitId = n.properties['unitId'] as string;
    let units = agentUnits.get(agentId);
    if (!units) {
      units = new Set();
      agentUnits.set(agentId, units);
    }
    units.add(unitId);
  }
  for (const units of agentUnits.values()) {
    if (units.size > 1) return true;
  }
  return false;
}

function hasNestedUnits(nodes: readonly GraphNode[]): boolean {
  return nodes.some(n => n.type === 'org-unit' && n.parentId !== undefined);
}

export function detectArchetype(model: GraphModel): ArchetypeHint {
  const { nodes, edges } = model;

  if (edges.length === 0) {
    return { archetype: 'simple-structure', confidence: 'low', layout: 'force' };
  }

  const byKind = edgesByKind(edges);

  // Priority 1: market — EXTENDED("bids-to")
  const extended = byKind.get('EXTENDED') ?? [];
  if (extended.some(e => e.properties?.['extendedKind'] === 'bids-to')) {
    return { archetype: 'market', confidence: 'high', layout: ARCHETYPE_LAYOUT['market'] };
  }

  // Priority 2: matrix — multi-unit agents
  if (hasMultiUnitAgents(nodes)) {
    return { archetype: 'matrix', confidence: 'high', layout: ARCHETYPE_LAYOUT['matrix'] };
  }

  // Priority 3: divisional-holarchy — nested units
  if (hasNestedUnits(nodes)) {
    return { archetype: 'divisional-holarchy', confidence: 'high', layout: ARCHETYPE_LAYOUT['divisional-holarchy'] };
  }

  // Priority 4: tiered-escalation — ESCALATES_TO with tier patterns
  const escalates = byKind.get('ESCALATES_TO') ?? [];
  if (escalates.length >= 2) {
    return { archetype: 'tiered-escalation', confidence: 'high', layout: ARCHETYPE_LAYOUT['tiered-escalation'] };
  }

  // Priority 5: pipeline — linear DELEGATES_TO chain
  if (isLinearDelegatesToChain(edges)) {
    return { archetype: 'pipeline', confidence: 'high', layout: ARCHETYPE_LAYOUT['pipeline'] };
  }

  // Priority 6: federation — one node DELEGATES_TO many + REPORTS_TO back
  const delegatesTo = byKind.get('DELEGATES_TO') ?? [];
  const reportsTo = byKind.get('REPORTS_TO') ?? [];
  if (delegatesTo.length >= 2 && reportsTo.length >= 2) {
    const delegateSources = new Map<string, number>();
    for (const e of delegatesTo) {
      delegateSources.set(e.source, (delegateSources.get(e.source) ?? 0) + 1);
    }
    const hasHub = [...delegateSources.values()].some(c => c >= 2);
    if (hasHub) {
      return { archetype: 'federation', confidence: 'high', layout: ARCHETYPE_LAYOUT['federation'] };
    }
  }

  // Priority 7: coalition — multiple REPORTS_TO converging, no SUPERVISES
  const supervises = byKind.get('SUPERVISES') ?? [];
  if (reportsTo.length >= 2 && supervises.length === 0) {
    return { archetype: 'coalition', confidence: 'medium', layout: ARCHETYPE_LAYOUT['coalition'] };
  }

  // Priority 8: hierarchy — SUPERVISES tree depth > 2
  if (supervisesTreeDepth(edges) > 2) {
    return { archetype: 'hierarchy', confidence: 'high', layout: ARCHETYPE_LAYOUT['hierarchy'] };
  }

  // Priority 9: simple-structure — all SUPERVISES from one source, flat
  if (supervises.length > 0) {
    const sources = new Set(supervises.map(e => e.source));
    if (sources.size === 1) {
      return { archetype: 'simple-structure', confidence: 'high', layout: ARCHETYPE_LAYOUT['simple-structure'] };
    }
  }

  // Priority 10: professional-bureaucracy — only BACKS_UP, no SUPERVISES
  const backsUp = byKind.get('BACKS_UP') ?? [];
  if (backsUp.length > 0 && supervises.length === 0) {
    return { archetype: 'professional-bureaucracy', confidence: 'medium', layout: ARCHETYPE_LAYOUT['professional-bureaucracy'] };
  }

  return { archetype: 'simple-structure', confidence: 'low', layout: 'force' };
}
