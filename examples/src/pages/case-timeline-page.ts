import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { WorkIdentity } from '@casehubio/blocks-ui-core';
import '@casehubio/blocks-ui-case-timeline';
import mockEvents from '../../mock-data/case-events.json';
import type { PagedResponse, EventLogEntryResponse } from '@casehubio/blocks-ui-case-timeline';

@customElement('case-timeline-page')
export class CaseTimelinePage extends LitElement {
  @state() private _mockEndpoint = '/api/mock';
  @state() private _mode: 'full' | 'compact' = 'full';

  private _mockFetch = async (url: string): Promise<Response> => {
    const urlObj = new URL(url, window.location.href);

    if (urlObj.pathname.includes('/cases/') && urlObj.pathname.endsWith('/events')) {
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

    return new Response('Not found', { status: 404 });
  };

  protected override firstUpdated(): void {
    const timeline = this.shadowRoot?.querySelector('case-timeline') as any;
    if (timeline) {
      timeline.fetchFn = this._mockFetch;
      timeline.configure({
        endpoint: this._mockEndpoint,
        identity: {
          userId: 'demo-user',
          tenancyId: 'tenant-1',
          roles: ['CASE_VIEWER'],
        } as WorkIdentity,
        caseId: 'case-fraud-001',
      });
    }
  }

  private _handleModeToggle(): void {
    this._mode = this._mode === 'full' ? 'compact' : 'full';
    this.requestUpdate();
  }

  override render() {
    return html`
      <div class="page-container">
        <div class="header">
          <h1>Case Timeline</h1>
          <p class="description">
            Visualizes case lifecycle events with full (vertical) and compact (horizontal strip) modes. Demonstrates
            event categorization, filtering by stream type, expandable payloads, and keyboard navigation.
          </p>
        </div>

        <div class="controls">
          <button @click="${this._handleModeToggle}">
            Switch to ${this._mode === 'full' ? 'Compact' : 'Full'} Mode
          </button>
        </div>

        <div class="timeline-container">
          <case-timeline mode="${this._mode}"></case-timeline>
        </div>

        <div class="info-panel">
          <h2>Component Features</h2>
          <ul>
            <li><strong>Full Mode:</strong> Vertical timeline with CSS line, categorized nodes (lifecycle/task/agent/milestone/action-gate/orchestration)</li>
            <li><strong>Compact Mode:</strong> Horizontal strip showing lifecycle + milestone events only, with truncation (first 3 + last 2 when >7)</li>
            <li><strong>Filter Bar:</strong> Stream type chips (CASE, WORKER, ORCHESTRATION, TIMER, SYSTEM) to filter visible events</li>
            <li><strong>Expandable Payloads:</strong> Click "Details" to toggle full payload JSON</li>
            <li><strong>Event Emission:</strong> Emits <code>timeline.event-selected</code>, <code>work-item.selected</code> (for tasks), <code>timeline.expand-requested</code></li>
            <li><strong>Accessibility:</strong> ARIA roles, keyboard navigation (Arrow Up/Down), live region announcements</li>
          </ul>

          <h3>Mock Data</h3>
          <p>
            This example uses ${mockEvents.length} mock case events spanning a complete fraud investigation:
          </p>
          <ul>
            <li><strong>Lifecycle events:</strong> CASE_STARTED, CASE_COMPLETED</li>
            <li><strong>Tasks:</strong> 2 tasks created and completed (document review, compliance check)</li>
            <li><strong>Agent activity:</strong> Agent dispatched and completed with trust scores</li>
            <li><strong>Milestones:</strong> 2 milestones reached (initial assessment, risk approval)</li>
            <li><strong>Action gates:</strong> Manager approval required for escalation</li>
            <li><strong>Orchestration:</strong> Risk assessment workflow started and completed</li>
            <li><strong>Timers:</strong> SLA reminder scheduled</li>
          </ul>

          <h3>Try It</h3>
          <ul>
            <li><strong>Full Mode:</strong> Click a node to see the event. Click "Details" to expand payload JSON.</li>
            <li><strong>Filter:</strong> Click stream type chips to toggle visibility of CASE, WORKER, ORCHESTRATION, etc.</li>
            <li><strong>Compact Mode:</strong> Switch to compact to see the horizontal summary strip. Click the strip to emit <code>timeline.expand-requested</code>.</li>
            <li><strong>Keyboard:</strong> Tab to a node, use Arrow Up/Down to navigate, Enter/Space to expand details.</li>
            <li><strong>Hover:</strong> In compact mode, hover over dots to see event type + timestamp tooltip.</li>
          </ul>

          <h3>Node Categorization</h3>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Event Types</th>
                <th>Styling</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Lifecycle</td>
                <td>CASE_STARTED, CASE_COMPLETED, CASE_FAULTED, etc.</td>
                <td>Green dot, prominent styling</td>
              </tr>
              <tr>
                <td>Task</td>
                <td>TASK_CREATED, TASK_COMPLETED, TASK_FAILED</td>
                <td>Amber/orange dot, emits work-item.selected on click</td>
              </tr>
              <tr>
                <td>Agent</td>
                <td>AGENT_DISPATCHED, AGENT_COMPLETED, AGENT_FAILED</td>
                <td>Purple dot, shows worker name + trust score from metadata</td>
              </tr>
              <tr>
                <td>Milestone</td>
                <td>MILESTONE_REACHED, MILESTONE_ACTIVATED, SLA_VIOLATED</td>
                <td>Blue diamond (rotated square)</td>
              </tr>
              <tr>
                <td>Action Gate</td>
                <td>ACTION_GATE_PENDING, ACTION_GATE_APPROVED, ACTION_GATE_REJECTED</td>
                <td>Red dot, decision points</td>
              </tr>
              <tr>
                <td>Orchestration</td>
                <td>ORCHESTRATION_STARTED, ORCHESTRATION_COMPLETED, ORCHESTRATION_ESCALATED</td>
                <td>Grey dot, workflow containers</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  static override styles = css`
    :host {
      display: block;
      padding: 24px;
      font-family: var(--pages-font-family, system-ui);
    }

    .page-container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      margin-bottom: 24px;
    }

    h1 {
      margin: 0 0 8px 0;
      font-size: 28px;
      font-weight: 600;
      color: var(--pages-gray-12, #111827);
    }

    .description {
      margin: 0;
      font-size: 16px;
      color: var(--pages-gray-11, #1f2937);
      line-height: 1.5;
    }

    .controls {
      margin-bottom: 24px;
    }

    .controls button {
      padding: 10px 16px;
      border-radius: 6px;
      border: 1px solid var(--pages-accent-7, #3b82f6);
      background: var(--pages-accent-9, #2563eb);
      color: white;
      font-weight: 500;
      cursor: pointer;
    }

    .controls button:hover {
      background: var(--pages-accent-10, #1d4ed8);
    }

    .timeline-container {
      margin-bottom: 32px;
      border: 1px solid var(--pages-gray-6, #d1d5db);
      border-radius: 8px;
      padding: 16px;
      background: white;
      min-height: 400px;
    }

    .info-panel {
      padding: 24px;
      background: var(--pages-gray-1, #fafbfc);
      border-radius: 8px;
    }

    .info-panel h2 {
      margin: 0 0 16px 0;
      font-size: 20px;
      font-weight: 600;
      color: var(--pages-gray-12, #111827);
    }

    .info-panel h3 {
      margin: 24px 0 12px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--pages-gray-11, #1f2937);
    }

    .info-panel h3:first-of-type {
      margin-top: 0;
    }

    .info-panel ul {
      margin: 0;
      padding-left: 24px;
    }

    .info-panel li {
      margin-bottom: 8px;
      line-height: 1.5;
      color: var(--pages-gray-11, #1f2937);
    }

    .info-panel p {
      margin: 0 0 12px 0;
      line-height: 1.5;
      color: var(--pages-gray-11, #1f2937);
    }

    .info-panel strong {
      color: var(--pages-gray-12, #111827);
    }

    .info-panel code {
      padding: 2px 6px;
      background: var(--pages-gray-3, #e5e7eb);
      border-radius: 3px;
      font-size: 13px;
      font-family: 'Courier New', monospace;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
    }

    th,
    td {
      padding: 8px 12px;
      text-align: left;
      border: 1px solid var(--pages-gray-5, #d1d5db);
    }

    th {
      background: var(--pages-gray-2, #f3f4f6);
      font-weight: 600;
      color: var(--pages-gray-12, #111827);
    }

    td {
      color: var(--pages-gray-11, #1f2937);
      font-size: 14px;
    }
  `;
}
