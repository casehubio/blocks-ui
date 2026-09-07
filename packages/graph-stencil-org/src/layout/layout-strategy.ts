import type { OrgLayoutStrategy } from './archetype-detection.js';

export type ElkAlgorithm = 'layered' | 'mrtree' | 'radial' | 'force' | 'stress';

export interface OrgElkLayoutOptions {
  algorithm: ElkAlgorithm;
  direction?: 'DOWN' | 'RIGHT' | 'LEFT' | 'UP';
  spacing: number;
  containerPadding?: number;
  elkOptions?: Readonly<Record<string, string>>;
}

export function orgLayoutOptions(strategy: OrgLayoutStrategy): OrgElkLayoutOptions {
  switch (strategy) {
    case 'star':
      return { algorithm: 'mrtree', direction: 'DOWN', spacing: 120 };

    case 'tree':
      return { algorithm: 'mrtree', direction: 'DOWN', spacing: 100 };

    case 'circular':
      return {
        algorithm: 'stress', spacing: 120,
        elkOptions: { 'elk.stress.desiredEdgeLength': '200' },
      };

    case 'layered':
      return {
        algorithm: 'layered', direction: 'DOWN', spacing: 100,
        elkOptions: { 'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP' },
      };

    case 'nested':
      return {
        algorithm: 'layered', direction: 'DOWN', spacing: 100,
        containerPadding: 40,
      };

    case 'hub-spoke':
      return {
        algorithm: 'stress', spacing: 120,
        elkOptions: { 'elk.stress.desiredEdgeLength': '180' },
      };

    case 'flow':
      return {
        algorithm: 'layered', direction: 'RIGHT', spacing: 80,
        elkOptions: { 'elk.layered.nodePlacement.strategy': 'LINEAR_SEGMENTS' },
      };

    case 'radial':
      return { algorithm: 'radial', spacing: 120 };

    case 'grid':
      return { algorithm: 'layered', direction: 'DOWN', spacing: 100 };

    case 'force':
      return {
        algorithm: 'force', spacing: 120,
        elkOptions: { 'elk.force.temperature': '0.001' },
      };
  }
}
