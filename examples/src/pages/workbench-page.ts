import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import type { WorkIdentity } from '@casehubio/blocks-ui-core';
import '@casehubio/blocks-ui-work-item-workbench';

const IDENTITY: WorkIdentity = {
  userId: 'demo-user',
  displayName: 'Demo User',
  groups: ['compliance', 'clinical-safety', 'household', 'device-ops', 'code-review'],
};

@customElement('workbench-page')
export class WorkbenchPage extends LitElement {
  static override styles = css`
    :host { display: block; height: 100%; }
    work-item-workbench { display: block; height: 100%; }
  `;

  override render() {
    return html`
      <work-item-workbench endpoint="" .identity=${IDENTITY}></work-item-workbench>
    `;
  }
}
