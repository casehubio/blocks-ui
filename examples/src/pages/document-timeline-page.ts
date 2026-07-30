import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '@casehubio/blocks-ui-document-workbench';
import { MOCK_SNAPSHOTS } from '../../mock-data/document-workbench.js';

@customElement('blocks-example-document-timeline')
export class DocumentTimelinePage extends LitElement {
  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin: 0 0 8px; font-size: 18px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin: 0 0 16px; font-size: 14px; color: var(--pages-neutral-10, #666); }
    .demo { border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 8px; overflow: hidden; }
  `;

  override render() {
    return html`
      <h2>Document Timeline</h2>
      <p>Horizontal snapshot strip — click to select A/B comparison pair, shift-click to extend selection. Trail highlighting connects raise/fix/verify rounds.</p>
      <div class="demo"><document-timeline id="timeline"></document-timeline></div>
    `;
  }

  override firstUpdated() {
    const tl = this.shadowRoot!.querySelector('#timeline') as any;
    tl.configure({ sessionId: 'demo-session' });
    tl._snapshots = [...MOCK_SNAPSHOTS];
    tl._selectedA = 0;
    tl._selectedB = 2;
  }
}
