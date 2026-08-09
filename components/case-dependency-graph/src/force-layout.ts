import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import type { Simulation } from 'd3-force';
import type { SimNode, SimLink } from './types.js';

export function createSimulation(
  nodes: SimNode[],
  links: SimLink[],
  width: number,
  height: number,
): Simulation<SimNode> {
  return forceSimulation(nodes)
    .force('link', forceLink<SimNode, SimLink>(links).id(d => d.id).distance(150))
    .force('charge', forceManyBody().strength(-400))
    .force('center', forceCenter(width / 2, height / 2))
    .force('collision', forceCollide().radius(50));
}

export function stopSimulation(sim: Simulation<SimNode>): void {
  sim.stop();
}
