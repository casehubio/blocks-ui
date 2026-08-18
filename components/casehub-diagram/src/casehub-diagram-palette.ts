import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

type ElementType = 'binding' | 'worker' | 'milestone' | 'goal';

const ITEMS: { type: ElementType; label: string; shape: string }[] = [
  { type: 'binding', label: 'Binding', shape: '╭─╮' },
  { type: 'worker', label: 'Worker', shape: '┌─┐' },
  { type: 'milestone', label: 'Milestone', shape: '◇' },
  { type: 'goal', label: 'Goal', shape: '⬡' },
];

@customElement('casehub-diagram-palette')
export class CasehubDiagramPalette extends LitElement {
  @property({ type: Boolean }) disabled = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'toolbar');
    this.setAttribute('aria-label', 'Diagram palette');
    this.setAttribute('aria-orientation', 'vertical');
  }

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('disabled')) {
      this.setAttribute('aria-disabled', String(this.disabled));
    }
  }

  static override styles = css`
    :host { display: flex; flex-direction: column; gap: 4px; padding: 6px; width: 56px; box-sizing: border-box; }
    button {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      border: 1px solid var(--pages-border-color, #ddd); border-radius: 6px;
      background: var(--pages-surface-color, #fff); cursor: pointer;
      padding: 6px 2px; font-size: 9px;
      color: var(--pages-text-secondary, #666);
      font-family: var(--pages-font-family, system-ui, sans-serif);
    }
    button:hover:not(:disabled) { background: var(--pages-surface-raised, #f5f5f5); }
    button:disabled { opacity: 0.4; cursor: default; }
    .shape { font-size: 16px; line-height: 1; }
  `;

  override render() {
    return html`${ITEMS.map(item => html`
      <button ?disabled=${this.disabled} @click=${() => this._emit(item.type)}>
        <span class="shape">${item.shape}</span>
        ${item.label}
      </button>
    `)}`;
  }

  private _emit(elementType: ElementType): void {
    this.dispatchEvent(new CustomEvent('palette-add', {
      bubbles: true, composed: true, detail: { elementType },
    }));
  }
}
