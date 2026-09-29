import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { registerCollection, mythicCollection } from '@casehubio/agent-avatar-2d';
import './agent-personality-workbench.js';
import type { PersonalityProfile, FullAgentDescriptor } from '@casehubio/blocks-ui-core';

type WorkbenchEl = HTMLElement & {
  initialDescriptor: FullAgentDescriptor | null;
  _activeTab: 'templates' | 'advanced';
  _profile: PersonalityProfile | null;
  _archetype: { family: string; subArchetype: string } | null;
  _selectedTemplateId: string | null;
  _locked: Set<string>;
  updateComplete: Promise<boolean>;
};

beforeAll(() => {
  registerCollection(mythicCollection);
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
});
