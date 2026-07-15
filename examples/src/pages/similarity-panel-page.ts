import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../../../components/similarity-panel/src/similarity-panel.js';
import type { Precedent } from '../../../components/similarity-panel/src/types.js';
import precedentData from '../../mock-data/precedents.json';

@customElement('similarity-panel-page')
export class SimilarityPanelPage extends LitElement {
  @state() private _eventLog: string[] = [];

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin-bottom: 8px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin-bottom: 24px; color: var(--pages-neutral-11, #555); font-size: 14px; }
    h3 { margin: 24px 0 12px; font-size: 16px; font-weight: 600; }
    .demo-section { margin-bottom: 32px; padding: 16px; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 6px; background: var(--pages-neutral-1, #fff); }
    .event-log { margin-top: 24px; padding: 16px; background: var(--pages-neutral-2, #f5f5f5); border-radius: 8px; max-height: 150px; overflow-y: auto; }
    .event-log h3 { margin: 0 0 8px; font-size: 14px; }
    .event-log pre { margin: 0; font-size: 13px; font-family: monospace; white-space: pre-wrap; }
  `;

  private _handleEvent(e: CustomEvent) {
    if (e.detail.topic === 'precedent.selected') {
      const { caseId, similarity, outcome } = e.detail.data ?? e.detail.payload ?? {};
      this._eventLog = [
        `[${new Date().toLocaleTimeString()}] Selected: ${caseId} (${similarity}% — ${outcome})`,
        ...this._eventLog.slice(0, 9),
      ];
    }
  }

  override render() {
    return html`
      <h2>Similarity Panel</h2>
      <p>Similar past cases with similarity bar and outcome badges. Renders via pages-table.</p>

      <h3>With Data (Property Injection)</h3>
      <div class="demo-section" @pages-event=${this._handleEvent}>
        <similarity-panel
          .data=${precedentData.precedents as Precedent[]}
        ></similarity-panel>
      </div>

      <h3>Empty State</h3>
      <div class="demo-section">
        <similarity-panel .data=${[]}></similarity-panel>
      </div>

      <h3>Custom Empty Message</h3>
      <div class="demo-section">
        <similarity-panel .data=${[]} empty-message="No matching precedents for this case"></similarity-panel>
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
    'similarity-panel-page': SimilarityPanelPage;
  }
}
