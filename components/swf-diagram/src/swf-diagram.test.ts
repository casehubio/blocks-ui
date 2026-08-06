import { describe, it, expect } from 'vitest';
import { toSwfGraph, applySwfPropertyEdit, swfTaskSchema } from '@casehubio/graph-stencil-swf';
import { toReactFlowGraph } from '@casehubio/graph-renderer';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SIMPLE_YAML = readFileSync(
  resolve(import.meta.dirname, '../../../packages/graph-stencil-swf/src/test-fixtures/simple-workflow.yaml'),
  'utf-8',
);

describe('swf-diagram integration', () => {
  it('end-to-end: SWF YAML → GraphModel → React Flow nodes', () => {
    const { model } = toSwfGraph(SIMPLE_YAML);
    const { nodes, edges } = toReactFlowGraph(model);

    expect(nodes.length).toBeGreaterThan(0);
    expect(edges.length).toBeGreaterThan(0);

    const callNodes = nodes.filter((n: { type?: string }) => n.type === 'swf-call');
    expect(callNodes.length).toBeGreaterThanOrEqual(1);

    const setNodes = nodes.filter((n: { type?: string }) => n.type === 'swf-set');
    expect(setNodes.length).toBeGreaterThanOrEqual(1);
  });

  it('all edges reference valid nodes', () => {
    const { model } = toSwfGraph(SIMPLE_YAML);
    const { nodes, edges } = toReactFlowGraph(model);
    const nodeIds = new Set(nodes.map((n: { id: string }) => n.id));

    for (const edge of edges) {
      expect(nodeIds.has(edge.source), `dangling source: ${edge.source}`).toBe(true);
      expect(nodeIds.has(edge.target), `dangling target: ${edge.target}`).toBe(true);
    }
  });

  it('degraded is undefined for valid YAML', () => {
    const { degraded } = toSwfGraph(SIMPLE_YAML);
    expect(degraded).toBeUndefined();
  });
});

describe('swf property editing', () => {
  it('applySwfPropertyEdit updates YAML and re-parse reflects change', () => {
    const result = toSwfGraph(SIMPLE_YAML);
    const callNodeId = '/do/0/fetchData';
    const nodePath = result.yamlPaths.get(callNodeId);
    expect(nodePath).toBeDefined();

    const newYaml = applySwfPropertyEdit(
      SIMPLE_YAML,
      [...nodePath!],
      ['with', 'method'],
      'POST',
    );
    const updated = toSwfGraph(newYaml);
    const callNode = updated.model.nodes.find(n => n.id === callNodeId);
    expect((callNode!.properties['with'] as Record<string, unknown>)['method']).toBe('POST');
  });

  it('removing a property sets it to undefined in the YAML', () => {
    const result = toSwfGraph(SIMPLE_YAML);
    const callNodeId = '/do/0/fetchData';
    const nodePath = result.yamlPaths.get(callNodeId);
    expect(nodePath).toBeDefined();

    const newYaml = applySwfPropertyEdit(
      SIMPLE_YAML,
      [...nodePath!],
      ['with', 'method'],
      undefined,
    );
    const updated = toSwfGraph(newYaml);
    const callNode = updated.model.nodes.find(n => n.id === callNodeId);
    expect((callNode!.properties['with'] as Record<string, unknown>)['method']).toBeUndefined();
  });
});

describe('swfTaskSchema', () => {
  it('has $defs for all engine-supported task types', () => {
    const defs = swfTaskSchema.$defs as Record<string, unknown>;
    expect(defs).toBeDefined();
    expect(defs['CallTask']).toBeDefined();
    expect(defs['SetTask']).toBeDefined();
    expect(defs['SwitchTask']).toBeDefined();
    expect(defs['RaiseTask']).toBeDefined();
    expect(defs['TryTask']).toBeDefined();
    expect(defs['TryCatchTask']).toBeDefined();
  });

  it('CallTask requires call property', () => {
    const callTask = (swfTaskSchema.$defs as Record<string, Record<string, unknown>>)['CallTask']!;
    expect(callTask['required']).toContain('call');
  });
});
