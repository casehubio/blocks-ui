import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@casehubio/blocks-ui-blocks-timeline';
import { eventChronologyStrategy } from '@casehubio/blocks-ui-blocks-timeline';
import type { CaseEvent, PagedResponse, EventLogEntryResponse } from '@casehubio/blocks-ui-blocks-timeline';
import type { Layout } from '@casehubio/blocks-ui-blocks-timeline';
import mockEvents from '../../mock-data/case-events.json';

@customElement('timeline-events-page')
export class TimelineEventsPage extends LitElement {
  @state() private _layout: Layout = 'vertical';
  private _originalFetch: typeof globalThis.fetch | null = null;

  private _mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const urlObj = new URL(url, window.location.href);

    if (urlObj.pathname.includes('/events')) {
      const response: PagedResponse<EventLogEntryResponse> = {
        content: mockEvents as EventLogEntryResponse[],
        page: 0,
        size: 20,
        totalElements: mockEvents.length,
        totalPages: 1,
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return this._originalFetch!.call(globalThis, input, init);
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this._originalFetch = globalThis.fetch;
    globalThis.fetch = this._mockFetch as typeof globalThis.fetch;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._originalFetch) {
      globalThis.fetch = this._originalFetch;
      this._originalFetch = null;
    }
  }

  private _toggleLayout(): void {
    this._layout = this._layout === 'vertical' ? 'compact' : 'vertical';
  }

  override render() {
    return html`
      <div class="page-container">
        <div class="header">
          <h1>Timeline — Event Chronology</h1>
          <p class="description">
            Chronological event log using eventChronologyStrategy. Displays case lifecycle events
            with category-coloured dots, stream type filtering, expandable payload detail, and
            compact dot strip mode.
          </p>
          <div class="controls">
            <button @click=${this._toggleLayout}>
              Mode: ${this._layout === 'vertical' ? 'Full' : 'Compact'} (click to toggle)
            </button>
          </div>
        </div>

        <div class="viewer-container">
          <blocks-timeline
            .strategy=${eventChronologyStrategy()}
            .data=${mockEvents as CaseEvent[]}
            layout=${this._layout}
          ></blocks-timeline>
        </div>

        <div class="info-panel">
          <h2>Component Features</h2>
          <ul>
            <li><strong>Event Chronology Strategy:</strong> Maps CaseEvent[] to timeline nodes with category colouring and stream type filtering</li>
            <li><strong>Vertical Layout:</strong> Timestamp-anchored event list with expandable payload detail</li>
            <li><strong>Compact Layout:</strong> Temporal-weighted dot strip summary — click to request full view</li>
            <li><strong>Filter Bar:</strong> Toggle stream types (CASE, WORKER, ORCHESTRATION, TIMER, SYSTEM)</li>
            <li><strong>PagedResponse Transform:</strong> Strategy auto-extracts .content from paginated backend responses</li>
          </ul>

          <h3>Mock Data</h3>
          <p>
            ${mockEvents.length} events spanning a fraud investigation case lifecycle —
            CASE_STARTED through CASE_COMPLETED with tasks, agent dispatch, milestones,
            orchestration, gates, and timers.
          </p>

          <h3>Try It</h3>
          <ul>
            <li>Click any event row to see the timeline.node-selected event fire</li>
            <li>Click "Details" on an event to expand the payload tree</li>
            <li>Toggle stream type chips to filter event categories</li>
            <li>Switch to Compact mode to see the temporal-weighted dot strip</li>
            <li>Click the compact strip to fire timeline.expand-requested</li>
          </ul>
        </div>
      </div>
    `;
  }

  static override styles = css`
    :host { display: block; padding: 24px; font-family: var(--pages-font-family, system-ui); }
    .page-container { max-width: 1200px; margin: 0 auto; }
    .header { margin-bottom: 32px; }
    h1 { margin: 0 0 8px 0; font-size: 28px; font-weight: 600; color: var(--pages-gray-12, #111827); }
    .description { margin: 0 0 16px 0; font-size: 16px; color: var(--pages-gray-11, #1f2937); line-height: 1.5; }
    .controls { display: flex; gap: 8px; }
    .controls button { padding: 8px 16px; border: 1px solid var(--pages-gray-6, #d1d5db); border-radius: 6px; background: white; cursor: pointer; font-size: 14px; }
    .controls button:hover { background: var(--pages-gray-2, #f9fafb); }
    .viewer-container { margin-bottom: 32px; border: 1px solid var(--pages-gray-6, #d1d5db); border-radius: 8px; background: white; }
    .info-panel { padding: 24px; background: var(--pages-gray-1, #fafbfc); border-radius: 8px; }
    .info-panel h2 { margin: 0 0 16px 0; font-size: 20px; font-weight: 600; }
    .info-panel h3 { margin: 24px 0 12px 0; font-size: 16px; font-weight: 600; }
    .info-panel ul { margin: 0; padding-left: 24px; }
    .info-panel li { margin-bottom: 8px; line-height: 1.5; }
    .info-panel p { margin: 0 0 12px 0; line-height: 1.5; }
  `;
}
