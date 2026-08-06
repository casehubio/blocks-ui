import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';
import { buildFlatGraph } from '@openworkflowspec/sdk';
import type { Specification } from '@openworkflowspec/sdk';
import { toSwfGraph, wrapDoBlock } from './swf-adapter.js';

const FIXTURES_DIR = resolve(__dirname, '../test-fixtures');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

describe('SDK buildFlatGraph ID contract', () => {
  it('produces path-based IDs for simple workflow', () => {
    const yaml = loadFixture('simple-workflow.yaml');
    const workflow = parseYaml(yaml) as Specification.Workflow;
    const graph = buildFlatGraph(workflow, true);

    const nodeIds = graph.nodes.map(n => n.id);
    expect(nodeIds).toContain('/do/0/fetchData');
    expect(nodeIds).toContain('/do/1/transformResult');
    expect(nodeIds).toContain('/do/2/checkCondition');
    expect(nodeIds).toContain('/do/3/raiseError');
    expect(nodeIds).toContain('root-entry-node');
    expect(nodeIds).toContain('root-exit-node');
  });

  it('produces deterministic IDs across repeated calls', () => {
    const yaml = loadFixture('simple-workflow.yaml');
    const workflow = parseYaml(yaml) as Specification.Workflow;
    const graph1 = buildFlatGraph(workflow, true);
    const graph2 = buildFlatGraph(workflow, true);
    expect(graph1.nodes.map(n => n.id)).toEqual(graph2.nodes.map(n => n.id));
  });

  it('produces path-based IDs for nested structures', () => {
    const yaml = loadFixture('nested-workflow.yaml');
    const workflow = parseYaml(yaml) as Specification.Workflow;
    const graph = buildFlatGraph(workflow, true);

    const nodeIds = graph.nodes.map(n => n.id);
    expect(nodeIds).toContain('/do/0/tryBlock');
    expect(nodeIds).toContain('/do/0/tryBlock/try/0/innerStep');
    expect(nodeIds).toContain('/do/0/tryBlock/catch/do/0/handleError');
  });
});

describe('toSwfGraph', () => {
  it('converts simple SWF YAML to GraphModel with prefixed types', () => {
    const yaml = loadFixture('simple-workflow.yaml');
    const result = toSwfGraph(yaml);

    expect(result.model.nodes.length).toBeGreaterThan(0);

    const callNode = result.model.nodes.find(n => n.type === 'swf-call');
    expect(callNode).toBeDefined();
    expect(callNode!.properties['call']).toBe('http');

    const setNode = result.model.nodes.find(n => n.type === 'swf-set');
    expect(setNode).toBeDefined();

    const switchNode = result.model.nodes.find(n => n.type === 'swf-switch');
    expect(switchNode).toBeDefined();

    const raiseNode = result.model.nodes.find(n => n.type === 'swf-raise');
    expect(raiseNode).toBeDefined();

    const startNode = result.model.nodes.find(n => n.type === 'swf-start');
    expect(startNode).toBeDefined();

    const endNode = result.model.nodes.find(n => n.type === 'swf-end');
    expect(endNode).toBeDefined();
  });

  it('maps SDK edge sourceId/targetId to casehub source/target', () => {
    const yaml = loadFixture('simple-workflow.yaml');
    const result = toSwfGraph(yaml);

    expect(result.model.edges.length).toBeGreaterThan(0);
    for (const edge of result.model.edges) {
      expect(edge).toHaveProperty('source');
      expect(edge).toHaveProperty('target');
    }
  });

  it('builds yamlPaths for all task nodes without degradation', () => {
    const yaml = loadFixture('simple-workflow.yaml');
    const result = toSwfGraph(yaml);

    expect(result.degraded).toBeUndefined();
    expect(result.yamlPaths.size).toBeGreaterThan(0);
    expect(result.yamlPaths.has('/do/0/fetchData')).toBe(true);
    expect(result.yamlPaths.has('/do/1/transformResult')).toBe(true);
    expect(result.yamlPaths.has('/do/2/checkCondition')).toBe(true);
    expect(result.yamlPaths.has('/do/3/raiseError')).toBe(true);
  });

  it('handles nested try/catch structures', () => {
    const yaml = loadFixture('nested-workflow.yaml');
    const result = toSwfGraph(yaml);

    expect(result.model.nodes.length).toBeGreaterThan(0);
    expect(result.degraded).toBeUndefined();

    const tryCatchNode = result.model.nodes.find(n => n.type === 'swf-try-catch');
    expect(tryCatchNode).toBeDefined();

    const tryNode = result.model.nodes.find(n => n.type === 'swf-try');
    expect(tryNode).toBeDefined();

    const catchNode = result.model.nodes.find(n => n.type === 'swf-catch');
    expect(catchNode).toBeDefined();

    const callNode = result.model.nodes.find(n => n.type === 'swf-call');
    expect(callNode).toBeDefined();
    expect(callNode!.id).toBe('/do/0/tryBlock/try/0/innerStep');
  });

  it('derives switch-case edge type for switch node outbound edges', () => {
    const yaml = loadFixture('simple-workflow.yaml');
    const result = toSwfGraph(yaml);

    const switchNode = result.model.nodes.find(n => n.type === 'swf-switch');
    expect(switchNode).toBeDefined();

    const switchEdges = result.model.edges.filter(e => e.source === switchNode!.id);
    for (const edge of switchEdges) {
      expect(edge.type).toBe('switch-case');
    }
  });
});

describe('wrapDoBlock', () => {
  it('produces valid SWF YAML envelope', () => {
    const doBlock = [{ fetchData: { call: 'http', with: { method: 'GET' } } }];
    const yaml = wrapDoBlock(doBlock);

    expect(yaml).toContain('dsl:');
    expect(yaml).toContain('do:');
    expect(yaml).toContain('fetchData');

    const result = toSwfGraph(yaml);
    expect(result.model.nodes.length).toBeGreaterThan(0);
    expect(result.degraded).toBeUndefined();
  });
});
