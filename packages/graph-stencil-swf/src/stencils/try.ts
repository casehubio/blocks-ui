import { html } from 'lit-html';
import type { StencilGrammar, GraphNode, NodeDecoration } from '@casehubio/graph-core';
import type { StencilTemplate } from '@casehubio/graph-renderer';

export const tryGrammar: StencilGrammar = {
  type: 'swf-try',
  connections: {
    inbound: { min: 0, max: Infinity, allowedFrom: ['swf-call', 'swf-set', 'swf-switch', 'swf-entry', 'swf-start'] },
    outbound: { min: 0, max: 1, allowedTo: ['swf-call', 'swf-set', 'swf-switch', 'swf-raise', 'swf-exit', 'swf-end'] },
  },
};

export function renderTry(node: GraphNode, _decoration?: NodeDecoration): StencilTemplate {
  const label = node.properties['label'] ? String(node.properties['label']) : 'Try';
  return html`
    <div style="padding: 8px 12px; border: 2px solid var(--pages-border-strong, #888); background: var(--pages-surface-raised, #f8f8f8); border-top: 3px solid #0ea5e9; min-width: 160px; font-family: var(--pages-font-family, sans-serif); font-size: 13px; border-radius: 4px;">
      <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; color: var(--pages-text-color, #333);">
        <span>\u{1F6E1}\u{FE0F}</span>
        <span>${label}</span>
      </div>
    </div>
  `;
}
