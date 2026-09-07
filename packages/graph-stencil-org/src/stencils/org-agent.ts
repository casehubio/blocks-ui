import { html } from 'lit-html';
import type { GraphNode, NodeDecoration } from '@casehubio/graph-core';

export function renderOrgAgent(node: GraphNode, _decoration?: NodeDecoration) {
  const agentId = String(node.properties['agentId'] ?? '');
  const role = node.properties['role'] as string | undefined;

  return html`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:#fff;border:1.5px solid #d1d5db;border-radius:8px;min-width:160px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="#6366f1" stroke-width="1.5">
        <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
      </svg>
      <div>
        <div style="font-weight:600;font-size:14px;color:#1f2937;">${agentId}</div>
        ${role ? html`<div style="font-size:12px;color:#6b7280;margin-top:2px;">${role}</div>` : ''}
      </div>
    </div>
  `;
}
