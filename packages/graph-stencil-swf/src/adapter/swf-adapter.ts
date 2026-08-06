import type { GraphModel } from '@casehubio/graph-core';

export class SwfAdapter {
  toGraph(workflowYaml: string): GraphModel {
    return { nodes: [], edges: [] };
  }

  applyEdit(workflowYaml: string, _edit: unknown): string {
    return workflowYaml;
  }
}
