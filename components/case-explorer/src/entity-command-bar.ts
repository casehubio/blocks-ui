import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { emitPagesEvent, BlocksConfirmDialog } from '@casehubio/blocks-ui-core';
import { LiveRegionMixin } from '@casehubio/pages-primitives';
void BlocksConfirmDialog;
import type { CommandDescriptor } from './types.js';

export const EntityCommandBarTopics = {
  ENTITY_CHANGED: 'entity.changed',
} as const;

@customElement('entity-command-bar')
export class EntityCommandBar extends LiveRegionMixin(LitElement) {
  @property({ attribute: false }) commands: readonly CommandDescriptor[] = [];
  @property({ type: String, attribute: 'entity-id' }) entityId = '';
  @property({ type: String, attribute: 'entity-type' }) entityType = '';
  @property({ attribute: false }) fetchFn: typeof fetch = fetch;

  @state() private _pendingCommand: CommandDescriptor | null = null;
  @state() private _executing = false;
  @state() private _error: string | null = null;

  static override styles = css`
    :host { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

    button {
      padding: 6px 12px;
      border-radius: 4px;
      border: 1px solid var(--pages-border-color, #ccc);
      background: var(--pages-surface-color, #fff);
      color: var(--pages-text-color, #333);
      cursor: pointer;
      font-size: 0.875rem;
    }

    button:hover { background: var(--pages-hover-color, #f0f0f0); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }

    button.destructive {
      border-color: var(--pages-danger-color, #dc3545);
      color: var(--pages-danger-color, #dc3545);
    }

    button.destructive:hover {
      background: var(--pages-danger-color, #dc3545);
      color: #fff;
    }

    .error {
      color: var(--pages-danger-color, #dc3545);
      font-size: 0.8125rem;
      padding: 4px 8px;
    }
  `;

  override render(): TemplateResult {
    if (this.commands.length === 0) return html``;

    return html`
      ${this.commands.map(cmd => html`
        <button
          class=${cmd.severity === 'destructive' ? 'destructive' : ''}
          aria-label=${cmd.description ?? cmd.label}
          ?disabled=${this._executing}
          @click=${() => this._handleClick(cmd)}
        >${cmd.label}</button>
      `)}
      ${this._pendingCommand ? this._renderConfirmDialog() : nothing}
      ${this._error ? html`<span class="error" role="alert">${this._error}</span>` : nothing}
    `;
  }

  private _renderConfirmDialog(): TemplateResult {
    const cmd = this._pendingCommand!;
    return html`
      <blocks-confirm-dialog
        .open=${true}
        .heading=${cmd.label}
        .message=${cmd.confirmMessage ?? `Are you sure you want to ${cmd.label.toLowerCase()}?`}
        .confirmVariant=${cmd.severity === 'destructive' ? 'danger' : 'neutral'}
        @confirm=${() => this._executeCommand(cmd)}
        @cancel=${() => { this._pendingCommand = null; }}
      ></blocks-confirm-dialog>
    `;
  }

  private _handleClick(cmd: CommandDescriptor): void {
    this._error = null;
    if (cmd.confirmation) {
      this._pendingCommand = cmd;
    } else {
      this._executeCommand(cmd);
    }
  }

  private async _executeCommand(cmd: CommandDescriptor): Promise<void> {
    this._pendingCommand = null;
    this._executing = true;

    try {
      const response = await this.fetchFn(cmd.endpoint, {
        method: cmd.method ?? 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        let message = response.statusText;
        try {
          const body = await response.json();
          if (body.message) message = body.message;
          else if (body.error) message = body.error;
        } catch { /* ignore parse errors */ }
        this._error = message;
        this.announce(`Command failed: ${message}`);
        return;
      }

      this.announce(`${cmd.label} completed successfully`);
      emitPagesEvent(this, EntityCommandBarTopics.ENTITY_CHANGED, {
        entityId: this.entityId,
        entityType: this.entityType,
        command: cmd.name,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this._error = message;
      this.announce(`Command failed: ${message}`);
    } finally {
      this._executing = false;
    }
  }
}
