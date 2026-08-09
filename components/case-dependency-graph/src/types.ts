import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';

export interface SimNode extends SimulationNodeDatum {
  id: string;
  label: string;
  status: string;
  domain: string;
}

export interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string;
  type: string;
}

export interface FilterChangePayload {
  selectedTypes: Set<string>;
}
