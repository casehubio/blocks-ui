import { registerStencil } from '@casehubio/graph-renderer';
import { dagNodeGrammar, renderDagNode } from './dag-node.js';

let registered = false;

export function registerHtnStencils(): void {
  if (registered) return;
  registered = true;

  registerStencil({
    type: 'dag-node',
    label: 'Task',
    icon: 'box',
    grammar: dagNodeGrammar,
    render: renderDagNode,
  });
}
