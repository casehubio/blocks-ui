import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { WorkItemResponse, WorkItemLifecycleEvent } from '@casehubio/blocks-ui-core';

@customElement('detail-activity-tab')
export class DetailActivityTab extends LitElement {
  @property({ type: Object }) workItem: WorkItemResponse | null = null;
  @property({ type: Array }) events: readonly WorkItemLifecycleEvent[] = [];

  static override styles = css`
    :host {
      display: block;
      padding: var(--blocks-space-4, 16px);
    }

    .timeline {
      display: flex;
      flex-direction: column;
      gap: var(--blocks-space-3, 12px);
    }

    .event {
      display: flex;
      gap: var(--blocks-space-2, 8px);
      padding: var(--blocks-space-2, 8px);
      border-radius: var(--blocks-radius-sm, 4px);
      background: var(--blocks-neutral-2, #fafafa);
    }

    .event-icon {
      width: 24px;
      height: 24px;
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

    .event-content {
      flex: 1;
    }

    .event-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: var(--blocks-space-1, 4px);
    }

    .event-type {
      font-weight: var(--blocks-font-weight-medium, 500);
      font-size: var(--blocks-font-size-sm, 12px);
      color: var(--blocks-neutral-12, #111);
    }

    .event-time {
      font-size: var(--blocks-font-size-xs, 11px);
      color: var(--blocks-neutral-9, #888);
    }

    .event-actor {
      font-size: var(--blocks-font-size-xs, 11px);
      color: var(--blocks-neutral-10, #666);
    }

    .event-detail {
      font-size: var(--blocks-font-size-sm, 12px);
      color: var(--blocks-neutral-11, #444);
      margin-top: var(--blocks-space-0-5, 2px);
    }

    .add-note {
      margin-top: var(--blocks-space-4, 16px);
      padding-top: var(--blocks-space-4, 16px);
      border-top: 1px solid var(--blocks-neutral-5, #e0e0e0);
    }

    .add-note h3 {
      font-size: var(--blocks-font-size-base, 14px);
      font-weight: var(--blocks-font-weight-medium, 500);
      margin: 0 0 var(--blocks-space-2, 8px) 0;
      color: var(--blocks-neutral-12, #111);
    }

    textarea {
      width: 100%;
      min-height: 80px;
      padding: var(--blocks-space-2, 8px);
      border: 1px solid var(--blocks-neutral-6, #ccc);
      border-radius: var(--blocks-radius-sm, 4px);
      font-family: inherit;
      font-size: var(--blocks-font-size-sm, 12px);
      resize: vertical;
    }

    textarea:focus {
      outline: 2px solid var(--blocks-accent-9, #2563eb);
      outline-offset: -1px;
      border-color: var(--blocks-accent-9, #2563eb);
    }

    .note-actions {
      display: flex;
      gap: var(--blocks-space-2, 8px);
      margin-top: var(--blocks-space-2, 8px);
    }

    button {
      padding: var(--blocks-space-1-5, 6px) var(--blocks-space-3, 12px);
      border-radius: var(--blocks-radius-sm, 4px);
      font-family: inherit;
      font-size: var(--blocks-font-size-sm, 12px);
      font-weight: var(--blocks-font-weight-medium, 500);
      cursor: pointer;
      border: none;
    }

    .primary {
      background: var(--blocks-accent-9, #2563eb);
      color: #fff;
    }

    .secondary {
      background: var(--blocks-neutral-3, #f3f3f3);
      color: var(--blocks-neutral-12, #111);
    }

    .empty {
      text-align: center;
      padding: var(--blocks-space-8, 32px);
      color: var(--blocks-neutral-9, #888);
      font-size: var(--blocks-font-size-sm, 12px);
    }
  `;

  override render(): TemplateResult {
    if (!this.workItem) {
      return html`<div class="empty">No work item selected</div>`;
    }

    if (this.events.length === 0) {
      return html`
        <div class="empty">No activity yet</div>
        ${this._renderAddNote()}
      `;
    }

    return html`
      <div class="timeline">
        ${this.events.map(event => this._renderEvent(event))}
      </div>
      ${this._renderAddNote()}
    `;
  }

  private _renderEvent(event: WorkItemLifecycleEvent): TemplateResult {
    return html`
      <div class="event">
        <div class="event-icon">${this._getEventIcon(event.type)}</div>
        <div class="event-content">
          <div class="event-header">
            <span class="event-type">${this._formatEventType(event.type)}</span>
            <span class="event-time">${this._formatTime(event.occurredAt)}</span>
          </div>
          ${event.actor ? html`<div class="event-actor">by ${event.actor}</div>` : ''}
          ${event.detail ? html`<div class="event-detail">${event.detail}</div>` : ''}
          ${event.rationale ? html`<div class="event-detail">${event.rationale}</div>` : ''}
        </div>
      </div>
    `;
  }

  private _renderAddNote(): TemplateResult {
    return html`
      <div class="add-note">
        <h3>Add Note</h3>
        <textarea
          placeholder="Add a note to this work item..."
          @keydown="${this._handleNoteKeydown}"
        ></textarea>
        <div class="note-actions">
          <button class="primary" @click="${this._handleAddNote}">Add Note</button>
          <button class="secondary" @click="${this._handleClearNote}">Clear</button>
        </div>
      </div>
    `;
  }

  private _getEventIcon(type: string): string {
    const firstLetter = type.charAt(0);
    return firstLetter;
  }

  private _formatEventType(type: string): string {
    return type
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }

  private _formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }

  private _handleNoteKeydown(e: KeyboardEvent): void {
    // Ctrl+Enter or Cmd+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      this._handleAddNote();
    }
  }

  private _handleAddNote(): void {
    const textarea = this.shadowRoot?.querySelector('textarea');
    const note = textarea?.value.trim();
    if (!note) return;

    this.dispatchEvent(
      new CustomEvent('add-note', {
        bubbles: true,
        composed: true,
        detail: { note },
      }),
    );

    if (textarea) textarea.value = '';
  }

  private _handleClearNote(): void {
    const textarea = this.shadowRoot?.querySelector('textarea');
    if (textarea) textarea.value = '';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'detail-activity-tab': DetailActivityTab;
  }
}
