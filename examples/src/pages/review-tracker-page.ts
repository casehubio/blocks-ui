import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '@casehubio/blocks-ui-document-workbench';
import { MOCK_ENTRIES } from '../../mock-data/document-workbench.js';

@customElement('blocks-example-review-tracker')
export class ReviewTrackerPage extends LitElement {
  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin: 0 0 8px; font-size: 18px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin: 0 0 16px; font-size: 14px; color: var(--pages-neutral-10, #666); }
    .demo { height: 500px; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 8px; overflow: hidden; }
  `;

  override render() {
    return html`
      <h2>Review Tracker</h2>
      <p>Review point status checklist — progress bar, point selection, human actions (comment, override, prioritise). Points derived from debate entry stream.</p>
      <div class="demo"><review-tracker id="tracker"></review-tracker></div>
    `;
  }

  override firstUpdated() {
    const tracker = this.shadowRoot!.querySelector('#tracker') as any;
    tracker.configure({ debateSessionId: 'demo-session' });
    tracker._entries = [...MOCK_ENTRIES];
  }
}
