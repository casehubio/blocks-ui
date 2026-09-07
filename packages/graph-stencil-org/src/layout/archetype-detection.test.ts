import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { toOrgGraph } from '../adapter/org-adapter.js';
import { detectArchetype } from './archetype-detection.js';
import type { ArchetypeHint } from './archetype-detection.js';

const ARCHETYPES_DIR = resolve(
  __dirname,
  '../../../../../eidos/examples/org-scenarios/src/test/resources/archetypes',
);

function detectFromFile(name: string): ArchetypeHint {
  const yaml = readFileSync(resolve(ARCHETYPES_DIR, `${name}.yaml`), 'utf-8');
  const result = toOrgGraph(yaml);
  return detectArchetype(result.model);
}

describe('detectArchetype', () => {
  it('detects simple-structure', () => {
    const hint = detectFromFile('simple-structure');
    expect(hint.archetype).toBe('simple-structure');
    expect(hint.layout).toBe('star');
  });

  it('detects divisional-holarchy', () => {
    const hint = detectFromFile('divisional-holarchy');
    expect(hint.archetype).toBe('divisional-holarchy');
    expect(hint.layout).toBe('nested');
  });

  it('detects federation', () => {
    const hint = detectFromFile('federation-orchestrator');
    expect(hint.archetype).toBe('federation');
    expect(hint.layout).toBe('hub-spoke');
  });

  it('detects pipeline', () => {
    const hint = detectFromFile('pipeline');
    expect(hint.archetype).toBe('pipeline');
    expect(hint.layout).toBe('flow');
  });

  it('detects market', () => {
    const hint = detectFromFile('market');
    expect(hint.archetype).toBe('market');
    expect(hint.layout).toBe('radial');
  });

  it('detects matrix', () => {
    const hint = detectFromFile('matrix');
    expect(hint.archetype).toBe('matrix');
    expect(hint.layout).toBe('grid');
  });

  it('detects tiered-escalation', () => {
    const hint = detectFromFile('tiered-escalation');
    expect(hint.archetype).toBe('tiered-escalation');
    expect(hint.layout).toBe('layered');
  });

  it('detects professional-bureaucracy', () => {
    const hint = detectFromFile('professional-bureaucracy');
    expect(hint.archetype).toBe('professional-bureaucracy');
    expect(hint.layout).toBe('circular');
  });

  it('detects coalition', () => {
    const hint = detectFromFile('coalition-advisory');
    expect(hint.archetype).toBe('coalition');
    expect(hint.layout).toBe('radial');
  });

  it('detects hierarchy from inline fixture (depth > 2)', () => {
    const yaml = `organization:
  units:
    - unitId: org
      name: Organization
      tenancyId: t1
      members:
        - agentId: ceo
        - agentId: vp1
        - agentId: vp2
        - agentId: mgr1
        - agentId: mgr2
        - agentId: eng1
        - agentId: eng2
      capabilities: []
      goals: []
      constraints: []
  relationships:
    - sourceAgentId: ceo
      targetAgentId: vp1
      kind: SUPERVISES
      tenancyId: t1
    - sourceAgentId: ceo
      targetAgentId: vp2
      kind: SUPERVISES
      tenancyId: t1
    - sourceAgentId: vp1
      targetAgentId: mgr1
      kind: SUPERVISES
      tenancyId: t1
    - sourceAgentId: vp1
      targetAgentId: mgr2
      kind: SUPERVISES
      tenancyId: t1
    - sourceAgentId: mgr1
      targetAgentId: eng1
      kind: SUPERVISES
      tenancyId: t1
    - sourceAgentId: mgr2
      targetAgentId: eng2
      kind: SUPERVISES
      tenancyId: t1
`;
    const result = toOrgGraph(yaml);
    const hint = detectArchetype(result.model);
    expect(hint.archetype).toBe('hierarchy');
    expect(hint.layout).toBe('tree');
  });

  it('falls back to force for empty graph', () => {
    const yaml = `organization:
  units: []
  relationships: []
`;
    const result = toOrgGraph(yaml);
    const hint = detectArchetype(result.model);
    expect(hint.layout).toBe('force');
    expect(hint.confidence).toBe('low');
  });

  it('falls back to force for no relationships', () => {
    const yaml = `organization:
  units:
    - unitId: team
      name: Team
      tenancyId: t1
      members:
        - agentId: alice
      capabilities: []
      goals: []
      constraints: []
  relationships: []
`;
    const result = toOrgGraph(yaml);
    const hint = detectArchetype(result.model);
    expect(hint.layout).toBe('force');
    expect(hint.confidence).toBe('low');
  });

  it('returns confidence level', () => {
    const hint = detectFromFile('simple-structure');
    expect(['high', 'medium', 'low']).toContain(hint.confidence);
  });
});
