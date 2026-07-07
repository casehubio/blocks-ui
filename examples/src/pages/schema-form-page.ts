import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@casehubio/blocks-ui-core';

const SAMPLE_SCHEMA = {
  type: 'object',
  properties: {
    transactionId: { type: 'string' },
    amount: { type: 'number' },
    currency: { type: 'string', enum: ['USD', 'EUR', 'GBP'] },
    flagged: { type: 'boolean' },
    reportDate: { type: 'string', format: 'date' },
    detectedAt: { type: 'string', format: 'date-time' },
    notes: { type: 'string', maxLength: 500 },
    parties: {
      type: 'object',
      properties: {
        sender: { type: 'string' },
        receiver: { type: 'string' },
      },
    },
  },
  required: ['transactionId', 'amount'],
};

const SAMPLE_DATA = {
  transactionId: 'TXN-2026-04521',
  amount: 125000,
  currency: 'USD',
  flagged: true,
  reportDate: '2026-07-06',
  detectedAt: '2026-07-06T14:30:00Z',
  notes: 'Multiple rapid transfers to newly opened accounts in high-risk jurisdictions.',
  parties: { sender: 'Acme Holdings Ltd', receiver: 'Shell Corp 42 LLC' },
};

@customElement('schema-form-page')
export class SchemaFormPage extends LitElement {
  @state() private mode: 'display' | 'edit' = 'display';

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin-bottom: 8px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin-bottom: 16px; color: var(--pages-neutral-11, #555); font-size: 14px; }
    .controls { margin-bottom: 16px; display: flex; gap: 8px; }
    .mode-btn { padding: 6px 14px; border: 1px solid var(--pages-neutral-6); border-radius: 4px; background: var(--pages-neutral-1); cursor: pointer; font-size: 13px; color: var(--pages-neutral-11); }
    .mode-btn.active { background: var(--pages-accent-9); color: white; border-color: var(--pages-accent-9); }
    schema-form { display: block; max-width: 600px; border: 1px solid var(--pages-neutral-5); border-radius: 6px; padding: 16px; background: var(--pages-neutral-1); }
  `;

  override render() {
    return html`
      <h2>Schema Form</h2>
      <p>Renders JSON Schema as read-only display or editable form. Sample: AML suspicious transaction payload.</p>
      <div class="controls">
        <button class="mode-btn ${this.mode === 'display' ? 'active' : ''}" @click=${() => { this.mode = 'display'; }}>Display</button>
        <button class="mode-btn ${this.mode === 'edit' ? 'active' : ''}" @click=${() => { this.mode = 'edit'; }}>Edit</button>
      </div>
      <schema-form .schema=${SAMPLE_SCHEMA} .data=${SAMPLE_DATA} .mode=${this.mode}></schema-form>
    `;
  }
}
