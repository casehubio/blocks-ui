import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@casehubio/blocks-ui-contributor-workbench';
import contributorData from '../../mock-data/contributor.json';

const MOCK_ENDPOINT = '/mock-api/contributor';
const originalFetch = window.fetch;

function installMockFetch(): void {
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith(MOCK_ENDPOINT + '/contributors/')) {
      await new Promise(r => setTimeout(r, 300));
      return new Response(JSON.stringify(contributorData), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    return originalFetch(input, init);
  }) as typeof window.fetch;
}

installMockFetch();

@customElement('blocks-example-contributor-workbench')
export class ContributorWorkbenchPage extends LitElement {
  @state() private _actorId = 'contributor-chen-m';

  static override styles = css`
    :host { display: flex; flex-direction: column; height: 100%; padding: 24px; box-sizing: border-box; }
    h2 { font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); margin-bottom: 8px; }
    p { color: var(--pages-neutral-11, #555); font-size: 14px; margin-bottom: 24px; }
    .controls { display: flex; gap: 16px; align-items: center; margin-bottom: 16px; }
    label { font-size: 13px; font-weight: 500; color: var(--pages-neutral-11, #555); }
    select { padding: 4px 8px; border-radius: 4px; border: 1px solid var(--pages-neutral-6, #ccc);
      background: var(--pages-neutral-1, #fff); font-size: 13px; color: var(--pages-neutral-12, #111); }
    .workbench-container { flex: 1; min-height: 0; border: 1px solid var(--pages-neutral-5, #e0e0e0);
      border-radius: 6px; overflow: hidden; }
  `;

  override render() {
    return html`
      <h2>Contributor Workbench</h2>
      <p>Contributor trust profile — split-pane layout with intake lane badge, trust score gauge,
        dimension scores (left) and outcome history table (right). Demonstrates trust-weighted
        contributor routing with fast-track / standard / triage classification.</p>
      <div class="controls">
        <label>Contributor:</label>
        <select @change=${(e: Event) => { this._actorId = (e.target as HTMLSelectElement).value; }}>
          <option value="contributor-chen-m">Dr. Chen (Medical Review)</option>
          <option value="contributor-smith-j">J. Smith (AML Analyst)</option>
        </select>
      </div>
      <div class="workbench-container">
        <blocks-contributor-workbench endpoint="${MOCK_ENDPOINT}" actor-id="${this._actorId}">
        </blocks-contributor-workbench>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'blocks-example-contributor-workbench': ContributorWorkbenchPage; }
}
