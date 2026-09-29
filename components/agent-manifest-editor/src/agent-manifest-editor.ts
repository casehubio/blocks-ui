import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import type { Manifest, ModelDescriptor, AliasDeclaration, ProviderDeclaration } from '@casehubio/blocks-ui-core';
import { PRESETS } from './presets.js';
import { BUILT_IN_PROVIDERS } from './provider-defaults.js';
import type { ProviderChangedDetail } from './manifest-provider-card.js';
import './manifest-provider-card.js';

interface LlmProviderInfo {
  vendor: string;
  displayName: string;
  models: ModelDescriptor[];
  detection: 'detected' | 'partial' | 'none';
  credentialTypes?: string[];
  defaultHost?: string;
}

interface AliasRow {
  key: string;
  declaration: AliasDeclaration;
}

export interface AgentManifestEditorProps {
  data: Manifest;
  endpoint: string;
  providersEndpoint: string;
  systemPrompt: string;
  devMode: boolean;
}

@customElement('agent-manifest-editor')
export class AgentManifestEditor extends LitElement {
  @property({ attribute: false }) data: Manifest = {};
  @property({ type: String }) endpoint = '';
  @property({ type: String, attribute: 'providers-endpoint' }) providersEndpoint = '';
  @property({ type: String, attribute: 'system-prompt' }) systemPrompt = '';
  @property({ type: Boolean, attribute: 'dev-mode' }) devMode = false;

  @state() private _activePreset: string | null = null;
  @state() private _providerStates = new Map<string, ProviderChangedDetail>();
  @state() private _aliases: AliasRow[] = [];
  @state() private _dataSnapshot: Manifest = {};
  @state() private _dynamicProviders: LlmProviderInfo[] = [];
  @state() private _providerDetection = new Map<string, 'detected' | 'partial' | 'none'>();
  @state() private _providerModels = new Map<string, ModelDescriptor[]>();
  @state() private _loading = false;
  @state() private _error = '';

  private _endpointAbort: AbortController | null = null;
  private _providersAbort: AbortController | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'form');
    this.setAttribute('aria-label', 'LLM configuration editor');
    if (this.data && (this.data.providers?.length || this.data.aliases || this.data.models?.length)) {
      this._initFromData(this.data);
    }
    if (this.providersEndpoint) this._fetchProviders();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._endpointAbort?.abort();
    this._providersAbort?.abort();
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('data')) {
      this._endpointAbort?.abort();
      this._initFromData(this.data);
    }
    if (changed.has('endpoint') && this.endpoint && !this.data?.providers?.length) {
      this._fetchEndpoint();
    }
    if (changed.has('providersEndpoint') && this.providersEndpoint) {
      this._fetchProviders();
    }
  }

  private _initFromData(manifest: Manifest): void {
    this._dataSnapshot = { ...manifest };
    const newStates = new Map<string, ProviderChangedDetail>();

    if (manifest.providers) {
      for (const provider of manifest.providers) {
        const models = manifest.models?.filter(m => m.vendor === provider.vendor) ?? [];
        newStates.set(provider.vendor, {
          vendor: provider.vendor,
          credential: provider.credential,
          host: provider.host,
          selectedModels: models,
        });
      }
    }
    this._providerStates = newStates;

    const newAliases: AliasRow[] = [];
    if (manifest.aliases) {
      for (const [key, decl] of Object.entries(manifest.aliases)) {
        newAliases.push({ key, declaration: { ...decl } });
      }
    }
    this._aliases = newAliases;
  }

  private async _fetchEndpoint(): Promise<void> {
    this._endpointAbort?.abort();
    this._endpointAbort = new AbortController();
    this._loading = true;
    this._error = '';
    try {
      const resp = await fetch(this.endpoint, { signal: this._endpointAbort.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const manifest: Manifest = await resp.json();
      this._initFromData(manifest);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        this._error = 'Failed to load configuration';
      }
    } finally {
      this._loading = false;
    }
  }

  private async _fetchProviders(): Promise<void> {
    this._providersAbort?.abort();
    this._providersAbort = new AbortController();
    try {
      const resp = await fetch(this.providersEndpoint, { signal: this._providersAbort.signal });
      if (!resp.ok) return;
      const providers: LlmProviderInfo[] = await resp.json();
      const dynamic: LlmProviderInfo[] = [];
      for (const p of providers) {
        const builtIn = BUILT_IN_PROVIDERS.find(b => b.vendor === p.vendor.toLowerCase());
        if (builtIn) {
          this._providerDetection.set(p.vendor.toLowerCase(), p.detection);
          if (p.models?.length) {
            this._providerModels.set(p.vendor.toLowerCase(), p.models);
          }
        } else {
          dynamic.push(p);
        }
      }
      this._dynamicProviders = dynamic;
      this.requestUpdate();
    } catch {
      // Non-blocking — detection badges stay grey
    }
  }

  private _onPresetClick(presetId: string): void {
    if (this._activePreset === presetId) return;
    this._activePreset = presetId;
    const preset = PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    const preserved = {
      sources: this._dataSnapshot.sources,
      localModels: this._dataSnapshot.localModels,
      defaults: this._dataSnapshot.defaults,
    };
    this._initFromData(preset.manifest);
    this._dataSnapshot = { ...this._dataSnapshot, ...preserved };
    this._emitManifest();
  }

  private _onProviderChanged(e: CustomEvent<ProviderChangedDetail>): void {
    const detail = e.detail;
    this._providerStates.set(detail.vendor, detail);
    this.requestUpdate();
    this._emitManifest();
  }

  private _assembleManifest(): Manifest {
    const providers: ProviderDeclaration[] = [];
    const models: ModelDescriptor[] = [];

    for (const [, state] of this._providerStates) {
      if (state.credential || state.host || state.selectedModels.length > 0) {
        providers.push({
          vendor: state.vendor,
          credential: state.credential,
          host: state.host,
        });
        models.push(...state.selectedModels);
      }
    }

    const aliases: Record<string, AliasDeclaration> = {};
    for (const row of this._aliases) {
      if (row.key) aliases[row.key] = row.declaration;
    }

    return {
      providers: providers.length > 0 ? providers : undefined,
      models: models.length > 0 ? models : undefined,
      aliases: Object.keys(aliases).length > 0 ? aliases : undefined,
      defaults: this._dataSnapshot.defaults,
      sources: this._dataSnapshot.sources,
      localModels: this._dataSnapshot.localModels,
    };
  }

  private _emitManifest(): void {
    const manifest = this._assembleManifest();
    this.dispatchEvent(new CustomEvent('pages-event', {
      detail: { topic: 'manifest:configured', payload: manifest },
      bubbles: true,
      composed: true,
    }));
  }

  private _addAlias(): void {
    this._aliases = [...this._aliases, { key: '', declaration: {} }];
  }

  private _removeAlias(idx: number): void {
    this._aliases = this._aliases.filter((_, i) => i !== idx);
    this._emitManifest();
  }

  private _updateAliasKey(idx: number, key: string): void {
    const aliases = [...this._aliases];
    aliases[idx] = { ...aliases[idx]!, key };
    this._aliases = aliases;
    this._emitManifest();
  }

  private _updateAliasField(idx: number, field: keyof AliasDeclaration, value: unknown): void {
    const aliases = [...this._aliases];
    const row = { ...aliases[idx]! };
    row.declaration = { ...row.declaration, [field]: value };
    aliases[idx] = row;
    this._aliases = aliases;
    this._emitManifest();
  }

  private _hasDuplicateAliasKey(key: string, idx: number): boolean {
    return key !== '' && this._aliases.some((a, i) => i !== idx && a.key === key);
  }

  private _isStalePreferVendor(vendor?: string): boolean {
    if (!vendor) return false;
    for (const [, state] of this._providerStates) {
      if (state.vendor === vendor && state.selectedModels.length > 0) return false;
    }
    return true;
  }

  private _getModelsForProvider(vendor: string): ModelDescriptor[] {
    const backendModels = this._providerModels.get(vendor);
    if (backendModels) return backendModels;
    const seen = new Set<string>();
    const unique: ModelDescriptor[] = [];
    for (const p of PRESETS) {
      for (const m of p.manifest.models ?? []) {
        if (m.vendor === vendor && !seen.has(m.id)) {
          seen.add(m.id);
          unique.push(m);
        }
      }
    }
    return unique;
  }

  private _getSelectedForProvider(vendor: string): string[] {
    return this._providerStates.get(vendor)?.selectedModels.map(m => m.id) ?? [];
  }

  private _getProviderDecl(vendor: string): ProviderDeclaration {
    const state = this._providerStates.get(vendor);
    return state
      ? { vendor: state.vendor, credential: state.credential, host: state.host }
      : { vendor };
  }

  private _getDetection(vendor: string): 'detected' | 'partial' | 'none' {
    return this._providerDetection.get(vendor) ?? 'none';
  }

  static styles = css`
    :host { display: block; color: var(--pages-text, #e0e0e0); font-family: system-ui, sans-serif; }
    .dev-banner { background: #e65100; color: white; padding: 0.4rem 1rem; font-size: 0.8rem; border-radius: 4px; margin-bottom: 0.75rem; }
    .preset-bar { display: flex; gap: 0.5rem; margin-bottom: 1rem; overflow-x: auto; padding-bottom: 0.25rem; }
    .preset-card { padding: 0.5rem 1rem; border: 1px solid var(--pages-border, #333); border-radius: 6px; cursor: pointer; white-space: nowrap; font-size: 0.85rem; background: var(--pages-surface, #1a1a2e); transition: border-color 0.15s; }
    .preset-card:hover { border-color: #555; }
    .preset-card.active { border-color: #7986cb; background: #1a237e33; }
    .provider-grid { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 1rem; }
    .section-title { font-size: 0.85rem; font-weight: 600; margin: 1rem 0 0.5rem; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; }
    .alias-editor { margin-bottom: 1rem; }
    .alias-row { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.35rem; flex-wrap: wrap; }
    .alias-key-input { width: 140px; padding: 0.3rem; background: var(--pages-input-bg, #0f0f23); border: 1px solid var(--pages-border, #333); border-radius: 4px; color: inherit; font-family: monospace; font-size: 0.8rem; }
    .alias-field { padding: 0.3rem; background: var(--pages-input-bg, #0f0f23); border: 1px solid var(--pages-border, #333); border-radius: 4px; color: inherit; font-size: 0.8rem; min-width: 80px; }
    .alias-field select { background: var(--pages-input-bg, #0f0f23); color: inherit; border: none; }
    .alias-duplicate-error { font-size: 0.7rem; color: #f44336; }
    .alias-stale-warning { font-size: 0.7rem; color: #ff9800; }
    .delete-btn { background: none; border: none; color: #f44336; cursor: pointer; font-size: 0.9rem; padding: 0.2rem; }
    .add-alias-btn { font-size: 0.8rem; padding: 0.25rem 0.5rem; border: 1px dashed #555; border-radius: 4px; background: transparent; color: #aaa; cursor: pointer; }
    .prompt-preview { padding: 0.75rem; background: var(--pages-input-bg, #0f0f23); border-radius: 6px; font-size: 0.85rem; line-height: 1.5; white-space: pre-wrap; min-height: 3rem; color: #ccc; }
    .prompt-label { font-size: 0.7rem; color: #666; margin-bottom: 0.25rem; }
    .prompt-empty { color: #666; font-style: italic; }
    .error-banner { background: #b71c1c; color: white; padding: 0.5rem 1rem; border-radius: 4px; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
    .retry-btn { padding: 0.2rem 0.5rem; border: 1px solid white; border-radius: 4px; background: transparent; color: white; cursor: pointer; font-size: 0.8rem; }
    .loading { display: flex; align-items: center; justify-content: center; padding: 2rem; color: #888; }
    .spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid #555; border-top-color: #aaa; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 0.5rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;

  render() {
    if (this._loading) {
      return html`<div class="loading"><span class="spinner"></span> Loading configuration...</div>`;
    }

    return html`
      ${this.devMode ? html`<div class="dev-banner">Dev Mode — inline API keys enabled (not persisted)</div>` : nothing}
      ${this._error ? html`
        <div class="error-banner">
          ${this._error}
          <button class="retry-btn" @click=${this._fetchEndpoint}>Retry</button>
        </div>
      ` : nothing}

      <div class="preset-bar">
        ${PRESETS.map(p => html`
          <div class="preset-card ${classMap({ active: this._activePreset === p.id })}"
               data-preset=${p.id}
               @click=${() => this._onPresetClick(p.id)}>
            ${p.label}
          </div>
        `)}
      </div>

      <div class="provider-grid">
        ${BUILT_IN_PROVIDERS.map(bp => html`
          <manifest-provider-card
            .vendor=${bp.vendor}
            .displayName=${bp.displayName}
            .provider=${this._getProviderDecl(bp.vendor)}
            .models=${this._getModelsForProvider(bp.vendor)}
            .selectedModels=${this._getSelectedForProvider(bp.vendor)}
            .detection=${this._getDetection(bp.vendor)}
            .devMode=${this.devMode}
            .testEndpoint=${''}
            .isOther=${false}
            @provider-changed=${this._onProviderChanged}
          ></manifest-provider-card>
        `)}

        ${this._dynamicProviders.map(dp => html`
          <manifest-provider-card
            .vendor=${dp.vendor}
            .displayName=${dp.displayName}
            .provider=${{ vendor: dp.vendor }}
            .models=${dp.models}
            .selectedModels=${this._getSelectedForProvider(dp.vendor)}
            .detection=${dp.detection}
            .devMode=${this.devMode}
            .testEndpoint=${''}
            .isOther=${false}
            @provider-changed=${this._onProviderChanged}
          ></manifest-provider-card>
        `)}

        <manifest-provider-card
          vendor="other"
          displayName="Other"
          .provider=${{ vendor: '' }}
          .models=${[]}
          .selectedModels=${[]}
          detection="none"
          .devMode=${this.devMode}
          testEndpoint=""
          .isOther=${true}
          @provider-changed=${this._onProviderChanged}
        ></manifest-provider-card>
      </div>

      <div class="section-title">Aliases</div>
      <div class="alias-editor">
        ${this._aliases.map((row, i) => this._renderAliasRow(row, i))}
        <button class="add-alias-btn" @click=${this._addAlias}>+ Add alias</button>
      </div>

      <div class="section-title">System Prompt Preview</div>
      <div class="prompt-label">Generated from personality profile</div>
      <div class="prompt-preview">
        ${this.systemPrompt
          ? this.systemPrompt
          : html`<span class="prompt-empty">No personality profile configured</span>`}
      </div>
    `;
  }

  private _renderAliasRow(row: AliasRow, idx: number) {
    const duplicate = this._hasDuplicateAliasKey(row.key, idx);
    const staleVendor = this._isStalePreferVendor(row.declaration.preferVendor);

    return html`
      <div class="alias-row">
        <input class="alias-key-input" .value=${row.key} placeholder="Alias name"
               @input=${(e: Event) => this._updateAliasKey(idx, (e.target as HTMLInputElement).value)}>
        <select class="alias-field"
                .value=${row.declaration.tier ?? ''}
                @change=${(e: Event) => this._updateAliasField(idx, 'tier', (e.target as HTMLSelectElement).value || undefined)}>
          <option value="">Tier</option>
          <option value="FLAGSHIP">Flagship</option>
          <option value="STANDARD">Standard</option>
          <option value="FAST">Fast</option>
          <option value="EMBEDDING">Embedding</option>
        </select>
        <input class="alias-field" type="number" placeholder="Min ctx" style="width:70px"
               .value=${String(row.declaration.minContext ?? '')}
               @input=${(e: Event) => this._updateAliasField(idx, 'minContext', Number((e.target as HTMLInputElement).value) || undefined)}>
        <input class="alias-field" placeholder="Prefer vendor" style="width:100px"
               .value=${row.declaration.preferVendor ?? ''}
               @input=${(e: Event) => this._updateAliasField(idx, 'preferVendor', (e.target as HTMLInputElement).value || undefined)}>
        <button class="delete-btn" @click=${() => this._removeAlias(idx)}>✗</button>
        ${duplicate ? html`<span class="alias-duplicate-error">Duplicate key</span>` : nothing}
        ${staleVendor ? html`<span class="alias-stale-warning" title="No models configured for this vendor">⚠</span>` : nothing}
      </div>
    `;
  }
}
