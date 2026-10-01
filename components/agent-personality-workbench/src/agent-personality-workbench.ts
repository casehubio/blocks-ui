import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PersonalityProfile, FullAgentDescriptor } from '@casehubio/blocks-ui-core';
import { listCollections } from '../../../packages/agent-avatar-2d/src/collections/registry.js';
import { getRolesForArchetype } from '../../avatar-step/src/data/compatibility-matrix.js';
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
  @state() _collection = 'mythic';
  @state() _groupBy: 'role' | 'family' = 'role';
  @state() _profile: PersonalityProfile | null = null;
  @state() _archetype: { family: string; subArchetype: string } | null = null;
  @state() _selectedTemplateId: string | null = null;
  @state() _templateName = '';
  @state() _templateDesc = '';
  @state() _templateAlias = '';
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
    .collection-bar { display: flex; gap: 6px; margin-bottom: 10px; flex-shrink: 0; }
    .collection-pill {
      padding: 5px 14px; border-radius: 6px; border: 2px solid var(--pages-neutral-4, #3a3a52);
      background: var(--pages-neutral-2, #252538); cursor: pointer; font-size: 13px; font-weight: 500;
      color: var(--pages-neutral-11, #ccc); transition: all 0.15s;
    }
    .collection-pill[aria-checked="true"] {
      border-color: var(--pages-accent-9, #2563eb); background: var(--pages-accent-3, #1e3a5f);
      color: var(--pages-accent-11, #93c5fd);
    }
    .control-row { display: flex; gap: 6px; margin-bottom: 10px; flex-shrink: 0; }
    .toggle-btn {
      padding: 5px 14px; border: 1px solid var(--pages-neutral-5, #4a4a62);
      background: var(--pages-neutral-2, #252538); color: var(--pages-neutral-11, #ccc);
      cursor: pointer; font-size: 12px; transition: all 0.15s;
    }
    .toggle-btn:first-child { border-radius: 6px 0 0 6px; }
    .toggle-btn:last-child { border-radius: 0 6px 6px 0; }
    .toggle-btn[aria-checked="true"] {
      background: var(--pages-accent-9, #2563eb); color: #fff; border-color: var(--pages-accent-9, #2563eb);
    }
  `;

  protected override render() {
    return html`
      <div class="workbench-grid">
        <div class="tab-column">
          ${this._renderCollectionBar()}
          ${this._renderGroupToggle()}
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
              .selectedTemplateId=${this._selectedTemplateId}
              .collection=${this._collection}
              .groupBy=${this._groupBy}>
            </agent-catalog>
          </div>
          <div class="tab-panel" role="tabpanel" id="panel-advanced"
            aria-labelledby="tab-advanced"
            ?hidden=${this._activeTab !== 'advanced'}
            @avatar:archetype:selected=${this._onArchetypeSelected}
            @avatar:personality:changed=${this._onPersonalityChanged}>
            <avatar-step
              .hideProfile=${true}
              .externalProfile=${this._profile}
              .collection=${this._collection}>
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
            .locked=${this._locked}
            .archetypeRoles=${this._archetypeRoles}
            .templateName=${this._templateName}
            .templateDesc=${this._templateDesc}
            .templateAlias=${this._templateAlias}
            .collection=${this._collection}>
          </agent-profile-panel>
        </div>
      </div>
    `;
  }

  private _renderCollectionBar() {
    const collections: ReadonlyArray<{ id: string; label: string }> = listCollections();
    if (collections.length <= 1) return nothing;
    return html`
      <div class="collection-bar" role="radiogroup" aria-label="Avatar collection">
        ${collections.map(c => html`
          <button class="collection-pill" role="radio"
            aria-checked=${String(this._collection === c.id)}
            @click=${() => { this._collection = c.id; }}>
            ${c.label}
          </button>
        `)}
      </div>
    `;
  }

  private _renderGroupToggle() {
    return html`
      <div class="control-row" role="radiogroup" aria-label="Group by">
        <button class="toggle-btn" role="radio"
          aria-checked=${String(this._groupBy === 'role')}
          @click=${() => { this._groupBy = 'role'; }}>By Role</button>
        <button class="toggle-btn" role="radio"
          aria-checked=${String(this._groupBy === 'family')}
          @click=${() => { this._groupBy = 'family'; }}>By Family</button>
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

  private get _archetypeRoles(): Array<{ profession: string; role: string }> {
    if (!this._archetype) return [];
    return getRolesForArchetype(`${this._archetype.family}/${this._archetype.subArchetype}`);
  }

  private _onTemplateSelected(e: CustomEvent) {
    const descriptor = e.detail.template as FullAgentDescriptor;
    this._profile = descriptor.personality ? { ...descriptor.personality } : null;
    this._archetype = descriptor.archetypeFamily && descriptor.subArchetype
      ? { family: descriptor.archetypeFamily, subArchetype: descriptor.subArchetype }
      : null;
    this._selectedTemplateId = (e.detail.templateId as string) || null;
    this._templateName = descriptor.name || '';
    this._templateDesc = descriptor.description || '';
    this._templateAlias = descriptor.preferredAlias || '';
  }

  private _onTemplateDeselected() {
    this._profile = null;
    this._archetype = null;
    this._selectedTemplateId = null;
    this._templateName = '';
    this._templateDesc = '';
    this._templateAlias = '';
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
    this._templateName = '';
    this._templateDesc = '';
    this._templateAlias = '';
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
