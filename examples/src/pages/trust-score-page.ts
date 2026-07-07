import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../../../components/trust-score-panel/src/trust-score-panel.js';
import type { TrustScoreResponse } from '../../../components/trust-score-panel/src/types.js';
import trustScoreData from '../../mock-data/trust-scores.json';

@customElement('trust-score-page')
export class TrustScorePage extends LitElement {
  @state() private _selectedActorId = 'agent-alice';
  @state() private _mode: 'full' | 'compact' = 'full';

  static override styles = css`
    :host {
      display: block;
      padding: var(--spacing-lg, 24px);
      font-family: var(--font-family-base, system-ui, sans-serif);
    }

    h1 {
      margin: 0 0 var(--spacing-md, 16px) 0;
      font-size: var(--font-size-2xl, 24px);
      font-weight: var(--font-weight-bold, 700);
    }

    h2 {
      margin: var(--spacing-xl, 32px) 0 var(--spacing-md, 16px) 0;
      font-size: var(--font-size-xl, 20px);
      font-weight: var(--font-weight-semibold, 600);
    }

    .controls {
      display: flex;
      gap: var(--spacing-md, 16px);
      margin-bottom: var(--spacing-lg, 24px);
      padding: var(--spacing-md, 16px);
      background: var(--color-surface-secondary, #f5f5f5);
      border-radius: var(--border-radius-md, 8px);
    }

    .control-group {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs, 4px);
    }

    .control-group label {
      font-size: var(--font-size-sm, 14px);
      font-weight: var(--font-weight-semibold, 600);
      color: var(--color-text-secondary, #666);
    }

    select {
      padding: var(--spacing-sm, 8px);
      border: 1px solid var(--color-border, #d1d5db);
      border-radius: var(--border-radius-sm, 4px);
      font-size: var(--font-size-base, 16px);
      background: white;
    }

    .demo-section {
      margin-top: var(--spacing-lg, 24px);
      padding: var(--spacing-md, 16px);
      border: 1px solid var(--color-border, #d1d5db);
      border-radius: var(--border-radius-md, 8px);
    }

    .compact-examples {
      display: flex;
      gap: var(--spacing-md, 16px);
      flex-wrap: wrap;
    }

    .compact-example {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm, 8px);
    }

    .compact-example label {
      font-size: var(--font-size-sm, 14px);
      color: var(--color-text-secondary, #666);
    }

    .event-log {
      margin-top: var(--spacing-lg, 24px);
      padding: var(--spacing-md, 16px);
      background: var(--color-surface-secondary, #f5f5f5);
      border-radius: var(--border-radius-md, 8px);
      max-height: 200px;
      overflow-y: auto;
    }

    .event-log h3 {
      margin: 0 0 var(--spacing-sm, 8px) 0;
      font-size: var(--font-size-base, 16px);
      font-weight: var(--font-weight-semibold, 600);
    }

    .event-log pre {
      margin: 0;
      font-size: var(--font-size-sm, 14px);
      font-family: monospace;
      white-space: pre-wrap;
    }
  `;

  private _mockFetch = async (url: string): Promise<Response> => {
    // Extract actorId from URL: /api/v1/ledger/trust/{actorId}
    const match = url.match(/\/trust\/([^/]+)/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), { status: 400 });
    }

    const actorId = match[1];
    const actor = (trustScoreData.actors as TrustScoreResponse[]).find(
      (a) => a.actorId === actorId
    );

    if (!actor) {
      return new Response(JSON.stringify({ error: 'Actor not found' }), { status: 404 });
    }

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    return new Response(JSON.stringify(actor), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  private _handleCapabilitySelected(e: CustomEvent) {
    if (e.detail.topic === 'trust.capability-selected') {
      const { tag, score, actorId } = e.detail.data;
      console.log('Capability selected:', { tag, score, actorId });
      this._logEvent(`Capability selected: ${tag} (score: ${score}) for ${actorId}`);
    }
  }

  @state() private _eventLog: string[] = [];

  private _logEvent(message: string) {
    this._eventLog = [
      `[${new Date().toLocaleTimeString()}] ${message}`,
      ...this._eventLog.slice(0, 9),
    ];
  }

  override render() {
    return html`
      <h1>Trust Score Panel Demo</h1>

      <div class="controls">
        <div class="control-group">
          <label for="actor-select">Select Actor</label>
          <select
            id="actor-select"
            @change=${(e: Event) => {
              this._selectedActorId = (e.target as HTMLSelectElement).value;
            }}
          >
            ${(trustScoreData.actors as TrustScoreResponse[]).map(
              (actor) => html`
                <option value=${actor.actorId} ?selected=${actor.actorId === this._selectedActorId}>
                  ${actor.actorId} ${actor.globalScore ? `(${actor.globalScore.toFixed(2)})` : '(no data)'}
                </option>
              `
            )}
          </select>
        </div>

        <div class="control-group">
          <label for="mode-select">Display Mode</label>
          <select
            id="mode-select"
            @change=${(e: Event) => {
              this._mode = (e.target as HTMLSelectElement).value as 'full' | 'compact';
            }}
          >
            <option value="full">Full</option>
            <option value="compact">Compact</option>
          </select>
        </div>
      </div>

      <div class="demo-section" @pages-event=${this._handleCapabilitySelected}>
        <trust-score-panel
          .mode=${this._mode}
          .actorId=${this._selectedActorId}
          endpoint="http://mock.local/api/v1/ledger"
          .fetchFn=${this._mockFetch}
        ></trust-score-panel>
      </div>

      <h2>Compact Mode Examples (Pre-fetched Data)</h2>
      <div class="compact-examples">
        ${(trustScoreData.actors as TrustScoreResponse[])
          .filter((a) => a.globalScore !== undefined)
          .map((actor) => {
            const level =
              actor.globalScore! >= 0.7 ? 'high' : actor.globalScore! >= 0.4 ? 'adequate' : 'low';
            return html`
              <div class="compact-example">
                <label>${actor.actorId}:</label>
                <trust-score-panel
                  mode="compact"
                  .score=${actor.globalScore}
                  .trustLevel=${level}
                ></trust-score-panel>
              </div>
            `;
          })}
        <div class="compact-example">
          <label>No data:</label>
          <trust-score-panel mode="compact" trustLevel="none"></trust-score-panel>
        </div>
      </div>

      ${this._eventLog.length > 0
        ? html`
            <div class="event-log">
              <h3>Event Log</h3>
              <pre>${this._eventLog.join('\n')}</pre>
            </div>
          `
        : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'trust-score-page': TrustScorePage;
  }
}
