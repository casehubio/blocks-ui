import { describe, it, expect, vi, afterEach } from 'vitest';
import { html, render } from 'lit';
import './channel-input.js';
import { ChannelEventTopics } from './events.js';

afterEach(() => { document.body.innerHTML = ''; });

describe('channel-input', () => {
  it('renders a textarea', async () => {
    const el = document.createElement('channel-input') as any;
    el.channelId = 'ch-1';
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('textarea')).toBeTruthy();
  });

  it('emits channel:send-message on Enter', async () => {
    const el = document.createElement('channel-input') as any;
    el.channelId = 'ch-1';
    document.body.appendChild(el);
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('pages-event', handler);
    const textarea = el.shadowRoot!.querySelector('textarea')!;
    textarea.value = 'hello world';
    textarea.dispatchEvent(new Event('input'));
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(handler).toHaveBeenCalledOnce();
    const detail = handler.mock.calls[0]![0]!.detail;
    expect(detail.topic).toBe(ChannelEventTopics.SEND_MESSAGE);
    expect(detail.payload.content).toBe('hello world');
    expect(detail.payload.channelId).toBe('ch-1');
  });

  it('does not emit on Shift+Enter', async () => {
    const el = document.createElement('channel-input') as any;
    el.channelId = 'ch-1';
    document.body.appendChild(el);
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('pages-event', handler);
    const textarea = el.shadowRoot!.querySelector('textarea')!;
    textarea.value = 'line one';
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not emit empty messages', async () => {
    const el = document.createElement('channel-input') as any;
    el.channelId = 'ch-1';
    document.body.appendChild(el);
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('pages-event', handler);
    const textarea = el.shadowRoot!.querySelector('textarea')!;
    textarea.value = '   ';
    textarea.dispatchEvent(new Event('input'));
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(handler).not.toHaveBeenCalled();
  });

  it('clears textarea after sending', async () => {
    const el = document.createElement('channel-input') as any;
    el.channelId = 'ch-1';
    document.body.appendChild(el);
    await el.updateComplete;

    const textarea = el.shadowRoot!.querySelector('textarea')!;
    textarea.value = 'hello';
    textarea.dispatchEvent(new Event('input'));
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await el.updateComplete;

    expect(textarea.value).toBe('');
  });

  it('shows reply banner when replyTo is set', async () => {
    const el = document.createElement('channel-input') as any;
    el.channelId = 'ch-1';
    el.replyTo = { messageId: 'msg-1', senderName: 'agent-alpha' };
    document.body.appendChild(el);
    await el.updateComplete;

    const banner = el.shadowRoot!.querySelector('.reply-banner');
    expect(banner).toBeTruthy();
    expect(banner!.textContent).toContain('agent-alpha');
  });

  it('includes inReplyTo in sent message when replying', async () => {
    const el = document.createElement('channel-input') as any;
    el.channelId = 'ch-1';
    el.replyTo = { messageId: 'msg-1', senderName: 'alpha' };
    document.body.appendChild(el);
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('pages-event', handler);
    const textarea = el.shadowRoot!.querySelector('textarea')!;
    textarea.value = 'reply text';
    textarea.dispatchEvent(new Event('input'));
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(handler.mock.calls[0]![0]!.detail.payload.inReplyTo).toBe('msg-1');
  });

  it('clears replyTo banner on cancel click', async () => {
    const el = document.createElement('channel-input') as any;
    el.channelId = 'ch-1';
    el.replyTo = { messageId: 'msg-1', senderName: 'alpha' };
    document.body.appendChild(el);
    await el.updateComplete;

    el.shadowRoot!.querySelector('.reply-cancel')!.click();
    await el.updateComplete;

    expect(el.replyTo).toBeUndefined();
    expect(el.shadowRoot!.querySelector('.reply-banner')).toBeNull();
  });

  // --- Type Selector (Gap #1) ---

  it('type selector hidden by default', async () => {
    const el = document.createElement('channel-input') as any;
    el.channelId = 'ch-1';
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.type-selector')).toBeNull();
  });

  it('type selector shown when showTypeSelector=true', async () => {
    const el = document.createElement('channel-input') as any;
    el.channelId = 'ch-1';
    el.showTypeSelector = true;
    document.body.appendChild(el);
    await el.updateComplete;

    const select = el.shadowRoot!.querySelector('.type-selector select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.options.length).toBe(9);
  });

  it('allowedTypes filters the type selector', async () => {
    const el = document.createElement('channel-input') as any;
    el.channelId = 'ch-1';
    el.showTypeSelector = true;
    el.allowedTypes = ['QUERY', 'COMMAND'];
    document.body.appendChild(el);
    await el.updateComplete;

    const select = el.shadowRoot!.querySelector('.type-selector select') as HTMLSelectElement;
    const values = Array.from(select.options).map(o => o.value);
    expect(values).toEqual(['QUERY', 'COMMAND']);
  });

  it('deniedTypes filters the type selector', async () => {
    const el = document.createElement('channel-input') as any;
    el.channelId = 'ch-1';
    el.showTypeSelector = true;
    el.deniedTypes = ['EVENT'];
    document.body.appendChild(el);
    await el.updateComplete;

    const select = el.shadowRoot!.querySelector('.type-selector select') as HTMLSelectElement;
    const values = Array.from(select.options).map(o => o.value);
    expect(values).not.toContain('EVENT');
    expect(values.length).toBe(8);
  });

  it('deniedTypes takes precedence over allowedTypes', async () => {
    const el = document.createElement('channel-input') as any;
    el.channelId = 'ch-1';
    el.showTypeSelector = true;
    el.allowedTypes = ['QUERY', 'EVENT'];
    el.deniedTypes = ['EVENT'];
    document.body.appendChild(el);
    await el.updateComplete;

    const select = el.shadowRoot!.querySelector('.type-selector select') as HTMLSelectElement;
    const values = Array.from(select.options).map(o => o.value);
    expect(values).toEqual(['QUERY']);
  });

  it('speechAct included in payload when type selector is visible', async () => {
    const el = document.createElement('channel-input') as any;
    el.channelId = 'ch-1';
    el.showTypeSelector = true;
    document.body.appendChild(el);
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('pages-event', handler);
    const textarea = el.shadowRoot!.querySelector('textarea')!;
    textarea.value = 'hello';
    textarea.dispatchEvent(new Event('input'));
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(handler.mock.calls[0]![0]!.detail.payload.speechAct).toBeTruthy();
  });

  it('speechAct not included when type selector is hidden', async () => {
    const el = document.createElement('channel-input') as any;
    el.channelId = 'ch-1';
    document.body.appendChild(el);
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('pages-event', handler);
    const textarea = el.shadowRoot!.querySelector('textarea')!;
    textarea.value = 'hello';
    textarea.dispatchEvent(new Event('input'));
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(handler.mock.calls[0]![0]!.detail.payload.speechAct).toBeUndefined();
  });

  // --- Error Feedback (Gap #4) ---

  it('shows default error when setError called', async () => {
    const el = document.createElement('channel-input') as any;
    el.channelId = 'ch-1';
    document.body.appendChild(el);
    await el.updateComplete;

    el.setError('Send failed');
    await el.updateComplete;

    const error = el.shadowRoot!.querySelector('.error');
    expect(error).toBeTruthy();
    expect(error!.textContent).toBe('Send failed');
  });

  it('uses renderError callback when provided', async () => {
    const el = document.createElement('channel-input') as any;
    el.channelId = 'ch-1';
    el.renderError = (msg: string) => html`<div class="custom-error">ERR: ${msg}</div>`;
    document.body.appendChild(el);
    await el.updateComplete;

    el.setError('Network error');
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('.custom-error')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('.custom-error')!.textContent).toBe('ERR: Network error');
    expect(el.shadowRoot!.querySelector('.error')).toBeNull();
  });

  it('clears error on next send', async () => {
    const el = document.createElement('channel-input') as any;
    el.channelId = 'ch-1';
    document.body.appendChild(el);
    await el.updateComplete;

    el.setError('Previous error');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.error')).toBeTruthy();

    const textarea = el.shadowRoot!.querySelector('textarea')!;
    textarea.value = 'new message';
    textarea.dispatchEvent(new Event('input'));
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('.error')).toBeNull();
  });

  it('empty and undefined allowedTypes/deniedTypes mean no constraint', async () => {
    const el = document.createElement('channel-input') as any;
    el.channelId = 'ch-1';
    el.showTypeSelector = true;
    el.allowedTypes = [];
    el.deniedTypes = undefined;
    document.body.appendChild(el);
    await el.updateComplete;

    const select = el.shadowRoot!.querySelector('.type-selector select') as HTMLSelectElement;
    expect(select.options.length).toBe(9);
  });
});
