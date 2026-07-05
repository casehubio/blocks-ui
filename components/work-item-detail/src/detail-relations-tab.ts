import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { WorkItemResponse } from '@casehubio/blocks-ui-core';
import { emitPagesEvent } from '@casehubio/blocks-ui-core';

interface RelatedItem {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly relationType: 'parent' | 'child' | 'linked';
}

@customElement('detail-relations-tab')
export class DetailRelationsTab extends LitElement {
  @property({ type: Object }) workItem: WorkItemResponse | null = null;
  @property({ type: Array }) relatedItems: readonly RelatedItem[] = [];

  static override styles = css`
    :host {
      display: block;
      padding: var(--blocks-space-4, 16px);
    }

    .section {
      margin-bottom: var(--blocks-space-4, 16px);
    }

    .section-title {
      font-size: var(--blocks-font-size-base, 14px);
      font-weight: var(--blocks-font-weight-medium, 500);
      margin: 0 0 var(--blocks-space-2, 8px) 0;
      color: var(--blocks-neutral-12, #111);
    }

    .relation-list {
      display: flex;
      flex-direction: column;
      gap: var(--blocks-space-2, 8px);
    }

    .relation-item {
      display: flex;
      align-items: center;
      gap: var(--blocks-space-2, 8px);
      padding: var(--blocks-space-2, 8px);
      border-radius: var(--blocks-radius-sm, 4px);
      background: var(--blocks-neutral-2, #fafafa);
      cursor: pointer;
    }

    @media (prefers-reduced-motion: no-preference) {
      .relation-item {
        transition: background-color 120ms ease-out;
      }
    }

    .relation-item:hover {
      background: var(--blocks-neutral-3, #f3f3f3);
    }

    .relation-item:focus-visible {
      outline: 2px solid var(--blocks-accent-9, #2563eb);
      outline-offset: 2px;
    }

    .relation-icon {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--blocks-accent-9, #2563eb);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--blocks-font-size-xs, 11px);
      font-weight: var(--blocks-font-weight-semibold, 600);
      flex-shrink: 0;
    }

    .relation-content {
      flex: 1;
      min-width: 0;
    }

    .relation-title {
      font-size: var(--blocks-font-size-sm, 12px);
      font-weight: var(--blocks-font-weight-medium, 500);
      color: var(--blocks-neutral-12, #111);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .relation-meta {
      font-size: var(--blocks-font-size-xs, 11px);
      color: var(--blocks-neutral-9, #888);
    }

    .status-pill {
      padding: 2px 6px;
      border-radius: var(--blocks-radius-sm, 4px);
      font-size: var(--blocks-font-size-xs, 11px);
      font-weight: var(--blocks-font-weight-medium, 500);
      background: var(--blocks-neutral-3, #f3f3f3);
      color: var(--blocks-neutral-11, #444);
      flex-shrink: 0;
    }

    .empty {
      text-align: center;
      padding: var(--blocks-space-4, 16px);
      color: var(--blocks-neutral-9, #888);
      font-size: var(--blocks-font-size-sm, 12px);
    }
  `;

  override render(): TemplateResult {
    if (!this.workItem) {
      return html`<div class="empty">No work item selected</div>`;
    }

    const parents = this.relatedItems.filter(item => item.relationType === 'parent');
    const children = this.relatedItems.filter(item => item.relationType === 'child');
    const linked = this.relatedItems.filter(item => item.relationType === 'linked');

    return html`
      ${parents.length > 0
        ? html`
            <div class="section">
              <h3 class="section-title">Parent Work Item</h3>
              <div class="relation-list">
                ${parents.map(item => this._renderRelationItem(item))}
              </div>
            </div>
          `
        : ''}
      ${children.length > 0
        ? html`
            <div class="section">
              <h3 class="section-title">Child Tasks</h3>
              <div class="relation-list">
                ${children.map(item => this._renderRelationItem(item))}
              </div>
            </div>
          `
        : ''}
      ${linked.length > 0
        ? html`
            <div class="section">
              <h3 class="section-title">Linked Cases</h3>
              <div class="relation-list">
                ${linked.map(item => this._renderRelationItem(item))}
              </div>
            </div>
          `
        : ''}
      ${this.relatedItems.length === 0
        ? html`<div class="empty">No related work items</div>`
        : ''}
    `;
  }

  private _renderRelationItem(item: RelatedItem): TemplateResult {
    return html`
      <div
        class="relation-item"
        role="button"
        tabindex="0"
        @click="${() => this._handleItemClick(item.id)}"
        @keydown="${(e: KeyboardEvent) => this._handleItemKeydown(e, item.id)}"
      >
        <div class="relation-icon">${this._getRelationIcon(item.relationType)}</div>
        <div class="relation-content">
          <div class="relation-title">${item.title}</div>
          <div class="relation-meta">${item.id}</div>
        </div>
        <div class="status-pill">${item.status}</div>
      </div>
    `;
  }

  private _getRelationIcon(type: 'parent' | 'child' | 'linked'): string {
    switch (type) {
      case 'parent':
        return '↑';
      case 'child':
        return '↓';
      case 'linked':
        return '→';
    }
  }

  private _handleItemClick(workItemId: string): void {
    emitPagesEvent(document, 'work-item.selected', { workItemId });
  }

  private _handleItemKeydown(e: KeyboardEvent, workItemId: string): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._handleItemClick(workItemId);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'detail-relations-tab': DetailRelationsTab;
  }
}
