import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { WorkIdentity } from '@casehubio/blocks-ui-core';
import '@casehubio/blocks-ui-work-item-inbox';

const IDENTITY: WorkIdentity = {
  userId: 'demo-user',
  displayName: 'Demo User',
  groups: ['compliance', 'clinical-safety', 'household', 'device-ops', 'code-review'],
};

@customElement('queue-inbox-page')
export class QueueInboxPage extends LitElement {
  static override styles = css`
    :host { display: block; height: 100%; }
    h2 { padding: 24px 24px 8px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { padding: 0 24px 16px; color: var(--pages-neutral-11, #555); font-size: 14px; }
    work-item-inbox { display: block; height: calc(100% - 80px); }
  `;

  override render() {
    return html`
      <h2>Queue + Inbox Integration</h2>
      <p>Select a queue pill to scope. Tabs compose with queue scope. Filter pills show counts and disable at zero.</p>
      <work-item-inbox endpoint="" .identity=${IDENTITY}></work-item-inbox>
    `;
  }
}
