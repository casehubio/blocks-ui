import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PersonalityProfile, FullAgentDescriptor } from '@casehubio/blocks-ui-core';
import '../../agent-catalog/src/agent-catalog.js';
import '../../avatar-step/src/avatar-step.js';
import '../../agent-profile-panel/src/agent-profile-panel.js';

export interface AgentPersonalityWorkbenchProps {
  initialDescriptor?: FullAgentDescriptor | null;
}

@customElement('agent-personality-workbench')
export class AgentPersonalityWorkbench extends LitElement {
  @property({ attribute: false }) initialDescriptor: FullAgentDescriptor | null = null;

  @state() _activeTab: 'templates' | 'advanced' = 'templates';
  @state() _profile: PersonalityProfile | null = null;
  @state() _archetype: { family: string; subArchetype: string } | null = null;
  @state() _selectedTemplateId: string | null = null;
  @state() _locked: Set<string> = new Set();

  override connectedCallback() {
    super.connectedCallback();
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', 'Agent personality workbench');
  }

  static override styles = css`
    :host { display: block; height: 100%; font-family: var(--pages-font-family, system-ui); }
    .workbench-grid {
      display: grid;
      grid-template-columns: 1fr minmax(280px, 380px);
      height: 100%;
      gap: 16px;
    }
    @media (max-width: 768px) {
      .workbench-grid { grid-template-columns: 1fr; }
    }
    .tab-column { display: flex; flex-direction: column; overflow: hidden; }
    .profile-column { overflow-y: auto; border-left: 1px solid var(--pages-neutral-4, #333); padding-left: 16px; }
    @media (max-width: 768px) {
      .profile-column { border-left: none; border-top: 1px solid var(--pages-neutral-4, #333); padding-left: 0; padding-top: 16px; }
    }
    .tab-bar { display: flex; gap: 4px; margin-bottom: 12px; flex-shrink: 0; }
    .tab-btn {
      padding: 6px 16px; border: 1px solid var(--pages-neutral-5, #4a4a62);
      border-radius: 6px 6px 0 0; background: var(--pages-neutral-2, #252538);
      color: var(--pages-neutral-11, #ccc); cursor: pointer; font-size: 13px;
      border-bottom: none;
    }
    .tab-btn[aria-selected="true"] {
      background: var(--pages-neutral-3, #2e2e44);
      color: var(--pages-neutral-12, #eee);
      border-bottom: 2px solid var(--pages-accent-7, #3b82f6);
    }
    .tab-panel { flex: 1; overflow-y: auto; }
    .tab-panel[hidden] { display: none; }
  `;

  protected override render() {
    return html`
      <div class="workbench-grid">
        <div class="tab-column">
          <div class="tab-bar" role="tablist" aria-label="Personality configuration mode">
            <button class="tab-btn" role="tab"
              id="tab-templates"
              aria-selected=${String(this._activeTab === 'templates')}
              aria-controls="panel-templates"
              @click=${() => { this._activeTab = 'templates'; }}
              @keydown=${this._onTabKeydown}>Templates</button>
            <button class="tab-btn" role="tab"
              id="tab-advanced"
              aria-selected=${String(this._activeTab === 'advanced')}
              aria-controls="panel-advanced"
              @click=${() => { this._activeTab = 'advanced'; }}
              @keydown=${this._onTabKeydown}>Advanced</button>
          </div>
          <div class="tab-panel" role="tabpanel" id="panel-templates"
            aria-labelledby="tab-templates"
            ?hidden=${this._activeTab !== 'templates'}
            @catalog:template:selected=${this._onTemplateSelected}
            @catalog:template:deselected=${this._onTemplateDeselected}>
            <agent-catalog
              .suppressDetail=${true}
              .selectedTemplateId=${this._selectedTemplateId}>
            </agent-catalog>
          </div>
          <div class="tab-panel" role="tabpanel" id="panel-advanced"
            aria-labelledby="tab-advanced"
            ?hidden=${this._activeTab !== 'advanced'}
            @avatar:archetype:selected=${this._onArchetypeSelected}
            @avatar:personality:changed=${this._onPersonalityChanged}>
            <avatar-step
              .hideProfile=${true}
              .externalProfile=${this._profile}>
            </avatar-step>
          </div>
        </div>
        <div class="profile-column"
          @profile:value:changed=${this._onProfileValueChanged}
          @profile:lock:changed=${this._onProfileLockChanged}
          @profile:reset=${this._onProfileReset}
          @personality:confirmed=${this._onConfirm}>
          <agent-profile-panel
            .profile=${this._profile}
            .archetype=${this._archetype}
            .locked=${this._locked}>
          </agent-profile-panel>
        </div>
      </div>
    `;
  }

  private _onTabKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      this._activeTab = this._activeTab === 'templates' ? 'advanced' : 'templates';
      const nextTab = this.shadowRoot!.querySelector(`#tab-${this._activeTab}`) as HTMLElement;
      nextTab?.focus();
    }
  }

  private _onTemplateSelected(e: CustomEvent) {
    const descriptor = e.detail.template as FullAgentDescriptor;
    this._profile = descriptor.personality ? { ...descriptor.personality } : null;
    this._archetype = descriptor.archetypeFamily && descriptor.subArchetype
      ? { family: descriptor.archetypeFamily, subArchetype: descriptor.subArchetype }
      : null;
    this._selectedTemplateId = (e.detail.templateId as string) || null;
  }

  private _onTemplateDeselected() {
    this._profile = null;
    this._archetype = null;
    this._selectedTemplateId = null;
  }

  private _onArchetypeSelected(e: CustomEvent) {
    const { archetype, personality } = e.detail;
    this._profile = personality ? { ...personality } : null;
    this._archetype = archetype ? { family: archetype.family, subArchetype: archetype.subArchetype } : null;
  }

  private _onPersonalityChanged(e: CustomEvent) {
    this._profile = e.detail.personality ? { ...e.detail.personality } : null;
  }

  private _onProfileValueChanged(e: CustomEvent) {
    e.stopPropagation();
    if (!this._profile) return;
    const { field, value } = e.detail;
    if (field === 'profession') {
      this._profile = { ...this._profile, profession: this._profile.profession === value ? undefined : value, role: undefined };
    } else if (field === 'role') {
      this._profile = { ...this._profile, role: this._profile.role === value ? undefined : value };
    } else if (field === 'belbin') {
      const belbin = this._profile.belbin;
      if (!belbin) {
        this._profile = { ...this._profile, belbin: { primary: value, secondaries: [] } };
      } else if (belbin.primary === value) {
        this._profile = { ...this._profile, belbin: undefined };
      } else if (belbin.secondaries.includes(value)) {
        this._profile = { ...this._profile, belbin: { ...belbin, secondaries: belbin.secondaries.filter((s: string) => s !== value) } };
      } else if (belbin.secondaries.length < 2) {
        this._profile = { ...this._profile, belbin: { ...belbin, secondaries: [...belbin.secondaries, value] } };
      } else {
        this._profile = { ...this._profile, belbin: { ...belbin, secondaries: [belbin.secondaries[1]!, value] } };
      }
    } else if (field === 'bigFive') {
      const { dim, pole } = value;
      const bf = { ...(this._profile.bigFive || {}) } as Record<string, string>;
      if (bf[dim] === pole) { delete bf[dim]; } else { bf[dim] = pole; }
      this._profile = { ...this._profile, bigFive: bf as PersonalityProfile['bigFive'] };
    } else {
      const current = (this._profile as Record<string, unknown>)[field];
      this._profile = { ...this._profile, [field]: current === value ? undefined : value };
    }
  }

  private _onProfileLockChanged(e: CustomEvent) {
    e.stopPropagation();
    const { field, locked } = e.detail;
    const next = new Set(this._locked);
    if (locked) next.add(field); else next.delete(field);
    this._locked = next;
  }

  private _onProfileReset(e: CustomEvent) {
    e.stopPropagation();
    this._profile = null;
    this._archetype = null;
    this._selectedTemplateId = null;
    this._locked = new Set();
  }

  private _onConfirm(e: CustomEvent) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('personality:confirmed', {
      detail: { profile: this._profile, archetype: this._archetype },
      bubbles: true, composed: true,
    }));
  }
}
