import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '@casehubio/blocks-ui-document-workbench';

@customElement('blocks-example-workspace-status')
export class WorkspaceStatusPage extends LitElement {
  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin: 0 0 8px; font-size: 18px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin: 0 0 16px; font-size: 14px; color: var(--pages-neutral-10, #666); }
    .topbar-mock { display: flex; align-items: center; gap: 16px; padding: 8px 16px; background: var(--pages-neutral-2, #f5f5f5); border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 8px; }
    .topbar-label { font-size: 12px; color: var(--pages-neutral-8, #888); }
  `;

  override render() {
    return html`
      <h2>Workspace Status</h2>
      <p>Inline workspace watching progress — pulsing dot, agent name, elapsed time, cost. Responds to workspace-progress pages-events.</p>
      <div class="topbar-mock">
        <span class="topbar-label">Topbar mock:</span>
        <workspace-status id="status"></workspace-status>
      </div>
    `;
  }

  override firstUpdated() {
    const status = this.shadowRoot!.querySelector('#status') as any;
    status._visible = true;
    status._text = 'reviewer-1: analysing §3.2 retry logic...';
    status._elapsed = 42;
  }
}
