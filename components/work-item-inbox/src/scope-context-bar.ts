import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { QueueView } from '@casehubio/blocks-ui-core';

@customElement('scope-context-bar')
export class ScopeContextBar extends LitElement {
  @property({ type: Object }) queue: QueueView | null = null;

  static override styles = css`
    :host { display: block; }

    .scope-bar {
      padding: 4px 12px;
      background: var(--blocks-accent-3, #eff6ff);
      border-bottom: 1px solid var(--blocks-accent-6, #bfdbfe);
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .scope-label {
      font-size: 10px;
      color: var(--blocks-accent-11, #1e40af);
      font-weight: 600;
    }

    .scope-tag {
      background: var(--blocks-accent-2, #dbeafe);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      color: var(--blocks-accent-11, #1e40af);
      border: 1px solid var(--blocks-accent-6, #bfdbfe);
    }

    .scope-tag.raw {
      font-family: monospace;
    }

    .clear-btn {
      margin-left: auto;
      font-size: 10px;
      color: var(--blocks-accent-9, #3b82f6);
      cursor: pointer;
      background: none;
      border: none;
      text-decoration: underline;
      padding: 0;
    }

    .clear-btn:focus-visible {
      outline: 2px solid var(--blocks-accent-9, #2563eb);
      outline-offset: 2px;
    }
  `;

  private _parseLabelPattern(pattern: string): Array<{ key: string; value: string } | { raw: string }> {
    const parts = pattern.split(',').map(p => p.trim());
    return parts.map(part => {
      const eqIdx = part.indexOf('=');
      if (eqIdx > 0 && eqIdx < part.length - 1 && !part.includes(' ')) {
        return { key: part.substring(0, eqIdx), value: part.substring(eqIdx + 1) };
      }
      return { raw: part };
    });
  }

  private _handleClear() {
    this.dispatchEvent(new CustomEvent('scope-clear', { bubbles: true, composed: true }));
  }

  override render() {
    if (!this.queue) return nothing;

    const tags = this._parseLabelPattern(this.queue.labelPattern);

    return html`
      <div class="scope-bar" role="status" aria-live="polite">
        <span class="scope-label">SCOPE:</span>
        ${tags.map(tag =>
          'raw' in tag
            ? html`<span class="scope-tag raw">${tag.raw}</span>`
            : html`<span class="scope-tag">${tag.key}=${tag.value}</span>`
        )}
        <button class="clear-btn" @click="${this._handleClear}">✕ clear</button>
      </div>
    `;
  }
}
