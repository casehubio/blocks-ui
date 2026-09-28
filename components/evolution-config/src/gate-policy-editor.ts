import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { StageDescriptor, GatePolicy, GateMode, ImprovementStreamView } from './types.js';
import { EvolutionApi } from './api.js';
import { emitEvolutionEvent, EvolutionEventTopics } from './events.js';

export interface GatePolicyEditorProps {
  endpoint?: string;
  caseId?: string;
  tenancyId?: string;
  stages?: readonly StageDescriptor[];
  policy?: GatePolicy;
  streams?: readonly ImprovementStreamView[];
  readonly?: boolean;
}

interface DomainGroup {
  domainId: string;
  stages: StageDescriptor[];
}

@customElement('blocks-gate-policy-editor')
export class GatePolicyEditor extends LitElement {
  @property({ type: String }) endpoint?: string;
  @property({ type: String }) caseId?: string;
  @property({ type: String }) tenancyId?: string;
  @property({ type: Array }) stages?: readonly StageDescriptor[];
  @property({ type: Object }) policy?: GatePolicy;
  @property({ type: Array, attribute: false }) streams?: readonly ImprovementStreamView[];
  @property({ type: Boolean }) readonly = false;

  @state() private _loading = false;
  @state() private _error: string | null = null;
  @state() private _fetchedStages: StageDescriptor[] | null = null;
  @state() private _fetchedPolicy: GatePolicy | null = null;
  @state() private _pendingModes = new Map<string, GateMode>();
  @state() private _pendingTimeout: number | null = null;
  @state() private _saving = false;

  private _api?: EvolutionApi;

  static override styles = css`
    :host { display: block; font-family: var(--pages-font-family, system-ui); }
    .domain-group { margin-bottom: 16px; }
    .domain-header {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--pages-neutral-9, #737373);
      padding: 8px 0 4px; border-bottom: 1px solid var(--pages-neutral-4, #e0e0e0);
    }
    .stage-table { width: 100%; border-collapse: collapse; }
    .stage-table th {
      text-align: left; font-size: 11px; font-weight: 600;
      color: var(--pages-neutral-9, #737373); padding: 6px 8px;
      border-bottom: 1px solid var(--pages-neutral-4, #e0e0e0);
    }
    .stage-table td { padding: 6px 8px; border-bottom: 1px solid var(--pages-neutral-3, #f0f0f0); }
    .stage-table tr:hover { background: var(--pages-neutral-2, #fafafa); }
    .checkpoint-badge {
      display: inline-block; width: 8px; height: 8px; border-radius: 50%;
      background: var(--pages-accent-9, #0080ff);
    }
    .checkpoint-badge--no { background: var(--pages-neutral-5, #ccc); }
    .mode-select {
      padding: 4px 8px; border: 1px solid var(--pages-neutral-6, #e0e0e0);
      border-radius: 4px; font-size: 13px; background: white;
    }
    .mode-select--changed {
      border-color: var(--pages-warning-9, #f59e0b);
      background: var(--pages-warning-2, #fffbeb);
    }
    .timeout-row {
      display: flex; align-items: center; gap: 12px;
      margin-top: 16px; padding: 12px;
      background: var(--pages-neutral-2, #fafafa);
      border-radius: 8px;
    }
    .timeout-row label { font-size: 13px; font-weight: 500; }
    .timeout-row input {
      width: 100px; padding: 4px 8px;
      border: 1px solid var(--pages-neutral-6, #e0e0e0);
      border-radius: 4px; font-size: 13px;
    }
    .timeout-row .unit { font-size: 12px; color: var(--pages-neutral-9, #737373); }
    .actions { display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end; }
    .btn-save {
      padding: 8px 20px; background: var(--pages-accent-9, #0080ff); color: white;
      border: none; border-radius: 4px; font-size: 13px; font-weight: 500; cursor: pointer;
    }
    .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-save:not(:disabled):hover { background: var(--pages-accent-10, #0066cc); }
    .btn-reset {
      padding: 8px 20px; background: var(--pages-neutral-3, #f5f5f5);
      color: var(--pages-neutral-11, #555); border: none; border-radius: 4px;
      font-size: 13px; font-weight: 500; cursor: pointer;
    }
    .loading { padding: 24px; color: var(--pages-neutral-9, #737373); text-align: center; }
    .error { padding: 16px; background: var(--pages-danger-3, #fee); color: var(--pages-danger-11, #c00); border-radius: 4px; }
    .empty { padding: 24px; color: var(--pages-neutral-9, #737373); text-align: center; }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'form');
    this.setAttribute('aria-label', 'Gate policy editor');
    if (this.endpoint && !this._api) {
      this._api = new EvolutionApi(this.endpoint);
    }
    if (this._api && this.caseId && this.tenancyId) {
      this._fetch();
    }
  }

  configure(props: Partial<GatePolicyEditorProps>): void {
    if (props.endpoint !== undefined) this.endpoint = props.endpoint;
    if (props.caseId !== undefined) this.caseId = props.caseId;
    if (props.tenancyId !== undefined) this.tenancyId = props.tenancyId;
    if (props.stages !== undefined) this.stages = props.stages;
    if (props.policy !== undefined) this.policy = props.policy;
    if (props.streams !== undefined) this.streams = props.streams;
    if (props.readonly !== undefined) this.readonly = props.readonly;
  }

  private get _stageList(): readonly StageDescriptor[] {
    return this.stages ?? this._fetchedStages ?? [];
  }

  private get _currentPolicy(): GatePolicy {
    return this.policy ?? this._fetchedPolicy ?? { modes: null, gateTimeoutMinutes: null };
  }

  private get _isDirty(): boolean {
    return this._pendingModes.size > 0 || this._pendingTimeout !== null;
  }

  private _groups(): DomainGroup[] {
    const map = new Map<string, StageDescriptor[]>();
    for (const stage of this._stageList) {
      const list = map.get(stage.domainId) ?? [];
      list.push(stage);
      map.set(stage.domainId, list);
    }
    const groups: DomainGroup[] = [];
    for (const [domainId, stages] of map) {
      stages.sort((a, b) => a.ordinal - b.ordinal);
      groups.push({ domainId, stages });
    }
    return groups;
  }

  private _effectiveMode(stageId: string): GateMode {
    if (this._pendingModes.has(stageId)) return this._pendingModes.get(stageId)!;
    const modes = this._currentPolicy.modes;
    if (modes && stageId in modes) return modes[stageId]!;
    return 'AUTO';
  }

  private _effectiveTimeout(): number {
    if (this._pendingTimeout !== null) return this._pendingTimeout;
    return this._currentPolicy.gateTimeoutMinutes ?? 1440;
  }

  private _handleModeChange(stageId: string, mode: GateMode): void {
    const current = this._currentPolicy.modes;
    const originalMode = (current && stageId in current) ? current[stageId]! : 'AUTO';
    if (mode === originalMode) {
      this._pendingModes.delete(stageId);
    } else {
      this._pendingModes.set(stageId, mode);
    }
    this._pendingModes = new Map(this._pendingModes);
  }

  private _handleTimeoutChange(value: string): void {
    const num = parseInt(value, 10);
    const original = this._currentPolicy.gateTimeoutMinutes ?? 1440;
    if (!isNaN(num) && num !== original) {
      this._pendingTimeout = num;
    } else {
      this._pendingTimeout = null;
    }
  }

  private _resetChanges(): void {
    this._pendingModes = new Map();
    this._pendingTimeout = null;
  }

  private _buildPolicy(): GatePolicy {
    const baseModes = { ...(this._currentPolicy.modes ?? {}) };
    for (const [stageId, mode] of this._pendingModes) {
      baseModes[stageId] = mode;
    }
    return {
      modes: Object.keys(baseModes).length > 0 ? baseModes : null,
      gateTimeoutMinutes: this._pendingTimeout ?? this._currentPolicy.gateTimeoutMinutes,
    };
  }

  /** @internal — exposed for testing */
  async _handleSave(): Promise<void> {
    const policy = this._buildPolicy();
    if (this._api && this.caseId && this.tenancyId) {
      this._saving = true;
      try {
        await this._api.setGatePolicy(this.caseId, this.tenancyId, policy);
        this._fetchedPolicy = policy;
      } catch (e) {
        this._error = e instanceof Error ? e.message : 'Failed to save gate policy';
        this._saving = false;
        return;
      }
      this._saving = false;
    }
    emitEvolutionEvent(this, EvolutionEventTopics.GATE_POLICY_CHANGED, policy);
    this._pendingModes = new Map();
    this._pendingTimeout = null;
  }

  private async _fetch(): Promise<void> {
    if (!this._api || !this.caseId || !this.tenancyId) return;
    this._loading = true;
    this._error = null;
    try {
      const [stages, policy] = await Promise.all([
        this._api.getStages(this.caseId),
        this._api.getGatePolicy(this.caseId, this.tenancyId),
      ]);
      this._fetchedStages = stages;
      this._fetchedPolicy = policy;
    } catch (e) {
      this._error = e instanceof Error ? e.message : 'Failed to load gate policy';
    } finally {
      this._loading = false;
    }
  }

  private _renderImpactPreview() {
    if (!this.streams || this.streams.length === 0) return nothing;
    const policy = this._currentPolicy;
    if (!policy.modes) return nothing;
    const gatedStages = Object.entries(policy.modes)
      .filter(([, mode]) => mode === 'GATED')
      .map(([stageId]) => stageId);
    if (gatedStages.length === 0) return nothing;
    const impacts = gatedStages.map(stageId => {
      const count = this.streams!.filter(s => s.currentStage === stageId).length;
      return { stageId, count };
    }).filter(i => i.count > 0);
    if (impacts.length === 0) return nothing;
    return html`
      <div class="impact-preview" style="margin-top:12px;padding:8px;background:var(--pages-accent-3,#dbeafe);border-radius:4px;font-size:13px">
        <strong>Gate impact on active streams:</strong>
        <ul style="margin:4px 0 0;padding-left:20px">
          ${impacts.map(i => html`<li style="margin:2px 0"><strong>${i.stageId}</strong>: ${i.count} improvement${i.count > 1 ? 's' : ''} gated</li>`)}
        </ul>
      </div>
    `;
  }

  override render() {
    this.setAttribute('aria-busy', String(this._loading));
    if (this._loading) return html`<div class="loading">Loading gate policy...</div>`;
    if (this._error) return html`<div class="error">${this._error}</div>`;

    const groups = this._groups();
    if (groups.length === 0) return html`<div class="empty">No stages available.</div>`;

    return html`
      ${groups.map(g => html`
        <div class="domain-group" role="group" aria-label="${g.domainId} stages">
          <div class="domain-header">${g.domainId}</div>
          <table class="stage-table">
            <thead>
              <tr><th>Stage</th><th>Ordinal</th><th>Gate</th><th>Mode</th></tr>
            </thead>
            <tbody>
              ${g.stages.map(s => {
                const mode = this._effectiveMode(s.id);
                const isChanged = this._pendingModes.has(s.id);
                return html`
                  <tr>
                    <td>${s.name}</td>
                    <td>${s.ordinal}</td>
                    <td><span class="checkpoint-badge ${s.gateCheckpoint ? '' : 'checkpoint-badge--no'}" title="${s.gateCheckpoint ? 'Gate checkpoint' : 'Not a gate checkpoint'}"></span></td>
                    <td>
                      ${this.readonly
                        ? html`<span>${mode}</span>`
                        : html`
                          <select class="mode-select ${isChanged ? 'mode-select--changed' : ''}"
                                  .value=${mode}
                                  @change=${(e: Event) => this._handleModeChange(s.id, (e.target as HTMLSelectElement).value as GateMode)}>
                            ${s.gateCheckpoint ? html`<option value="GATED">GATED</option>` : nothing}
                            <option value="AUTO">AUTO</option>
                            <option value="NOTIFY">NOTIFY</option>
                          </select>
                        `
                      }
                    </td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>
      `)}

      <div class="timeout-row">
        <label>Gate timeout</label>
        ${this.readonly
          ? html`<span>${this._effectiveTimeout()} minutes</span>`
          : html`
            <input type="number" min="1"
                   .value=${String(this._effectiveTimeout())}
                   @input=${(e: Event) => this._handleTimeoutChange((e.target as HTMLInputElement).value)} />
            <span class="unit">minutes (default: 1440 = 24h)</span>
          `
        }
      </div>

      ${this._renderImpactPreview()}

      ${!this.readonly ? html`
        <div class="actions">
          <button class="btn-reset" ?disabled=${!this._isDirty} @click=${() => this._resetChanges()}>Reset</button>
          <button class="btn-save" ?disabled=${!this._isDirty || this._saving} aria-disabled="${!this._isDirty}" @click=${() => this._handleSave()}>
            ${this._saving ? 'Saving...' : 'Save Policy'}
          </button>
        </div>
      ` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blocks-gate-policy-editor': GatePolicyEditor;
  }
}
