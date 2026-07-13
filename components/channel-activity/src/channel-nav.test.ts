import { describe, it, expect, afterEach, vi } from 'vitest';
import './channel-nav.js';
import type { QhorusChannel } from './types.js';
import { ChannelEventTopics } from './events.js';

describe('channel-nav', () => {
  let el: HTMLElement;

  afterEach(() => {
    el?.remove();
    vi.restoreAllMocks();
  });

  it('renders list of channels with names', async () => {
    el = document.createElement('channel-nav');
    const channels: QhorusChannel[] = [
      { id: 'ch1', name: 'General', semantic: 'APPEND', paused: false },
      { id: 'ch2', name: 'Urgent', semantic: 'COLLECT', paused: false },
    ];
    (el as any).channels = channels;
    document.body.appendChild(el);
    await (el as any).updateComplete;

    const items = el.shadowRoot!.querySelectorAll('.channel-item');
    expect(items.length).toBe(2);
    expect(items[0]!.textContent).toContain('General');
    expect(items[1]!.textContent).toContain('Urgent');
  });

  it('highlights selected channel', async () => {
    el = document.createElement('channel-nav');
    (el as any).channels = [
      { id: 'ch1', name: 'General', semantic: 'APPEND', paused: false },
      { id: 'ch2', name: 'Urgent', semantic: 'COLLECT', paused: false },
    ];
    (el as any).selectedChannelId = 'ch1';
    document.body.appendChild(el);
    await (el as any).updateComplete;

    const items = el.shadowRoot!.querySelectorAll('.channel-item');
    expect(items[0]!.classList.contains('selected')).toBe(true);
    expect(items[1]!.classList.contains('selected')).toBe(false);
    expect(items[0]!.getAttribute('aria-selected')).toBe('true');
  });

  it('emits channel:selected on channel click', async () => {
    el = document.createElement('channel-nav');
    (el as any).channels = [{ id: 'ch1', name: 'General', semantic: 'APPEND', paused: false }];
    document.body.appendChild(el);
    await (el as any).updateComplete;

    const listener = vi.fn();
    el.addEventListener('pages-event', listener);
    (el.shadowRoot!.querySelector('.channel-item') as HTMLElement).click();

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]![0]!.detail.topic).toBe(ChannelEventTopics.SELECT_CHANNEL);
    expect(listener.mock.calls[0]![0]!.detail.payload).toEqual({ channelId: 'ch1' });
  });

  it('emits channel:create with name from prompt', async () => {
    el = document.createElement('channel-nav');
    document.body.appendChild(el);
    await (el as any).updateComplete;

    vi.spyOn(window, 'prompt').mockReturnValue('New Channel');
    const listener = vi.fn();
    el.addEventListener('pages-event', listener);

    (el.shadowRoot!.querySelector('.create-channel-btn') as HTMLElement).click();
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]![0]!.detail.topic).toBe(ChannelEventTopics.CREATE_CHANNEL);
    expect(listener.mock.calls[0]![0]!.detail.payload).toEqual({ name: 'New Channel' });
  });

  it('does not emit create when prompt cancelled', async () => {
    el = document.createElement('channel-nav');
    document.body.appendChild(el);
    await (el as any).updateComplete;

    vi.spyOn(window, 'prompt').mockReturnValue(null);
    const listener = vi.fn();
    el.addEventListener('pages-event', listener);

    (el.shadowRoot!.querySelector('.create-channel-btn') as HTMLElement).click();
    expect(listener).not.toHaveBeenCalled();
  });

  it('emits channel:delete after confirm', async () => {
    el = document.createElement('channel-nav');
    (el as any).channels = [{ id: 'ch1', name: 'General', semantic: 'APPEND', paused: false }];
    document.body.appendChild(el);
    await (el as any).updateComplete;

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const listener = vi.fn();
    el.addEventListener('pages-event', listener);

    (el.shadowRoot!.querySelector('.delete-btn') as HTMLElement).click();
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]![0]!.detail.topic).toBe(ChannelEventTopics.DELETE_CHANNEL);
    expect(listener.mock.calls[0]![0]!.detail.payload).toEqual({ channelId: 'ch1' });
  });

  it('does not emit delete when confirm cancelled', async () => {
    el = document.createElement('channel-nav');
    (el as any).channels = [{ id: 'ch1', name: 'General', semantic: 'APPEND', paused: false }];
    document.body.appendChild(el);
    await (el as any).updateComplete;

    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const listener = vi.fn();
    el.addEventListener('pages-event', listener);

    (el.shadowRoot!.querySelector('.delete-btn') as HTMLElement).click();
    expect(listener).not.toHaveBeenCalled();
  });

  it('navigates channels with arrow keys and Enter', async () => {
    el = document.createElement('channel-nav');
    (el as any).channels = [
      { id: 'ch1', name: 'General', semantic: 'APPEND', paused: false },
      { id: 'ch2', name: 'Urgent', semantic: 'COLLECT', paused: false },
      { id: 'ch3', name: 'Random', semantic: 'BARRIER', paused: false },
    ];
    document.body.appendChild(el);
    await (el as any).updateComplete;

    const list = el.shadowRoot!.querySelector('.channel-list') as HTMLElement;
    let items = el.shadowRoot!.querySelectorAll('.channel-item');
    expect(items[0]!.classList.contains('focused')).toBe(true);

    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await (el as any).updateComplete;
    items = el.shadowRoot!.querySelectorAll('.channel-item');
    expect(items[1]!.classList.contains('focused')).toBe(true);

    const listener = vi.fn();
    el.addEventListener('pages-event', listener);
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]![0]!.detail.payload).toEqual({ channelId: 'ch2' });
  });

  it('handles empty channel list without crashing', async () => {
    el = document.createElement('channel-nav');
    (el as any).channels = [];
    document.body.appendChild(el);
    await (el as any).updateComplete;

    expect(el.shadowRoot!.querySelectorAll('.channel-item').length).toBe(0);
    const list = el.shadowRoot!.querySelector('.channel-list') as HTMLElement;
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await (el as any).updateComplete;
    expect((el as any)._focusedIndex).toBe(0);
  });
});
