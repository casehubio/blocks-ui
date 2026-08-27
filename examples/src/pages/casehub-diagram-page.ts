import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { createSwfThumbnailRenderer, registerSwfStencils } from '@casehubio/graph-stencil-swf';
import { registerThumbnailRenderer } from '@casehubio/graph-stencil-case';
import '@casehubio/blocks-ui-casehub-diagram';

registerSwfStencils();
registerThumbnailRenderer('swf', createSwfThumbnailRenderer());

const YAML = `dsl: casehub/1.0
namespace: insurance
name: claim-adjudication
version: "3.0.0"
spec:
  bindings:
    - name: intake-validation
      capability:
        name: schema-validation
        version: "1.0"
    - name: policy-lookup
      capability:
        name: policy-verification
        version: "2.1"
    - name: medical-review
      humanTask:
        form: medical-evidence-review
        assignmentStrategy: trust-weighted
    - name: fraud-detection
      capability:
        name: fraud-scoring
        version: "1.5"
    - name: sanctions-screening
      capability:
        name: sanctions-check
        version: "1.0"
    - name: risk-aggregation
      capability:
        name: risk-assessment
        version: "2.0"
    - name: routing-decision
      capability:
        name: claim-routing
        version: "1.0"
    - name: compliance-sub
      subCase: compliance/regulatory-filing
  workers:
    - name: schema-validator
      capabilities:
        - schema-validation
      agent:
        model: gpt-4o
        instructions: Validate claim payload against JSON Schema
    - name: policy-agent
      capabilities:
        - policy-verification
      a2a:
        url: https://agents.internal/policy-lookup
        skills:
          - policy-verification
    - name: fraud-ml-agent
      capabilities:
        - fraud-scoring
      agent:
        model: claude-sonnet-4-20250514
        instructions: Run ML fraud detection model on enriched claim data
      do:
        - fetchEnrichment:
            call: http
            with:
              method: post
              endpoint:
                uri: https://api.internal/enrich
        - runModel:
            call: http
            with:
              method: post
              endpoint:
                uri: https://api.internal/ml/fraud
        - computeScore:
            set:
              fraudScore: \${.runModel.output.score}
        - checkThreshold:
            switch:
              - when: \${.fraudScore > 0.8}
                then: flagForReview
              - when: \${.fraudScore <= 0.8}
                then: pass
    - name: sanctions-agent
      capabilities:
        - sanctions-check
      mcp:
        url: https://mcp.internal/sanctions
        transport: streamable-http
        tools:
          - screen-entity
      do:
        - fetchPEPLists:
            call: http
            with:
              method: get
              endpoint:
                uri: https://api.internal/sanctions/pep-lists
        - screenClaimant:
            call: http
            with:
              method: post
              endpoint:
                uri: https://api.internal/sanctions/screen
        - routeResult:
            switch:
              - when: \${.screenClaimant.output.hit}
                then: escalateToCompliance
              - when: \${!.screenClaimant.output.hit}
                then: recordClearance
    - name: risk-aggregator
      capabilities:
        - risk-assessment
      sequence:
        - fraud-detection
        - sanctions-screening
      do:
        - aggregateInputs:
            try:
              - combineSanctions:
                  call: http
                  with:
                    method: post
                    endpoint:
                      uri: https://api.internal/risk/sanctions
              - combineFraud:
                  call: http
                  with:
                    method: post
                    endpoint:
                      uri: https://api.internal/risk/fraud
              - combineMedical:
                  call: http
                  with:
                    method: post
                    endpoint:
                      uri: https://api.internal/risk/medical
            catch:
              errors:
                with:
                  type: '*'
              do:
                - handleMissingInput:
                    call: http
                    with:
                      method: post
                      endpoint:
                        uri: https://api.internal/risk/fallback
        - computeOverallRisk:
            call: http
            with:
              method: post
              endpoint:
                uri: https://api.internal/risk/compute
  milestones:
    - name: evidence-gathered
      condition: "intake-validation.complete && policy-lookup.complete"
    - name: risk-assessed
      condition: "fraud-detection.complete && sanctions-screening.complete"
    - name: decision-made
      condition: "routing-decision.complete"
  goals:
    - name: claim-resolved
      expression:
        all:
          - decision-made
          - compliance-sub.complete
`;

@customElement('blocks-example-casehub-diagram')
export class CasehubDiagramPage extends LitElement {
  static override styles = css`
    :host { display: flex; flex-direction: column; height: 100%; padding: 24px; box-sizing: border-box; }
    h2 { font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); margin-bottom: 8px; }
    p { color: var(--pages-neutral-11, #555); font-size: 14px; margin-bottom: 24px; }
    .diagram-container { flex: 1; min-height: 0; border: 1px solid var(--pages-neutral-5, #e0e0e0);
      border-radius: 6px; overflow: hidden; }
    casehub-diagram { width: 100%; height: 100%; }
  `;

  override render() {
    return html`
      <h2>CaseHub Diagram</h2>
      <p>Visual diagram editor for CaseDefinition YAML. Stencil palette (left) with 4 creatable types
        driven by CaseEditPolicy. Click a node to see its schema-driven property palette (right) with
        discriminator rendering for function type, trigger type, model provider, and MCP transport.
        Structural editing: add, delete (with auto-join), undo/redo, and optional runtime overlay.</p>
      <div class="diagram-container">
        <casehub-diagram .yaml=${YAML}></casehub-diagram>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'blocks-example-casehub-diagram': CasehubDiagramPage; }
}
