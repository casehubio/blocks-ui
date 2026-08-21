import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toSwfGraph } from '@casehubio/graph-stencil-swf';
import { computeElkLayout, toReactFlowGraph, validateEdgeRouting } from '@casehubio/graph-renderer';

function extractAllYamls(file: string): string[] {
  const src = readFileSync(resolve(import.meta.dirname, '../../../examples/src/pages/' + file), 'utf-8');
  const results: string[] = [];
  const re = /const \w+ = `([\s\S]*?)`;/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    results.push(m[1]!.replace(/\\(\$)/g, '$'));
  }
  return results;
}

async function renderSwfDiagram(yaml: string, direction: 'DOWN' | 'RIGHT' = 'DOWN') {
  const { model } = toSwfGraph(yaml);
  const layout = await computeElkLayout(model, { direction, spacing: 40, containerPadding: 25, wrapping: true });
  const { nodes: rawNodes, edges: rawEdges } = toReactFlowGraph(model, layout, undefined, direction);
  const nodeParents = new Map(rawNodes.map(n => [n.id, n.parentId]));
  const filteredEdges = rawEdges.filter(e => {
    const sp = nodeParents.get(e.source);
    const tp = nodeParents.get(e.target);
    if (!sp || !tp || sp !== tp) return true;
    return sp === 'root';
  });
  const connectedIds = new Set(filteredEdges.flatMap(e => [e.source, e.target]));
  const filteredNodes = rawNodes
    .filter(n => n.type !== 'swf-root')
    .map(n => {
      const cleared = n.parentId === 'root' ? { ...n, parentId: undefined } : { ...n };
      if (!connectedIds.has(n.id)) cleared.data = { ...cleared.data, _hideHandles: true };
      return cleared;
    });
  return { nodes: filteredNodes, edges: filteredEdges };
}

const swfYamls = extractAllYamls('swf-diagram-page.ts');
const CLAIM_REVIEW = swfYamls.find(y => y.includes('claim-review'))!;
const PIPELINE = swfYamls.find(y => y.includes('document-processing'))!;

describe('edge routing TDD — SWF diagrams (graph model validation)', () => {
  it('Claim Review (DOWN)', async () => {
    const { nodes, edges } = await renderSwfDiagram(CLAIM_REVIEW, 'DOWN');
    const result = validateEdgeRouting(nodes, edges);
    expect(result.violations, result.violations.join('\n')).toEqual([]);
  });

  it('Document Pipeline (RIGHT)', async () => {
    const { nodes, edges } = await renderSwfDiagram(PIPELINE, 'RIGHT');
    const result = validateEdgeRouting(nodes, edges);
    expect(result.violations, result.violations.join('\n')).toEqual([]);
  });
});
