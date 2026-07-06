import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './scope-context-bar.js';
import type { QueueView } from '@casehubio/blocks-ui-core';

describe('scope-context-bar', () => {
  let el: HTMLElement & { queue: QueueView | null };

  beforeEach(async () => {
    el = document.createElement('scope-context-bar') as any;
    document.body.appendChild(el);
    await (el as any).updateComplete;
  });

  afterEach(() => el.remove());

  it('renders nothing when no queue is set', () => {
    el.queue = null;
    expect(el.shadowRoot!.querySelector('.scope-bar')).toBeNull();
  });

  it('renders label pattern as key:value tag', async () => {
    el.queue = { id: 'q1', name: 'AML', labelPattern: 'domain=aml', scope: null };
    await (el as any).updateComplete;
    const tag = el.shadowRoot!.querySelector('.scope-tag');
    expect(tag?.textContent).toContain('domain');
    expect(tag?.textContent).toContain('aml');
  });

  it('renders raw pattern for non key=value patterns', async () => {
    el.queue = { id: 'q1', name: 'Complex', labelPattern: 'status:active AND priority>2', scope: null };
    await (el as any).updateComplete;
    const tag = el.shadowRoot!.querySelector('.scope-tag');
    expect(tag?.textContent).toContain('status:active AND priority>2');
  });

  it('emits scope-clear on clear button click', async () => {
    el.queue = { id: 'q1', name: 'AML', labelPattern: 'domain=aml', scope: null };
    await (el as any).updateComplete;
    const handler = vi.fn();
    el.addEventListener('scope-clear', handler);
    const clearBtn = el.shadowRoot!.querySelector('.clear-btn') as HTMLElement;
    clearBtn.click();
    expect(handler).toHaveBeenCalled();
  });

  it('has role="status" and aria-live="polite"', async () => {
    el.queue = { id: 'q1', name: 'AML', labelPattern: 'domain=aml', scope: null };
    await (el as any).updateComplete;
    const bar = el.shadowRoot!.querySelector('.scope-bar');
    expect(bar?.getAttribute('role')).toBe('status');
    expect(bar?.getAttribute('aria-live')).toBe('polite');
  });
});
