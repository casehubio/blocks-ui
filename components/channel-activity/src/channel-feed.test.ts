import { describe, it, expect, afterEach, vi } from 'vitest';
import { html } from 'lit';
import './channel-feed.js';
import './channel-message.js';
import './channel-thread.js';
import './channel-reaction-bar.js';
import type { QhorusMessage } from './types.js';
import { ChannelEventTopics } from './events.js';

import type { QhorusTopic } from './types.js';

function msg(id: string, overrides: Partial<QhorusMessage> = {}): QhorusMessage {
  return {
    id, channelId: 'ch-1', sender: 'agent-a', messageType: 'EVENT',
    actorType: 'AGENT', content: `Message ${id}`, topic: 'General', topicId: 't-default',
    replyCount: 0, artefactRefs: [], createdAt: '2026-07-07T12:00:00Z', ...overrides,
  };
}

function topic(id: string, name: string, overrides: Partial<QhorusTopic> = {}): QhorusTopic {
  return {
    id, channelId: 'ch-1', name, state: 'ACTIVE', messageCount: 0,
    createdAt: '2026-01-01T00:00:00Z', ...overrides,
  };
}

afterEach(() => { document.body.innerHTML = ''; });

describe('channel-feed', () => {
  it('renders messages chronologically', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [msg('1'), msg('2'), msg('3')];
    document.body.appendChild(el);
    await el.updateComplete;

    const msgs = el.shadowRoot!.querySelectorAll('channel-message');
    expect(msgs.length).toBe(3);
  });

  it('groups consecutive messages from same sender within 2 min', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [
      msg('1', { sender: 'alice', createdAt: '2026-07-07T12:00:00Z' }),
      msg('2', { sender: 'alice', createdAt: '2026-07-07T12:00:30Z' }),
      msg('3', { sender: 'bob', createdAt: '2026-07-07T12:01:00Z' }),
    ];
    document.body.appendChild(el);
    await el.updateComplete;

    const headers = el.shadowRoot!.querySelectorAll('.message-group-header');
    expect(headers.length).toBe(2);
  });

  it('splits sender groups when messages >2min apart', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [
      msg('1', { sender: 'alice', createdAt: '2026-07-07T12:00:00Z' }),
      msg('2', { sender: 'alice', createdAt: '2026-07-07T12:02:01Z' }),
    ];
    document.body.appendChild(el);
    await el.updateComplete;

    const headers = el.shadowRoot!.querySelectorAll('.message-group-header');
    expect(headers.length).toBe(2);
  });

  it('renders empty state when messages array is empty', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [];
    document.body.appendChild(el);
    await el.updateComplete;

    const emptyDiv = el.shadowRoot!.querySelector('.empty');
    expect(emptyDiv).toBeTruthy();
    expect(emptyDiv!.textContent!.trim()).toBe('No messages yet');
  });

  it('separates replies from roots and renders thread inline', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [
      msg('root', { sender: 'alice' }),
      msg('reply1', { sender: 'bob', inReplyTo: 'root' }),
      msg('reply2', { sender: 'carol', inReplyTo: 'root' }),
      msg('standalone', { sender: 'dave' }),
    ];
    document.body.appendChild(el);
    await el.updateComplete;

    const threads = el.shadowRoot!.querySelectorAll('channel-thread');
    expect(threads.length).toBe(1);
    const thread = threads[0] as any;
    expect(thread.rootMessage.id).toBe('root');
    expect(thread.replies.length).toBe(2);
  });

  it('promotes orphaned replies to roots when parent is missing', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [
      msg('m1', { sender: 'alice' }),
      msg('orphan', { sender: 'bob', inReplyTo: 'deleted-parent' }),
    ];
    document.body.appendChild(el);
    await el.updateComplete;

    const messages = el.shadowRoot!.querySelectorAll('channel-message');
    expect(messages.length).toBe(2);
    const threads = el.shadowRoot!.querySelectorAll('channel-thread');
    expect(threads.length).toBe(0);
  });

  it('filters reactions per message correctly', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [msg('m1', { sender: 'alice' }), msg('m2', { sender: 'bob' })];
    el.reactions = [
      { messageId: 'm1', emoji: '👍', actorId: 'u1', createdAt: '2026-07-07T12:00:00Z' },
      { messageId: 'm1', emoji: '❤️', actorId: 'u2', createdAt: '2026-07-07T12:00:00Z' },
      { messageId: 'm2', emoji: '🔥', actorId: 'u3', createdAt: '2026-07-07T12:00:00Z' },
    ];
    document.body.appendChild(el);
    await el.updateComplete;

    const messages = el.shadowRoot!.querySelectorAll('channel-message');
    expect((messages[0] as any).reactions.length).toBe(2);
    expect((messages[1] as any).reactions.length).toBe(1);
  });

  it('feed container has role="log" and aria-live="polite"', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [msg('1')];
    document.body.appendChild(el);
    await el.updateComplete;

    const feed = el.shadowRoot!.querySelector('.feed');
    expect(feed!.getAttribute('role')).toBe('log');
    expect(feed!.getAttribute('aria-live')).toBe('polite');
  });

  // --- renderContextHeader (extension point) ---

  it('renders context header when callback is provided', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [msg('1')];
    el.renderContextHeader = () => html`<div class="test-header">Case Context</div>`;
    document.body.appendChild(el);
    await el.updateComplete;

    const header = el.shadowRoot!.querySelector('.test-header');
    expect(header).toBeTruthy();
    expect(header!.textContent).toBe('Case Context');
  });

  it('does not render context header when callback is absent', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [msg('1')];
    document.body.appendChild(el);
    await el.updateComplete;

    const header = el.shadowRoot!.querySelector('.context-header');
    expect(header).toBeNull();
  });

  // --- terminalDimming (Gap #2) ---

  it('applies terminal-dimmed class to DONE/FAILURE/DECLINE/HANDOFF messages', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [
      msg('1', { messageType: 'DONE' }),
      msg('2', { messageType: 'QUERY' }),
    ];
    document.body.appendChild(el);
    await el.updateComplete;

    const items = el.shadowRoot!.querySelectorAll('.message-item');
    expect(items[0].classList.contains('terminal-dimmed')).toBe(true);
    expect(items[1].classList.contains('terminal-dimmed')).toBe(false);
  });

  it('does not apply terminal-dimmed when terminalDimming=false', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [msg('1', { messageType: 'DONE' })];
    el.terminalDimming = false;
    document.body.appendChild(el);
    await el.updateComplete;

    const item = el.shadowRoot!.querySelector('.message-item');
    expect(item!.classList.contains('terminal-dimmed')).toBe(false);
  });

  // --- eventStyling (Gap #2) ---

  it('applies event-dimmed class to EVENT messages', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [
      msg('1', { messageType: 'EVENT' }),
      msg('2', { messageType: 'COMMAND' }),
    ];
    document.body.appendChild(el);
    await el.updateComplete;

    const items = el.shadowRoot!.querySelectorAll('.message-item');
    expect(items[0].classList.contains('event-dimmed')).toBe(true);
    expect(items[1].classList.contains('event-dimmed')).toBe(false);
  });

  it('does not apply event-dimmed when eventStyling=false', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [msg('1', { messageType: 'EVENT' })];
    el.eventStyling = false;
    document.body.appendChild(el);
    await el.updateComplete;

    const item = el.shadowRoot!.querySelector('.message-item');
    expect(item!.classList.contains('event-dimmed')).toBe(false);
  });

  // --- staleCursorMinutes (Gap #5) ---

  it('shows stale prompt when channel cursor is older than threshold', async () => {
    const el = document.createElement('channel-feed') as any;
    el.channelId = 'ch-1';
    el.staleCursorMinutes = 1;
    el.messages = [];

    const staleTimestamp = Date.now() - 2 * 60 * 1000;
    sessionStorage.setItem('channel-activity.cursors', JSON.stringify({ 'ch-1': { id: 'cur-42', ts: staleTimestamp } }));

    document.body.appendChild(el);
    await el.updateComplete;

    const prompt = el.shadowRoot!.querySelector('.stale-prompt');
    expect(prompt).toBeTruthy();

    sessionStorage.removeItem('channel-activity.cursors');
  });

  it('emits channel:cursor-catchup when catch-up button clicked', async () => {
    const el = document.createElement('channel-feed') as any;
    el.channelId = 'ch-1';
    el.staleCursorMinutes = 1;
    el.messages = [];

    const staleTimestamp = Date.now() - 2 * 60 * 1000;
    sessionStorage.setItem('channel-activity.cursors', JSON.stringify({ 'ch-1': { id: 'cur-42', ts: staleTimestamp } }));

    document.body.appendChild(el);
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('pages-event', handler);

    const catchupBtn = el.shadowRoot!.querySelector('.stale-catchup') as HTMLButtonElement;
    catchupBtn.click();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]![0]!.detail.topic).toBe(ChannelEventTopics.CURSOR_CATCHUP);
    expect(handler.mock.calls[0]![0]!.detail.payload).toEqual({ channelId: 'ch-1', cursorId: 'cur-42' });

    sessionStorage.removeItem('channel-activity.cursors');
  });

  it('emits channel:cursor-reload when reload button clicked', async () => {
    const el = document.createElement('channel-feed') as any;
    el.channelId = 'ch-1';
    el.staleCursorMinutes = 1;
    el.messages = [];

    const staleTimestamp = Date.now() - 2 * 60 * 1000;
    sessionStorage.setItem('channel-activity.cursors', JSON.stringify({ 'ch-1': { id: 'cur-42', ts: staleTimestamp } }));

    document.body.appendChild(el);
    await el.updateComplete;

    const handler = vi.fn();
    el.addEventListener('pages-event', handler);

    const reloadBtn = el.shadowRoot!.querySelector('.stale-reload') as HTMLButtonElement;
    reloadBtn.click();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]![0]!.detail.topic).toBe(ChannelEventTopics.CURSOR_RELOAD);
    expect(handler.mock.calls[0]![0]!.detail.payload).toEqual({ channelId: 'ch-1' });

    sessionStorage.removeItem('channel-activity.cursors');
  });

  it('clears stale prompt when messages update', async () => {
    const el = document.createElement('channel-feed') as any;
    el.channelId = 'ch-1';
    el.staleCursorMinutes = 1;
    el.messages = [];

    const staleTimestamp = Date.now() - 2 * 60 * 1000;
    sessionStorage.setItem('channel-activity.cursors', JSON.stringify({ 'ch-1': { id: 'cur-42', ts: staleTimestamp } }));

    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.stale-prompt')).toBeTruthy();

    el.messages = [msg('1')];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.stale-prompt')).toBeNull();

    sessionStorage.removeItem('channel-activity.cursors');
  });

  it('does not show stale prompt when staleCursorMinutes=0', async () => {
    const el = document.createElement('channel-feed') as any;
    el.channelId = 'ch-1';
    el.staleCursorMinutes = 0;
    el.messages = [];

    const staleTimestamp = Date.now() - 60 * 60 * 1000;
    sessionStorage.setItem('channel-activity.cursors', JSON.stringify({ 'ch-1': { id: 'cur-42', ts: staleTimestamp } }));

    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('.stale-prompt')).toBeNull();

    sessionStorage.removeItem('channel-activity.cursors');
  });

  it('does not show stale prompt when cursor is fresh', async () => {
    const el = document.createElement('channel-feed') as any;
    el.channelId = 'ch-1';
    el.staleCursorMinutes = 30;
    el.messages = [];

    sessionStorage.setItem('channel-activity.cursors', JSON.stringify({ 'ch-1': { id: 'cur-42', ts: Date.now() } }));

    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('.stale-prompt')).toBeNull();

    sessionStorage.removeItem('channel-activity.cursors');
  });

  it('passes channelName to channel-message elements', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [msg('m1', { sender: 'alice' })];
    el.channelName = 'general';
    document.body.appendChild(el);
    await el.updateComplete;

    const msgEl = el.shadowRoot!.querySelector('channel-message') as any;
    expect(msgEl.channelName).toBe('general');
  });

  // --- renderContent passthrough ---

  it('passes renderContent to channel-message elements', async () => {
    const renderContent = vi.fn((m: QhorusMessage) => html`<span class="custom">${m.content}</span>`);
    const el = document.createElement('channel-feed') as any;
    el.messages = [msg('m1', { sender: 'alice' })];
    el.renderContent = renderContent;
    document.body.appendChild(el);
    await el.updateComplete;

    const msgEl = el.shadowRoot!.querySelector('channel-message') as any;
    expect(msgEl.renderContent).toBe(renderContent);
  });

  it('passes renderContent to channel-thread elements', async () => {
    const renderContent = vi.fn(() => undefined);
    const el = document.createElement('channel-feed') as any;
    el.messages = [
      msg('root', { sender: 'alice' }),
      msg('reply1', { sender: 'bob', inReplyTo: 'root' }),
    ];
    el.renderContent = renderContent;
    document.body.appendChild(el);
    await el.updateComplete;

    const thread = el.shadowRoot!.querySelector('channel-thread') as any;
    expect(thread.renderContent).toBe(renderContent);
  });

  // --- formatSender passthrough ---

  it('passes formatSender to channel-message elements', async () => {
    const formatSender = vi.fn((s: string) => s.toUpperCase());
    const el = document.createElement('channel-feed') as any;
    el.messages = [msg('m1', { sender: 'alice' })];
    el.formatSender = formatSender;
    document.body.appendChild(el);
    await el.updateComplete;

    const msgEl = el.shadowRoot!.querySelector('channel-message') as any;
    expect(msgEl.formatSender).toBe(formatSender);
  });

  // --- View modes ---

  it('defaults viewMode to flat', async () => {
    const el = document.createElement('channel-feed') as any;
    expect(el.viewMode).toBe('flat');
  });

  it('topics mode: renders topic section headers', async () => {
    const el = document.createElement('channel-feed') as any;
    el.viewMode = 'topics';
    el.topics = [
      topic('t1', 'General'),
      topic('t2', 'deployment'),
    ];
    el.messages = [
      msg('m1', { topicId: 't1', topic: 'General', createdAt: '2026-01-01T00:00:00Z' }),
      msg('m2', { topicId: 't2', topic: 'deployment', sender: 'bob', createdAt: '2026-01-01T00:01:00Z' }),
    ];
    document.body.appendChild(el);
    await el.updateComplete;

    const headers = el.shadowRoot!.querySelectorAll('.topic-section-header');
    expect(headers.length).toBe(2);
  });

  // --- selectedMessageId ---

  it('highlights the selected message with a selected class', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [msg('m1', { sender: 'alice' }), msg('m2', { sender: 'bob' })];
    el.selectedMessageId = 'm2';
    document.body.appendChild(el);
    await el.updateComplete;

    const items = el.shadowRoot!.querySelectorAll('.message-item');
    expect(items[0].classList.contains('selected')).toBe(false);
    expect(items[1].classList.contains('selected')).toBe(true);
  });

  it('highlights a thread root with selected class when selectedMessageId matches', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [
      msg('root', { sender: 'alice' }),
      msg('reply1', { sender: 'bob', inReplyTo: 'root' }),
    ];
    el.selectedMessageId = 'root';
    document.body.appendChild(el);
    await el.updateComplete;

    const thread = el.shadowRoot!.querySelector('channel-thread') as HTMLElement;
    expect(thread.classList.contains('selected')).toBe(true);
  });

  it('does not highlight thread when a different message is selected', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [
      msg('root', { sender: 'alice' }),
      msg('reply1', { sender: 'bob', inReplyTo: 'root' }),
      msg('other', { sender: 'carol' }),
    ];
    el.selectedMessageId = 'other';
    document.body.appendChild(el);
    await el.updateComplete;

    const thread = el.shadowRoot!.querySelector('channel-thread') as HTMLElement;
    expect(thread.classList.contains('selected')).toBe(false);
  });

  it('expands and highlights thread when selectedMessageId is a reply inside it', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [
      msg('root', { sender: 'mark', messageType: 'COMMAND' }),
      msg('reply1', { sender: 'agent-atlas', messageType: 'STATUS', inReplyTo: 'root' }),
      msg('reply2', { sender: 'agent-atlas', messageType: 'DONE', inReplyTo: 'root' }),
    ];
    document.body.appendChild(el);
    await el.updateComplete;

    const thread = el.shadowRoot!.querySelector('channel-thread') as any;
    expect(thread.collapsed).toBe(true);
    expect(thread.classList.contains('selected')).toBe(false);

    el.selectedMessageId = 'reply2';
    await el.updateComplete;
    await thread.updateComplete;

    expect(thread.collapsed).toBe(false);
    expect(thread.classList.contains('selected')).toBe(true);
    expect(thread.shadowRoot!.querySelectorAll('.reply channel-message').length).toBe(2);
  });

  it('adds data-message-id to message-item wrappers', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [msg('m1', { sender: 'alice' }), msg('m2', { sender: 'bob' })];
    document.body.appendChild(el);
    await el.updateComplete;

    const items = el.shadowRoot!.querySelectorAll('.message-item');
    expect(items[0].getAttribute('data-message-id')).toBe('m1');
    expect(items[1].getAttribute('data-message-id')).toBe('m2');
  });

  it('passes selectedMessageId to channel-thread components', async () => {
    const el = document.createElement('channel-feed') as any;
    el.messages = [
      msg('root', { sender: 'alice' }),
      msg('reply1', { sender: 'bob', inReplyTo: 'root' }),
    ];
    el.selectedMessageId = 'reply1';
    document.body.appendChild(el);
    await el.updateComplete;

    const thread = el.shadowRoot!.querySelector('channel-thread') as any;
    expect(thread.selectedMessageId).toBe('reply1');
  });

  it('topics mode: does not render empty topic sections', async () => {
    const el = document.createElement('channel-feed') as any;
    el.viewMode = 'topics';
    el.topics = [
      topic('t1', 'General'),
      topic('t2', 'empty-topic'),
    ];
    el.messages = [
      msg('m1', { topicId: 't1', topic: 'General' }),
    ];
    document.body.appendChild(el);
    await el.updateComplete;

    const headers = el.shadowRoot!.querySelectorAll('.topic-section-header');
    expect(headers.length).toBe(1);
  });
});
