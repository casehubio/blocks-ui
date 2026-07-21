import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { QhorusMessage } from './types.js';
import { commitmentStateCategory, isObligationCreating } from './types.js';
import { emitPagesEvent } from '@casehubio/blocks-ui-core';
import { ChannelEventTopics } from './events.js';
import type { CommitmentRecord } from './commitment.js';

@customElement('channel-task-panel')
export class ChannelTaskPanelElement extends LitElement {
  @property({ type: Array }) messages: QhorusMessage[] = [];
  @property({ type: Object }) commitments: Map<string, CommitmentRecord> = new Map();
  @property({ type: String }) selectedMessageId?: string;

  static override readonly styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow-y: auto;
      font-family: var(--pages-font-family);
    }
    .panel-title {
      font-size: var(--pages-font-size-sm);
      font-weight: var(--pages-font-weight-semibold);
      padding: var(--pages-space-3) var(--pages-space-4);
      border-bottom: 1px solid var(--pages-neutral-4);
      color: var(--pages-neutral-12);
    }
    .group-label {
      font-size: var(--pages-font-size-xs);
      font-weight: var(--pages-font-weight-medium);
      color: var(--pages-neutral-8);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: var(--pages-space-2) var(--pages-space-4) var(--pages-space-1);
    }
    .task-row {
      display: flex;
      flex-direction: column;
      gap: var(--pages-space-1);
      padding: var(--pages-space-2) var(--pages-space-4);
      cursor: pointer;
      border-bottom: 1px solid var(--pages-neutral-3);
    }
    .task-row:hover { background: var(--pages-neutral-2); }
    .task-row.selected { background: var(--pages-accent-2); }
    .task-row.overdue { border-left: 3px solid var(--pages-danger-9); }
    .task-header {
      display: flex;
      align-items: center;
      gap: var(--pages-space-2);
    }
    .state-badge {
      font-size: 10px;
      font-weight: var(--pages-font-weight-medium);
      padding: 1px 6px;
      border-radius: var(--pages-radius-sm);
      text-transform: uppercase;
    }
    .badge-active { background: var(--pages-accent-3); color: var(--pages-accent-11); }
    .badge-info { background: var(--pages-info-3); color: var(--pages-info-11); }
    .badge-success { background: var(--pages-success-3); color: var(--pages-success-11); }
    .badge-danger { background: var(--pages-danger-3); color: var(--pages-danger-11); }
    .badge-neutral { background: var(--pages-neutral-3); color: var(--pages-neutral-9); }
    .badge-transfer { background: var(--pages-info-3); color: var(--pages-info-11); }
    .badge-warning { background: var(--pages-warning-3); color: var(--pages-warning-11); }
    .sender-target {
      font-size: var(--pages-font-size-xs);
      color: var(--pages-neutral-9);
    }
    .content-preview {
      font-size: var(--pages-font-size-sm);
      color: var(--pages-neutral-11);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .timestamp {
      font-size: var(--pages-font-size-xs);
      color: var(--pages-neutral-8);
    }
    .deadline-indicator {
      font-size: var(--pages-font-size-xs);
      color: var(--pages-danger-9);
      font-weight: var(--pages-font-weight-medium);
    }
    .terminal-group { opacity: 0.7; }
    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--pages-neutral-8);
      font-size: var(--pages-font-size-sm);
    }
  `;

  private _commands(): QhorusMessage[] {
    return this.messages.filter(m => isObligationCreating(m.messageType));
  }

  private _isOverdue(record: CommitmentRecord | undefined): boolean {
    if (!record?.deadline) return false;
    return record.state === 'OPEN' && new Date(record.deadline) < new Date();
  }

  private _isTerminal(state: string): boolean {
    return ['FULFILLED', 'FAILED', 'DECLINED', 'DELEGATED', 'EXPIRED'].includes(state);
  }

  private _formatTime(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'now';
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    return `${Math.floor(diffHr / 24)}d`;
  }

  private _onRowClick(msg: QhorusMessage) {
    emitPagesEvent(this, ChannelEventTopics.MESSAGE_SELECTED, { message: msg });
  }

  override render() {
    const commands = this._commands();
    if (commands.length === 0) {
      return html`<div class="panel-title">Tasks</div><div class="empty">No commitments in this channel</div>`;
    }

    const active: QhorusMessage[] = [];
    const overdue: QhorusMessage[] = [];
    const terminal: QhorusMessage[] = [];

    for (const cmd of commands) {
      const record = this.commitments.get(cmd.id);
      const state = record?.state ?? 'OPEN';
      if (this._isOverdue(record)) {
        overdue.push(cmd);
      } else if (this._isTerminal(state)) {
        terminal.push(cmd);
      } else {
        active.push(cmd);
      }
    }

    return html`
      <div class="panel-title">Tasks</div>
      ${overdue.length > 0 ? html`
        <div class="group-label">Overdue</div>
        ${overdue.map(m => this._renderRow(m))}
      ` : nothing}
      ${active.length > 0 ? html`
        <div class="group-label">Active</div>
        ${active.map(m => this._renderRow(m))}
      ` : nothing}
      ${terminal.length > 0 ? html`
        <div class="group-label terminal-group">Completed</div>
        <div class="terminal-group">
          ${terminal.map(m => this._renderRow(m))}
        </div>
      ` : nothing}
    `;
  }

  private _renderRow(msg: QhorusMessage) {
    const record = this.commitments.get(msg.id);
    const state = record?.state ?? 'OPEN';
    const category = commitmentStateCategory(state as any);
    const isOverdue = this._isOverdue(record);
    const isSelected = this.selectedMessageId === msg.id;

    return html`
      <div class="task-row ${isOverdue ? 'overdue' : ''} ${isSelected ? 'selected' : ''}"
           @click=${() => this._onRowClick(msg)}>
        <div class="task-header">
          <span class="state-badge badge-${category}">${state}</span>
          <span class="timestamp">${this._formatTime(msg.createdAt)}</span>
          ${isOverdue && record?.deadline ? html`
            <span class="deadline-indicator">overdue</span>
          ` : nothing}
        </div>
        <div class="content-preview">${msg.content.split('\n')[0]}</div>
        <div class="sender-target">
          ${msg.sender}${msg.target ? html` → ${msg.target}` : nothing}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'channel-task-panel': ChannelTaskPanelElement;
  }
}
