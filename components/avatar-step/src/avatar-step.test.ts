import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { registerCollection, mythicCollection } from '@casehubio/agent-avatar-2d';
import './avatar-step.js';

type AvatarStepEl = HTMLElement & {
  updateComplete: Promise<boolean>;
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
});
