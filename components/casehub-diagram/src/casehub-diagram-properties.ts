import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property as litProp } from 'lit/decorators.js';
import { renderPropertyForm, emitPropertyChange } from '@casehubio/diagram-core';

export { renderPropertyForm, emitPropertyChange };

@customElement('casehub-diagram-properties')
export class CasehubDiagramProperties extends LitElement {
  @litProp({ attribute: false }) schema: Record<string, unknown> = {};
  @litProp({ attribute: false }) data: Record<string, unknown> = {};
  @litProp({ type: Boolean }) readonly = false;

  static override styles = css`
    :host { display: block; font-family: var(--pages-font-family, system-ui, sans-serif); }
    .panel { padding: 12px; overflow-y: auto; height: 100%; box-sizing: border-box; }
    .panel-header { font-size: 14px; font-weight: 700; margin-bottom: 12px; color: var(--pages-text-color, #333); }
  `;

  private _currentTargetType(): string | null {
    if (this.data['capability'] !== undefined) return 'capability';
    if (this.data['subCase'] !== undefined) return 'subCase';
    if (this.data['humanTask'] !== undefined) return 'humanTask';
    return null;
  }

  private _renderTargetSelector(): TemplateResult | typeof nothing {
    const targetType = this._currentTargetType();
    if (!targetType) return nothing;

    return html`
      <label style="font-size: 12px; color: var(--pages-text-color, #333); margin-bottom: 8px; display: block;">
        Target type
        <select style="width: 100%; font-size: 12px; padding: 4px; margin-top: 2px;"
          ?disabled=${this.readonly}
          @change=${(e: Event) => {
            const newType = (e.target as HTMLSelectElement).value as 'capability' | 'subCase' | 'humanTask';
            if (newType !== targetType) {
              this.dispatchEvent(new CustomEvent('target-type-change', {
                bubbles: true, composed: true, detail: { targetType: newType },
              }));
            }
          }}>
          <option value="capability" ?selected=${targetType === 'capability'}>Capability</option>
          <option value="subCase" ?selected=${targetType === 'subCase'}>SubCase</option>
          <option value="humanTask" ?selected=${targetType === 'humanTask'}>HumanTask</option>
        </select>
      </label>
    `;
  }

  override render() {
    const nodeName = String(this.data['name'] ?? this.data['type'] ?? 'Properties');

    return html`
      <div class="panel">
        <div class="panel-header">${nodeName}</div>
        ${this._renderTargetSelector()}
        ${renderPropertyForm(this.schema, this.data, this.readonly, (field, value) => {
          this.dispatchEvent(emitPropertyChange(field, value));
        })}
      </div>
    `;
  }
}
