import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ModelDescriptor, ProviderDeclaration } from '@casehubio/blocks-ui-core';
import { getInferenceRanges, parseInferenceFromProperties, writeInferenceToProperties, getAuthPatterns, getDefaultAuthPattern } from './provider-defaults.js';
import type { InferenceDefaults, ProviderInferenceRanges, AuthPattern, AuthField } from './provider-defaults.js';

export interface ProviderChangedDetail {
  vendor: string;
  credential?: string | Record<string, string>;
  host?: string;
  selectedModels: ModelDescriptor[];
  authPatternId?: string;
}

interface TestResult {
  success: boolean;
  error?: string;
  details?: Record<string, boolean>;
  timestamp: number;
}

@customElement('manifest-provider-card')
export class ManifestProviderCard extends LitElement {
  @property({ type: String }) vendor = '';
  @property({ type: String }) displayName = '';
  @property({ attribute: false }) provider: ProviderDeclaration = { vendor: '' };
  @property({ attribute: false }) models: ModelDescriptor[] = [];
  @property({ attribute: false }) selectedModels: string[] = [];
  @property({ type: String }) detection: 'detected' | 'partial' | 'none' = 'none';
  @property({ type: Boolean }) devMode = false;
  @property({ type: String }) testEndpoint = '';
  @property({ type: Boolean }) isOther = false;

  @state() private _expanded = false;
  @state() private _authPatternId = '';
  @state() private _authValues: Record<string, string> = {};
  @state() private _altIndex = 0;
  @state() private _inlineKey = '';
  @state() private _testResult: TestResult | null = null;
  @state() private _testing = false;
  @state() private _showBatchSet = false;
  @state() private _otherModels: ModelDescriptor[] = [];
  @state() private _otherVendorName = '';
  @state() private _otherHost = '';

  private _testAbort: AbortController | null = null;
  private _cancelTimeout: ReturnType<typeof setTimeout> | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'region');
    this._updateAriaLabel();
    this._initFromProvider();
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('displayName') || changed.has('vendor')) {
      this._updateAriaLabel();
    }
    if (changed.has('vendor') && !this._authPatternId) {
      this._authPatternId = getDefaultAuthPattern(this.vendor).id;
    }
    if (changed.has('provider')) {
      this._initFromProvider();
    }
    if (changed.has('_authValues') || changed.has('_authPatternId') ||
        changed.has('selectedModels')) {
      this._testResult = null;
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._abortTest();
  }

  private _updateAriaLabel(): void {
    this.setAttribute('aria-label', `${this.displayName || this.vendor} provider configuration`);
  }

  private _initFromProvider(): void {
    if (!this._authPatternId) {
      this._authPatternId = getDefaultAuthPattern(this.vendor).id;
    }
    const cred = this.provider?.credential;
    if (typeof cred === 'object' && cred !== null) {
      this._authValues = { ...cred };
    } else if (typeof cred === 'string') {
      this._authValues = { apiKey: cred };
    } else {
      this._authValues = {};
    }
    if (this.provider?.host) {
      this._authValues = { ...this._authValues, host: this.provider.host };
    }
    if (this.isOther) {
      this._otherVendorName = this.provider?.vendor ?? '';
      this._otherHost = this.provider?.host ?? '';
    }
  }

  private _buildCredential(): string | Record<string, string> | undefined {
    const pattern = this._getActivePattern();
    const allFields = [...pattern.fields, ...(pattern.alternatives?.[this._altIndex]?.fields ?? [])];
    const secretFields = allFields.filter(f => f.type === 'secret');
    const nonSecretFields = allFields.filter(f => f.type !== 'secret');

    if (secretFields.length === 1 && nonSecretFields.every(f => f.key === 'baseUrl' || f.key === 'host')) {
      const val = this._authValues[secretFields[0]!.key];
      return val || undefined;
    }

    const cred: Record<string, string> = {};
    for (const field of allFields) {
      if (field.key === 'host' || field.key === 'baseUrl' || field.key === 'adc') continue;
      const val = this._authValues[field.key];
      if (val) cred[field.key] = val;
    }
    return Object.keys(cred).length > 0 ? cred : undefined;
  }

  private _getActivePattern(): AuthPattern {
    const patterns = getAuthPatterns(this.isOther ? '' : this.vendor);
    return patterns.find(p => p.id === this._authPatternId) ?? patterns[0]!;
  }

  private _getSelectedModelDescriptors(): ModelDescriptor[] {
    const allModels = this.isOther ? this._otherModels : this.models;
    return allModels.filter(m => this.selectedModels.includes(m.id));
  }

  private _emitChanged(): void {
    const host = this._authValues.host || this._authValues.baseUrl || (this.isOther ? this._otherHost : this.provider?.host);
    const detail: ProviderChangedDetail = {
      vendor: this.isOther ? this._otherVendorName : this.vendor,
      credential: this._buildCredential(),
      host,
      selectedModels: this._getSelectedModelDescriptors(),
      authPatternId: this._authPatternId,
    };
    this.dispatchEvent(new CustomEvent('provider-changed', {
      detail,
      bubbles: true,
      composed: true,
    }));
  }

  private _toggleExpand(): void {
    this._expanded = !this._expanded;
  }

  private _onAuthPatternChange(patternId: string): void {
    this._authPatternId = patternId;
    this._authValues = {};
    this._altIndex = 0;
    this._emitChanged();
  }

  private _onAltChange(index: number): void {
    this._altIndex = index;
    this._emitChanged();
  }

  private _onAuthFieldChange(key: string, value: string): void {
    this._authValues = { ...this._authValues, [key]: value };
    this._emitChanged();
  }

  private _onInlineKeyChange(value: string): void {
    this._inlineKey = value;
  }

  private _onModelToggle(modelId: string): void {
    const current = [...this.selectedModels];
    const idx = current.indexOf(modelId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(modelId);
    }
    this.selectedModels = current;
    this._emitChanged();
  }

  private _onInferenceChange(modelId: string, param: keyof InferenceDefaults, value: number): void {
    const allModels = this.isOther ? this._otherModels : this.models;
    const model = allModels.find(m => m.id === modelId);
    if (!model) return;
    model.properties = writeInferenceToProperties({ [param]: value }, model.properties);
    this.requestUpdate();
    this._emitChanged();
  }

  private _applyBatchInference(inference: InferenceDefaults): void {
    const allModels = this.isOther ? this._otherModels : this.models;
    for (const model of allModels) {
      if (this.selectedModels.includes(model.id)) {
        model.properties = writeInferenceToProperties(inference, model.properties);
      }
    }
    this.requestUpdate();
    this._emitChanged();
  }

  private _abortTest(): void {
    this._testAbort?.abort();
    this._testAbort = null;
    if (this._cancelTimeout) {
      clearTimeout(this._cancelTimeout);
      this._cancelTimeout = null;
    }
    this._testing = false;
  }

  private async _runTest(): Promise<void> {
    if (!this.testEndpoint) return;
    this._abortTest();
    this._testing = true;
    this._testAbort = new AbortController();

    const credential = this._inlineKey || this._buildCredentialString();
    const payload = {
      vendor: this.isOther ? this._otherVendorName : this.vendor,
      credential,
      models: this.selectedModels,
    };

    this._cancelTimeout = setTimeout(() => { this.requestUpdate(); }, 3000);

    try {
      const response = await fetch(this.testEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.any([
          this._testAbort.signal,
          AbortSignal.timeout(30000),
        ]),
      });
      const result = await response.json();
      this._testResult = { ...result, timestamp: Date.now() };
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        this._testResult = { success: false, error: e.message, timestamp: Date.now() };
      }
    } finally {
      this._testing = false;
      if (this._cancelTimeout) {
        clearTimeout(this._cancelTimeout);
        this._cancelTimeout = null;
      }
    }
  }

  private _addOtherModel(): void {
    const id = `model-${this._otherModels.length + 1}`;
    this._otherModels = [...this._otherModels, { id, vendor: this._otherVendorName }];
  }

  private _removeOtherModel(idx: number): void {
    this._otherModels = this._otherModels.filter((_, i) => i !== idx);
    this.selectedModels = this.selectedModels.filter(id => this._otherModels.some(m => m.id === id));
    this._emitChanged();
  }

  private _updateOtherModel(idx: number, field: string, value: string | number): void {
    const models = [...this._otherModels];
    const model = { ...models[idx]! };
    if (field === 'id') model.id = value as string;
    else if (field === 'displayName') model.displayName = value as string;
    else if (field === 'contextWindow') model.contextWindow = value as number;
    model.vendor = this._otherVendorName;
    models[idx] = model;
    this._otherModels = models;
    this._emitChanged();
  }

  private _onOtherVendorChange(name: string): void {
    this._otherVendorName = name;
    this._otherModels = this._otherModels.map(m => ({ ...m, vendor: name }));
    this._emitChanged();
  }

  private _hasDuplicateModelId(id: string, idx: number): boolean {
    return this._otherModels.some((m, i) => i !== idx && m.id === id);
  }

  private _groupModelsByTier(): Record<string, ModelDescriptor[]> {
    const groups: Record<string, ModelDescriptor[]> = {};
    const tiers = ['FLAGSHIP', 'STANDARD', 'FAST', 'EMBEDDING'];
    for (const tier of tiers) groups[tier] = [];
    for (const model of this.models) {
      const tier = model.tier ?? 'STANDARD';
      if (!groups[tier]) groups[tier] = [];
      groups[tier]!.push(model);
    }
    return groups;
  }

  private _getTestBadgeClass(): string {
    if (!this._testResult) return 'untested';
    if (!this._testResult.success) return 'failed';
    if (this._testResult.details) {
      const values = Object.values(this._testResult.details);
      if (values.some(v => !v)) return 'partial';
    }
    return 'passed';
  }

  static styles = css`
    :host { display: block; border: 1px solid var(--pages-border, #333); border-radius: 8px; margin-bottom: 0.5rem; background: var(--pages-surface, #1a1a2e); }
    .card-header { display: flex; align-items: center; padding: 0.75rem 1rem; cursor: pointer; gap: 0.75rem; user-select: none; }
    .card-header:hover { background: var(--pages-hover, #16213e); border-radius: 8px; }
    .provider-name { font-weight: 600; flex: 1; }
    .detection-badge { width: 10px; height: 10px; border-radius: 50%; }
    .detection-badge.detected { background: #4caf50; }
    .detection-badge.partial { background: #ff9800; }
    .detection-badge.none { background: #666; }
    .test-badge { font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; }
    .test-badge.passed { background: #1b5e20; color: #a5d6a7; }
    .test-badge.failed { background: #b71c1c; color: #ef9a9a; }
    .test-badge.partial { background: #e65100; color: #ffcc80; }
    .test-badge.untested { background: #333; color: #888; }
    .model-count { font-size: 0.8rem; color: #888; }
    .card-body { padding: 0 1rem 1rem; }
    .section-label { font-size: 0.75rem; text-transform: uppercase; color: #888; margin: 0.75rem 0 0.25rem; letter-spacing: 0.05em; }
    .cred-radios { display: flex; gap: 1rem; margin: 0.5rem 0; }
    .cred-radios label { display: flex; align-items: center; gap: 0.25rem; font-size: 0.85rem; cursor: pointer; }
    .cred-input { width: 100%; padding: 0.4rem; background: var(--pages-input-bg, #0f0f23); border: 1px solid var(--pages-border, #333); border-radius: 4px; color: inherit; font-family: monospace; }
    .auth-pattern-label { font-size: 0.8rem; color: #888; margin: 0.25rem 0; }
    .auth-field-row { margin: 0.35rem 0; }
    .auth-field-label { display: block; font-size: 0.75rem; color: #aaa; margin-bottom: 0.15rem; }
    .auth-field-label .required { color: #f44336; }
    .auth-hint { font-size: 0.7rem; color: #666; margin-top: 0.15rem; font-style: italic; }
    .tier-group { margin: 0.5rem 0; }
    .tier-label { font-size: 0.7rem; text-transform: uppercase; color: #666; padding: 0.25rem 0; border-bottom: 1px solid #222; }
    .model-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0; font-size: 0.85rem; }
    .model-row label { display: flex; align-items: center; gap: 0.4rem; flex: 1; cursor: pointer; }
    .capability-pill { font-size: 0.65rem; padding: 1px 5px; border-radius: 3px; background: #1a237e; color: #7986cb; }
    .context-badge { font-size: 0.65rem; color: #666; }
    .cost-badge { font-size: 0.65rem; color: #888; }
    .model-test-indicator { font-size: 0.7rem; }
    .model-test-indicator.pass { color: #4caf50; }
    .model-test-indicator.fail { color: #f44336; }
    .inference-row { display: flex; align-items: center; gap: 0.5rem; margin: 0.25rem 0; font-size: 0.8rem; }
    .inference-row label { min-width: 80px; color: #aaa; }
    .inference-row input[type="range"] { flex: 1; }
    .inference-row .value { min-width: 50px; text-align: right; font-family: monospace; }
    .batch-set { margin: 0.5rem 0; padding: 0.5rem; background: #111; border-radius: 4px; }
    .batch-set-toggle { font-size: 0.75rem; color: #7986cb; cursor: pointer; text-decoration: underline; }
    .test-section { display: flex; align-items: center; gap: 0.5rem; margin: 0.75rem 0; }
    .test-btn { padding: 0.3rem 0.75rem; border: 1px solid #555; border-radius: 4px; background: transparent; color: inherit; cursor: pointer; font-size: 0.8rem; }
    .test-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .test-btn:hover:not(:disabled) { background: #222; }
    .test-timestamp { font-size: 0.7rem; color: #666; }
    .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #555; border-top-color: #aaa; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .other-field { display: flex; gap: 0.5rem; margin: 0.25rem 0; align-items: center; }
    .other-field label { font-size: 0.8rem; min-width: 80px; color: #aaa; }
    .other-model-row { display: flex; gap: 0.5rem; align-items: center; padding: 0.25rem 0; }
    .other-model-row input { flex: 1; }
    .validation-error { font-size: 0.7rem; color: #f44336; }
    .add-btn { font-size: 0.8rem; padding: 0.25rem 0.5rem; border: 1px dashed #555; border-radius: 4px; background: transparent; color: #aaa; cursor: pointer; margin-top: 0.25rem; }
    .delete-btn { background: none; border: none; color: #f44336; cursor: pointer; font-size: 0.9rem; padding: 0; }
    .apply-btn { font-size: 0.75rem; padding: 0.2rem 0.5rem; border: 1px solid #555; border-radius: 4px; background: transparent; color: inherit; cursor: pointer; }
  `;

  render() {
    return html`
      <div class="card-header"
           aria-expanded="${this._expanded}"
           @click=${this._toggleExpand}>
        <span class="detection-badge ${this.detection}"></span>
        <span class="provider-name">${this.displayName || this.vendor}</span>
        <span class="model-count">${this.selectedModels.length} model${this.selectedModels.length !== 1 ? 's' : ''}</span>
        <span class="test-badge ${this._getTestBadgeClass()}">${this._renderTestBadgeText()}</span>
      </div>
      ${this._expanded ? this._renderBody() : nothing}
    `;
  }

  private _renderTestBadgeText() {
    if (this._testing) return html`<span class="spinner"></span>`;
    if (!this._testResult) return 'untested';
    if (this._testResult.success) {
      if (this._testResult.details) {
        const total = Object.keys(this._testResult.details).length;
        const passed = Object.values(this._testResult.details).filter(v => v).length;
        if (passed < total) return `${passed}/${total}`;
      }
      return '✓';
    }
    return '✗';
  }

  private _renderBody() {
    return html`
      <div class="card-body">
        ${this.isOther ? this._renderOtherFields() : nothing}
        ${this._renderCredentialEditor()}
        ${this.isOther ? this._renderOtherModelList() : this._renderModelList()}
        ${this._renderTestConnection()}
      </div>
    `;
  }

  private _renderOtherFields() {
    return html`
      <div class="other-field">
        <label>Provider</label>
        <input class="cred-input" .value=${this._otherVendorName}
               @input=${(e: Event) => this._onOtherVendorChange((e.target as HTMLInputElement).value)}
               placeholder="e.g. mistral">
      </div>
      <div class="other-field">
        <label>Endpoint</label>
        <input class="cred-input" .value=${this._otherHost}
               @input=${(e: Event) => { this._otherHost = (e.target as HTMLInputElement).value; this._emitChanged(); }}
               placeholder="e.g. https://api.example.com">
      </div>
    `;
  }

  private _renderCredentialEditor() {
    const patterns = getAuthPatterns(this.isOther ? '' : this.vendor);
    const activePattern = this._getActivePattern();

    return html`
      <div class="section-label">Connection</div>
      ${patterns.length > 1 ? html`
        <div class="cred-radios">
          ${patterns.map(p => html`
            <label>
              <input type="radio" name="auth-pattern" value=${p.id}
                     .checked=${this._authPatternId === p.id}
                     @change=${() => this._onAuthPatternChange(p.id)}>
              ${p.label}
            </label>
          `)}
        </div>
      ` : html`<div class="auth-pattern-label">${activePattern.label}</div>`}

      ${activePattern.fields.map(f => this._renderAuthField(f))}

      ${activePattern.alternatives && activePattern.alternatives.length > 0 ? html`
        <div class="section-label" style="margin-top:0.5rem">Authentication</div>
        <div class="cred-radios">
          ${activePattern.alternatives.map((alt, i) => html`
            <label>
              <input type="radio" name="auth-alt" value=${i}
                     .checked=${this._altIndex === i}
                     @change=${() => this._onAltChange(i)}>
              ${alt.label}
            </label>
          `)}
        </div>
        ${activePattern.alternatives[this._altIndex]?.fields.map(f => this._renderAuthField(f))}
      ` : nothing}

      ${this.devMode && activePattern.id === 'api-key' ? html`
        <div style="margin-top:0.5rem">
          <div class="section-label">Dev Mode</div>
          <input type="password" class="cred-input" .value=${this._inlineKey}
                 placeholder="Paste API key (dev only — not persisted)"
                 @input=${(e: Event) => this._onInlineKeyChange((e.target as HTMLInputElement).value)}>
        </div>
      ` : nothing}
    `;
  }

  private _renderAuthField(field: AuthField) {
    const value = this._authValues[field.key] ?? '';
    const inputType = field.type === 'secret' ? 'password' : 'text';

    return html`
      <div class="auth-field-row">
        <label class="auth-field-label">
          ${field.label}
          ${field.required ? html`<span class="required">*</span>` : nothing}
        </label>
        <input class="cred-input" type=${inputType}
               .value=${value}
               placeholder=${field.placeholder ?? (field.envVar ? `env: ${field.envVar}` : '')}
               @input=${(e: Event) => this._onAuthFieldChange(field.key, (e.target as HTMLInputElement).value)}>
        ${field.hint ? html`<div class="auth-hint">${field.hint}</div>` : nothing}
      </div>
    `;
  }

  private _renderModelList() {
    const groups = this._groupModelsByTier();
    return html`
      <div class="section-label">Models</div>
      ${this._renderBatchSet()}
      ${Object.entries(groups).filter(([, models]) => models.length > 0).map(([tier, models]) => html`
        <div class="tier-group">
          <div class="tier-label">${tier}</div>
          ${models.map(m => this._renderModelRow(m))}
        </div>
      `)}
    `;
  }

  private _renderModelRow(model: ModelDescriptor) {
    const checked = this.selectedModels.includes(model.id);
    const ranges = getInferenceRanges(this.vendor, model);
    const inference = parseInferenceFromProperties(model.properties);
    const testDetail = this._testResult?.details?.[model.id];

    return html`
      <div class="model-row">
        <label>
          <input type="checkbox" .checked=${checked}
                 @change=${() => this._onModelToggle(model.id)}>
          ${model.displayName ?? model.id}
        </label>
        ${model.capabilities?.map(c => html`<span class="capability-pill">${c}</span>`) ?? nothing}
        ${model.contextWindow ? html`<span class="context-badge">${(model.contextWindow / 1000).toFixed(0)}K</span>` : nothing}
        ${model.costTier ? html`<span class="cost-badge">${model.costTier}</span>` : nothing}
        ${testDetail !== undefined ? html`<span class="model-test-indicator ${testDetail ? 'pass' : 'fail'}">${testDetail ? '✓' : '✗'}</span>` : nothing}
      </div>
      ${checked ? this._renderInferenceSliders(model.id, ranges, inference) : nothing}
    `;
  }

  private _renderInferenceSliders(modelId: string, ranges: ProviderInferenceRanges, current: InferenceDefaults) {
    return html`
      <div style="padding-left: 1.5rem; margin-bottom: 0.5rem;">
        ${this._renderSlider(modelId, 'temperature', 'Temperature', ranges.temperature, current.temperature ?? ranges.temperature.default)}
        ${this._renderSlider(modelId, 'topP', 'Top-P', ranges.topP, current.topP ?? ranges.topP.default)}
        ${this._renderSlider(modelId, 'maxTokens', 'Max Tokens', ranges.maxTokens, current.maxTokens ?? ranges.maxTokens.default)}
      </div>
    `;
  }

  private _renderSlider(modelId: string, param: keyof InferenceDefaults, label: string, range: { min: number; max: number }, value: number) {
    const step = param === 'maxTokens' ? 1 : 0.01;
    return html`
      <div class="inference-row">
        <label>${label}</label>
        <input type="range" min=${range.min} max=${range.max} step=${step}
               .value=${String(value)}
               @change=${(e: Event) => this._onInferenceChange(modelId, param, Number((e.target as HTMLInputElement).value))}>
        <span class="value">${param === 'maxTokens' ? value : value.toFixed(2)}</span>
      </div>
    `;
  }

  private _renderBatchSet() {
    if (this.selectedModels.length === 0) return nothing;
    const ranges = getInferenceRanges(this.vendor);
    return html`
      <span class="batch-set-toggle" @click=${() => { this._showBatchSet = !this._showBatchSet; }}>
        ${this._showBatchSet ? 'Hide' : 'Batch set'}
      </span>
      ${this._showBatchSet ? html`
        <div class="batch-set">
          <div class="inference-row">
            <label>Temperature</label>
            <input type="range" id="batch-temp" min=${ranges.temperature.min} max=${ranges.temperature.max} step="0.01" .value=${String(ranges.temperature.default)}>
            <span class="value">${ranges.temperature.default.toFixed(2)}</span>
          </div>
          <div class="inference-row">
            <label>Top-P</label>
            <input type="range" id="batch-topp" min=${ranges.topP.min} max=${ranges.topP.max} step="0.01" .value=${String(ranges.topP.default)}>
            <span class="value">${ranges.topP.default.toFixed(2)}</span>
          </div>
          <div class="inference-row">
            <label>Max Tokens</label>
            <input type="range" id="batch-maxtokens" min=${ranges.maxTokens.min} max=${ranges.maxTokens.max} step="1" .value=${String(ranges.maxTokens.default)}>
            <span class="value">${ranges.maxTokens.default}</span>
          </div>
          <button class="apply-btn" @click=${this._onBatchApply}>Apply to all</button>
        </div>
      ` : nothing}
    `;
  }

  private _onBatchApply(): void {
    const temp = this.shadowRoot!.querySelector('#batch-temp') as HTMLInputElement;
    const topp = this.shadowRoot!.querySelector('#batch-topp') as HTMLInputElement;
    const maxtokens = this.shadowRoot!.querySelector('#batch-maxtokens') as HTMLInputElement;
    this._applyBatchInference({
      temperature: Number(temp?.value),
      topP: Number(topp?.value),
      maxTokens: Number(maxtokens?.value),
    });
  }

  private _renderOtherModelList() {
    return html`
      <div class="section-label">Models</div>
      ${this._otherModels.map((m, i) => html`
        <div class="other-model-row">
          <input class="cred-input" .value=${m.id} placeholder="Model ID (required)"
                 @input=${(e: Event) => this._updateOtherModel(i, 'id', (e.target as HTMLInputElement).value)}>
          <input class="cred-input" .value=${m.displayName ?? ''} placeholder="Display name"
                 @input=${(e: Event) => this._updateOtherModel(i, 'displayName', (e.target as HTMLInputElement).value)}>
          <input class="cred-input" type="number" .value=${String(m.contextWindow ?? '')} placeholder="Context"
                 style="width: 80px"
                 @input=${(e: Event) => this._updateOtherModel(i, 'contextWindow', Number((e.target as HTMLInputElement).value))}>
          <button class="delete-btn" @click=${() => this._removeOtherModel(i)}>✗</button>
          ${this._hasDuplicateModelId(m.id, i) ? html`<span class="validation-error">Duplicate ID</span>` : nothing}
        </div>
      `)}
      <button class="add-btn" @click=${this._addOtherModel}>+ Add model</button>
    `;
  }

  private _renderTestConnection() {
    const disabled = !this.testEndpoint;
    const tooltip = disabled ? 'No test endpoint configured' : '';

    return html`
      <div class="test-section">
        <button class="test-btn" ?disabled=${disabled || this._testing}
                title=${tooltip}
                @click=${this._runTest}>
          ${this._testing ? html`<span class="spinner"></span> Testing...` : 'Test Connection'}
        </button>
        ${this._testing && this._cancelTimeout ? html`
          <button class="test-btn" @click=${this._abortTest}>Cancel</button>
        ` : nothing}
        ${this._testResult ? html`
          <span class="test-timestamp">${new Date(this._testResult.timestamp).toLocaleTimeString()}</span>
          ${this._testResult.error ? html`<span style="color: #f44336; font-size: 0.8rem">${this._testResult.error}</span>` : nothing}
        ` : nothing}
      </div>
    `;
  }
}
