import { describe, it, expect } from 'vitest';
import type { GraphModel } from '@casehubio/graph-core';
import { computeRadialLayout } from './radial-layout.js';

function makeModel(
  nodes: { id: string; parentId?: string }[],
  edges: { source: string; target: string }[] = [],
): GraphModel {
  return {
    nodes: nodes.map(n => ({ id: n.id, type: 'test', parentId: n.parentId, properties: {} })),
    edges: edges.map((e, i) => ({ id: `e${i}`, type: 'default', source: e.source, target: e.target })),
  };
}

describe('computeRadialLayout', () => {
  it('layouts a single root with no children', () => {
    const model = makeModel([{ id: 'root' }]);
    const result = computeRadialLayout(model);
    expect(result.nodeLayouts.has('root')).toBe(true);
    const root = result.nodeLayouts.get('root')!;
    expect(root.x).toBe(0);
    expect(root.y).toBe(0);
    expect(root.width).toBe(280);
    expect(root.height).toBe(50);
  });

  it('layouts a root with one child as a container', () => {
    const model = makeModel(
      [{ id: 'root' }, { id: 'child', parentId: 'root' }],
      [{ source: 'root', target: 'child' }],
    );
    const result = computeRadialLayout(model);
    expect(result.nodeLayouts.has('root')).toBe(true);
    expect(result.nodeLayouts.has('child')).toBe(true);
    const root = result.nodeLayouts.get('root')!;
    expect(root.width).toBeGreaterThan(280);
  });

  it('layouts a hub with spokes radially', () => {
    const model = makeModel(
      [
        { id: 'root' },
        { id: 'hub', parentId: 'root' },
        { id: 'spoke1', parentId: 'root' },
        { id: 'spoke2', parentId: 'root' },
        { id: 'spoke3', parentId: 'root' },
      ],
      [
        { source: 'hub', target: 'spoke1' },
        { source: 'hub', target: 'spoke2' },
        { source: 'hub', target: 'spoke3' },
      ],
    );
    const result = computeRadialLayout(model);
    expect(result.nodeLayouts.size).toBe(5);
    const hub = result.nodeLayouts.get('hub')!;
    const s1 = result.nodeLayouts.get('spoke1')!;
    const s2 = result.nodeLayouts.get('spoke2')!;
    expect(s1.x).not.toBe(s2.x);
  });

  it('picks the most-connected node as hub', () => {
    const model = makeModel(
      [
        { id: 'root' },
        { id: 'a', parentId: 'root' },
        { id: 'b', parentId: 'root' },
        { id: 'c', parentId: 'root' },
        { id: 'd', parentId: 'root' },
      ],
      [
        { source: 'a', target: 'b' },
        { source: 'a', target: 'c' },
        { source: 'a', target: 'd' },
      ],
    );
    const result = computeRadialLayout(model);
    const layouts = ['b', 'c', 'd'].map(id => result.nodeLayouts.get(id)!);
    const spokeCenters = layouts.map(l => l.x + l.width / 2);
    const allDifferent = new Set(spokeCenters).size > 1;
    expect(allDifferent).toBe(true);
  });

  it('produces non-overlapping node positions with wide spacing', () => {
    const model = makeModel(
      [
        { id: 'root' },
        { id: 'hub', parentId: 'root' },
        { id: 's1', parentId: 'root' },
        { id: 's2', parentId: 'root' },
        { id: 's3', parentId: 'root' },
      ],
      [
        { source: 'hub', target: 's1' },
        { source: 'hub', target: 's2' },
        { source: 'hub', target: 's3' },
      ],
    );
    const result = computeRadialLayout(model, 200);
    const childIds = ['hub', 's1', 's2', 's3'];
    for (let i = 0; i < childIds.length; i++) {
      for (let j = i + 1; j < childIds.length; j++) {
        const a = result.nodeLayouts.get(childIds[i]!)!;
        const b = result.nodeLayouts.get(childIds[j]!)!;
        const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
        const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
        expect(overlapX && overlapY).toBe(false);
      }
    }
  });

  it('accepts custom spacing', () => {
    const model = makeModel(
      [
        { id: 'root' },
        { id: 'hub', parentId: 'root' },
        { id: 's1', parentId: 'root' },
        { id: 's2', parentId: 'root' },
        { id: 's3', parentId: 'root' },
      ],
      [
        { source: 'hub', target: 's1' },
        { source: 'hub', target: 's2' },
        { source: 'hub', target: 's3' },
      ],
    );
    const tight = computeRadialLayout(model, 60);
    const wide = computeRadialLayout(model, 240);
    const tightRoot = tight.nodeLayouts.get('root')!;
    const wideRoot = wide.nodeLayouts.get('root')!;
    expect(wideRoot.width).toBeGreaterThan(tightRoot.width);
  });
});
