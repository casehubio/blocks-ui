import { html } from 'lit-html';
import type { GraphNode, NodeDecoration } from '@casehubio/graph-core';

export function renderOrgUnit(node: GraphNode, _decoration?: NodeDecoration) {
  const name = String(node.properties['name'] ?? node.properties['unitId'] ?? '');
  const kind = node.properties['kind'] as string | undefined;
  const memberCount = (node.properties['memberCount'] as number | undefined) ?? 0;

  return html`
    <div style="width:100%;height:100%;min-width:280px;min-height:100px;border:2px solid #6366f1;border-radius:10px;background:#faf5ff;overflow:visible;box-sizing:border-box;">
      <div style="display:flex;align-items:center;padding:8px 14px;background:#ede9fe;border-radius:8px 8px 0 0;border-bottom:1px solid #c4b5fd;gap:6px;">
        <span style="font-weight:700;font-size:15px;color:#4338ca;">${name}</span>
        ${kind ? html`<span style="font-size:12px;background:#e0e7ff;color:#3730a3;padding:2px 8px;border-radius:4px;">${kind}</span>` : ''}
        <span style="font-size:12px;background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:4px;margin-left:auto;">${memberCount}</span>
      </div>
    </div>
  `;
}
