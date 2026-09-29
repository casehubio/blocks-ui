import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { registerCollection, mythicCollection, chibiCollection, neonCollection } from '../../../packages/agent-avatar-2d/src/index.js';
import '../../../components/avatar-step/src/avatar-step.js';

@customElement('blocks-example-avatar-step')
export class AvatarStepPage extends LitElement {
  @state() private _eventLog: string[] = [];

  static override styles = css`
    :host { display: block; padding: 24px; height: 100%; box-sizing: border-box; overflow-y: auto; }
    h2 { margin-bottom: 8px; font-size: 20px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin-bottom: 24px; color: var(--pages-neutral-11, #555); font-size: 14px; }
    .demo-section { margin-bottom: 24px; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 6px; background: var(--pages-neutral-1, #fff); overflow: hidden; }
    avatar-step { display: block; min-height: 600px; }
    .event-log { margin-top: 16px; padding: 16px; background: var(--pages-neutral-2, #f5f5f5); border-radius: 8px; max-height: 200px; overflow-y: auto; }
    .event-log h3 { margin: 0 0 8px; font-size: 14px; }
    .event-log pre { margin: 0; font-size: 13px; font-family: monospace; white-space: pre-wrap; }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    registerCollection(mythicCollection);
    registerCollection(chibiCollection);
    registerCollection(neonCollection);
  }

  private _handlePersonalityChanged(e: CustomEvent) {
    const profile = e.detail;
    const summary = Object.entries(profile)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(', ');
    this._eventLog = [
      `[${new Date().toLocaleTimeString()}] personality:changed — ${summary}`,
      ...this._eventLog.slice(0, 19),
    ];
  }

  private _handleArchetypeSelected(e: CustomEvent) {
    this._eventLog = [
      `[${new Date().toLocaleTimeString()}] archetype:selected — ${e.detail.archetype} (${e.detail.collection})`,
      ...this._eventLog.slice(0, 19),
    ];
  }

  override render() {
    return html`
      <h2>Avatar Step — Personality Profile Builder</h2>
      <p>Faceted personality selector for eidos agents: 6 frameworks (MBTI, Enneagram, DISC, Belbin, SDI, Big Five),
        profession presets (8 professions, 42 roles), split-panel profile configurator,
        4 avatar collections (Mythic/Chibi/Donut Creek/Neon), 12×4 archetype grid with three-tier filtering.</p>

      <div class="demo-section"
           @avatar:personality:changed=${this._handlePersonalityChanged}
           @avatar:archetype:selected=${this._handleArchetypeSelected}>
        <avatar-step></avatar-step>
      </div>

      ${this._eventLog.length > 0 ? html`
        <div class="event-log">
          <h3>Event Log</h3>
          <pre>${this._eventLog.join('\n')}</pre>
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'blocks-example-avatar-step': AvatarStepPage;
  }
}
