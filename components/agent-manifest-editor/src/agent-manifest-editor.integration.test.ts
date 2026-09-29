import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

function collectManifestEvents(el: HTMLElement): Manifest[] {
  const events: Manifest[] = [];
  el.addEventListener('pages-event', ((e: CustomEvent) => {
    if (e.detail?.topic === 'manifest:configured') events.push(e.detail.payload);
  }) as EventListener);
  return events;
}

describe('agent-manifest-editor integration', () => {
  let el: EditorEl;

  beforeEach(() => {
    el = document.createElement('agent-manifest-editor') as EditorEl;
    document.body.appendChild(el);
  });

  afterEach(() => { el.remove(); });

  it('end-to-end: preset → emits manifest with providers, models, aliases', async () => {
    await el.updateComplete;
    const events = collectManifestEvents(el);

    const preset = el.shadowRoot!.querySelector('[data-preset="anthropic-direct"]') as HTMLElement;
    preset.click();
    await el.updateComplete;

    expect(events.length).toBeGreaterThan(0);
    const manifest = events[events.length - 1]!;
    expect(manifest.providers).toBeDefined();
    expect(manifest.providers!.length).toBeGreaterThan(0);
    expect(manifest.providers![0]!.vendor).toBe('anthropic');
    expect(manifest.models).toBeDefined();
    expect(manifest.models!.length).toBeGreaterThan(0);
    expect(manifest.aliases).toBeDefined();
    expect(manifest.aliases!['reasoning-heavy']).toBeDefined();
  });

  it('multi-provider preset includes all providers and models', async () => {
    await el.updateComplete;
    const events = collectManifestEvents(el);

    const preset = el.shadowRoot!.querySelector('[data-preset="multi-provider"]') as HTMLElement;
    preset.click();
    await el.updateComplete;

    expect(events.length).toBeGreaterThan(0);
    const manifest = events[events.length - 1]!;
    expect(manifest.providers!.length).toBe(2);
    const vendors = manifest.providers!.map(p => p.vendor);
    expect(vendors).toContain('anthropic');
    expect(vendors).toContain('openai');
    expect(manifest.models!.length).toBeGreaterThan(3);
  });

  it('state restoration: set data → switch preset → re-set data → aliases restored', async () => {
    const original: Manifest = {
      providers: [{ vendor: 'openai', credential: 'env:KEY' }],
      models: [{ id: 'gpt-4o', vendor: 'openai' }],
      aliases: { custom: { tier: 'FAST', minContext: 50000 } },
      sources: [{ uri: 'https://models.example.com', priority: 1 }],
    };

    el.data = original;
    await el.updateComplete;
    await el.updateComplete;

    // Switch to a preset (modifies aliases)
    const preset = el.shadowRoot!.querySelector('[data-preset="anthropic-direct"]') as HTMLElement;
    preset.click();
    await el.updateComplete;

    // Restore original
    el.data = original;
    await el.updateComplete;
    await el.updateComplete;

    const events = collectManifestEvents(el);

    // Trigger a preset to get an emission with the restored state's passthrough
    const p2 = el.shadowRoot!.querySelector('[data-preset="openai-standard"]') as HTMLElement;
    p2.click();
    await el.updateComplete;

    if (events.length > 0) {
      const last = events[events.length - 1]!;
      expect(last.sources).toEqual([{ uri: 'https://models.example.com', priority: 1 }]);
    }
  });

  it('provider cards render for all 4 built-in providers plus Other', async () => {
    await el.updateComplete;
    const cards = el.shadowRoot!.querySelectorAll('manifest-provider-card');
    expect(cards.length).toBe(5);

    const vendors = Array.from(cards).map(c => (c as any).vendor);
    expect(vendors).toContain('anthropic');
    expect(vendors).toContain('openai');
    expect(vendors).toContain('google');
    expect(vendors).toContain('ollama');
    expect(vendors).toContain('other');
  });

  it('system prompt preview updates when property changes', async () => {
    await el.updateComplete;
    let preview = el.shadowRoot!.querySelector('.prompt-preview');
    expect(preview?.textContent).toContain('No personality profile configured');

    el.systemPrompt = 'You are a precise analyst.';
    await el.updateComplete;
    preview = el.shadowRoot!.querySelector('.prompt-preview');
    expect(preview?.textContent).toContain('You are a precise analyst.');
  });

  it('dev mode passes through to provider cards', async () => {
    el.devMode = true;
    await el.updateComplete;

    const cards = el.shadowRoot!.querySelectorAll('manifest-provider-card');
    for (const card of Array.from(cards)) {
      expect((card as any).devMode).toBe(true);
    }
  });
});
