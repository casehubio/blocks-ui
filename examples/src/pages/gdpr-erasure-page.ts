import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../../../components/gdpr-erasure-action/src/gdpr-erasure-action.js';

@customElement('gdpr-erasure-page')
export class GdprErasurePage extends LitElement {
  @state() private _subjectLabel = 'Patient';
  @state() private _eventLog: string[] = [];

  private _originalFetch: typeof globalThis.fetch | null = null;

  private _mockFetch = async (url: string, init?: RequestInit): Promise<Response> => {
    await new Promise(r => setTimeout(r, 800));
    const body = init?.body ? JSON.parse(init.body as string) : {};
    if (body.subjectId === 'error') {
      return new Response('', { status: 500 });
    }
    return new Response(JSON.stringify({
      erasureId: `ERASE-${Date.now()}`,
      status: body.subjectId === 'already' ? 'ALREADY_WITHDRAWN' : 'WITHDRAWN',
      timestamp: new Date().toISOString(),
      entryCount: Math.floor(Math.random() * 200) + 10,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin-bottom: 8px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin-bottom: 24px; color: var(--pages-neutral-11, #555); font-size: 14px; }
    h3 { margin: 24px 0 12px; font-size: 16px; font-weight: 600; }
    .controls { margin-bottom: 16px; display: flex; gap: 12px; align-items: center; }
    select { padding: 6px 12px; border: 1px solid var(--pages-neutral-6, #ccc); border-radius: 4px; font-size: 13px; }
    .demo-section { margin-bottom: 32px; padding: 16px; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 6px; background: var(--pages-neutral-1, #fff); }
    .hint { font-size: 12px; color: var(--pages-neutral-9, #888); margin-top: 8px; }
    .event-log { margin-top: 24px; padding: 16px; background: var(--pages-neutral-2, #f5f5f5); border-radius: 8px; max-height: 150px; overflow-y: auto; }
    .event-log h3 { margin: 0 0 8px; font-size: 14px; }
    .event-log pre { margin: 0; font-size: 13px; font-family: monospace; white-space: pre-wrap; }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this._originalFetch = globalThis.fetch;
    globalThis.fetch = this._mockFetch as unknown as typeof fetch;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._originalFetch) {
      globalThis.fetch = this._originalFetch;
      this._originalFetch = null;
    }
  }

  private _handleEvent(e: CustomEvent) {
    if (e.detail.topic === 'gdpr.erasure-completed') {
      const { subjectId, reason, status } = e.detail.data ?? e.detail.payload ?? {};
      this._eventLog = [
        `[${new Date().toLocaleTimeString()}] Erasure: ${subjectId} — ${reason} [${status}]`,
        ...this._eventLog.slice(0, 9),
      ];
    }
  }

  override render() {
    return html`
      <h2>GDPR Erasure Action</h2>
      <p>Three-phase erasure form: input → confirmation (blocks-confirm-dialog) → receipt.</p>

      <div class="controls">
        <select @change=${(e: Event) => { this._subjectLabel = (e.target as HTMLSelectElement).value; }}>
          <option value="Patient" selected>Subject: Patient</option>
          <option value="Customer">Subject: Customer</option>
          <option value="Entity">Subject: Entity</option>
        </select>
      </div>

      <div class="demo-section" @pages-event=${this._handleEvent}>
        <gdpr-erasure-action
          endpoint="http://mock.local/api/erasure"
          .subjectLabel=${this._subjectLabel}
          .reasonOptions=${['GDPR Art.17 Request', 'Data Retention Policy', 'Account Deletion', 'Consent Withdrawal']}
        ></gdpr-erasure-action>
        <p class="hint">Try subject IDs: any text = success, "error" = failure, "already" = already withdrawn</p>
      </div>

      ${this._eventLog.length > 0 ? html`
        <div class="event-log">
          <h3>Event Log</h3>
          <pre>${this._eventLog.join('\n')}</pre>
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdpr-erasure-page': GdprErasurePage;
  }
}
