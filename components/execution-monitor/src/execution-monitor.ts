import { LitElement, html, css, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { LiveRegionMixin } from '@casehubio/pages-primitives/a11y';
import { emitPagesEvent } from '@casehubio/blocks-ui-core';
import { SSEManager } from '@casehubio/pages-data/dist/sse/sse-manager.js';
import type { SSEEvent } from '@casehubio/pages-data/dist/sse/sse-manager.js';
import type {
  ExecutionSnapshot, ExecutionState, AgentRef, AgentResult,
  ExecutionModel, PatternType,
} from '@casehubio/blocks-ui-core';
import '@casehubio/blocks-ui-core';

export const ExecutionMonitorTopics = {
  AGENT_SELECTED: 'execution.agent-selected',
} as const;

@customElement('blocks-execution-monitor')
export class ExecutionMonitor extends LiveRegionMixin(LitElement) {
  @property({ type: String }) endpoint?: string;
  @property({ type: String, attribute: 'execution-id' }) executionId?: string;
  @property({ attribute: false }) data?: ExecutionSnapshot;
  @property({ type: String, attribute: 'selection-topic' }) selectionTopic?: string;
  @property({ type: Number, attribute: 'stale-threshold-ms' }) staleThresholdMs = 30000;
  @property({ attribute: false }) renderAgent?: (agent: AgentRef, result?: AgentResult) => TemplateResult | undefined;
  @property({ attribute: false }) renderModel?: (model: ExecutionModel) => TemplateResult | undefined;

  @state() private _snapshot: ExecutionSnapshot | undefined;
  @state() private _stale = false;
  @state() private _connected = false;

  private _sseManager = new SSEManager();
  private _sseUrl: string | null = null;
  private _staleTimer: ReturnType<typeof setInterval> | null = null;
  private _lastUpdateTime = 0;

  private _sseHandler = (event: SSEEvent) => {
    this._snapshot = event.data as ExecutionSnapshot;
    this._stale = false;
    this._connected = true;
    this._lastUpdateTime = Date.now();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this._startStaleTimer();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._teardownSSE();
    this._stopStaleTimer();
  }

  override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('data') && this.data) {
      this._snapshot = this.data;
      this._stale = false;
    }
    if (changed.has('endpoint') || changed.has('executionId')) {
      this._reconnectSSE();
    }
  }

  private _reconnectSSE(): void {
    this._teardownSSE();
    this._snapshot = undefined;
    if (!this.endpoint || !this.executionId || this.data) return;
    this._sseUrl = `${this.endpoint}/${this.executionId}/state`;
    this._sseManager.subscribe(this._sseUrl, this._sseHandler);
    this._lastUpdateTime = Date.now();
  }

  private _teardownSSE(): void {
    if (this._sseUrl) {
      this._sseManager.unsubscribe(this._sseUrl, this._sseHandler);
      this._sseUrl = null;
    }
    this._connected = false;
  }

  private _startStaleTimer(): void {
    this._staleTimer = setInterval(() => {
      if (!this._sseUrl || !this._connected) return;
      const elapsed = Date.now() - this._lastUpdateTime;
      if (elapsed > this.staleThresholdMs) {
        this._stale = true;
      }
    }, 5000);
  }

  private _stopStaleTimer(): void {
    if (this._staleTimer) {
      clearInterval(this._staleTimer);
      this._staleTimer = null;
    }
  }

  private _isTerminal(state: ExecutionState): boolean {
    return state === 'COMPLETE' || state === 'FAULTED' || state === 'CANCELLED';
  }

  private _handleAgentClick(agent: AgentRef): void {
    const topic = this.selectionTopic ?? ExecutionMonitorTopics.AGENT_SELECTED;
    emitPagesEvent(this, topic, { agentRef: agent });
  }

  private _renderStateBadge(state: ExecutionState): TemplateResult {
    return html`<status-badge domain="execution" state=${state}></status-badge>`;
  }

  private _renderPatternBadge(pattern: PatternType): TemplateResult {
    return html`<status-badge domain="pattern" state=${pattern}></status-badge>`;
  }

  private _renderElapsed(): TemplateResult | typeof nothing {
    if (!this._snapshot?.startedAt) return nothing;
    if (this._isTerminal(this._snapshot.state) && this._snapshot.result) {
      return html`<span class="result-label">${this._snapshot.result}</span>`;
    }
    return html`<span class="elapsed">Started ${this._snapshot.startedAt}</span>`;
  }

  private _renderModelSection(model: ExecutionModel): TemplateResult {
    if (this.renderModel) {
      const custom = this.renderModel(model);
      if (custom !== undefined) return custom;
    }
    const parts: string[] = [];
    if (model.routingStrategy) parts.push(`Routing: ${model.routingStrategy}`);
    if (model.aggregationStrategy) parts.push(`Agg: ${model.aggregationStrategy}`);
    const fp = model.failurePolicy;
    return html`
      <div class="model-section">
        <div class="section-label">Execution Model</div>
        ${parts.length > 0 ? html`<div class="model-strategies">${parts.join('  ')}</div>` : ''}
        <div class="model-failure">Failure: ${fp.routingFailureAction} / ${fp.aggregationFailureAction}</div>
      </div>
    `;
  }

  private _renderAgentRow(agent: AgentRef, result?: AgentResult): TemplateResult {
    if (this.renderAgent) {
      const custom = this.renderAgent(agent, result);
      if (custom !== undefined) return custom;
    }
    return html`
      <div class="agent-row" @click=${() => this._handleAgentClick(agent)}>
        <span class="agent-name">${agent.name ?? agent.id}</span>
        <span class="agent-type-badge">${agent.type}</span>
        ${result
          ? html`
            <status-badge domain="agent" state=${result.status}></status-badge>
            ${result.duration != null ? html`<span class="agent-duration">${(result.duration / 1000).toFixed(1)}s</span>` : ''}
          `
          : html`<span class="agent-active">active</span>`
        }
      </div>
    `;
  }

  private _renderAgentRoster(): TemplateResult {
    if (!this._snapshot) return html``;
    const completed = this._snapshot.completedAgents.length;
    const total = completed + this._snapshot.activeAgents.length;
    return html`
      <div class="roster-section">
        <div class="roster-header">
          <span class="section-label">Agents</span>
          <span class="roster-count">${completed} / ${total}</span>
        </div>
        <div class="roster-list">
          ${this._snapshot.completedAgents.map(r => this._renderAgentRow(r.agentRef, r))}
          ${this._snapshot.activeAgents.map(a => this._renderAgentRow(a))}
        </div>
      </div>
    `;
  }

  override render(): TemplateResult {
    if (!this._snapshot) {
      if (this._sseUrl) return html`<div class="loading">Connecting...</div>`;
      return html`<div class="placeholder">No execution data</div>`;
    }
    const s = this._snapshot;
    const showIteration = s.iteration != null && (s.model.pattern === 'LOOP' || s.model.pattern === 'DEBATE');

    return html`
      ${this._stale ? html`<div class="stale-banner" role="alert">Data may be stale</div>` : ''}
      <div class="header">
        <div class="header-badges">
          ${this._renderStateBadge(s.state)}
          ${this._renderPatternBadge(s.model.pattern)}
        </div>
        ${this._renderElapsed()}
      </div>
      ${this._renderModelSection(s.model)}
      ${this._renderAgentRoster()}
      ${showIteration ? html`<div class="iteration-section">Iteration ${s.iteration} of ${s.model.pattern}</div>` : ''}
    `;
  }

  configure(props: Record<string, unknown>): void {
    if (props.endpoint !== undefined) this.endpoint = props.endpoint as string;
    if (props.executionId !== undefined) this.executionId = props.executionId as string;
  }

  static override styles = css`
    :host { display: block; font-family: var(--pages-font-family, system-ui); }
    .placeholder, .loading { color: var(--pages-neutral-7, #525252); font-size: var(--pages-font-size-sm, 12px); padding: var(--pages-space-4, 16px); text-align: center; }
    .stale-banner { padding: 8px 12px; background: var(--pages-warning-2, #fef5e6); color: var(--pages-warning-11, #7d4e00); font-size: 12px; border-radius: 4px; margin-bottom: 8px; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: var(--pages-space-3, 12px) 0; border-bottom: 1px solid var(--pages-neutral-4, #d4d4d4); }
    .header-badges { display: flex; align-items: center; gap: var(--pages-space-2, 8px); }
    .elapsed { font-size: 12px; color: var(--pages-neutral-9, #525252); }
    .result-label { font-size: 12px; font-weight: 600; color: var(--pages-neutral-11, #333); }
    .model-section { padding: var(--pages-space-3, 12px) 0; border-bottom: 1px solid var(--pages-neutral-4, #d4d4d4); }
    .section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--pages-neutral-9, #525252); letter-spacing: 0.05em; margin-bottom: 4px; }
    .model-strategies { font-size: 13px; color: var(--pages-neutral-11, #333); }
    .model-failure { font-size: 12px; color: var(--pages-neutral-9, #525252); margin-top: 2px; }
    .roster-section { padding: var(--pages-space-3, 12px) 0; }
    .roster-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .roster-count { font-size: 13px; font-weight: 600; color: var(--pages-neutral-11, #333); }
    .roster-list { display: flex; flex-direction: column; gap: 4px; }
    .agent-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 4px; cursor: pointer; font-size: 13px; }
    .agent-row:hover { background: var(--pages-neutral-2, #f5f5f5); }
    .agent-name { font-weight: 500; color: var(--pages-neutral-12, #0a0a0a); min-width: 100px; }
    .agent-type-badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 500; background: var(--pages-neutral-3, #e5e5e5); color: var(--pages-neutral-11, #333); }
    .agent-active { font-size: 12px; color: var(--pages-accent-9, #3b82f6); font-weight: 500; }
    .agent-duration { font-size: 12px; color: var(--pages-neutral-9, #525252); margin-left: auto; }
    .iteration-section { padding: var(--pages-space-3, 12px) 0; font-size: 13px; color: var(--pages-neutral-11, #333); border-top: 1px solid var(--pages-neutral-4, #d4d4d4); }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'blocks-execution-monitor': ExecutionMonitor;
  }
}
