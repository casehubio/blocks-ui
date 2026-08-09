import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { registerRelationshipType, lookupRelationshipType } from '@casehubio/blocks-ui-core';
import '../../../components/case-dependency-graph/src/blocks-case-dependency-graph.js';
import type { GraphModel, GraphNode } from '@casehubio/graph-core';

registerRelationshipType('blocks', {
  color: '#ef4444', style: 'solid', directed: true, label: 'Blocks',
});
registerRelationshipType('relates_to', {
  color: '#3b82f6', style: 'dotted', directed: false, label: 'Relates To',
});

interface CaseDetail {
  id: string;
  label: string;
  status: string;
  description: string;
  assignee: string;
  created: string;
}

const CASE_DETAILS: Record<string, CaseDetail> = {
  'fraud-4012': { id: 'fraud-4012', label: 'Fraud #4012', status: 'RUNNING', description: 'Suspicious wire transfer — $42,000 to unrecognised offshore account. Flagged by automated monitoring. Initial investigation found the same beneficiary appeared in a prior closed case (#3841).', assignee: 'J. Chen', created: '2026-07-15' },
  'fraud-3841': { id: 'fraud-3841', label: 'Fraud #3841', status: 'COMPLETED', description: 'Account flagged for unusual international transfers — 6 months ago. Investigated, found insufficient evidence, closed as low-risk. Now linked to #4012 via shared beneficiary.', assignee: 'M. Torres', created: '2026-01-22' },
  'fraud-4087': { id: 'fraud-4087', label: 'Fraud #4087', status: 'RUNNING', description: 'Expanded investigation superseding #4012. Scope broadened to include all accounts linked to the offshore beneficiary. Cross-jurisdictional coordination initiated.', assignee: 'J. Chen', created: '2026-07-28' },
  'coord-500': { id: 'coord-500', label: 'Coordination #500', status: 'RUNNING', description: 'Cross-border coordination case managing parallel investigations across three jurisdictions. Each jurisdiction runs its own sub-investigation with local regulatory authority.', assignee: 'S. Williams', created: '2026-08-01' },
  'juris-a': { id: 'juris-a', label: 'Jurisdiction A', status: 'RUNNING', description: 'UK Financial Conduct Authority — investigating the originating bank account. Has issued a production order for transaction records. Blocking Jurisdiction B pending evidence sharing.', assignee: 'R. Patel', created: '2026-08-02' },
  'juris-b': { id: 'juris-b', label: 'Jurisdiction B', status: 'WAITING', description: 'Singapore MAS — investigating the receiving account. Waiting on evidence from Jurisdiction A before proceeding. Cannot issue local orders until the UK production order completes.', assignee: 'L. Tan', created: '2026-08-02' },
  'juris-c': { id: 'juris-c', label: 'Jurisdiction C', status: 'COMPLETED', description: 'UAE Central Bank — investigated the intermediary routing bank. Found no local violations. Provided transaction metadata to coordination case. Investigation complete.', assignee: 'A. Hassan', created: '2026-08-02' },
  'sub-1': { id: 'sub-1', label: 'Wire Transfer', status: 'COMPLETED', description: 'Analysis of the specific wire transfer that triggered the investigation. Source, destination, intermediaries, timing, and amount confirmed. Evidence package prepared.', assignee: 'J. Chen', created: '2026-07-29' },
  'sub-2': { id: 'sub-2', label: 'Account Review', status: 'RUNNING', description: 'Full account history review for the originating account. Looking for patterns — frequency, amounts, counterparties. 18 months of transactions under analysis.', assignee: 'K. Okafor', created: '2026-07-30' },
};

const SAMPLE_GRAPH: GraphModel = {
  nodes: Object.values(CASE_DETAILS).map(c => ({
    id: c.id, type: 'case', properties: { label: c.label, status: c.status, domain: 'case' },
  })),
  edges: [
    { id: 'e1', type: 'supersedes', source: 'fraud-4012', target: 'fraud-4087' },
    { id: 'e2', type: 'relates_to', source: 'fraud-4012', target: 'fraud-3841' },
    { id: 'e3', type: 'coordination', source: 'coord-500', target: 'juris-a' },
    { id: 'e4', type: 'coordination', source: 'coord-500', target: 'juris-b' },
    { id: 'e5', type: 'coordination', source: 'coord-500', target: 'juris-c' },
    { id: 'e6', type: 'parent_child', source: 'fraud-4087', target: 'sub-1' },
    { id: 'e7', type: 'parent_child', source: 'fraud-4087', target: 'sub-2' },
    { id: 'e8', type: 'blocks', source: 'juris-a', target: 'juris-b' },
  ],
};

function getRelationships(id: string): Array<{ target: string; type: string; direction: string }> {
  const rels: Array<{ target: string; type: string; direction: string }> = [];
  for (const e of SAMPLE_GRAPH.edges) {
    if (e.source === id) rels.push({ target: CASE_DETAILS[e.target]?.label ?? e.target, type: e.type, direction: 'outgoing' });
    if (e.target === id) rels.push({ target: CASE_DETAILS[e.source]?.label ?? e.source, type: e.type, direction: 'incoming' });
  }
  return rels;
}

@customElement('blocks-example-case-dependency-graph')
export class CaseDependencyGraphPage extends LitElement {
  @state() private _selectedCase: CaseDetail | null = null;

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin-bottom: 8px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    .subtitle { margin-bottom: 24px; color: var(--pages-neutral-11, #555); font-size: 14px; }

    .workbench { display: flex; gap: 0; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 6px; overflow: hidden; height: 600px; }
    .graph-pane { flex: 2; min-width: 0; }
    .detail-pane { flex: 1; min-width: 280px; max-width: 380px; border-left: 1px solid var(--pages-neutral-5, #e0e0e0); overflow-y: auto; background: var(--pages-neutral-2, #f5f5f5); }

    .detail-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--pages-neutral-9, #999); font-style: italic; font-size: 14px; padding: 24px; text-align: center; }

    .detail-content { padding: 20px; }
    .detail-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .detail-title { font-size: 16px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    .detail-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .detail-badge.RUNNING { background: var(--pages-success-3, #d1fae5); color: var(--pages-success-11, #065f46); }
    .detail-badge.COMPLETED { background: var(--pages-success-3, #d1fae5); color: var(--pages-success-11, #065f46); }
    .detail-badge.WAITING { background: var(--pages-warning-3, #fef3c7); color: var(--pages-warning-11, #92400e); }

    .detail-desc { font-size: 13px; line-height: 1.5; color: var(--pages-neutral-11, #555); margin-bottom: 16px; }

    .detail-meta { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 13px; margin-bottom: 20px; }
    .detail-meta dt { color: var(--pages-neutral-9, #999); }
    .detail-meta dd { margin: 0; color: var(--pages-neutral-12, #111); }

    .detail-rels h4 { font-size: 13px; font-weight: 600; margin: 0 0 8px; color: var(--pages-neutral-12, #111); }
    .rel-list { list-style: none; padding: 0; margin: 0; }
    .rel-item { display: flex; align-items: center; gap: 6px; padding: 4px 0; font-size: 13px; }
    .rel-badge { padding: 1px 6px; border-radius: 3px; font-size: 11px; color: #fff; }
    .rel-direction { color: var(--pages-neutral-9, #999); font-size: 11px; }
    .rel-target { color: var(--pages-neutral-12, #111); }

    .scenario-note { margin-bottom: 16px; padding: 12px 16px; background: var(--pages-accent-3, #e0e7ff); border-radius: 6px; font-size: 13px; color: var(--pages-accent-11, #1e40af); line-height: 1.5; }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('pages-event', this._handleEvent as EventListener);
  }

  override disconnectedCallback(): void {
    this.removeEventListener('pages-event', this._handleEvent as EventListener);
    super.disconnectedCallback();
  }

  private _handleEvent = (e: CustomEvent): void => {
    if (e.detail?.topic === 'case-graph:selected') {
      const { id } = e.detail.data ?? e.detail.payload ?? {};
      if (id && CASE_DETAILS[id]) {
        this._selectedCase = CASE_DETAILS[id];
      }
    }
  };

  private _renderDetail() {
    const c = this._selectedCase;
    if (!c) {
      return html`<div class="detail-empty">Click a case node in the graph to see its details and relationships</div>`;
    }

    const rels = getRelationships(c.id);

    return html`
      <div class="detail-content">
        <div class="detail-header">
          <span class="detail-title">${c.label}</span>
          <span class="detail-badge ${c.status}">${c.status}</span>
        </div>
        <div class="detail-desc">${c.description}</div>
        <dl class="detail-meta">
          <dt>Assignee</dt><dd>${c.assignee}</dd>
          <dt>Created</dt><dd>${c.created}</dd>
          <dt>ID</dt><dd>${c.id}</dd>
        </dl>
        ${rels.length > 0 ? html`
          <div class="detail-rels">
            <h4>Relationships (${rels.length})</h4>
            <ul class="rel-list">
              ${rels.map(r => {
                const desc = lookupRelationshipType(r.type);
                return html`
                  <li class="rel-item">
                    <span class="rel-badge" style="background: ${desc.color}">${desc.label ?? r.type}</span>
                    <span class="rel-direction">${r.direction === 'outgoing' ? '→' : '←'}</span>
                    <span class="rel-target">${r.target}</span>
                  </li>`;
              })}
            </ul>
          </div>
        ` : nothing}
      </div>
    `;
  }

  override render() {
    return html`
      <h2>Case Dependency Graph</h2>
      <p class="subtitle">D3 force-directed graph of case relationships — click any case to see its details and connections.</p>

      <div class="scenario-note">
        <strong>Scenario:</strong> A bank's fraud team is investigating suspicious wire transfers across three jurisdictions. The original case (#4012) was superseded by a broader investigation (#4087). A prior closed case (#3841) is linked via a shared beneficiary. A coordination case (#500) manages parallel investigations in the UK, Singapore, and UAE. Jurisdiction A blocks Jurisdiction B pending evidence sharing.
      </div>

      <div class="workbench">
        <div class="graph-pane">
          <blocks-case-dependency-graph
            .graphData=${SAMPLE_GRAPH}
            selection-topic="case-graph"
          ></blocks-case-dependency-graph>
        </div>
        <div class="detail-pane">
          ${this._renderDetail()}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blocks-example-case-dependency-graph': CaseDependencyGraphPage;
  }
}
