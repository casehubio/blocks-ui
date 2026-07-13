import { describe, it, expect, vi } from 'vitest';
import { emitPagesEvent } from '@casehubio/blocks-ui-core';
import { ChannelEventTopics } from './events.js';

describe('ChannelEventTopics', () => {
  it('all topic constants have channel: prefix', () => {
    for (const topic of Object.values(ChannelEventTopics)) {
      expect(topic).toMatch(/^channel:/);
    }
  });

  it('all topic constants have exact string values', () => {
    expect(ChannelEventTopics.SEND_MESSAGE).toBe('channel:send-message');
    expect(ChannelEventTopics.REACT).toBe('channel:react');
    expect(ChannelEventTopics.UNREACT).toBe('channel:unreact');
    expect(ChannelEventTopics.CREATE_CHANNEL).toBe('channel:create');
    expect(ChannelEventTopics.DELETE_CHANNEL).toBe('channel:delete');
    expect(ChannelEventTopics.SELECT_CHANNEL).toBe('channel:selected');
    expect(ChannelEventTopics.MESSAGE_SELECTED).toBe('channel:message-selected');
    expect(ChannelEventTopics.CURSOR_CATCHUP).toBe('channel:cursor-catchup');
    expect(ChannelEventTopics.CURSOR_RELOAD).toBe('channel:cursor-reload');
  });

  it('does not include removed topics (SELECT_TOPIC, RESOLVE_TOPIC)', () => {
    const keys = Object.keys(ChannelEventTopics);
    expect(keys).not.toContain('SELECT_TOPIC');
    expect(keys).not.toContain('RESOLVE_TOPIC');
  });

  it('has exactly 9 topics', () => {
    expect(Object.keys(ChannelEventTopics).length).toBe(9);
  });
});

describe('emitPagesEvent integration', () => {
  it('dispatches pages-event with topic and payload', () => {
    const target = document.createElement('div');
    const handler = vi.fn();
    target.addEventListener('pages-event', handler);

    emitPagesEvent(target, ChannelEventTopics.SELECT_CHANNEL, { channelId: 'ch-1' });

    expect(handler).toHaveBeenCalledOnce();
    const event = handler.mock.calls[0]![0]! as CustomEvent;
    expect(event.detail.topic).toBe('channel:selected');
    expect(event.detail.payload).toEqual({ channelId: 'ch-1' });
  });

  it('bubbles and composes', () => {
    const target = document.createElement('div');
    const handler = vi.fn();
    document.body.appendChild(target);
    document.body.addEventListener('pages-event', handler);

    emitPagesEvent(target, ChannelEventTopics.SEND_MESSAGE, { channelId: 'ch-1', content: 'hello' });

    expect(handler).toHaveBeenCalledOnce();
    const event = handler.mock.calls[0]![0]! as CustomEvent;
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);

    document.body.removeChild(target);
    document.body.removeEventListener('pages-event', handler);
  });

  it('emits cursor-catchup with channelId and cursorId', () => {
    const target = document.createElement('div');
    const handler = vi.fn();
    target.addEventListener('pages-event', handler);

    emitPagesEvent(target, ChannelEventTopics.CURSOR_CATCHUP, { channelId: 'ch-1', cursorId: 'cur-42' });

    const event = handler.mock.calls[0]![0]! as CustomEvent;
    expect(event.detail.topic).toBe('channel:cursor-catchup');
    expect(event.detail.payload).toEqual({ channelId: 'ch-1', cursorId: 'cur-42' });
  });

  it('emits cursor-reload with channelId only', () => {
    const target = document.createElement('div');
    const handler = vi.fn();
    target.addEventListener('pages-event', handler);

    emitPagesEvent(target, ChannelEventTopics.CURSOR_RELOAD, { channelId: 'ch-1' });

    const event = handler.mock.calls[0]![0]! as CustomEvent;
    expect(event.detail.topic).toBe('channel:cursor-reload');
    expect(event.detail.payload).toEqual({ channelId: 'ch-1' });
  });
});
