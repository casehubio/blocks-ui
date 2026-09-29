import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Manifest } from '../../../packages/blocks-ui-core/src/index.js';
import '../../../components/agent-manifest-editor/src/agent-manifest-editor.js';

const SAMPLE_DATA: Manifest = {
  providers: [
    { vendor: 'anthropic', credential: 'env:ANTHROPIC_API_KEY' },
    { vendor: 'openai', credential: 'env:OPENAI_API_KEY' },
  ],
  models: [
    { id: 'claude-opus-4-6', displayName: 'Claude Opus 4.6', vendor: 'anthropic', tier: 'FLAGSHIP', contextWindow: 1000000, maxOutput: 32000, capabilities: ['vision', 'tool_use'] },
    { id: 'claude-sonnet-5', displayName: 'Claude Sonnet 5', vendor: 'anthropic', tier: 'STANDARD', contextWindow: 200000, capabilities: ['vision', 'tool_use'] },
    { id: 'gpt-4o', displayName: 'GPT-4o', vendor: 'openai', tier: 'FLAGSHIP', contextWindow: 128000, capabilities: ['vision', 'tool_use'] },
  ],
  aliases: {
    'reasoning-heavy': { tier: 'FLAGSHIP', capabilities: ['tool_use'], preferVendor: 'anthropic' },
    'fast-response': { tier: 'FAST' },
  },
  sources: [{ uri: 'https://models.casehub.io/registry.yaml', priority: 1 }],
  defaults: { backend: 'anthropic' },
};

const SAMPLE_PROMPT = `You are a detail-oriented analyst who values precision and structured reasoning. You prefer clear evidence chains and flag ambiguity rather than guessing. You communicate findings with confidence levels and supporting data.

When presenting analysis:
- Lead with the conclusion, then the evidence
- Flag uncertainty explicitly with confidence percentages
- Distinguish between observed facts and inferences
- Suggest follow-up investigations for low-confidence findings`;

@customElement('blocks-example-manifest-editor')
export class ManifestEditorPage extends LitElement {
  @state() private _devMode = false;
  @state() private _hasData = false;
  @state() private _hasPrompt = false;
  @state() private _lastManifest: Manifest | null = null;
  @state() private _eventCount = 0;

  static override styles = css`
    :host { display: block; padding: 24px; height: 100%; box-sizing: border-box; overflow-y: auto; color: var(--pages-neutral-12, #111); font-family: var(--pages-font-family, system-ui); }
    h2 { margin-bottom: 8px; font-size: 20px; font-weight: 600; }
    p { margin-bottom: 24px; color: var(--pages-neutral-11, #555); font-size: 14px; }
    .controls { margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap; }
    button { padding: 6px 12px; border-radius: var(--pages-radius-2, 4px); border: 1px solid var(--pages-neutral-6, #ccc); background: var(--pages-neutral-2, #f5f5f5); color: var(--pages-neutral-12, #111); cursor: pointer; font-size: 13px; }
    button:hover { background: var(--pages-neutral-3, #e5e5e5); }
    button.active { background: var(--pages-accent-3, #dbeafe); border-color: var(--pages-accent-9, #3b82f6); color: var(--pages-accent-11, #1e40af); }
    .demo-section { margin-bottom: 24px; border: 1px solid var(--pages-neutral-4, #e5e5e5); border-radius: var(--pages-radius-3, 6px); background: var(--pages-neutral-1, #fff); padding: 16px; }
    .output-section { margin-top: 16px; }
    .output-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .output-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
    .event-count { font-size: 12px; color: var(--pages-neutral-9, #888); }
    pre { margin: 0; padding: 16px; background: var(--pages-neutral-2, #f5f5f5); color: var(--pages-neutral-12, #111); border: 1px solid var(--pages-neutral-4, #e5e5e5); border-radius: var(--pages-radius-3, 8px); max-height: 300px; overflow-y: auto; font-size: 13px; font-family: 'SF Mono', 'Fira Code', monospace; white-space: pre-wrap; }
  `;

  private _handleManifestConfigured(e: CustomEvent) {
    if (e.detail?.topic === 'manifest:configured') {
      this._lastManifest = e.detail.payload;
      this._eventCount++;
    }
  }

  override render() {
    return html`
      <h2>Agent Manifest Editor</h2>
      <p>LLM provider/model/credential configuration. Presets, progressive disclosure provider cards,
        credential editing (env/file/ref + dev-mode inline), model picker with tier grouping,
        alias configuration, per-model inference sliders, test connection, system prompt preview.</p>

      <div class="controls">
        <button class=${this._devMode ? 'active' : ''} @click=${() => { this._devMode = !this._devMode; }}>
          ${this._devMode ? 'Dev Mode ON' : 'Dev Mode OFF'}
        </button>
        <button @click=${() => { this._hasData = !this._hasData; }}>
          ${this._hasData ? 'Clear Data' : 'Load Sample Data'}
        </button>
        <button @click=${() => { this._hasPrompt = !this._hasPrompt; }}>
          ${this._hasPrompt ? 'Clear Prompt' : 'Set System Prompt'}
        </button>
        <button @click=${() => { this._hasData = false; this._hasPrompt = false; this._devMode = false; this._lastManifest = null; this._eventCount = 0; }}>
          Reset All
        </button>
      </div>

      <div class="demo-section" @pages-event=${this._handleManifestConfigured}>
        <agent-manifest-editor
          .data=${this._hasData ? SAMPLE_DATA : {}}
          .systemPrompt=${this._hasPrompt ? SAMPLE_PROMPT : ''}
          .devMode=${this._devMode}
        ></agent-manifest-editor>
      </div>

      <div class="output-section">
        <div class="output-header">
          <h3>Emitted Manifest</h3>
          <span class="event-count">${this._eventCount} event${this._eventCount !== 1 ? 's' : ''} emitted</span>
        </div>
        <pre>${this._lastManifest ? JSON.stringify(this._lastManifest, null, 2) : 'No manifest emitted yet — select a preset or configure a provider.'}</pre>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blocks-example-manifest-editor': ManifestEditorPage;
  }
}
