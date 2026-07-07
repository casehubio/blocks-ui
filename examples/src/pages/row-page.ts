import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { WorkItemResponse } from '@casehubio/blocks-ui-core';
import '@casehubio/blocks-ui-work-item-row';

@customElement('row-page')
export class RowPage extends LitElement {
  @state() private items: WorkItemResponse[] = [];

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin-bottom: 16px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin-bottom: 16px; color: var(--pages-neutral-11, #555); font-size: 14px; }
    .rows { max-width: 800px; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 6px; overflow: hidden; }
  `;

  override async connectedCallback() {
    super.connectedCallback();
    const resp = await fetch('/workitems/inbox');
    const data = await resp.json();
    this.items = (data as Array<{ item: WorkItemResponse }>).map(d => d.item).slice(0, 6);
  }

  override render() {
    return html`
      <h2>Work Item Row</h2>
      <p>Shared row component used by the inbox and queue board. Shows priority border, status pill, category, and age.</p>
      <div class="rows">
        ${this.items.map(item => html`<work-item-row .item=${item}></work-item-row>`)}
      </div>
    `;
  }
}
