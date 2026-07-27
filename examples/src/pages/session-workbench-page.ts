import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '@casehubio/blocks-ui-session-workbench';

@customElement('blocks-example-session-workbench')
export class ExampleSessionWorkbench extends LitElement {
  static override styles = css`
    :host { display: block; height: 100%; padding: 16px; }
    h2 { margin: 0 0 16px; font-size: 18px; font-weight: 600; color: var(--pages-neutral-11, #0a0a0a); }
    .workbench-container { height: calc(100% - 50px); border: 1px solid var(--pages-neutral-4, #d4d4d4); border-radius: 8px; overflow: hidden; }
    .note { font-size: 12px; color: var(--pages-neutral-7, #525252); margin-top: 8px; }
  `;

  override render() {
    return html`
      <h2>Session Workbench</h2>
      <div class="workbench-container">
        <blocks-session-workbench endpoint="/api/sessions"></blocks-session-workbench>
      </div>
      <p class="note">Requires a running claudony instance at /api/sessions. Without one, the list will show a fetch error.</p>
    `;
  }
}
