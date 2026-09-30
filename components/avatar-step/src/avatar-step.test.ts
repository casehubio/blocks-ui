import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { registerCollection, mythicCollection } from '@casehubio/agent-avatar-2d';
import './avatar-step.js';
import type { PersonalityProfile } from '@casehubio/blocks-ui-core';

type AvatarStepEl = HTMLElement & {
  updateComplete: Promise<boolean>;
  hideProfile: boolean;
  externalProfile: PersonalityProfile | null;
  _profile: PersonalityProfile;
  _frameworks: Record<string, string>;
  _bigFive: Record<string, string>;
  _profileProfession: string | null;
  _profileRole: string | null;
  _selectedArchetype: string | null;
};

beforeAll(() => {
  registerCollection(mythicCollection);
});

describe('avatar-step', () => {
  let el: AvatarStepEl;

  beforeEach(() => {
    el = document.createElement('avatar-step') as AvatarStepEl;
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
  });

  it('renders with role="region" and aria-label', async () => {
    await el.updateComplete;
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-label')).toBe('Avatar selection');
  });

  it('renders avatar grid with 48 cells', async () => {
    await el.updateComplete;
    const avatars = el.shadowRoot!.querySelectorAll('.avatar-cell');
    expect(avatars.length).toBe(48);
  });

  it('renders collection bar', async () => {
    await el.updateComplete;
    const bar = el.shadowRoot!.querySelector('[role="radiogroup"]');
    expect(bar).toBeTruthy();
  });

  it('renders personality panel', async () => {
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('.personality-side');
    expect(panel).toBeTruthy();
  });

  it('emits avatar:archetype:selected on avatar click', async () => {
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('.avatar-cell:not([aria-disabled="true"])') as HTMLElement;
    expect(cell).toBeTruthy();
    let detail: Record<string, unknown> | undefined;
    el.addEventListener('avatar:archetype:selected', ((e: CustomEvent) => {
      detail = e.detail;
    }) as EventListener);
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(detail).toBeDefined();
    expect(detail!.archetype).toBeDefined();
  });

  it('archetype selection syncs SDI and Big Five to filter pill state', async () => {
    await el.updateComplete;

    // Click the first archetype cell (Caregiver family)
    const cell = el.shadowRoot!.querySelector('.avatar-cell:not([aria-disabled="true"])') as HTMLElement;
    expect(cell).toBeTruthy();
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await el.updateComplete;
    await el.updateComplete;

    // SDI pill for the archetype's value should have aria-selected="true"
    const sdiPills = el.shadowRoot!.querySelectorAll('[data-framework="sdi"]');
    const selectedSdi = Array.from(sdiPills).filter(p => p.getAttribute('aria-selected') === 'true');
    expect(selectedSdi.length).toBeGreaterThan(0);

    // Big Five toggles should reflect the archetype's values
    const bigFiveToggles = el.shadowRoot!.querySelectorAll('.big5-toggle[aria-checked="true"]');
    expect(bigFiveToggles.length).toBeGreaterThan(0);
  });

  describe('archetype selection syncs all six frameworks to filter pills (#216)', () => {
    function pill(fw: string, value: string): HTMLElement | null {
      return el.shadowRoot!.querySelector(`[data-framework="${fw}"][data-value="${value}"]`);
    }

    async function clickArchetype(family: string, sub: string) {
      const cell = el.shadowRoot!.querySelector(`[aria-label="${family} ${sub} avatar"]`) as HTMLElement;
      expect(cell, `avatar cell for ${family}/${sub}`).toBeTruthy();
      cell.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      await el.updateComplete;
      await el.updateComplete;
    }

    it('syncs MBTI profile value as selected pill', async () => {
      await el.updateComplete;
      await clickArchetype('Caregiver', 'Angel');
      const p = pill('mbti', 'INFJ');
      expect(p).toBeTruthy();
      expect(p!.getAttribute('aria-selected')).toBe('true');
    });

    it('syncs Enneagram profile value as selected pill', async () => {
      await el.updateComplete;
      await clickArchetype('Caregiver', 'Angel');
      const p = pill('enneagram', 'Type 2');
      expect(p).toBeTruthy();
      expect(p!.getAttribute('aria-selected')).toBe('true');
    });

    it('syncs DISC profile value as selected pill', async () => {
      await el.updateComplete;
      await clickArchetype('Caregiver', 'Angel');
      const p = pill('disc', 'S');
      expect(p).toBeTruthy();
      expect(p!.getAttribute('aria-selected')).toBe('true');
    });

    it('syncs Belbin primary as selected pill', async () => {
      await el.updateComplete;
      await clickArchetype('Caregiver', 'Angel');
      const p = pill('belbin', 'Co-ordinator');
      expect(p).toBeTruthy();
      expect(p!.getAttribute('aria-selected')).toBe('true');
    });

    it('does not select non-profile MBTI values', async () => {
      await el.updateComplete;
      await clickArchetype('Caregiver', 'Angel');
      const p = pill('mbti', 'INTJ');
      expect(p).toBeTruthy();
      expect(p!.getAttribute('aria-selected')).toBe('false');
    });

    it('dims non-matching SDI pills when archetype is selected', async () => {
      await el.updateComplete;
      await clickArchetype('Caregiver', 'Angel');
      for (const val of ['Red', 'Green', 'Hub']) {
        const p = pill('sdi', val);
        expect(p, `SDI ${val} pill`).toBeTruthy();
        expect(p!.hasAttribute('data-dimmed'), `SDI ${val} should be dimmed`).toBe(true);
      }
    });

    it('does not dim selected SDI pill', async () => {
      await el.updateComplete;
      await clickArchetype('Caregiver', 'Angel');
      const p = pill('sdi', 'Blue');
      expect(p).toBeTruthy();
      expect(p!.hasAttribute('data-dimmed')).toBe(false);
    });

    it('syncs correctly for a different family (Hero/Warrior)', async () => {
      await el.updateComplete;
      await clickArchetype('Hero', 'Warrior');
      expect(pill('mbti', 'ENTJ')!.getAttribute('aria-selected')).toBe('true');
      expect(pill('enneagram', 'Type 8')!.getAttribute('aria-selected')).toBe('true');
      expect(pill('disc', 'D')!.getAttribute('aria-selected')).toBe('true');
      expect(pill('sdi', 'Red')!.getAttribute('aria-selected')).toBe('true');
      expect(pill('sdi', 'Blue')!.hasAttribute('data-dimmed')).toBe(true);
      expect(pill('sdi', 'Green')!.hasAttribute('data-dimmed')).toBe(true);
    });
  });

  describe('hideProfile', () => {
    it('hides profile section when hideProfile is true', async () => {
      el.remove();
      const el2 = document.createElement('avatar-step') as AvatarStepEl;
      el2.hideProfile = true;
      document.body.appendChild(el2);
      await el2.updateComplete;
      const profile = el2.shadowRoot!.querySelector('.profile-section');
      expect(profile).toBeNull();
      el2.remove();
    });

    it('shows profile section when hideProfile is false (default)', async () => {
      await el.updateComplete;
      const profile = el.shadowRoot!.querySelector('.profile-section');
      expect(profile).toBeTruthy();
    });
  });

  describe('externalProfile', () => {
    it('syncs internal state from externalProfile', async () => {
      await el.updateComplete;
      const profile: PersonalityProfile = {
        profession: 'Engineering', role: 'Architect',
        mbti: 'INTJ', enneagram: 'Type 5', disc: 'CD',
      };
      el.externalProfile = profile;
      await el.updateComplete;
      expect(el._profile.mbti).toBe('INTJ');
      expect(el._frameworks.mbti).toBe('INTJ');
      expect(el._profileProfession).toBe('Engineering');
      expect(el._profileRole).toBe('Architect');
    });

    it('clears internal state when externalProfile is set to null', async () => {
      await el.updateComplete;
      el.externalProfile = { mbti: 'INTJ', enneagram: 'Type 5' };
      await el.updateComplete;
      expect(el._profile.mbti).toBe('INTJ');

      el.externalProfile = null;
      await el.updateComplete;
      expect(el._profile.mbti).toBeUndefined();
      expect(el._selectedArchetype).toBeNull();
    });
  });
});
