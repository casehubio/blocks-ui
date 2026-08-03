import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import './casehub-diagram-toolbar.js';

type ToolbarEl = HTMLElement & {
  dirty: boolean;
  saving: boolean;
  hasBackend: boolean;
  updateComplete: Promise<boolean>;
};

describe('casehub-diagram-toolbar', () => {
  let el: ToolbarEl;

  beforeEach(async () => {
    el = document.createElement('casehub-diagram-toolbar') as ToolbarEl;
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => {
    el.remove();
  });

  it('shows save button when hasBackend is true', async () => {
    el.hasBackend = true;
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector('button');
    expect(btn).not.toBeNull();
  });

  it('hides save button when hasBackend is false', () => {
    const btn = el.shadowRoot!.querySelector('button');
    expect(btn).toBeNull();
  });

  it('emits toolbar-save on save button click', async () => {
    el.hasBackend = true;
    el.dirty = true;
    await el.updateComplete;
    const handler = vi.fn();
    el.addEventListener('toolbar-save', handler);
    el.shadowRoot!.querySelector('button')!.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('disables save button when not dirty', async () => {
    el.hasBackend = true;
    el.dirty = false;
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('shows dirty indicator when dirty is true', async () => {
    el.hasBackend = true;
    el.dirty = true;
    await el.updateComplete;
    const dot = el.shadowRoot!.querySelector('.dirty-dot');
    expect(dot).not.toBeNull();
  });

  it('hides dirty indicator when dirty is false', async () => {
    el.hasBackend = true;
    el.dirty = false;
    await el.updateComplete;
    const dot = el.shadowRoot!.querySelector('.dirty-dot');
    expect(dot).toBeNull();
  });

  it('disables save button while saving', async () => {
    el.hasBackend = true;
    el.dirty = true;
    el.saving = true;
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('shows Saving text while saving', async () => {
    el.hasBackend = true;
    el.dirty = true;
    el.saving = true;
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector('button')!;
    expect(btn.textContent!.trim()).toContain('Saving');
  });
});
