import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { WorkIdentity, WorkItemResponse } from '@casehubio/blocks-ui-core';
import '@casehubio/blocks-ui-work-item-detail';

const IDENTITY: WorkIdentity = {
  userId: 'demo-user',
  displayName: 'Demo User',
  groups: ['compliance', 'clinical-safety', 'household', 'device-ops', 'code-review'],
};

@customElement('detail-page')
export class DetailPage extends LitElement {
  @state() private items: WorkItemResponse[] = [];
  @state() private selectedId: string | null = null;

  static override styles = css`
    :host { display: flex; height: 100%; }
    .picker { width: 260px; border-right: 1px solid var(--pages-neutral-5, #e0e0e0); overflow-y: auto; padding: 16px; }
    .picker h3 { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: var(--pages-neutral-12); }
    .pick-item { display: block; width: 100%; text-align: left; padding: 8px; margin-bottom: 4px; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 4px; background: var(--pages-neutral-1); cursor: pointer; font-size: 13px; color: var(--pages-neutral-12); }
    .pick-item:hover { background: var(--pages-neutral-3); }
    .pick-item.active { border-color: var(--pages-accent-9); background: var(--pages-accent-2); }
    .pick-item .status { font-size: 11px; color: var(--pages-neutral-9); text-transform: uppercase; }
    .detail-area { flex: 1; overflow: auto; }
    work-item-detail { display: block; height: 100%; }
  `;

  override async connectedCallback() {
    super.connectedCallback();
    const resp = await fetch('/workitems/inbox');
    const data = await resp.json();
    this.items = (data as Array<{ item: WorkItemResponse }>).map(d => d.item);
    if (this.items.length > 0) this.selectedId = this.items[0]!.id;
  }

  override render() {
    return html`
      <div class="picker">
        <h3>Select a work item</h3>
        ${this.items.map(item => html`
          <button class="pick-item ${this.selectedId === item.id ? 'active' : ''}"
            @click=${() => { this.selectedId = item.id; }}>
            ${item.title}
            <div class="status">${item.status} · ${item.priority}</div>
          </button>
        `)}
      </div>
      <div class="detail-area">
        ${this.selectedId
          ? html`<work-item-detail endpoint="" .workItemId=${this.selectedId} .identity=${IDENTITY}></work-item-detail>`
          : html`<div style="padding: 24px; color: var(--pages-neutral-9)">Select an item to view details</div>`}
      </div>
    `;
  }
}
