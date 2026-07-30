import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '@casehubio/blocks-ui-document-workbench';
import { MOCK_ENTRIES } from '../../mock-data/document-workbench.js';

@customElement('blocks-example-debate-feed')
export class DebateFeedPage extends LitElement {
  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin: 0 0 8px; font-size: 18px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin: 0 0 16px; font-size: 14px; color: var(--pages-neutral-10, #666); }
    .demo { height: 500px; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 8px; overflow: hidden; }
  `;

  override render() {
    return html`
      <h2>Debate Feed</h2>
      <p>Adversarial debate conversation — entries grouped by round, colour-coded by type. Human entries show a badge. Click an entry to emit point-selected.</p>
      <div class="demo"><debate-feed id="feed"></debate-feed></div>
    `;
  }

  override firstUpdated() {
    const feed = this.shadowRoot!.querySelector('#feed') as any;
    feed.configure({ debateSessionId: 'demo-session' });
    feed._entries = [...MOCK_ENTRIES];
  }
}
