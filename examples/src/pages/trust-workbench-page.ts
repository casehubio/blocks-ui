import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../../../components/trust-workbench/src/trust-workbench.js';

@customElement('trust-workbench-page')
export class TrustWorkbenchPage extends LitElement {
  @state() private _actorId = 'agent-alice';
  @state() private _eventLog: string[] = [];

  static override styles = css`
    :host { display: flex; flex-direction: column; padding: 24px; height: 100%; box-sizing: border-box; }
    h2 { margin: 0 0 8px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); flex-shrink: 0; }
    .controls { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-shrink: 0; }
    .controls label { font-size: 13px; color: var(--pages-neutral-11, #555); font-weight: 600; }
    .controls select { padding: 6px 12px; border: 1px solid var(--pages-neutral-6, #ccc); border-radius: 4px; font-size: 13px; }
    .workbench-container { flex: 1; min-height: 0; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 6px; overflow: hidden; }
    .event-log { flex-shrink: 0; margin-top: 12px; padding: 8px 12px; background: var(--pages-neutral-2, #f5f5f5); border-radius: 4px; max-height: 80px; overflow-y: auto; font-size: 12px; font-family: monospace; color: var(--pages-neutral-11, #555); }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('pages-event', this._logEvent);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('pages-event', this._logEvent);
  }

  private _logEvent = (e: Event): void => {
    const detail = (e as CustomEvent).detail;
    if (!detail?.topic) return;
    const topic = detail.topic as string;
    if (topic.startsWith('trust') || topic.startsWith('trust-routing')) {
      this._eventLog = [
        `[${new Date().toLocaleTimeString()}] ${topic}: ${JSON.stringify(detail.payload ?? {})}`.slice(0, 120),
        ...this._eventLog.slice(0, 9),
      ];
    }
  };

  override render() {
    return html`
      <h2>Trust Workbench</h2>
      <div class="controls">
        <label for="actor-select">Actor:</label>
        <select id="actor-select" @change=${(e: Event) => { this._actorId = (e.target as HTMLSelectElement).value; }}>
          <option value="agent-alice" selected>agent-alice (0.87)</option>
          <option value="agent-bob">agent-bob (0.72)</option>
        </select>
      </div>

      <div class="workbench-container">
        <trust-workbench endpoint="/api" actor-id=${this._actorId}></trust-workbench>
      </div>

      ${this._eventLog.length > 0 ? html`
        <div class="event-log">
          ${this._eventLog.map(e => html`<div>${e}</div>`)}
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'trust-workbench-page': TrustWorkbenchPage;
  }
}
