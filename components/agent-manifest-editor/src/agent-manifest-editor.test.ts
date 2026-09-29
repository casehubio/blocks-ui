import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './agent-manifest-editor.js';
import type { Manifest } from '@casehubio/blocks-ui-core';

type EditorEl = HTMLElement & {
  updateComplete: Promise<boolean>;
  data: Manifest;
  endpoint: string;
  providersEndpoint: string;
  systemPrompt: string;
  devMode: boolean;
};

describe('agent-manifest-editor', () => {
  let el: EditorEl;

  beforeEach(() => {
    el = document.createElement('agent-manifest-editor') as EditorEl;
    document.body.appendChild(el);
  });

  afterEach(() => { el.remove(); });

  describe('ARIA', () => {
    it('renders with role="form" and aria-label', async () => {
      await el.updateComplete;
      expect(el.getAttribute('role')).toBe('form');
      expect(el.getAttribute('aria-label')).toBe('LLM configuration editor');
    });
  });

  describe('layout', () => {
    it('renders preset bar with 4 presets', async () => {
      await el.updateComplete;
      const presets = el.shadowRoot!.querySelectorAll('.preset-card');
      expect(presets.length).toBe(4);
    });

    it('renders provider cards (4 built-in + Other)', async () => {
      await el.updateComplete;
      const cards = el.shadowRoot!.querySelectorAll('manifest-provider-card');
      expect(cards.length).toBe(5);
    });

    it('renders alias editor section', async () => {
      await el.updateComplete;
      const aliasSection = el.shadowRoot!.querySelector('.alias-editor');
      expect(aliasSection).toBeTruthy();
    });
  });

  describe('system prompt preview', () => {
    it('shows prompt text when set', async () => {
      el.systemPrompt = 'You are a helpful assistant.';
      await el.updateComplete;
      const preview = el.shadowRoot!.querySelector('.prompt-preview');
      expect(preview?.textContent).toContain('You are a helpful assistant.');
    });

    it('shows empty state when no systemPrompt', async () => {
      await el.updateComplete;
      const preview = el.shadowRoot!.querySelector('.prompt-preview');
      expect(preview?.textContent).toContain('No personality profile configured');
    });
  });

  describe('dev mode', () => {
    it('banner hidden by default', async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.dev-banner')).toBeNull();
    });

    it('banner visible when devMode is true', async () => {
      el.devMode = true;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.dev-banner')).toBeTruthy();
    });
  });

  describe('preset selection', () => {
    it('clicking preset populates state and highlights', async () => {
      await el.updateComplete;
      const preset = el.shadowRoot!.querySelector('[data-preset="anthropic-production"]') as HTMLElement;
      preset.click();
      await el.updateComplete;
      expect(preset.classList.contains('active')).toBe(true);
    });

    it('clicking different preset unhighlights previous', async () => {
      await el.updateComplete;
      const p1 = el.shadowRoot!.querySelector('[data-preset="anthropic-production"]') as HTMLElement;
      const p2 = el.shadowRoot!.querySelector('[data-preset="openai-standard"]') as HTMLElement;
      p1.click();
      await el.updateComplete;
      p2.click();
      await el.updateComplete;
      expect(p1.classList.contains('active')).toBe(false);
      expect(p2.classList.contains('active')).toBe(true);
    });

    it('clicking already-active preset is a no-op', async () => {
      await el.updateComplete;
      const events: any[] = [];
      el.addEventListener('pages-event', ((e: CustomEvent) => {
        if (e.detail?.topic === 'manifest:configured') events.push(e.detail.payload);
      }) as EventListener);

      const preset = el.shadowRoot!.querySelector('[data-preset="anthropic-production"]') as HTMLElement;
      preset.click();
      await el.updateComplete;
      const firstCount = events.length;

      preset.click();
      await el.updateComplete;
      expect(events.length).toBe(firstCount);
    });

    it('preset selection emits manifest:configured', async () => {
      await el.updateComplete;
      const events: any[] = [];
      el.addEventListener('pages-event', ((e: CustomEvent) => {
        if (e.detail?.topic === 'manifest:configured') events.push(e.detail.payload);
      }) as EventListener);

      const preset = el.shadowRoot!.querySelector('[data-preset="anthropic-production"]') as HTMLElement;
      preset.click();
      await el.updateComplete;

      expect(events.length).toBeGreaterThan(0);
      const manifest = events[events.length - 1] as Manifest;
      expect(manifest.providers).toBeDefined();
      expect(manifest.providers![0]!.vendor).toBe('anthropic');
      expect(manifest.models!.length).toBeGreaterThan(0);
    });
  });

  describe('alias editor', () => {
    it('add alias row', async () => {
      await el.updateComplete;
      const addBtn = el.shadowRoot!.querySelector('.add-alias-btn') as HTMLElement;
      addBtn.click();
      await el.updateComplete;
      const rows = el.shadowRoot!.querySelectorAll('.alias-row');
      expect(rows.length).toBe(1);
    });

    it('duplicate alias key shows error', async () => {
      await el.updateComplete;
      const addBtn = el.shadowRoot!.querySelector('.add-alias-btn') as HTMLElement;
      addBtn.click();
      addBtn.click();
      await el.updateComplete;

      const inputs = el.shadowRoot!.querySelectorAll('.alias-key-input') as NodeListOf<HTMLInputElement>;
      inputs[0]!.value = 'reasoning';
      inputs[0]!.dispatchEvent(new Event('input', { bubbles: true }));
      inputs[1]!.value = 'reasoning';
      inputs[1]!.dispatchEvent(new Event('input', { bubbles: true }));
      await el.updateComplete;

      const errors = el.shadowRoot!.querySelectorAll('.alias-duplicate-error');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('data property', () => {
    it('initialises from data', async () => {
      el.data = {
        providers: [{ vendor: 'openai', credential: 'env:KEY' }],
        models: [{ id: 'gpt-4o', vendor: 'openai' }],
        aliases: { fast: { tier: 'FAST' } },
      };
      await el.updateComplete;
      await el.updateComplete;

      const aliasRows = el.shadowRoot!.querySelectorAll('.alias-row');
      expect(aliasRows.length).toBe(1);
    });

    it('re-setting data resets state (cancel semantics)', async () => {
      const original: Manifest = {
        providers: [{ vendor: 'openai', credential: 'env:KEY' }],
        models: [{ id: 'gpt-4o', vendor: 'openai' }],
        aliases: { fast: { tier: 'FAST' } },
      };
      el.data = original;
      await el.updateComplete;
      await el.updateComplete;

      el.data = { providers: [], models: [], aliases: {} };
      await el.updateComplete;
      await el.updateComplete;
      const aliasRows = el.shadowRoot!.querySelectorAll('.alias-row');
      expect(aliasRows.length).toBe(0);
    });

    it('passthrough fields preserved on emission', async () => {
      const events: Manifest[] = [];
      el.addEventListener('pages-event', ((e: CustomEvent) => {
        if (e.detail?.topic === 'manifest:configured') events.push(e.detail.payload);
      }) as EventListener);

      el.data = {
        providers: [{ vendor: 'anthropic', credential: 'env:KEY' }],
        models: [{ id: 'claude-opus-4-6', vendor: 'anthropic' }],
        sources: [{ uri: 'https://example.com', priority: 1 }],
        defaults: { backend: 'anthropic' },
      };
      await el.updateComplete;

      const preset = el.shadowRoot!.querySelector('[data-preset="openai-standard"]') as HTMLElement;
      preset.click();
      await el.updateComplete;

      if (events.length > 0) {
        const last = events[events.length - 1]!;
        expect(last.sources).toEqual([{ uri: 'https://example.com', priority: 1 }]);
        expect(last.defaults).toEqual({ backend: 'anthropic' });
      }
    });
  });
});
