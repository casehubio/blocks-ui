import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { createSwfThumbnailRenderer, registerSwfStencils } from '@casehubio/graph-stencil-swf';
import { registerThumbnailRenderer } from '@casehubio/graph-stencil-case';
import '@casehubio/blocks-ui-diagram-workbench';

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
  workers:
    - name: fraud-ml-agent
      capabilities:
        - fraud-scoring
      agent:
        model: claude-sonnet-4-20250514
        instructions: Run ML fraud detection model
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
    - name: routing-engine
      capabilities:
        - claim-routing
      agent:
        model: gpt-4o
        instructions: Determine claim routing
      definitionRef: '#routing-workflow'
  milestones:
    - name: risk-assessed
      condition: "fraud-detection.complete && sanctions-screening.complete"
    - name: decision-made
      condition: "routing-decision.complete"
  goals:
    - name: claim-resolved
      expression:
        all:
          - decision-made
definitions:
  routing-workflow:
    document:
      dsl: "1.0.0"
      namespace: insurance
      name: routing-workflow
      version: "1.0.0"
    do:
      - evaluateComplexity:
          call: http
          with:
            method: post
            endpoint:
              uri: https://api.internal/routing/complexity
      - determineRoute:
          switch:
            - when: \${.evaluateComplexity.output.level == 'high'}
              then: escalateToSenior
            - when: \${.evaluateComplexity.output.level == 'low'}
              then: autoApprove
      - assignAdjuster:
          call: http
          with:
            method: post
            endpoint:
              uri: https://api.internal/routing/assign
`;

@customElement('blocks-example-diagram-workbench')
export class DiagramWorkbenchPage extends LitElement {
  static override styles = css`
    :host { display: flex; flex-direction: column; height: 100%; padding: 24px; box-sizing: border-box; }
    h2 { font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); margin-bottom: 8px; }
    p { color: var(--pages-neutral-11, #555); font-size: 14px; margin-bottom: 24px; }
    .workbench-container { flex: 1; min-height: 0; border: 1px solid var(--pages-neutral-5, #e0e0e0);
      border-radius: 6px; overflow: hidden; }
    blocks-diagram-workbench { width: 100%; height: 100%; }
  `;

  override render() {
    return html`
      <h2>Diagram Workbench</h2>
      <p>Orthogonal diagram drill-down. Click ⤢ on any worker to inspect its definition.
        Workers with inline do: blocks and definitionRef (#routing-workflow) both drill down.
        The right pane renders the appropriate diagram type automatically.</p>
      <div class="workbench-container">
        <blocks-diagram-workbench .yaml=${YAML}></blocks-diagram-workbench>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blocks-example-diagram-workbench': DiagramWorkbenchPage;
  }
}
