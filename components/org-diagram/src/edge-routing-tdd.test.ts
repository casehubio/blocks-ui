import { describe, it, expect } from 'vitest';
import { toOrgGraph, orgLayoutOptions, detectArchetype, registerOrgStencils } from '@casehubio/graph-stencil-org';
import { computeElkLayout } from '@casehubio/graph-renderer/layout/elk-layout.js';
import type { ElkLayoutOptions } from '@casehubio/graph-renderer/layout/elk-layout.js';
import { toReactFlowGraph } from '@casehubio/graph-renderer/mapping.js';
import { validateEdgeRouting } from '@casehubio/graph-renderer/edge-routing-validator.js';
import type { OrgLayoutStrategy } from '@casehubio/graph-stencil-org';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

registerOrgStencils();

const ARCHETYPES_DIR = resolve(
  import.meta.dirname,
  '../../../../../../eidos/examples/org-scenarios/src/test/resources/archetypes',
);

function loadArchetype(name: string): string {
  return readFileSync(resolve(ARCHETYPES_DIR, `${name}.yaml`), 'utf-8');
}

async function renderOrgDiagram(yaml: string) {
  const { model } = toOrgGraph(yaml);
  const hint = detectArchetype(model);
  const strategy: OrgLayoutStrategy = hint.layout;
  const orgOpts = orgLayoutOptions(strategy);
  const opts: ElkLayoutOptions = {
    algorithm: orgOpts.algorithm,
    spacing: orgOpts.spacing,
    headerHeight: 48,
  };
  if (orgOpts.direction !== undefined) opts.direction = orgOpts.direction;
  if (orgOpts.containerPadding !== undefined) opts.containerPadding = orgOpts.containerPadding;
  if (orgOpts.elkOptions !== undefined) opts.elkOptions = orgOpts.elkOptions;
  const layout = await computeElkLayout(model, opts);
  const direction = opts.direction ?? (orgOpts.algorithm === 'layered' || orgOpts.algorithm === 'mrtree' ? 'DOWN' : undefined);
  return toReactFlowGraph(model, layout, undefined, direction);
}

describe('edge routing TDD — org diagrams', () => {
  it('simple-structure: no crossings', async () => {
    const yaml = loadArchetype('simple-structure');
    const { nodes, edges } = await renderOrgDiagram(yaml);
    const result = validateEdgeRouting(nodes, edges);
    expect(result.violations, result.violations.join('\n')).toEqual([]);
  });

  it('federation: no crossings', async () => {
    const yaml = loadArchetype('federation-orchestrator');
    const { nodes, edges } = await renderOrgDiagram(yaml);
    const result = validateEdgeRouting(nodes, edges);
    expect(result.violations, result.violations.join('\n')).toEqual([]);
  });

  it('pipeline: no crossings', async () => {
    const yaml = loadArchetype('pipeline');
    const { nodes, edges } = await renderOrgDiagram(yaml);
    const result = validateEdgeRouting(nodes, edges);
    expect(result.violations, result.violations.join('\n')).toEqual([]);
  });

  it('coalition-advisory: no crossings', async () => {
    const yaml = loadArchetype('coalition-advisory');
    const { nodes, edges } = await renderOrgDiagram(yaml);
    const result = validateEdgeRouting(nodes, edges);
    expect(result.violations, result.violations.join('\n')).toEqual([]);
  });

  it('divisional-holarchy: no crossings', async () => {
    const yaml = loadArchetype('divisional-holarchy');
    const { nodes, edges } = await renderOrgDiagram(yaml);
    const result = validateEdgeRouting(nodes, edges);
    expect(result.violations, result.violations.join('\n')).toEqual([]);
  });

  it('matrix: no crossings', async () => {
    const yaml = loadArchetype('matrix');
    const { nodes, edges } = await renderOrgDiagram(yaml);
    const result = validateEdgeRouting(nodes, edges);
    expect(result.violations, result.violations.join('\n')).toEqual([]);
  });

  it('tiered-escalation: no crossings', async () => {
    const yaml = loadArchetype('tiered-escalation');
    const { nodes, edges } = await renderOrgDiagram(yaml);
    const result = validateEdgeRouting(nodes, edges);
    expect(result.violations, result.violations.join('\n')).toEqual([]);
  });

  it('market: no crossings', async () => {
    const yaml = loadArchetype('market');
    const { nodes, edges } = await renderOrgDiagram(yaml);
    const result = validateEdgeRouting(nodes, edges);
    expect(result.violations, result.violations.join('\n')).toEqual([]);
  });

  it('professional-bureaucracy: no crossings', async () => {
    const yaml = loadArchetype('professional-bureaucracy');
    const { nodes, edges } = await renderOrgDiagram(yaml);
    const result = validateEdgeRouting(nodes, edges);
    expect(result.violations, result.violations.join('\n')).toEqual([]);
  });
});
