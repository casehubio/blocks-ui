import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '@casehubio/blocks-ui-document-workbench';
import { MOCK_DOC_A, MOCK_DOC_B } from '../../mock-data/document-workbench.js';

@customElement('blocks-example-document-diff')
export class DocumentDiffPage extends LitElement {
  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin: 0 0 8px; font-size: 18px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin: 0 0 16px; font-size: 14px; color: var(--pages-neutral-10, #666); }
    .demo { height: 500px; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 8px; overflow: hidden; }
  `;

  override render() {
    return html`
      <h2>Document Diff</h2>
      <p>Two-panel markdown diff viewer with LCS line diff, word-level highlights, canvas minimap, and heading-based scroll sync.</p>
      <div class="demo"><document-diff id="diff"></document-diff></div>
    `;
  }

  override firstUpdated() {
    const diff = this.shadowRoot!.querySelector('#diff') as any;
    diff.loadContent('a', MOCK_DOC_A, 'Original');
    diff.loadContent('b', MOCK_DOC_B, 'Revised');
  }
}
