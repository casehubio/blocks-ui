import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { registerOrgStencils } from '@casehubio/graph-stencil-org';
import '@casehubio/blocks-ui-org-diagram';

registerOrgStencils();

const SIMPLE_STRUCTURE = `organization:
  units:
    - unitId: startup
      name: Startup Team
      kind: simple-structure
      tenancyId: demo
      members:
        - agentId: ceo
          role: founder
        - agentId: dev-1
          role: engineer
        - agentId: dev-2
          role: engineer
        - agentId: designer
          role: designer
      capabilities: []
      goals:
        - name: ship-mvp
          description: Deliver minimum viable product
          priority: PRIMARY
          visibility: PUBLIC
      constraints: []
  relationships:
    - sourceAgentId: ceo
      targetAgentId: dev-1
      kind: SUPERVISES
      tenancyId: demo
    - sourceAgentId: ceo
      targetAgentId: dev-2
      kind: SUPERVISES
      tenancyId: demo
    - sourceAgentId: ceo
      targetAgentId: designer
      kind: SUPERVISES
      tenancyId: demo
`;

const FEDERATION = `organization:
  units:
    - unitId: coding-assistant
      name: Coding Assistant Federation
      kind: federation
      tenancyId: demo
      members:
        - agentId: orchestrator
          role: coordinator
        - agentId: searcher
          role: specialist
        - agentId: coder
          role: specialist
        - agentId: tester
          role: specialist
      capabilities: []
      goals: []
      constraints: []
  relationships:
    - sourceAgentId: orchestrator
      targetAgentId: searcher
      kind: DELEGATES_TO
      tenancyId: demo
    - sourceAgentId: orchestrator
      targetAgentId: coder
      kind: DELEGATES_TO
      tenancyId: demo
    - sourceAgentId: orchestrator
      targetAgentId: tester
      kind: DELEGATES_TO
      tenancyId: demo
    - sourceAgentId: searcher
      targetAgentId: orchestrator
      kind: REPORTS_TO
      tenancyId: demo
    - sourceAgentId: coder
      targetAgentId: orchestrator
      kind: REPORTS_TO
      tenancyId: demo
    - sourceAgentId: tester
      targetAgentId: orchestrator
      kind: REPORTS_TO
      tenancyId: demo
`;

const PIPELINE = `organization:
  units:
    - unitId: content-pipeline
      name: Content Pipeline
      kind: pipeline
      tenancyId: demo
      members:
        - agentId: researcher
          role: stage-1
        - agentId: writer
          role: stage-2
        - agentId: editor
          role: stage-3
        - agentId: publisher
          role: stage-4
      capabilities: []
      goals: []
      constraints: []
  relationships:
    - sourceAgentId: researcher
      targetAgentId: writer
      kind: DELEGATES_TO
      tenancyId: demo
    - sourceAgentId: writer
      targetAgentId: editor
      kind: DELEGATES_TO
      tenancyId: demo
    - sourceAgentId: editor
      targetAgentId: publisher
      kind: DELEGATES_TO
      tenancyId: demo
`;

const ARCHETYPES: Record<string, string> = {
  'Simple Structure': SIMPLE_STRUCTURE,
  'Federation': FEDERATION,
  'Pipeline': PIPELINE,
};

@customElement('blocks-example-org-diagram')
export class OrgDiagramPage extends LitElement {
  @state() private _yaml = SIMPLE_STRUCTURE;
  @state() private _selected = 'Simple Structure';

  static override styles = css`
    :host { display: flex; flex-direction: column; height: 100%; padding: 16px; box-sizing: border-box; gap: 12px; }
    h2 { font-size: 18px; font-weight: 600; color: var(--pages-neutral-12, #111); margin: 0; }
    .controls { display: flex; gap: 12px; align-items: center; }
    select { font-size: 13px; padding: 4px 8px; border: 1px solid var(--pages-neutral-5, #d1d5db);
      border-radius: 4px; background: var(--pages-surface-color, #fff); }
    .diagram-container { flex: 1; min-height: 0; border: 1px solid var(--pages-neutral-5, #e0e0e0);
      border-radius: 6px; overflow: hidden; }
    blocks-org-diagram { width: 100%; height: 100%; }
  `;

  override render() {
    return html`
      <div class="controls">
        <h2>Org Diagram</h2>
        <select @change=${(e: Event) => {
          const name = (e.target as HTMLSelectElement).value;
          this._selected = name;
          this._yaml = ARCHETYPES[name] ?? SIMPLE_STRUCTURE;
        }}>
          ${Object.keys(ARCHETYPES).map(name => html`
            <option ?selected=${name === this._selected}>${name}</option>
          `)}
        </select>
      </div>
      <div class="diagram-container">
        <blocks-org-diagram .yaml=${this._yaml}></blocks-org-diagram>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'blocks-example-org-diagram': OrgDiagramPage; }
}
