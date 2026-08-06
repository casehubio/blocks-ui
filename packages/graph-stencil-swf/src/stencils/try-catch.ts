import { html } from 'lit-html';
import type { StencilGrammar, GraphNode, NodeDecoration } from '@casehubio/graph-core';
import type { StencilTemplate } from '@casehubio/graph-renderer';

export const tryCatchGrammar: StencilGrammar = {
  type: 'swf-try-catch',
  connections: {
    inbound: { min: 0, max: Infinity, allowedFrom: ['swf-call', 'swf-set', 'swf-switch', 'swf-entry', 'swf-start'] },
    outbound: { min: 0, max: 1, allowedTo: ['swf-call', 'swf-set', 'swf-switch', 'swf-raise', 'swf-exit', 'swf-end'] },
  },
};

export function renderTryCatch(node: GraphNode, _decoration?: NodeDecoration): StencilTemplate {
  const label = node.properties['label'] ? String(node.properties['label']) : 'Catch';
  const errors = node.properties['errors'] as { with?: { type?: string } } | undefined;
  const errorFilter = errors?.with?.type ?? '';

  return html`
    <div style="padding: 8px 12px; border: 2px solid #ea580c; background: #fff7ed; border-top: 3px solid #ea580c; min-width: 160px; font-family: var(--pages-font-family, sans-serif); font-size: 13px; border-radius: 4px;">
      <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; color: #ea580c;">
        <span>\u{1F6E1}\u{FE0F}</span>
        <span>${label}</span>
      </div>
      ${errorFilter ? html`<div style="color: var(--pages-text-secondary, #666); font-size: 11px; margin-top: 2px;">${errorFilter}</div>` : ''}
    </div>
  `;
}
