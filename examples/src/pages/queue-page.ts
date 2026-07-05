import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { WorkIdentity } from '@casehubio/blocks-ui-core';
import '@casehubio/blocks-ui-queue-board';

const IDENTITY: WorkIdentity = {
  userId: 'demo-user',
  displayName: 'Demo User',
  groups: ['compliance', 'clinical-safety', 'household', 'device-ops', 'code-review'],
};

@customElement('queue-page')
export class QueuePage extends LitElement {
  static override styles = css`
    :host { display: block; height: 100%; }
    h2 { padding: 24px 24px 8px; font-size: 20px; font-weight: 600; color: var(--blocks-neutral-12, #111); }
    p { padding: 0 24px 16px; color: var(--blocks-neutral-11, #555); font-size: 14px; }
    queue-board { display: block; height: calc(100% - 80px); }
  `;

  override render() {
    return html`
      <h2>Queue Board</h2>
      <p>Dashboard view of work queues. Click a card to expand its items. Arrow keys navigate, Escape returns.</p>
      <queue-board endpoint="" .identity=${IDENTITY}></queue-board>
    `;
  }
}
