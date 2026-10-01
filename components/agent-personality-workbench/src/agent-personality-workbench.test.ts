import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { registerCollection, mythicCollection, chibiCollection } from '@casehubio/agent-avatar-2d';
import './agent-personality-workbench.js';
import type { PersonalityProfile, FullAgentDescriptor } from '@casehubio/blocks-ui-core';

type WorkbenchEl = HTMLElement & {
  initialDescriptor: FullAgentDescriptor | null;
  _activeTab: 'templates' | 'advanced';
  _collection: string;
  _groupBy: 'role' | 'family';
  _profile: PersonalityProfile | null;
  _archetype: { family: string; subArchetype: string } | null;
  _selectedTemplateId: string | null;
  _templateName: string;
  _templateDesc: string;
  _templateAlias: string;
  _locked: Set<string>;
  updateComplete: Promise<boolean>;
};

beforeAll(() => {
  registerCollection(mythicCollection);
  registerCollection(chibiCollection);
});

describe('agent-personality-workbench', () => {
  let el: WorkbenchEl;

  beforeEach(() => {
    el = document.createElement('agent-personality-workbench') as WorkbenchEl;
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
  });

  it('renders with role="region" and aria-label', async () => {
    await el.updateComplete;
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-label')).toBe('Agent personality workbench');
  });

  it('renders tablist with two tabs', async () => {
    await el.updateComplete;
    const tablist = el.shadowRoot!.querySelector('[role="tablist"]');
    expect(tablist).toBeTruthy();
    const tabs = el.shadowRoot!.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(2);
  });

  it('shows templates tab by default', async () => {
    await el.updateComplete;
    const tabs = el.shadowRoot!.querySelectorAll('[role="tab"]');
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('false');
  });

  it('switches tabs on click', async () => {
    await el.updateComplete;
    const tabs = el.shadowRoot!.querySelectorAll('[role="tab"]');
    (tabs[1] as HTMLElement).click();
    await el.updateComplete;
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true');
    expect(el._activeTab).toBe('advanced');
  });

  it('renders profile panel', async () => {
    await el.updateComplete;
    const panel = el.shadowRoot!.querySelector('agent-profile-panel');
    expect(panel).toBeTruthy();
  });

  it('renders agent-catalog in templates tab', async () => {
    await el.updateComplete;
    const catalog = el.shadowRoot!.querySelector('agent-catalog');
    expect(catalog).toBeTruthy();
  });

  it('renders avatar-step in advanced tab', async () => {
    await el.updateComplete;
    const avatarStep = el.shadowRoot!.querySelector('avatar-step');
    expect(avatarStep).toBeTruthy();
  });

  it('updates profile when catalog:template:selected fires', async () => {
    await el.updateComplete;
    const catalog = el.shadowRoot!.querySelector('agent-catalog')!;
    catalog.dispatchEvent(new CustomEvent('catalog:template:selected', {
      detail: {
        template: {
          agentId: '', name: 'Test', tenancyId: '',
          archetypeFamily: 'Guardian', subArchetype: 'Sentinel',
          personality: { mbti: 'ISTJ', enneagram: 'Type 1' },
        } as unknown as FullAgentDescriptor,
        templateId: 'test-template-id',
      },
      bubbles: true, composed: true,
    }));
    await el.updateComplete;
    expect(el._profile?.mbti).toBe('ISTJ');
    expect(el._archetype?.family).toBe('Guardian');
    expect(el._selectedTemplateId).toBe('test-template-id');
  });

  it('clears state when catalog:template:deselected fires', async () => {
    await el.updateComplete;
    el._profile = { mbti: 'INTJ' };
    el._selectedTemplateId = 'test-1';
    await el.updateComplete;

    const catalog = el.shadowRoot!.querySelector('agent-catalog')!;
    catalog.dispatchEvent(new CustomEvent('catalog:template:deselected', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el._profile).toBeNull();
    expect(el._selectedTemplateId).toBeNull();
  });

  it('clears state when profile:reset fires', async () => {
    await el.updateComplete;
    el._profile = { mbti: 'INTJ' };
    el._archetype = { family: 'Scholar', subArchetype: 'Analyst' };
    el._selectedTemplateId = 'test-1';
    await el.updateComplete;

    const panel = el.shadowRoot!.querySelector('agent-profile-panel')!;
    panel.dispatchEvent(new CustomEvent('profile:reset', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el._profile).toBeNull();
    expect(el._archetype).toBeNull();
    expect(el._selectedTemplateId).toBeNull();
    expect(el._locked.size).toBe(0);
  });

  it('emits personality:confirmed with profile and archetype', async () => {
    await el.updateComplete;
    el._profile = { mbti: 'INTJ' };
    el._archetype = { family: 'Scholar', subArchetype: 'Analyst' };

    const events: CustomEvent[] = [];
    el.addEventListener('personality:confirmed', (e) => events.push(e as CustomEvent));

    const panel = el.shadowRoot!.querySelector('agent-profile-panel')!;
    panel.dispatchEvent(new CustomEvent('personality:confirmed', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(events.length).toBe(1);
    expect(events[0]!.detail.profile.mbti).toBe('INTJ');
    expect(events[0]!.detail.archetype.family).toBe('Scholar');
  });

  it('tab keyboard navigation with arrow keys', async () => {
    await el.updateComplete;
    const firstTab = el.shadowRoot!.querySelector('#tab-templates') as HTMLElement;
    firstTab.focus();
    firstTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(el._activeTab).toBe('advanced');
  });

  describe('collection bar', () => {
    it('renders collection bar with radiogroup', async () => {
      await el.updateComplete;
      const bar = el.shadowRoot!.querySelector('[aria-label="Avatar collection"]');
      expect(bar).toBeTruthy();
      expect(bar!.getAttribute('role')).toBe('radiogroup');
    });

    it('renders a pill for each registered collection', async () => {
      await el.updateComplete;
      const pills = el.shadowRoot!.querySelectorAll('[aria-label="Avatar collection"] [role="radio"]');
      expect(pills.length).toBeGreaterThanOrEqual(1);
    });

    it('selects mythic by default', async () => {
      await el.updateComplete;
      expect(el._collection).toBe('mythic');
      const selected = el.shadowRoot!.querySelector('[aria-label="Avatar collection"] [aria-checked="true"]');
      expect(selected).toBeTruthy();
      expect(selected!.textContent!.trim().toLowerCase()).toContain('mythic');
    });

    it('updates collection on pill click', async () => {
      await el.updateComplete;
      const pills = el.shadowRoot!.querySelectorAll('[aria-label="Avatar collection"] [role="radio"]');
      if (pills.length < 2) return;
      (pills[1] as HTMLElement).click();
      await el.updateComplete;
      expect(el._collection).not.toBe('mythic');
    });

    it('passes collection to avatar-step', async () => {
      await el.updateComplete;
      const avatarStep = el.shadowRoot!.querySelector('avatar-step') as HTMLElement & { collection: string };
      expect(avatarStep).toBeTruthy();
      expect(avatarStep.collection).toBe(el._collection);
    });

    it('passes collection to agent-catalog', async () => {
      await el.updateComplete;
      const catalog = el.shadowRoot!.querySelector('agent-catalog') as HTMLElement & { collection: string };
      expect(catalog).toBeTruthy();
      expect(catalog.collection).toBe(el._collection);
    });

    it('collection bar is above tab bar', async () => {
      await el.updateComplete;
      const collectionBar = el.shadowRoot!.querySelector('[aria-label="Avatar collection"]') as HTMLElement;
      const tabBar = el.shadowRoot!.querySelector('[role="tablist"]') as HTMLElement;
      expect(collectionBar).toBeTruthy();
      expect(tabBar).toBeTruthy();
      const position = collectionBar.compareDocumentPosition(tabBar);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe('group toggle', () => {
    it('renders group toggle with radiogroup', async () => {
      await el.updateComplete;
      const toggle = el.shadowRoot!.querySelector('[aria-label="Group by"]');
      expect(toggle).toBeTruthy();
      expect(toggle!.getAttribute('role')).toBe('radiogroup');
    });

    it('defaults to By Role', async () => {
      await el.updateComplete;
      expect(el._groupBy).toBe('role');
      const checked = el.shadowRoot!.querySelector('[aria-label="Group by"] [aria-checked="true"]');
      expect(checked).toBeTruthy();
      expect(checked!.textContent!.trim()).toBe('By Role');
    });

    it('toggles to By Family on click', async () => {
      await el.updateComplete;
      const btns = el.shadowRoot!.querySelectorAll('[aria-label="Group by"] [role="radio"]');
      expect(btns.length).toBe(2);
      (btns[1] as HTMLElement).click();
      await el.updateComplete;
      expect(el._groupBy).toBe('family');
    });

    it('passes groupBy to agent-catalog', async () => {
      await el.updateComplete;
      el._groupBy = 'family';
      await el.updateComplete;
      const catalog = el.shadowRoot!.querySelector('agent-catalog') as HTMLElement & { groupBy: string };
      expect(catalog.groupBy).toBe('family');
    });
  });

  describe('profile panel properties', () => {
    it('passes templateName to profile panel on template selection', async () => {
      await el.updateComplete;
      const catalog = el.shadowRoot!.querySelector('agent-catalog')!;
      catalog.dispatchEvent(new CustomEvent('catalog:template:selected', {
        detail: {
          template: {
            agentId: '', name: 'Scholar Analyst', tenancyId: '',
            archetypeFamily: 'Scholar', subArchetype: 'Analyst',
            description: 'Analytical thinker',
            preferredAlias: 'sage',
            personality: { mbti: 'INTJ' },
          } as unknown as FullAgentDescriptor,
          templateId: 'test-id',
        },
        bubbles: true, composed: true,
      }));
      await el.updateComplete;
      expect(el._templateName).toBe('Scholar Analyst');
      expect(el._templateDesc).toBe('Analytical thinker');
      expect(el._templateAlias).toBe('sage');
      const panel = el.shadowRoot!.querySelector('agent-profile-panel') as HTMLElement & { templateName: string; templateDesc: string; templateAlias: string };
      expect(panel.templateName).toBe('Scholar Analyst');
      expect(panel.templateDesc).toBe('Analytical thinker');
      expect(panel.templateAlias).toBe('sage');
    });

    it('clears template info on deselection', async () => {
      await el.updateComplete;
      el._templateName = 'Test';
      el._templateDesc = 'Desc';
      el._templateAlias = 'alias';
      await el.updateComplete;

      const catalog = el.shadowRoot!.querySelector('agent-catalog')!;
      catalog.dispatchEvent(new CustomEvent('catalog:template:deselected', { bubbles: true, composed: true }));
      await el.updateComplete;
      expect(el._templateName).toBe('');
      expect(el._templateDesc).toBe('');
      expect(el._templateAlias).toBe('');
    });

    it('passes collection to profile panel', async () => {
      await el.updateComplete;
      const panel = el.shadowRoot!.querySelector('agent-profile-panel') as HTMLElement & { collection: string };
      expect(panel.collection).toBe(el._collection);
    });
  });
});
