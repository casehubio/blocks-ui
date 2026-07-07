import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@casehubio/blocks-ui-core';

@customElement('confirm-dialog-page')
export class ConfirmDialogPage extends LitElement {
  @state() private _basicOpen = false;
  @state() private _persistentOpen = false;
  @state() private _reasonOpen = false;
  @state() private _successOpen = false;
  @state() private _lastResult = '';

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin-bottom: 8px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin-bottom: 24px; color: var(--pages-neutral-11, #555); font-size: 14px; }
    h3 { margin: 24px 0 12px; font-size: 16px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    .demos { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
    .btn {
      padding: 8px 16px;
      border: 1px solid var(--pages-neutral-6, #ccc);
      border-radius: 4px;
      background: var(--pages-neutral-1, #fff);
      cursor: pointer;
      font-size: 14px;
      color: var(--pages-neutral-11, #555);
    }
    .btn:hover { background: var(--pages-neutral-3, #f0f0f0); }
    .btn.danger { border-color: var(--pages-danger-9, #dc2626); color: var(--pages-danger-9, #dc2626); }
    .btn.success { border-color: var(--pages-success-9, #16a34a); color: var(--pages-success-9, #16a34a); }
    .result {
      margin-top: 16px;
      padding: 12px;
      background: var(--pages-neutral-2, #f5f5f5);
      border-radius: 4px;
      font-size: 13px;
      font-family: monospace;
      color: var(--pages-neutral-11, #555);
      min-height: 40px;
    }
    .result-empty { color: var(--pages-neutral-8, #999); font-style: italic; }
  `;

  override render() {
    return html`
      <h2>Confirm Dialog</h2>
      <p>Lightweight confirmation dialog with focus trapping, optional reason field, and persistent mode for safety-critical actions.</p>

      <h3>Variants</h3>
      <div class="demos">
        <button class="btn danger" @click=${() => { this._basicOpen = true; }}>
          Danger (default)
        </button>
        <button class="btn success" @click=${() => { this._successOpen = true; }}>
          Success variant
        </button>
        <button class="btn" @click=${() => { this._persistentOpen = true; }}>
          Persistent (no backdrop dismiss)
        </button>
        <button class="btn" @click=${() => { this._reasonOpen = true; }}>
          With reason field
        </button>
      </div>

      <h3>Last Result</h3>
      <div class="result">
        ${this._lastResult
          ? this._lastResult
          : html`<span class="result-empty">Click a button above to open a dialog...</span>`}
      </div>

      <blocks-confirm-dialog
        .open=${this._basicOpen}
        heading="Delete 3 items?"
        message="This action cannot be undone. The items will be permanently removed."
        confirmLabel="Delete"
        cancelLabel="Keep"
        confirmVariant="danger"
        @confirm=${() => { this._basicOpen = false; this._lastResult = 'Danger dialog: CONFIRMED'; }}
        @cancel=${() => { this._basicOpen = false; this._lastResult = 'Danger dialog: CANCELLED'; }}
      ></blocks-confirm-dialog>

      <blocks-confirm-dialog
        .open=${this._successOpen}
        heading="Approve deployment?"
        message="This will deploy v2.4.1 to production."
        confirmLabel="Deploy"
        cancelLabel="Not yet"
        confirmVariant="success"
        @confirm=${() => { this._successOpen = false; this._lastResult = 'Success dialog: CONFIRMED'; }}
        @cancel=${() => { this._successOpen = false; this._lastResult = 'Success dialog: CANCELLED'; }}
      ></blocks-confirm-dialog>

      <blocks-confirm-dialog
        .open=${this._persistentOpen}
        heading="Authorise PI access?"
        message="This grants Principal Investigator access to unblinded trial data. Click outside will NOT dismiss — you must explicitly choose."
        confirmLabel="Authorise"
        cancelLabel="Deny"
        confirmVariant="danger"
        ?persistent=${true}
        @confirm=${() => { this._persistentOpen = false; this._lastResult = 'Persistent dialog: CONFIRMED (only Escape or button can close)'; }}
        @cancel=${() => { this._persistentOpen = false; this._lastResult = 'Persistent dialog: CANCELLED (via Escape or button)'; }}
      ></blocks-confirm-dialog>

      <blocks-confirm-dialog
        .open=${this._reasonOpen}
        heading="Reject application?"
        message="Please provide a reason for the rejection."
        confirmLabel="Reject"
        cancelLabel="Cancel"
        confirmVariant="danger"
        ?showReason=${true}
        @confirm=${(e: CustomEvent) => { this._reasonOpen = false; this._lastResult = 'Reason dialog: CONFIRMED — reason: ' + (e.detail.reason || '(none provided)'); }}
        @cancel=${() => { this._reasonOpen = false; this._lastResult = 'Reason dialog: CANCELLED'; }}
      ></blocks-confirm-dialog>
    `;
  }
}
