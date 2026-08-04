import { html } from 'lit-html';
import type { StencilGrammar, GraphNode, NodeDecoration } from '@casehubio/graph-core';
import type { StencilTemplate } from '@casehubio/graph-renderer';

export const goalGrammar: StencilGrammar = {
  type: 'goal',
  connections: {
    inbound: { min: 0, max: Infinity, allowedFrom: ['milestone', 'binding'] },
    outbound: { min: 0, max: 0, allowedTo: [] },
  },
};

const KIND_COLORS: Record<string, string> = {
  success: '#2e7d32',
  failure: '#c62828',
};

export function renderGoal(node: GraphNode, _decoration?: NodeDecoration): StencilTemplate {
  const data = node.properties;
  const name = String(data['name'] ?? '');
  const kind = String(data['kind'] ?? 'success');
  const color = KIND_COLORS[kind] ?? 'var(--pages-accent-color, #1a73e8)';

  return html`
    <div style="padding: 12px 20px; background: var(--pages-surface-color, #fff); border: 3px solid ${color}; min-width: 140px; font-family: var(--pages-font-family, sans-serif); font-size: 13px; clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%); display: flex; align-items: center; justify-content: center; min-height: 60px;">
      <div style="text-align: center;">
        <div style="font-weight: 700; color: ${color};">${name}</div>
        <div style="font-size: 11px; color: ${color}; text-transform: uppercase;">${kind}</div>
      </div>
    </div>
  `;
}
