import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '@casehubio/blocks-ui-document-workbench';
import { MOCK_BRAINSTORM_OPTIONS } from '../../mock-data/document-workbench.js';

@customElement('blocks-example-brainstorm-options')
export class BrainstormOptionsPage extends LitElement {
  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin: 0 0 8px; font-size: 18px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin: 0 0 16px; font-size: 14px; color: var(--pages-neutral-10, #666); }
    .demo { height: 600px; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 8px; overflow: hidden; }
  `;

  override render() {
    return html`
      <h2>Brainstorm Options</h2>
      <p>Interactive option cards with status badges, tradeoffs, and action buttons (recommend, eliminate, select).</p>
      <div class="demo"><brainstorm-options id="options"></brainstorm-options></div>
    `;
  }

  override firstUpdated() {
    const opts = this.shadowRoot!.querySelector('#options') as any;
    opts.configure({ sessionId: 'demo-session' });
    opts._options = [...MOCK_BRAINSTORM_OPTIONS];
  }
}
