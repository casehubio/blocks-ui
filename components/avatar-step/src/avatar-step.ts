import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ARCHETYPE_CONFIGS, ARCHETYPE_FAMILIES, listCollections } from '@casehubio/agent-avatar-2d';
import type { ArchetypeFamily } from '@casehubio/agent-avatar-2d';
import { getCompatibleArchetypes, getValidFrameworkValues, getValidBigFivePoles } from './filter.js';
import type { MatchTier } from './filter.js';
import { FRAMEWORK_FAMILY_MAP, ALL_FRAMEWORK_VALUES, SUB_ARCHETYPE_RULES } from './data/compatibility-matrix.js';
import type { PersonalityFramework, BigFiveDimension, BigFivePole } from './data/compatibility-matrix.js';
import { PROFESSION_PRESETS, PROFESSION_LIST } from './data/profession-presets.js';
import type { RoleVariant } from './data/profession-presets.js';
import { buildSummaryText } from './data/framework-descriptors.js';
import { deriveDispositions, deriveTendencies } from './data/disposition-mapping.js';
import { FRAMEWORK_TOOLTIPS } from './data/framework-tooltips.js';

export interface PersonalityProfile {
  mbti?: string;
  enneagram?: string;
  disc?: string;
  belbin?: { primary: string; secondaries: string[] };
  sdi?: string;
  bigFive?: Partial<Record<BigFiveDimension, BigFivePole>>;
}

const FAMILIES = ARCHETYPE_FAMILIES as readonly string[];
const BIG_FIVE_DIMS: BigFiveDimension[] = ['O', 'C', 'E', 'A', 'N'];
const BIG_FIVE_LABELS: Record<BigFiveDimension, string> = {
  O: 'Openness', C: 'Conscientiousness', E: 'Extraversion', A: 'Agreeableness', N: 'Neuroticism',
};
const FRAMEWORK_LABELS: Record<PersonalityFramework, string> = {
  mbti: 'MBTI', enneagram: 'Enneagram', disc: 'DISC', belbin: 'Belbin', sdi: 'SDI',
};
const SINGLE_FRAMEWORKS: PersonalityFramework[] = ['mbti', 'enneagram', 'disc', 'belbin', 'sdi'];

function familySubs(family: string): string[] {
  return Object.keys(ARCHETYPE_CONFIGS)
    .filter(k => k.startsWith(family + '/'))
    .map(k => k.split('/')[1]!);
}

function getFrameworkProfile(archetypeKey: string): Record<string, string[]> {
  const [family, sub] = archetypeKey.split('/');
  const profile: Record<string, string[]> = {};
  const rules = SUB_ARCHETYPE_RULES[family as ArchetypeFamily]?.find(r => r.subArchetype === sub);
  if (rules) {
    profile['MBTI'] = [...rules.mbtiAffinity];
    profile['Enneagram'] = rules.enneagramAffinity.map(n => `Type ${n}`);
  }
  for (const [fw, map] of Object.entries(FRAMEWORK_FAMILY_MAP)) {
    if (fw === 'bigFive' || fw === 'mbti' || fw === 'enneagram') continue;
    const label = fw === 'disc' ? 'DISC' : fw === 'belbin' ? 'Belbin' : 'SDI';
    const matches = Object.entries(map).filter(([, families]) => (families as string[]).includes(family!)).map(([val]) => val);
    if (matches.length > 0) profile[label] = matches;
  }
  return profile;
}

function getRolesForArchetype(archetypeKey: string): Array<{ profession: string; role: string }> {
  const matches: Array<{ profession: string; role: string }> = [];
  for (const [profession, roles] of Object.entries(PROFESSION_PRESETS)) {
    for (const { role, variants } of roles) {
      if (variants.some(v => v.archetype === archetypeKey)) {
        matches.push({ profession, role });
      }
    }
  }
  return matches;
}

function getRoleFrameworkValues(profession: string, role: string): Set<string> {
  const roles = PROFESSION_PRESETS[profession];
  const r = roles?.find(x => x.role === role);
  if (!r) return new Set();
  const vals = new Set<string>();
  for (const v of r.variants) {
    const profile = getFrameworkProfile(v.archetype);
    for (const [fw, fvs] of Object.entries(profile)) {
      for (const fv of fvs) vals.add(`${fw}:${fv}`);
    }
  }
  return vals;
}

@customElement('avatar-step')
export class AvatarStep extends LitElement {
  static override styles = css`
    :host { display: block; font-family: var(--pages-font-family, system-ui); }

    .collection-bar { display: flex; gap: 6px; margin-bottom: 12px; }
    .collection-btn {
      padding: 6px 14px; border-radius: 6px; border: 2px solid var(--pages-neutral-4, #3a3a52);
      background: var(--pages-neutral-2, #252538); cursor: pointer; font-size: 13px; font-weight: 500;
      color: var(--pages-neutral-11, #ccc); transition: all 0.15s;
    }
    .collection-btn[aria-checked="true"] {
      border-color: var(--pages-accent-9, #2563eb); background: var(--pages-accent-3, #1e3a5f);
      color: var(--pages-accent-11, #93c5fd);
    }

    .main-panel { display: grid; grid-template-columns: 1fr 280px; gap: 12px; margin-bottom: 12px; }
    @media (max-width: 767px) { .main-panel { grid-template-columns: 1fr; } }

    .panel { border: 1px solid var(--pages-neutral-4, #3a3a52); border-radius: 8px; padding: 12px; background: var(--pages-neutral-1, #1e1e2e); }
    .personality-side .panel { font-size: 11px; padding: 10px; }
    .personality-side .framework-row { margin-bottom: 5px; }
    .personality-side .framework-label { min-width: 70px; font-size: 11px; }
    .personality-side .pill { padding: 3px 7px; font-size: 10px; }
    .personality-side .big5-toggle { padding: 2px 6px; font-size: 10px; }
    .personality-side .big5-label { font-size: 10px; min-width: 16px; }
    .personality-side .reset-btn { font-size: 11px; padding: 3px 10px; }
    .personality-side .pill.avatar-match { background: var(--pages-accent-9, #2563eb); color: #fff; border-color: var(--pages-accent-9, #2563eb); }
    .personality-side .pill.role-scope { border-color: var(--pages-accent-7, #3b82f6); background: var(--pages-accent-2, #1a2744); }
    .grid-toggle { display: flex; gap: 6px; margin-bottom: 6px; align-items: center; }
    .grid-toggle label { font-size: 11px; color: var(--pages-neutral-10, #aaa); }
    .grid-toggle button { padding: 2px 8px; font-size: 10px; border-radius: 4px; border: 1px solid var(--pages-neutral-5, #4a4a62); background: var(--pages-neutral-2, #252538); color: var(--pages-neutral-11, #ccc); cursor: pointer; }
    .grid-toggle button.active { background: var(--pages-accent-9, #2563eb); color: #fff; border-color: var(--pages-accent-9, #2563eb); }

    .framework-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
    .framework-label { font-size: 12px; font-weight: 600; min-width: 90px; color: var(--pages-neutral-10, #aaa); }
    .pill {
      padding: 4px 10px; border-radius: 12px; border: 1px solid var(--pages-neutral-5, #4a4a62);
      background: var(--pages-neutral-2, #252538); cursor: pointer; font-size: 12px;
      color: var(--pages-neutral-11, #ccc); transition: all 0.15s;
    }
    .pill[aria-selected="true"], .pill[aria-pressed="true"] {
      background: var(--pages-accent-9, #0066cc); color: #fff; border-color: var(--pages-accent-9, #0066cc);
    }
    .pill[aria-disabled="true"] { opacity: 0.3; pointer-events: none; }
    .pill:hover:not([aria-selected="true"]):not([aria-disabled="true"]) { background: var(--pages-neutral-3, #2d2d44); }

    .big5-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
    .big5-label { font-size: 11px; min-width: 30px; text-align: center; color: var(--pages-neutral-10, #aaa); }
    .big5-toggle {
      padding: 3px 8px; border-radius: 4px; border: 1px solid var(--pages-neutral-5, #4a4a62);
      background: var(--pages-neutral-2, #252538); color: var(--pages-neutral-11, #ccc); cursor: pointer; font-size: 11px;
    }
    .big5-toggle[aria-checked="true"] {
      background: var(--pages-accent-9, #0066cc); color: #fff; border-color: var(--pages-accent-9, #0066cc);
    }
    .big5-toggle[aria-disabled="true"] { opacity: 0.3; pointer-events: none; }

    .reset-btn {
      padding: 4px 12px; border-radius: 4px; border: 1px solid var(--pages-neutral-5, #4a4a62);
      background: var(--pages-neutral-2, #252538); color: var(--pages-neutral-11, #ccc); cursor: pointer; font-size: 12px; margin-top: 4px;
    }
    .profile-section { margin-bottom: 12px; border: 1px solid var(--pages-accent-7, #3b82f6); border-radius: 8px; padding: 10px; background: var(--pages-neutral-2, #252538); }
    .profile-header { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--pages-accent-11, #93c5fd); margin-bottom: 8px; }
    .profile-group { position: relative; }
    .profile-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 12px; }
    .profile-label { min-width: 70px; font-weight: 600; color: var(--pages-neutral-10, #aaa); font-size: 11px; }
    .profile-value { color: var(--pages-neutral-11, #ccc); font-size: 12px; flex: 1; }
    .profile-lock { font-size: 10px; color: var(--pages-neutral-9, #999); cursor: pointer; padding: 2px 6px; border: 1px solid var(--pages-neutral-5, #4a4a62); border-radius: 4px; background: transparent; opacity: 0; transition: opacity 0.15s; }
    .profile-group:hover .profile-lock { opacity: 1; }
    .profile-lock.locked { opacity: 1; color: var(--pages-accent-11, #93c5fd); border-color: var(--pages-accent-7, #3b82f6); }
    .profile-picker { display: none; flex-wrap: wrap; gap: 4px; margin: 4px 0 4px 78px; }
    .profile-group:hover:not(.locked) .profile-picker { display: flex; }
    .profile-default { border-color: var(--pages-accent-7, #3b82f6); color: var(--pages-accent-11, #93c5fd); }
    .pill.sdi-blue, .pill.avatar-match.sdi-blue, .pill.role-scope.sdi-blue { border-color: #3b82f6; color: #93c5fd; background: transparent; }
    .pill.sdi-blue[aria-selected="true"], .pill.sdi-blue[aria-pressed="true"] { background: #2563eb; border-color: #2563eb; color: #fff; }
    .pill.sdi-red, .pill.avatar-match.sdi-red, .pill.role-scope.sdi-red { border-color: #ef4444; color: #fca5a5; background: transparent; }
    .pill.sdi-red[aria-selected="true"], .pill.sdi-red[aria-pressed="true"] { background: #dc2626; border-color: #dc2626; color: #fff; }
    .pill.sdi-green, .pill.avatar-match.sdi-green, .pill.role-scope.sdi-green { border-color: #22c55e; color: #86efac; background: transparent; }
    .pill.sdi-green[aria-selected="true"], .pill.sdi-green[aria-pressed="true"] { background: #16a34a; border-color: #16a34a; color: #fff; }
    .pill.sdi-hub, .pill.avatar-match.sdi-hub, .pill.role-scope.sdi-hub { border-color: #a78bfa; color: #c4b5fd; background: transparent; }
    .pill.sdi-hub[aria-selected="true"], .pill.sdi-hub[aria-pressed="true"] { background: #7c3aed; border-color: #7c3aed; color: #fff; }
    .sdi-text-blue { color: #93c5fd; }
    .sdi-text-red { color: #fca5a5; }
    .sdi-text-green { color: #86efac; }
    .sdi-text-hub { color: #c4b5fd; }
    .profile-belbin-sec { background: transparent; color: var(--pages-accent-9, #2563eb); border: 2px solid var(--pages-accent-9, #2563eb); }
    .dynamic-summary {
      font-size: 10px; color: var(--pages-accent-11, #93c5fd); font-style: italic;
      margin-top: 8px; line-height: 1.3; padding-top: 6px; border-top: 1px solid var(--pages-neutral-4, #3a3a52);
    }
    .disposition-section { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--pages-neutral-4, #3a3a52); }
    .disposition-header { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--pages-neutral-10, #aaa); margin-bottom: 6px; }
    .disposition-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 10px; }
    .disposition-label-low { min-width: 80px; text-align: right; color: var(--pages-neutral-9, #999); }
    .disposition-label-high { min-width: 80px; color: var(--pages-neutral-9, #999); }
    .disposition-bar { flex: 1; height: 6px; background: var(--pages-neutral-4, #3a3a52); border-radius: 3px; position: relative; min-width: 80px; }
    .disposition-marker { position: absolute; top: -3px; width: 12px; height: 12px; border-radius: 50%; background: var(--pages-accent-9, #2563eb); border: 2px solid var(--pages-accent-11, #93c5fd); transform: translateX(-50%); transition: left 0.3s ease; }
    .disposition-neutral { background: var(--pages-neutral-5, #4a4a62); }
    .tendencies-section { margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--pages-neutral-4, #3a3a52); }
    .tendencies-header { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--pages-neutral-10, #aaa); margin-bottom: 6px; }
    .tendency-list { display: flex; flex-wrap: wrap; gap: 4px; }
    .tendency-chip { padding: 3px 8px; border-radius: 10px; font-size: 10px; border: 1px solid; cursor: default; }
    .tendency-chip.strong { background: var(--pages-accent-3, #1e3a5f); border-color: var(--pages-accent-9, #2563eb); color: var(--pages-accent-11, #93c5fd); }
    .tendency-chip.moderate { background: var(--pages-neutral-3, #2d2d44); border-color: var(--pages-accent-7, #3b82f6); color: var(--pages-neutral-11, #ccc); }
    .tendency-chip.mild { background: transparent; border-color: var(--pages-neutral-5, #4a4a62); color: var(--pages-neutral-10, #aaa); }
    .tendency-strength { font-size: 8px; opacity: 0.7; margin-left: 2px; }

    .profession-pills { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
    .role-pills { display: flex; gap: 6px; flex-wrap: wrap; }
    .pill.role-match { border-color: var(--pages-accent-7, #93c5fd); background: var(--pages-accent-2, #eff6ff); }
    .variant-card { display: grid; grid-template-columns: auto 1fr 1fr; gap: 8px; align-items: center; width: 100%; padding: 8px 12px; margin-bottom: 4px; border: 2px solid var(--pages-neutral-4, #3a3a52); border-radius: 8px; background: var(--pages-neutral-2, #252538); cursor: pointer; text-align: left; color: var(--pages-neutral-11, #ccc); font-size: 13px; }
    .variant-card.selected { border-color: var(--pages-accent-9, #2563eb); }
    .variant-card:hover { border-color: var(--pages-accent-7, #93c5fd); }
    .variant-label { font-weight: 600; margin-bottom: 2px; }
    .variant-desc { font-size: 11px; color: var(--pages-neutral-9, #999); }
    .variant-roles { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px; }
    .role-badge { font-size: 9px; padding: 1px 5px; border-radius: 3px; background: var(--pages-accent-2, #1a2744); color: var(--pages-accent-11, #93c5fd); border: 1px solid var(--pages-accent-7, #3b82f6); cursor: pointer; }
    .role-badge:hover { background: var(--pages-accent-3, #1e3a5f); }
    .variant-profile { font-size: 10px; color: var(--pages-neutral-9, #999); margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 0 4px; }
    .variant-profile dt { font-weight: 600; color: var(--pages-neutral-10, #aaa); margin-top: 3px; }
    .variant-profile dd { margin: 0; margin-bottom: 2px; }

    .grid { display: grid; grid-template-columns: auto repeat(4, 1fr); gap: 4px; margin-bottom: 12px; }
    .family-label { font-size: 11px; font-weight: 600; color: var(--pages-neutral-10, #666); padding: 4px 8px 4px 0; display: flex; align-items: center; }
    .avatar-cell {
      display: flex; flex-direction: column; align-items: center; padding: 4px;
      border: 2px solid transparent; border-radius: 8px; cursor: pointer; transition: all 0.15s;
    }
    .avatar-cell.strong { opacity: 1; }
    .avatar-cell.strong:hover { border-color: var(--pages-accent-7, #93c5fd); }
    .avatar-cell.weak { opacity: 0.6; }
    .avatar-cell.weak:hover { border-color: var(--pages-accent-7, #93c5fd); }
    .avatar-cell.incompatible { opacity: 0.25; transform: scale(0.9); pointer-events: none; }
    .avatar-cell[aria-disabled="true"] { cursor: default; }
    .avatar-cell.selected { border-color: var(--pages-accent-9, #0066cc); background: var(--pages-accent-2, #eff6ff); }
    .avatar-cell .sub-label { font-size: 10px; color: var(--pages-neutral-9, #737373); text-align: center; margin-top: 2px; }

    .preview { display: flex; align-items: center; gap: 16px; padding: 12px; border: 1px solid var(--pages-neutral-4, #e5e5e5); border-radius: 8px; min-height: 80px; }
    .preview-info { font-size: 14px; }
    .preview-family { font-weight: 600; color: var(--pages-accent-11, #1e3a5f); }
    .preview-sub { color: var(--pages-neutral-10, #666); }

    .has-tip { position: relative; }
    .pill { overflow: visible; }
    .framework-row { overflow: visible; }
    .profile-row { overflow: visible; }
    .panel { overflow: visible; }
    .has-tip .tip-content {
      display: none; position: absolute; z-index: 10;
      bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%);
      background: var(--pages-neutral-3, #2d2d44); border: 1px solid var(--pages-neutral-5, #4a4a62);
      border-radius: 6px; padding: 6px 10px; font-size: 11px; color: var(--pages-neutral-12, #eee);
      white-space: normal; width: max-content; max-width: 280px; line-height: 1.4;
      pointer-events: auto; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .has-tip .tip-content::after {
      content: ''; position: absolute; top: 100%; left: 0; right: 0; height: 8px;
    }
    .has-tip:hover .tip-content { display: block; }
    .tip-more {
      display: inline-block; margin-top: 4px; font-size: 10px;
      color: var(--pages-accent-11, #93c5fd); cursor: pointer;
      background: none; border: none; padding: 0; text-decoration: underline;
    }
    .tip-dialog-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6); z-index: 100; display: flex;
      align-items: center; justify-content: center;
    }
    .tip-dialog {
      background: var(--pages-neutral-2, #252538); border: 1px solid var(--pages-neutral-5, #4a4a62);
      border-radius: 10px; padding: 20px; max-width: 480px; width: 90%;
      color: var(--pages-neutral-12, #eee); font-size: 13px; line-height: 1.5;
    }
    .tip-dialog h3 { margin: 0 0 8px; color: var(--pages-accent-11, #93c5fd); font-size: 15px; }
    .tip-dialog-close {
      float: right; background: none; border: none; color: var(--pages-neutral-10, #aaa);
      cursor: pointer; font-size: 16px; padding: 0;
    }

    @media (max-width: 767px) {
      .grid { grid-template-columns: auto repeat(2, 1fr); }
    }
  `;

  @state() private _collection = 'mythic';
  @state() private _selectedArchetype: string | null = null;
  @state() private _profession: string | null = null;
  @state() private _selectedRole: string | null = null;
  @state() private _frameworks: Partial<Record<PersonalityFramework, string>> = {};
  @state() private _bigFive: Partial<Record<BigFiveDimension, BigFivePole>> = {};
  @state() private _compactGrid = false;
  @state() private _profile: PersonalityProfile = {};
  @state() private _profileLocked = new Set<string>();
  @state() private _tipDialog: string | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', 'Avatar selection');
  }

  private _tiers(): Map<string, MatchTier> {
    return getCompatibleArchetypes(this._frameworks, this._bigFive);
  }

  private _tip(key: string, content: unknown) {
    const entry = FRAMEWORK_TOOLTIPS[key];
    if (!entry) return content;
    return html`<span class="has-tip">${content}<span class="tip-content">${entry.tip} <button class="tip-more" @click=${(e: Event) => { e.stopPropagation(); this._tipDialog = key; }}>more</button></span></span>`;
  }

  private _renderTipDialog() {
    if (!this._tipDialog) return nothing;
    const entry = FRAMEWORK_TOOLTIPS[this._tipDialog];
    if (!entry) return nothing;
    const title = this._tipDialog.includes(':') ? this._tipDialog.split(':')[1] : this._tipDialog;
    return html`
      <div class="tip-dialog-overlay" @click=${() => { this._tipDialog = null; }}>
        <div class="tip-dialog" @click=${(e: Event) => e.stopPropagation()}>
          <button class="tip-dialog-close" @click=${() => { this._tipDialog = null; }}>X</button>
          <h3>${title}</h3>
          <p>${entry.detail}</p>
        </div>
      </div>
    `;
  }

  private _buildPersonalityProfile(): PersonalityProfile {
    return { ...this._profile };
  }

  private _emitPersonalityChanged() {
    this.dispatchEvent(new CustomEvent('avatar:personality:changed', {
      detail: { personality: this._buildPersonalityProfile() },
      bubbles: true, composed: true,
    }));
  }

  private _initProfile(archetypeKey: string): PersonalityProfile {
    const [family, sub] = archetypeKey.split('/');
    const profile: PersonalityProfile = {};

    const rules = SUB_ARCHETYPE_RULES[family as ArchetypeFamily]?.find(r => r.subArchetype === sub);
    if (rules?.mbtiAffinity.length) profile.mbti = rules.mbtiAffinity[0];
    if (rules?.enneagramAffinity.length) profile.enneagram = `Type ${rules.enneagramAffinity[0]}`;

    for (const fw of ['disc', 'sdi'] as const) {
      const map = FRAMEWORK_FAMILY_MAP[fw];
      for (const [val, families] of Object.entries(map)) {
        if ((families as string[]).includes(family!)) { profile[fw] = val; break; }
      }
    }

    const belbinMatches: string[] = [];
    for (const [val, families] of Object.entries(FRAMEWORK_FAMILY_MAP.belbin)) {
      if ((families as string[]).includes(family!)) belbinMatches.push(val);
    }
    if (belbinMatches.length > 0) {
      profile.belbin = { primary: belbinMatches[0]!, secondaries: belbinMatches.slice(1, 3) };
    }

    const bigFive: Partial<Record<BigFiveDimension, BigFivePole>> = {};
    for (const dim of BIG_FIVE_DIMS) {
      const highFamilies = FRAMEWORK_FAMILY_MAP.bigFive[`High ${dim}`] as string[] | undefined;
      const lowFamilies = FRAMEWORK_FAMILY_MAP.bigFive[`Low ${dim}`] as string[] | undefined;
      const inHigh = highFamilies?.includes(family!) ?? false;
      const inLow = lowFamilies?.includes(family!) ?? false;
      if (inHigh && !inLow) bigFive[dim] = 'high';
      else if (inLow && !inHigh) bigFive[dim] = 'low';
    }
    if (Object.keys(bigFive).length > 0) profile.bigFive = bigFive;

    return profile;
  }

  private _sdiColor(value: string) {
    const cls = `sdi-text-${value.toLowerCase()}`;
    return html`<span class=${cls}>${value}</span>`;
  }

  private _toggleLock(fw: string) {
    const next = new Set(this._profileLocked);
    if (next.has(fw)) next.delete(fw); else next.add(fw);
    this._profileLocked = next;
  }

  private _updateProfileValue(fw: string, value: string) {
    if (fw === 'belbin') { this._updateProfileBelbin(value); return; }
    const current = (this._profile as Record<string, unknown>)[fw];
    if (current === value) {
      this._profile = { ...this._profile, [fw]: undefined };
    } else {
      this._profile = { ...this._profile, [fw]: value };
    }
    this._profileExpanded = null;
    this._emitPersonalityChanged();
  }

  private _updateProfileBelbin(value: string) {
    const belbin = this._profile.belbin;
    if (!belbin) {
      this._profile = { ...this._profile, belbin: { primary: value, secondaries: [] } };
    } else if (belbin.primary === value) {
      this._profile = { ...this._profile, belbin: undefined };
    } else if (belbin.secondaries.includes(value)) {
      this._profile = { ...this._profile, belbin: { ...belbin, secondaries: belbin.secondaries.filter(s => s !== value) } };
    } else if (belbin.secondaries.length < 2) {
      this._profile = { ...this._profile, belbin: { ...belbin, secondaries: [...belbin.secondaries, value] } };
    } else {
      this._profile = { ...this._profile, belbin: { ...belbin, secondaries: [belbin.secondaries[1]!, value] } };
    }
    this._emitPersonalityChanged();
  }

  private _updateProfileBigFive(dim: BigFiveDimension, pole: BigFivePole) {
    const bf = { ...(this._profile.bigFive || {}) };
    if (bf[dim] === pole) { delete bf[dim]; } else { bf[dim] = pole; }
    this._profile = { ...this._profile, bigFive: bf };
    this._emitPersonalityChanged();
  }

  private _selectFramework(fw: PersonalityFramework, value: string) {
    if (this._frameworks[fw] === value) {
      const next = { ...this._frameworks };
      delete next[fw];
      this._frameworks = next;
    } else {
      this._frameworks = { ...this._frameworks, [fw]: value };
    }
  }

  private _toggleBigFive(dim: BigFiveDimension, pole: BigFivePole) {
    if (this._bigFive[dim] === pole) {
      const next = { ...this._bigFive };
      delete next[dim];
      this._bigFive = next;
    } else {
      this._bigFive = { ...this._bigFive, [dim]: pole };
    }
  }

  private _selectArchetype(key: string) {
    this._selectedArchetype = key;
    const [family, sub] = key.split('/');
    const matched = getRolesForArchetype(key);
    const currentMatch = matched.find(m => m.profession === this._profession);
    if (currentMatch) {
      this._selectedRole = currentMatch.role;
    } else if (matched.length > 0) {
      this._profession = matched[0]!.profession;
      this._selectedRole = matched[0]!.role;
    } else {
      this._selectedRole = null;
    }
    this._profile = this._initProfile(key);
    this._profileExpanded = null;
    this.dispatchEvent(new CustomEvent('avatar:archetype:selected', {
      detail: { archetype: { family, subArchetype: sub }, collection: this._collection, personality: this._buildPersonalityProfile() },
      bubbles: true, composed: true,
    }));
  }

  private _reset() {
    this._frameworks = {};
    this._bigFive = {};
  }

  private _navigateToRole(profession: string, role: string, e: Event) {
    e.stopPropagation();
    this._profession = profession;
    this._selectedRole = role;
  }

  protected override render() {
    return html`
      ${this._renderCollectionBar()}
      <div class="main-panel">
        <div class="profession-side">
          ${this._renderProfileSection()}
          ${this._renderProfessionPanel()}
        </div>
        <div class="personality-side">${this._renderPersonalityPanel()}</div>
      </div>
      ${this._renderGrid()}
      ${this._renderTipDialog()}
    `;
  }

  private _renderCollectionBar() {
    const collections = listCollections();
    if (collections.length <= 1) return nothing;
    return html`
      <div class="collection-bar" role="radiogroup" aria-label="Avatar collection">
        ${collections.map(c => html`
          <button class="collection-btn" role="radio"
            aria-checked=${String(this._collection === c.id)}
            @click=${() => { this._collection = c.id; }}>
            ${c.label}
          </button>
        `)}
      </div>
    `;
  }

  private _renderProfessionPanel() {
    const roles = this._profession ? PROFESSION_PRESETS[this._profession] : undefined;
    const activeRole = roles?.find(r => r.role === this._selectedRole);
    const matchedRoles = this._selectedArchetype ? getRolesForArchetype(this._selectedArchetype) : [];
    const matchedProfessions = new Set(matchedRoles.map(m => m.profession));
    return html`
      <div class="panel" role="tabpanel">
        <div class="profession-pills" role="listbox" aria-label="Professions">
          ${PROFESSION_LIST.map(p => {
            const isProfMatch = matchedProfessions.has(p) && this._profession !== p;
            return html`
              <button class=${classMap({ pill: true, 'role-match': isProfMatch })}
                role="option"
                aria-selected=${String(this._profession === p)}
                @click=${() => {
                if (this._profession === p) {
                  this._profession = null;
                  this._selectedRole = null;
                } else {
                  this._profession = p;
                  if (this._selectedArchetype) {
                    const match = matchedRoles.find(m => m.profession === p);
                    this._selectedRole = match ? match.role : null;
                  } else {
                    this._selectedRole = null;
                  }
                }
              }}>
                ${p}
              </button>
            `;
          })}
        </div>
        ${this._selectedArchetype && matchedRoles.length === 0 ? html`
          <div style="font-size:12px;color:var(--pages-neutral-9,#999);margin-top:8px;padding:6px 10px;border:1px dashed var(--pages-neutral-5,#4a4a62);border-radius:6px">
            ${this._selectedArchetype.split('/')[0]} / ${this._selectedArchetype.split('/')[1]} — not mapped to any profession role. Use "By Personality" to explore this archetype.
          </div>
        ` : nothing}
        ${roles ? html`
          <div class="role-pills" role="listbox" aria-label="Roles">
            ${roles.map(({ role }) => {
              const isMatch = matchedRoles.some(m => m.profession === this._profession && m.role === role);
              return html`
                <button class=${classMap({ pill: true, 'role-match': isMatch && this._selectedRole !== role })}
                  role="option"
                  aria-selected=${String(this._selectedRole === role)}
                  @click=${() => { this._selectedRole = this._selectedRole === role ? null : role; }}>
                  ${role}
                </button>
              `;
            })}
          </div>
          ${activeRole ? html`
            <div style="margin-top:10px">
              <div style="font-size:12px;color:var(--pages-neutral-10,#aaa);margin-bottom:6px">What type of ${activeRole.role}?</div>
              ${activeRole.variants.map(v => {
                const profile = getFrameworkProfile(v.archetype);
                const variantRoles = getRolesForArchetype(v.archetype);
                return html`
                  <button class=${classMap({ 'variant-card': true, selected: this._selectedArchetype === v.archetype })}
                    @click=${() => this._selectArchetype(v.archetype)}>
                    <agent-avatar .archetype=${{ family: v.archetype.split('/')[0], subArchetype: v.archetype.split('/')[1] }}
                      collection=${this._collection} size="sm"></agent-avatar>
                    <div>
                      <div class="variant-label">${v.label}</div>
                      <div class="variant-desc">${v.description}</div>
                      <div style="font-size:10px;color:var(--pages-accent-11,#93c5fd);margin-top:2px">${v.archetype.split('/')[0]} / ${v.archetype.split('/')[1]}</div>
                      ${variantRoles.length > 0 ? html`
                        <div class="variant-roles">
                          ${variantRoles.map(m => html`
                            <span class="role-badge"
                              @click=${(e: Event) => this._navigateToRole(m.profession, m.role, e)}>
                              ${m.profession} &rsaquo; ${m.role}
                            </span>
                          `)}
                        </div>
                      ` : nothing}
                    </div>
                    <dl class="variant-profile">
                      ${Object.entries(profile).map(([fw, vals]) => html`
                        <dt>${this._tip(fw, fw)}</dt><dd>${vals.map((val: string) => this._tip(`${fw}:${val}`, fw === 'SDI' ? this._sdiColor(val) : val)).reduce((a: any, b: any) => html`${a}, ${b}`)}</dd>
                      `)}
                    </dl>
                  </button>
                `;
              })}
            </div>
          ` : nothing}
        ` : nothing}
      </div>
    `;
  }

  private _renderProfileSection() {
    const p = this._profile;
    const affinityProfile = this._selectedArchetype ? getFrameworkProfile(this._selectedArchetype) : {};
    const affinityVals = new Set<string>();
    for (const [fw, fvs] of Object.entries(affinityProfile)) {
      for (const fv of fvs) affinityVals.add(`${fw}:${fv}`);
    }
    const fwKeyMap: Record<string, string> = { mbti: 'MBTI', enneagram: 'Enneagram', disc: 'DISC', sdi: 'SDI' };

    const summaryText = buildSummaryText(p.mbti, p.enneagram, p.disc, this._selectedArchetype?.split('/')[1] ?? 'agent');

    return html`
      <div class="profile-section" role="region" aria-label="Personality profile">
        <div class="profile-header">Personality Profile</div>
        ${(['mbti', 'enneagram', 'disc', 'sdi'] as const).map(fw => {
          const label = fwKeyMap[fw]!;
          const val = p[fw];
          const isLocked = this._profileLocked.has(fw);
          return html`
            <div class=${classMap({ 'profile-group': true, locked: isLocked })}>
              <div class="profile-row">
                <span class="profile-label">${this._tip(label, label)}</span>
                <span class="profile-value">${val ? this._tip(`${label}:${val}`, fw === 'sdi' ? this._sdiColor(val) : val) : '—'}</span>
                <button class=${classMap({ 'profile-lock': true, locked: isLocked })}
                  @click=${() => this._toggleLock(fw)}>
                  ${isLocked ? 'unlock' : 'lock'}
                </button>
              </div>
              <div class="profile-picker" role="listbox" aria-label="${label} selection">
                ${(ALL_FRAMEWORK_VALUES[fw] as readonly string[]).map(v => {
                  const isDefault = affinityVals.has(`${label}:${v}`);
                  const classes: Record<string, boolean> = { pill: true, 'profile-default': isDefault && p[fw] !== v };
                  if (fw === 'sdi') classes[`sdi-${v.toLowerCase()}`] = true;
                  return html`
                    <button class=${classMap(classes)}
                      role="option" aria-selected=${String(p[fw] === v)}
                      @click=${() => this._updateProfileValue(fw, v)}>
                      ${this._tip(`${label}:${v}`, v)}
                    </button>
                  `;
                })}
              </div>
            </div>
          `;
        })}
        <div class=${classMap({ 'profile-group': true, locked: this._profileLocked.has('belbin') })}>
          <div class="profile-row">
            <span class="profile-label">${this._tip('Belbin', 'Belbin')}</span>
            <span class="profile-value">${p.belbin ? html`${this._tip('Belbin:' + p.belbin.primary, p.belbin.primary)}${p.belbin.secondaries.length ? html` + ${p.belbin.secondaries.map(s => this._tip('Belbin:' + s, s)).reduce((a: any, b: any) => html`${a}, ${b}`)}` : nothing}` : '—'}</span>
            <button class=${classMap({ 'profile-lock': true, locked: this._profileLocked.has('belbin') })}
              @click=${() => this._toggleLock('belbin')}>
              ${this._profileLocked.has('belbin') ? 'unlock' : 'lock'}
            </button>
          </div>
          <div class="profile-picker" role="group" aria-label="Belbin team roles">
            ${(ALL_FRAMEWORK_VALUES.belbin as readonly string[]).map(v => {
              const isPrimary = p.belbin?.primary === v;
              const isSecondary = p.belbin?.secondaries.includes(v) ?? false;
              const isDefault = affinityVals.has(`Belbin:${v}`);
              return html`
                <button class=${classMap({ pill: true, 'profile-belbin-sec': isSecondary && !isPrimary, 'profile-default': isDefault && !isPrimary && !isSecondary })}
                  role="button"
                  aria-pressed=${String(isPrimary || isSecondary)}
                  aria-description=${isPrimary ? 'primary' : isSecondary ? 'secondary' : nothing}
                  @click=${() => this._updateProfileBelbin(v)}>
                  ${this._tip('Belbin:' + v, v)}
                </button>
              `;
            })}
          </div>
        </div>
        <div class=${classMap({ 'profile-group': true, locked: this._profileLocked.has('bigFive') })}>
          <div class="profile-row">
            <span class="profile-label">${this._tip('Big Five', 'Big Five')}</span>
            <span class="profile-value">${BIG_FIVE_DIMS.map(d => p.bigFive?.[d] ? `${d}${p.bigFive[d] === 'high' ? '↑' : '↓'}` : '').filter(Boolean).join(' ') || '—'}</span>
            <button class=${classMap({ 'profile-lock': true, locked: this._profileLocked.has('bigFive') })}
              @click=${() => this._toggleLock('bigFive')}>
              ${this._profileLocked.has('bigFive') ? 'unlock' : 'lock'}
            </button>
          </div>
          <div class="profile-picker" style="flex-direction:column;margin-left:78px">
            ${BIG_FIVE_DIMS.map(dim => html`
              <div class="big5-row" role="radiogroup" aria-label=${BIG_FIVE_LABELS[dim]}>
                <span class="big5-label">${dim}</span>
                ${(['high', 'low'] as const).map(pole => html`
                  <button class="big5-toggle" role="radio"
                    aria-checked=${String(p.bigFive?.[dim] === pole)}
                    @click=${() => this._updateProfileBigFive(dim, pole)}>
                    ${this._tip(`Big Five:${pole === 'high' ? 'High' : 'Low'} ${dim}`, pole === 'high' ? 'High' : 'Low')}
                  </button>
                `)}
              </div>
            `)}
          </div>
        </div>
        ${summaryText ? html`<div class="dynamic-summary">${summaryText}</div>` : nothing}
        ${this._renderDispositions()}
      </div>
    `;
  }

  private _renderDispositions() {
    const hasAnyProfile = this._profile.mbti || this._profile.enneagram || this._profile.disc || this._profile.sdi || this._profile.belbin || (this._profile.bigFive && Object.keys(this._profile.bigFive).length > 0);
    if (!hasAnyProfile) return nothing;
    const scores = deriveDispositions(this._profile);
    return html`
      <div class="disposition-section">
        <div class="disposition-header">Canonical Dispositions</div>
        ${scores.map(s => {
          const pct = ((s.score + 1) / 2) * 100;
          const isNeutral = Math.abs(s.score) < 0.1;
          return html`
            <div class="disposition-row" title="${s.contributors.join(', ')}">
              <span class="disposition-label-low">${s.lowLabel}</span>
              <div class="disposition-bar">
                <div class=${classMap({ 'disposition-marker': true, 'disposition-neutral': isNeutral })} style="left: ${pct}%"></div>
              </div>
              <span class="disposition-label-high">${s.highLabel}</span>
            </div>
          `;
        })}
      </div>
      ${this._renderTendencies(scores)}
    `;
  }

  private _renderTendencies(scores: ReturnType<typeof deriveDispositions>) {
    const tendencies = deriveTendencies(scores);
    if (tendencies.length === 0) return nothing;
    return html`
      <div class="tendencies-section">
        <div class="tendencies-header">Behavioral Tendencies</div>
        <div class="tendency-list">
          ${tendencies.map(t => html`
            <span class=${classMap({ 'tendency-chip': true, [t.strength]: true })} title="${t.description}">
              ${t.name}<span class="tendency-strength">${t.strength === 'strong' ? '+++' : t.strength === 'moderate' ? '++' : '+'}</span>
            </span>
          `)}
        </div>
      </div>
    `;
  }

  private _renderPersonalityPanel() {
    const avatarProfile = this._selectedArchetype ? getFrameworkProfile(this._selectedArchetype) : {};
    const avatarVals = new Set<string>();
    for (const [fw, fvs] of Object.entries(avatarProfile)) {
      for (const fv of fvs) avatarVals.add(`${fw}:${fv}`);
    }
    const roleVals = (this._profession && this._selectedRole)
      ? getRoleFrameworkValues(this._profession, this._selectedRole) : new Set<string>();
    const fwKeyMap: Record<string, string> = { mbti: 'MBTI', enneagram: 'Enneagram', disc: 'DISC', belbin: 'Belbin', sdi: 'SDI' };
    return html`
      <div class="panel" role="tabpanel">
        ${SINGLE_FRAMEWORKS.map(fw => {
          const valid = new Set(getValidFrameworkValues(fw, this._frameworks, this._bigFive));
          const fwLabel = fwKeyMap[fw] ?? fw;
          return html`
            <div class="framework-row">
              <span class="framework-label">${this._tip(FRAMEWORK_LABELS[fw], FRAMEWORK_LABELS[fw])}</span>
              <div role="listbox" aria-label=${FRAMEWORK_LABELS[fw]} style="display:flex;gap:4px;flex-wrap:wrap">
                ${(ALL_FRAMEWORK_VALUES[fw] as readonly string[]).map(v => {
                  const isAvatarMatch = avatarVals.has(`${fwLabel}:${v}`);
                  const isRoleScope = roleVals.has(`${fwLabel}:${v}`);
                  const isSelected = this._frameworks[fw] === v;
                  const isDisabled = !valid.has(v) && !isSelected;
                  const classes: Record<string, boolean> = { pill: true, 'avatar-match': isAvatarMatch && !isSelected, 'role-scope': isRoleScope && !isAvatarMatch && !isSelected };
                  if (fw === 'sdi') classes[`sdi-${v.toLowerCase()}`] = true;
                  return html`
                    <button class=${classMap(classes)}
                      role="option"
                      data-framework=${fw} data-value=${v}
                      aria-selected=${String(isSelected)}
                      aria-disabled=${String(isDisabled)}
                      @click=${() => this._selectFramework(fw, v)}>
                      ${this._tip(`${fwLabel}:${v}`, v)}
                    </button>
                  `;
                })}
              </div>
            </div>
          `;
        })}
        <div class="framework-row">
          <span class="framework-label">${this._tip('Big Five', 'Big Five')}</span>
          <div style="display:flex;flex-direction:column;gap:2px">
            ${BIG_FIVE_DIMS.map(dim => {
              const validPoles = getValidBigFivePoles(dim, this._bigFive, this._frameworks);
              return html`
                <div class="big5-row" role="radiogroup" aria-label=${BIG_FIVE_LABELS[dim]}>
                  <span class="big5-label">${dim}</span>
                  ${(['high', 'low'] as const).map(pole => html`
                    <button class="big5-toggle" role="radio"
                      aria-checked=${String(this._bigFive[dim] === pole)}
                      aria-disabled=${String(!validPoles.has(pole) && this._bigFive[dim] !== pole)}
                      @click=${() => this._toggleBigFive(dim, pole)}>
                      ${this._tip(`Big Five:${pole === 'high' ? 'High' : 'Low'} ${dim}`, pole === 'high' ? 'High' : 'Low')}
                    </button>
                  `)}
                </div>
              `;
            })}
          </div>
        </div>
        <button class="reset-btn" @click=${() => this._reset()}>Reset all</button>
      </div>
    `;
  }

  private _renderGrid() {
    const tiers = this._tiers();
    const hasFilters = Object.keys(this._frameworks).length > 0 || Object.keys(this._bigFive).length > 0;
    return html`
      ${hasFilters ? html`
        <div class="grid-toggle">
          <label>View:</label>
          <button class=${this._compactGrid ? '' : 'active'} @click=${() => { this._compactGrid = false; }}>Full</button>
          <button class=${this._compactGrid ? 'active' : ''} @click=${() => { this._compactGrid = true; }}>Compact</button>
        </div>
      ` : nothing}
      <div class="grid" role="radiogroup" aria-label="Select archetype avatar">
        ${FAMILIES.map(family => {
          const subs = familySubs(family);
          const familyTiers = subs.map(s => tiers.get(`${family}/${s}`) ?? 'strong');
          const allIncompat = this._compactGrid && familyTiers.every(t => t === 'incompatible');
          if (allIncompat) return nothing;
          return html`
            <div class="family-label" role="group" aria-label="${family} family">${family}</div>
            ${subs.map(sub => {
              const key = `${family}/${sub}`;
              const tier = tiers.get(key) ?? 'strong';
              const selected = this._selectedArchetype === key;
              const disabled = tier === 'incompatible';
              if (this._compactGrid && disabled) return html`<div></div>`;
              return html`
                <div class=${classMap({ 'avatar-cell': true, [tier]: true, selected })}
                  role="radio" aria-checked=${String(selected)}
                  aria-label="${family} ${sub} avatar"
                  aria-disabled=${String(disabled)}
                  @click=${disabled ? nothing : () => this._selectArchetype(key)}>
                  <agent-avatar
                    .archetype=${{ family, subArchetype: sub }}
                    collection=${this._collection}
                    size="sm">
                  </agent-avatar>
                  <span class="sub-label">${sub}</span>
                </div>
              `;
            })}
          `;
        })}
      </div>
    `;
  }

  private _renderPreview() {
    const [family, sub] = this._selectedArchetype!.split('/');
    const matchedRoles = getRolesForArchetype(this._selectedArchetype!);
    const profile = getFrameworkProfile(this._selectedArchetype!);
    return html`
      <div class="preview" role="status" aria-live="polite">
        <agent-avatar
          .archetype=${{ family, subArchetype: sub }}
          collection=${this._collection}
          size="lg">
        </agent-avatar>
        <div class="preview-info">
          <div class="preview-family">${family}</div>
          <div class="preview-sub">${sub}</div>
          ${matchedRoles.length > 0 ? html`
            <div style="font-size:11px;color:var(--pages-neutral-9,#999);margin-top:4px">
              ${matchedRoles.map(m => html`<span style="background:var(--pages-accent-2,#eff6ff);padding:2px 6px;border-radius:4px;margin-right:4px;display:inline-block;margin-bottom:2px">${m.profession} &rsaquo; ${m.role}</span>`)}
            </div>
          ` : nothing}
          <dl class="variant-profile" style="margin-top:8px">
            ${Object.entries(profile).map(([fw, vals]) => html`
              <dt>${this._tip(fw, fw)}</dt><dd>${vals.map((val: string) => this._tip(`${fw}:${val}`, val)).reduce((a: any, b: any) => html`${a}, ${b}`)}</dd>
            `)}
          </dl>
        </div>
      </div>
    `;
  }
}
