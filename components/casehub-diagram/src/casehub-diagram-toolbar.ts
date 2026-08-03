import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('casehub-diagram-toolbar')
export class CasehubDiagramToolbar extends LitElement {
  @property({ type: Boolean }) dirty = false;
  @property({ type: Boolean }) saving = false;
  @property({ type: Boolean }) hasBackend = false;

  static override styles = css`
    :host { display: flex; align-items: center; gap: 8px; padding: 4px 12px; border-bottom: 1px solid var(--pages-border-color, #ddd); height: 32px; box-sizing: border-box; font-family: var(--pages-font-family, system-ui, sans-serif); }
    button {
      border: 1px solid var(--pages-border-color, #ccc); border-radius: 4px;
      background: var(--pages-surface-color, #fff); cursor: pointer;
      padding: 2px 10px; font-size: 12px; color: var(--pages-text-color, #333);
      display: flex; align-items: center; gap: 4px;
    }
    button:hover:not(:disabled) { background: var(--pages-surface-raised, #f5f5f5); }
    button:disabled { opacity: 0.4; cursor: default; }
    .dirty-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--pages-warning-color, #f59e0b); }
  `;

  override render() {
    if (!this.hasBackend) return nothing;

    return html`
      <button ?disabled=${!this.dirty || this.saving} @click=${this._save}>
        ${this.saving ? 'Saving…' : 'Save'}
      </button>
      ${this.dirty ? html`<span class="dirty-dot"></span>` : nothing}
    `;
  }

  private _save(): void {
    this.dispatchEvent(new CustomEvent('toolbar-save', { bubbles: true, composed: true }));
  }
}
