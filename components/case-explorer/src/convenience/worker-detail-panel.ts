import { LitElement, html, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { DetailRenderer } from '../types.js';
import { workerType } from '../presets.js';
import '../entity-detail.js';

@customElement('worker-detail-panel')
export class WorkerDetailPanel extends LitElement {
  @property({ type: String }) endpoint = '';
  @property({ attribute: false }) detailRenderer?: DetailRenderer;
  @property({ attribute: false }) detailRendererMap?: Record<string, string | DetailRenderer>;
  @property({ type: String, attribute: 'selection-topic' }) selectionTopic = 'worker';
  @property({ attribute: false }) fetchFn: typeof fetch = fetch;

  override render(): TemplateResult {
    const reg = { ...workerType({ listEndpoint: this.endpoint }), detailRenderer: this.detailRenderer, detailRendererMap: this.detailRendererMap };
    return html`<entity-detail .registration=${reg} selection-topic=${this.selectionTopic} .fetchFn=${this.fetchFn}></entity-detail>`;
  }
}
