import { parse as parseYaml, stringify } from 'yaml';
import { createGraph } from '@casehubio/graph-core';
import type { GraphNode, GraphEdge } from '@casehubio/graph-core';
import { buildFlatGraph } from '@openworkflowspec/sdk';
import type { Specification, FlatGraphNode, GraphEdge as SdkGraphEdge } from '@openworkflowspec/sdk';
import { buildYamlPaths } from './yaml-path-walker.js';
import { SWF_KNOWN_TYPES, SYNTHETIC_TYPES, SWF_TYPE_PREFIX, type AdapterResult } from '../types.js';

export function toSwfGraph(yaml: string): AdapterResult {
  const raw = parseYaml(yaml) as Specification.Workflow;
  const flatGraph = buildFlatGraph(raw, true);
  const yamlPaths = buildYamlPaths(yaml);

  const allSdkNodes = [flatGraph, ...flatGraph.nodes];
  const taskSdkNodes = allSdkNodes.filter(n => !SYNTHETIC_TYPES.has(n.type as string));

  let degraded: { reason: string } | undefined;
  if (yamlPaths.size !== taskSdkNodes.length) {
    degraded = { reason: `yamlPaths/model mismatch: ${yamlPaths.size} paths for ${taskSdkNodes.length} task nodes` };
  } else {
    for (const node of taskSdkNodes) {
      if (!yamlPaths.has(node.id)) {
        degraded = { reason: `No YAML path for task node '${node.id}'` };
        break;
      }
    }
  }

  const nodes: GraphNode[] = allSdkNodes.map(mapNode);
  const edges: GraphEdge[] = flatGraph.edges.map(e => mapEdge(e, allSdkNodes));
  const model = createGraph(nodes, edges);

  return { model, yamlPaths, degraded };
}

function mapNode(sdkNode: FlatGraphNode): GraphNode {
  const sdkType = sdkNode.type as string;
  const type = SWF_KNOWN_TYPES.has(sdkType) ? `${SWF_TYPE_PREFIX}${sdkType}` : 'swf-generic';

  const properties: Record<string, unknown> = {};
  if (sdkNode.label) properties['label'] = sdkNode.label;
  if (sdkNode.task) Object.assign(properties, sdkNode.task);
  if (!SWF_KNOWN_TYPES.has(sdkType)) properties['originalType'] = sdkType;

  return {
    id: sdkNode.id,
    type,
    ...(sdkNode.parentId ? { parentId: sdkNode.parentId } : {}),
    properties,
  };
}

function mapEdge(sdkEdge: SdkGraphEdge, nodes: FlatGraphNode[]): GraphEdge {
  const sourceNode = nodes.find(n => n.id === sdkEdge.sourceId);
  const edgeType = sourceNode?.type === 'switch' ? 'switch-case' : 'flow';

  return {
    id: sdkEdge.id,
    type: edgeType,
    source: sdkEdge.sourceId,
    target: sdkEdge.targetId,
    ...(sdkEdge.label ? { properties: { label: sdkEdge.label } } : {}),
  };
}

export function wrapDoBlock(doBlock: unknown): string {
  return stringify({
    document: { dsl: '1.0.0', namespace: 'embedded', name: 'worker-do', version: '1.0.0' },
    do: doBlock,
  });
}
