import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { registerOrgStencils } from '@casehubio/graph-stencil-org';
import type { AgentDescriptor } from '@casehubio/graph-stencil-org';
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

const GASTOWN = `organization:
  units:
    - unitId: oversight
      name: Oversight Chain
      kind: supervision-hierarchy
      kindVocabulary: urn:gastown:vocab:org
      tenancyId: gastown
      members:
        - agentId: boot
          role: root-watchdog
        - agentId: deacon
          role: cross-rig-watchdog
      capabilities: []
      goals: []
      constraints: []

    - unitId: rig-alpha
      name: Rig Alpha
      kind: rig
      kindVocabulary: urn:gastown:vocab:org
      tenancyId: gastown
      members:
        - agentId: witness-alpha
          role: witness
        - agentId: polecat-1
          role: worker
        - agentId: polecat-2
          role: worker
      capabilities:
        - name: full-stack-code-work

    - unitId: rig-beta
      name: Rig Beta
      kind: rig
      kindVocabulary: urn:gastown:vocab:org
      tenancyId: gastown
      members:
        - agentId: witness-beta
          role: witness
        - agentId: polecat-3
          role: worker
      capabilities:
        - name: full-stack-code-work

  relationships:
    - sourceAgentId: boot
      targetAgentId: deacon
      kind: SUPERVISES
      tenancyId: gastown

    - sourceAgentId: deacon
      targetAgentId: witness-alpha
      kind: SUPERVISES
      tenancyId: gastown
      scope:
        capabilityName: rig-monitoring
      attestation:
        dimensions: [LATENCY, ATTESTATION_RATE]
        signalTypes: [COMPLIANT, VIOLATED]

    - sourceAgentId: deacon
      targetAgentId: witness-beta
      kind: SUPERVISES
      tenancyId: gastown
      scope:
        capabilityName: rig-monitoring
      attestation:
        dimensions: [LATENCY, ATTESTATION_RATE]
        signalTypes: [COMPLIANT, VIOLATED]

    - sourceAgentId: witness-alpha
      targetAgentId: polecat-1
      kind: SUPERVISES
      tenancyId: gastown

    - sourceAgentId: witness-alpha
      targetAgentId: polecat-2
      kind: SUPERVISES
      tenancyId: gastown

    - sourceAgentId: witness-beta
      targetAgentId: polecat-3
      kind: SUPERVISES
      tenancyId: gastown

    - sourceAgentId: polecat-1
      targetAgentId: witness-alpha
      kind: ESCALATES_TO
      tenancyId: gastown

    - sourceAgentId: polecat-2
      targetAgentId: witness-alpha
      kind: ESCALATES_TO
      tenancyId: gastown

    - sourceAgentId: polecat-3
      targetAgentId: witness-beta
      kind: ESCALATES_TO
      tenancyId: gastown

    - sourceAgentId: witness-alpha
      targetAgentId: deacon
      kind: ESCALATES_TO
      tenancyId: gastown

    - sourceAgentId: witness-beta
      targetAgentId: deacon
      kind: ESCALATES_TO
      tenancyId: gastown

    - sourceAgentId: deacon
      targetAgentId: boot
      kind: ESCALATES_TO
      tenancyId: gastown

    - sourceAgentId: polecat-1
      targetAgentId: polecat-2
      kind: BACKS_UP
      tenancyId: gastown
      scope:
        capabilityName: code-analysis
`;

const GASTOWN_AGENTS: Record<string, AgentDescriptor> = {
  boot: {
    slot: 'root-watchdog',
    disposition: { autonomy: 'high', ruleFollowing: 'principled' },
    capabilities: [{ name: 'system-oversight' }],
    goals: [{ name: 'system-integrity', priority: 'PRIMARY' }],
    constraints: [{ name: 'no-direct-work', severity: 'HARD' }],
    briefing: 'Apex supervisor — no further escalation target. Monitors deacon health.',
  },
  deacon: {
    slot: 'cross-rig-watchdog',
    disposition: { ruleFollowing: 'principled', riskAppetite: 'cautious' },
    capabilities: [{ name: 'rig-monitoring' }, { name: 'attestation-review' }],
    goals: [{ name: 'rig-health', priority: 'PRIMARY' }],
    briefing: 'Cross-rig oversight. Attests witness behavior across all rigs.',
  },
  'witness-alpha': {
    slot: 'witness',
    disposition: { socialOrient: 'collaborative', ruleFollowing: 'principled' },
    capabilities: [{ name: 'code-review' }, { name: 'attestation' }],
    goals: [{ name: 'code-quality', priority: 'PRIMARY' }],
    briefing: 'Rig-level observer and attestor for Rig Alpha.',
  },
  'witness-beta': {
    slot: 'witness',
    disposition: { socialOrient: 'collaborative', ruleFollowing: 'principled' },
    capabilities: [{ name: 'code-review' }, { name: 'attestation' }],
    goals: [{ name: 'code-quality', priority: 'PRIMARY' }],
    briefing: 'Rig-level observer and attestor for Rig Beta.',
  },
  'polecat-1': {
    slot: 'worker',
    disposition: { autonomy: 'semi-auto', riskAppetite: 'measured' },
    capabilities: [{ name: 'full-stack-code-work' }],
    goals: [{ name: 'deliver-features' }],
    briefing: 'Primary worker in Rig Alpha. Backed up by polecat-2 for code analysis.',
  },
  'polecat-2': {
    slot: 'worker',
    disposition: { autonomy: 'semi-auto', riskAppetite: 'measured' },
    capabilities: [{ name: 'full-stack-code-work' }],
    goals: [{ name: 'deliver-features' }],
    briefing: 'Secondary worker in Rig Alpha. Backs up polecat-1 for code analysis.',
  },
  'polecat-3': {
    slot: 'worker',
    disposition: { autonomy: 'semi-auto', riskAppetite: 'measured' },
    capabilities: [{ name: 'full-stack-code-work' }],
    goals: [{ name: 'deliver-features' }],
    briefing: 'Solo worker in Rig Beta. No backup (single worker in rig).',
  },
};

const ARCHETYPES: Record<string, { yaml: string; agents?: Record<string, AgentDescriptor> }> = {
  'Gastown (Rich)': { yaml: GASTOWN, agents: GASTOWN_AGENTS },
  'Simple Structure': { yaml: SIMPLE_STRUCTURE },
  'Federation': { yaml: FEDERATION },
  'Pipeline': { yaml: PIPELINE },
};

@customElement('blocks-example-org-diagram')
export class OrgDiagramPage extends LitElement {
  @state() private _yaml = GASTOWN;
  @state() private _agents: Record<string, AgentDescriptor> | undefined = GASTOWN_AGENTS;
  @state() private _selected = 'Gastown (Rich)';

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
          const entry = ARCHETYPES[name];
          this._yaml = entry?.yaml ?? SIMPLE_STRUCTURE;
          this._agents = entry?.agents;
        }}>
          ${Object.keys(ARCHETYPES).map(name => html`
            <option ?selected=${name === this._selected}>${name}</option>
          `)}
        </select>
      </div>
      <div class="diagram-container">
        <blocks-org-diagram .yaml=${this._yaml} .agents=${this._agents}></blocks-org-diagram>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'blocks-example-org-diagram': OrgDiagramPage; }
}
