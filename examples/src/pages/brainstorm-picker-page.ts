import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '@casehubio/blocks-ui-document-workbench';

@customElement('blocks-example-brainstorm-picker')
export class BrainstormPickerPage extends LitElement {
  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin: 0 0 8px; font-size: 18px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin: 0 0 16px; font-size: 14px; color: var(--pages-neutral-10, #666); }
    .topbar-mock { display: flex; align-items: center; gap: 16px; padding: 8px 16px; background: var(--pages-neutral-2, #f5f5f5); border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 8px; }
    .topbar-label { font-size: 12px; color: var(--pages-neutral-8, #888); }
  `;

  override render() {
    return html`
      <h2>Brainstorm Picker</h2>
      <p>Topbar session switcher dropdown — shows active brainstorm sessions for quick switching.</p>
      <div class="topbar-mock">
        <span class="topbar-label">Topbar mock:</span>
        <brainstorm-picker id="picker"></brainstorm-picker>
      </div>
    `;
  }

  override firstUpdated() {
    const picker = this.shadowRoot!.querySelector('#picker') as any;
    picker._sessions = [
      { sessionId: 'session-abc123def', state: 'ACTIVE', optionCount: '4' },
      { sessionId: 'session-xyz789ghi', state: 'ACTIVE', optionCount: '3' },
    ];
  }
}
