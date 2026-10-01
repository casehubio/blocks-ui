import type { GraphModel } from '@casehubio/graph-core';
import {
  computeElkLayout,
  type ElkLayoutOptions,
  type ElkLayoutResult,
  type NodeLayout,
} from '@casehubio/graph-renderer';

function overlaps(a: NodeLayout, b: NodeLayout): boolean {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

/** Preserve ELK's routing while separating the occasional overlapping sibling tasks. */
export async function computeSwfLayout(
  model: GraphModel,
  options: ElkLayoutOptions,
): Promise<ElkLayoutResult> {
  const layout = await computeElkLayout(model, options);
  const nodeLayouts = new Map(layout.nodeLayouts);
  const siblings = new Map<string, string[]>();

  for (const node of model.nodes) {
    const parent = node.parentId ?? '__root__';
    const group = siblings.get(parent) ?? [];
    group.push(node.id);
    siblings.set(parent, group);
  }

  const horizontal = options.direction === 'RIGHT' || options.direction === 'LEFT';
  const gap = Math.max(20, options.spacing ?? 50);
  for (const ids of siblings.values()) {
    const placed: NodeLayout[] = [];
    const ordered = ids
      .map(id => [id, nodeLayouts.get(id)] as const)
      .filter((entry): entry is readonly [string, NodeLayout] => entry[1] !== undefined)
      .sort(([, a], [, b]) => horizontal ? a.x - b.x : a.y - b.y);

    for (const [id, original] of ordered) {
      let current = { ...original };
      while (placed.some(other => overlaps(current, other))) {
        if (horizontal) {
          current = { ...current, x: Math.max(...placed.map(other => other.x + other.width)) + gap };
        } else {
          current = { ...current, y: Math.max(...placed.map(other => other.y + other.height)) + gap };
        }
      }
      nodeLayouts.set(id, current);
      placed.push(current);
    }
  }

  return { nodeLayouts };
}
