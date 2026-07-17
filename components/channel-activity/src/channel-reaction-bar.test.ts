import { describe, it, expect, vi, afterEach } from 'vitest';
import './channel-reaction-bar.js';
import type { Reaction } from './types.js';
import { ChannelEventTopics } from './events.js';

function makeReactions(specs: Array<[string, string[]]>): Reaction[] {
  return specs.flatMap(([emoji, actors]) =>
    actors.map(actorId => ({ messageId: 'msg-1', emoji, actorId, createdAt: '2026-07-07T12:00:00Z' }))
  );
}

afterEach(() => { document.body.innerHTML = ''; });

describe('channel-reaction-bar', () => {
  it('renders grouped reaction pills', async () => {
    const el = document.createElement('channel-reaction-bar') as any;
    el.reactions = makeReactions([['👍', ['a', 'b']], ['❤️', ['a']]]);
    el.messageId = 'msg-1';
    document.body.appendChild(el);
    await el.updateComplete;

    const pills = el.shadowRoot!.querySelectorAll('.reaction-pill');
    expect(pills.length).toBe(2);
    expect(pills[0].textContent).toContain('👍');
    expect(pills[0].textContent).toContain('2');
    expect(pills[1].textContent).toContain('❤️');
    expect(pills[1].textContent).toContain('1');
  });

  it('highlights pills where current user reacted', async () => {
    const el = document.createElement('channel-reaction-bar') as any;
    el.reactions = makeReactions([['👍', ['me', 'other']]]);
    el.messageId = 'msg-1';
    el.currentActorId = 'me';
    document.body.appendChild(el);
    await el.updateComplete;

    const pill = el.shadowRoot!.querySelector('.reaction-pill');
    expect(pill!.classList.contains('reacted')).toBe(true);
  });

  it('emits channel:react on click when not reacted', async () => {
    const el = document.createElement('channel-reaction-bar') as any;
    el.reactions = makeReactions([['👍', ['other']]]);
    el.messageId = 'msg-1';
    el.currentActorId = 'me';
    document.body.appendChild(el);
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('pages-event', handler);
    el.shadowRoot!.querySelector('.reaction-pill')!.click();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]![0]!.detail.topic).toBe(ChannelEventTopics.REACT);
    expect(handler.mock.calls[0]![0]!.detail.payload).toEqual({ messageId: 'msg-1', emoji: '👍' });
  });

  it('emits channel:unreact on click when already reacted', async () => {
    const el = document.createElement('channel-reaction-bar') as any;
    el.reactions = makeReactions([['👍', ['me']]]);
    el.messageId = 'msg-1';
    el.currentActorId = 'me';
    document.body.appendChild(el);
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('pages-event', handler);
    el.shadowRoot!.querySelector('.reaction-pill')!.click();

    expect(handler.mock.calls[0]![0]!.detail.topic).toBe(ChannelEventTopics.UNREACT);
  });

  it('renders add button when reactions array is empty', async () => {
    const el = document.createElement('channel-reaction-bar') as any;
    el.reactions = [];
    el.messageId = 'msg-1';
    document.body.appendChild(el);
    await el.updateComplete;

    const pills = el.shadowRoot!.querySelectorAll('.reaction-pill');
    expect(pills.length).toBe(0);
    const addBtn = el.shadowRoot!.querySelector('.add-reaction-btn');
    expect(addBtn).toBeTruthy();
  });

  it('clicking add button shows emoji picker', async () => {
    const el = document.createElement('channel-reaction-bar') as any;
    el.reactions = [];
    el.messageId = 'msg-1';
    document.body.appendChild(el);
    await el.updateComplete;

    const addBtn = el.shadowRoot!.querySelector('.add-reaction-btn') as HTMLButtonElement;
    addBtn.click();
    await el.updateComplete;

    const picker = el.shadowRoot!.querySelector('channel-emoji-picker');
    expect(picker).toBeTruthy();
  });

  it('selecting emoji emits channel:react and closes picker', async () => {
    const el = document.createElement('channel-reaction-bar') as any;
    el.reactions = [];
    el.messageId = 'msg-1';
    document.body.appendChild(el);
    await el.updateComplete;

    const addBtn = el.shadowRoot!.querySelector('.add-reaction-btn') as HTMLButtonElement;
    addBtn.click();
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('pages-event', handler);

    const picker = el.shadowRoot!.querySelector('channel-emoji-picker')!;
    picker.dispatchEvent(new CustomEvent('emoji-selected', {
      bubbles: true, composed: true,
      detail: { emoji: '🎉' },
    }));
    await el.updateComplete;

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]![0]!.detail.topic).toBe(ChannelEventTopics.REACT);
    expect(handler.mock.calls[0]![0]!.detail.payload).toEqual({ messageId: 'msg-1', emoji: '🎉' });
    expect(el.shadowRoot!.querySelector('channel-emoji-picker')).toBeNull();
  });

  it('clicking add button while picker is open closes it', async () => {
    const el = document.createElement('channel-reaction-bar') as any;
    el.reactions = [];
    el.messageId = 'msg-1';
    document.body.appendChild(el);
    await el.updateComplete;

    const addBtn = el.shadowRoot!.querySelector('.add-reaction-btn') as HTMLButtonElement;
    addBtn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('channel-emoji-picker')).toBeTruthy();

    addBtn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('channel-emoji-picker')).toBeNull();
  });

  describe('viewport-aware positioning', () => {
    function stubContainerRect(el: any, rect: Partial<DOMRect>) {
      const container = el.shadowRoot!.querySelector('.picker-container')!;
      vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
        top: 400, bottom: 424, left: 100, right: 128, width: 28, height: 24,
        x: 100, y: 400, toJSON: () => ({}),
        ...rect,
      } as DOMRect);
    }

    function setViewport(width: number, height: number) {
      Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
    }

    it('applies flip class when insufficient space above', async () => {
      setViewport(1024, 800);
      const el = document.createElement('channel-reaction-bar') as any;
      el.reactions = [];
      el.messageId = 'msg-1';
      document.body.appendChild(el);
      await el.updateComplete;

      stubContainerRect(el, { top: 50, bottom: 74 });

      el.shadowRoot!.querySelector('.add-reaction-btn')!.click();
      await el.updateComplete;

      const popover = el.shadowRoot!.querySelector('.picker-popover')!;
      expect(popover.classList.contains('flip')).toBe(true);
    });

    it('applies align-right class when insufficient space on right', async () => {
      setViewport(400, 800);
      const el = document.createElement('channel-reaction-bar') as any;
      el.reactions = [];
      el.messageId = 'msg-1';
      document.body.appendChild(el);
      await el.updateComplete;

      stubContainerRect(el, { left: 200, right: 228 });

      el.shadowRoot!.querySelector('.add-reaction-btn')!.click();
      await el.updateComplete;

      const popover = el.shadowRoot!.querySelector('.picker-popover')!;
      expect(popover.classList.contains('align-right')).toBe(true);
    });

    it('no flip or align-right when sufficient space', async () => {
      setViewport(1024, 800);
      const el = document.createElement('channel-reaction-bar') as any;
      el.reactions = [];
      el.messageId = 'msg-1';
      document.body.appendChild(el);
      await el.updateComplete;

      stubContainerRect(el, { top: 500, left: 100 });

      el.shadowRoot!.querySelector('.add-reaction-btn')!.click();
      await el.updateComplete;

      const popover = el.shadowRoot!.querySelector('.picker-popover')!;
      expect(popover.classList.contains('flip')).toBe(false);
      expect(popover.classList.contains('align-right')).toBe(false);
    });

    it('applies both flip and align-right in top-right corner', async () => {
      setViewport(400, 800);
      const el = document.createElement('channel-reaction-bar') as any;
      el.reactions = [];
      el.messageId = 'msg-1';
      document.body.appendChild(el);
      await el.updateComplete;

      stubContainerRect(el, { top: 50, left: 300 });

      el.shadowRoot!.querySelector('.add-reaction-btn')!.click();
      await el.updateComplete;

      const popover = el.shadowRoot!.querySelector('.picker-popover')!;
      expect(popover.classList.contains('flip')).toBe(true);
      expect(popover.classList.contains('align-right')).toBe(true);
    });
  });
});
