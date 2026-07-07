import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { WorkIdentity } from '@casehubio/blocks-ui-core';
import '@casehubio/blocks-ui-work-item-inbox';

const IDENTITY: WorkIdentity = {
  userId: 'demo-user',
  displayName: 'Demo User',
  groups: ['compliance', 'clinical-safety', 'household', 'device-ops', 'code-review'],
};

@customElement('inbox-page')
export class InboxPage extends LitElement {
  static override styles = css`
    :host { display: block; height: 100%; }
    h2 { padding: 24px 24px 8px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { padding: 0 24px 16px; color: var(--pages-neutral-11, #555); font-size: 14px; }
    work-item-inbox { display: block; height: calc(100% - 80px); }
  `;

  override render() {
    return html`
      <h2>Work Item Inbox</h2>
      <p>Two modes: My Work (assigned items) and Claimable (pending in your groups). Try claiming an item with the C key.</p>
      <work-item-inbox endpoint="" .identity=${IDENTITY}></work-item-inbox>
    `;
  }
}
