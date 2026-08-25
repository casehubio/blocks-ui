import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { createSwfThumbnailRenderer, registerSwfStencils } from '@casehubio/graph-stencil-swf';
import { registerThumbnailRenderer } from '@casehubio/graph-stencil-case';
import '@casehubio/blocks-ui-casehub-diagram';
import '@casehubio/blocks-ui-swf-diagram';

registerSwfStencils();
registerThumbnailRenderer('swf', createSwfThumbnailRenderer());

function highlightYaml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(#.*)/g, '<span class="hl-comment">$1</span>')
    .replace(/^(\s*- )/gm, '<span class="hl-dash">$1</span>')
    .replace(/^(\s*[\w][\w.-]*)(:)/gm, '<span class="hl-key">$1</span><span class="hl-colon">$2</span>')
    .replace(/:\s+(".*?")/g, ': <span class="hl-string">$1</span>')
    .replace(/:\s+('.*?')/g, ': <span class="hl-string">$1</span>')
    .replace(/:\s+(true|false|null)\b/g, ': <span class="hl-bool">$1</span>')
    .replace(/:\s+(\d+\.?\d*)\s*$/gm, ': <span class="hl-number">$1</span>');
}

const PLACEHOLDER = `dsl: casehub/1.0
namespace: example
name: my-case
version: "1.0.0"
spec:
  bindings:
    - name: intake
      capability:
        name: validate
        version: "1.0"
  workers:
    - name: validator
      capabilities:
        - validate
      agent:
        model: claude-sonnet-4-20250514
        instructions: Validate input
`;

@customElement('blocks-example-diagram-export')
export class DiagramExportPage extends LitElement {
  @state() private _yaml = PLACEHOLDER;
  @state() private _diagramType: 'case' | 'swf' = 'case';

  static override styles = css`
    :host { display: flex; flex-direction: column; height: 100%; padding: 24px; box-sizing: border-box; gap: 16px; }
    h2 { font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); margin: 0; }
    p { color: var(--pages-neutral-11, #555); font-size: 14px; margin: 0; }
    .header { display: flex; align-items: center; gap: 16px; }
    .type-toggle {
      padding: 4px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;
      border: 1px solid var(--pages-border-color, #ccc);
      background: var(--pages-surface-color, #fff);
      color: var(--pages-text-color, #333);
    }
    .type-toggle.active {
      background: var(--pages-accent-color, #1a73e8);
      color: #fff; border-color: var(--pages-accent-color, #1a73e8);
    }
    .split { display: flex; flex: 1; min-height: 0; gap: 16px; }
    .editor-wrap {
      position: relative; width: 400px; flex-shrink: 0;
      border: 1px solid var(--pages-border-color, #ddd); border-radius: 6px;
      overflow: hidden;
    }
    .editor-wrap textarea, .editor-wrap pre {
      margin: 0; padding: 12px; font-family: monospace; font-size: 13px;
      line-height: 1.5; tab-size: 2; white-space: pre-wrap; word-wrap: break-word;
      width: 100%; height: 100%; box-sizing: border-box;
    }
    .editor-wrap textarea {
      position: absolute; inset: 0; resize: none;
      background: transparent; color: transparent; caret-color: var(--pages-text-color, #ccc);
      border: none; outline: none; z-index: 1;
    }
    .editor-wrap pre {
      overflow-y: auto;
      background: var(--pages-neutral-2, #1a1a1a); color: var(--pages-neutral-11, #ccc);
    }
    .hl-key { color: #7dd3fc; }
    .hl-colon { color: var(--pages-neutral-9, #888); }
    .hl-string { color: #86efac; }
    .hl-number { color: #fbbf24; }
    .hl-bool { color: #c084fc; }
    .hl-comment { color: var(--pages-neutral-8, #666); font-style: italic; }
    .hl-dash { color: #f97316; }
    .diagram-container {
      flex: 1; min-width: 0;
      border: 1px solid var(--pages-neutral-5, #e0e0e0);
      border-radius: 6px; overflow: hidden;
    }
    casehub-diagram, swf-diagram { width: 100%; height: 100%; }
  `;

  override render() {
    return html`
      <div class="header">
        <h2>Diagram Export</h2>
        <button class="type-toggle ${this._diagramType === 'case' ? 'active' : ''}"
          @click=${() => this._diagramType = 'case'}>Case</button>
        <button class="type-toggle ${this._diagramType === 'swf' ? 'active' : ''}"
          @click=${() => this._diagramType = 'swf'}>SWF</button>
        <p>Paste YAML, then use the toolbar Export buttons to save as SVG or PNG.</p>
      </div>
      <div class="split">
        <div class="editor-wrap">
          <pre><code>${unsafeHTML(highlightYaml(this._yaml))}</code></pre>
          <textarea
            .value=${this._yaml}
            @input=${(e: Event) => { this._yaml = (e.target as HTMLTextAreaElement).value; }}
            spellcheck="false"
          ></textarea>
        </div>
        <div class="diagram-container">
          ${this._diagramType === 'case'
            ? html`<casehub-diagram .yaml=${this._yaml}></casehub-diagram>`
            : html`<swf-diagram .yaml=${this._yaml}></swf-diagram>`}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'blocks-example-diagram-export': DiagramExportPage; }
}
