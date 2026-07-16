import { describe, it, expect, afterEach, vi } from 'vitest';
import { html } from 'lit';
import './channel-thread.js';
import './channel-message.js';
import type { QhorusMessage } from './types.js';

function msg(id: string, type: string, content: string): QhorusMessage {
  return {
    id, channelId: 'ch-1', sender: 'agent-a', messageType: type as any,
    actorType: 'AGENT', content, topic: 'General', replyCount: 0, artefactRefs: [],
    createdAt: '2026-07-07T12:00:00Z',
  };
}

afterEach(() => { document.body.innerHTML = ''; });

describe('channel-thread', () => {
  it('renders root message and reply count when collapsed', async () => {
    const el = document.createElement('channel-thread') as any;
    el.rootMessage = msg('1', 'COMMAND', 'Analyze auth');
    el.replies = [msg('2', 'STATUS', 'Reading files'), msg('3', 'DONE', 'Complete')];
    el.collapsed = true;
    document.body.appendChild(el);
    await el.updateComplete;

    const shadow = el.shadowRoot!;
    expect(shadow.querySelector('channel-message')).toBeTruthy();
    expect(shadow.textContent).toContain('2 replies');
    expect(shadow.querySelectorAll('.reply channel-message').length).toBe(0);
  });

  it('renders all replies when expanded', async () => {
    const el = document.createElement('channel-thread') as any;
    el.rootMessage = msg('1', 'COMMAND', 'Analyze auth');
    el.replies = [msg('2', 'STATUS', 'Reading'), msg('3', 'DONE', 'Done')];
    el.collapsed = false;
    document.body.appendChild(el);
    await el.updateComplete;

    const messages = el.shadowRoot!.querySelectorAll('channel-message');
    expect(messages.length).toBe(3);
  });

  it('toggles collapse on header click', async () => {
    const el = document.createElement('channel-thread') as any;
    el.rootMessage = msg('1', 'COMMAND', 'Task');
    el.replies = [msg('2', 'DONE', 'Done')];
    el.collapsed = true;
    document.body.appendChild(el);
    await el.updateComplete;

    el.shadowRoot!.querySelector('.thread-toggle')!.click();
    await el.updateComplete;

    expect(el.collapsed).toBe(false);
    expect(el.shadowRoot!.querySelectorAll('channel-message').length).toBe(2);
  });

  it('shows commitment state on header', async () => {
    const el = document.createElement('channel-thread') as any;
    el.rootMessage = msg('1', 'COMMAND', 'Task');
    el.replies = [msg('2', 'STATUS', 'Working')];
    el.commitmentState = 'FULFILLED';
    el.collapsed = true;
    document.body.appendChild(el);
    await el.updateComplete;

    const badge = el.shadowRoot!.querySelector('.thread-commitment');
    expect(badge).toBeTruthy();
    expect(badge!.textContent).toContain('FULFILLED');
  });

  it('renders nothing when rootMessage is not set', async () => {
    const el = document.createElement('channel-thread') as any;
    document.body.appendChild(el);
    await el.updateComplete;

    const message = el.shadowRoot!.querySelector('channel-message');
    expect(message).toBeNull();
  });

  it('shows "1 reply" for singular reply count', async () => {
    const el = document.createElement('channel-thread') as any;
    el.rootMessage = msg('1', 'COMMAND', 'Task');
    el.replies = [msg('2', 'DONE', 'Done')];
    el.collapsed = true;
    document.body.appendChild(el);
    await el.updateComplete;

    const toggle = el.shadowRoot!.querySelector('.thread-toggle');
    expect(toggle!.textContent).toContain('1 reply');
  });

  it('aria-expanded is false when collapsed', async () => {
    const el = document.createElement('channel-thread') as any;
    el.rootMessage = msg('1', 'COMMAND', 'Task');
    el.replies = [msg('2', 'DONE', 'Done')];
    el.collapsed = true;
    document.body.appendChild(el);
    await el.updateComplete;

    const toggle = el.shadowRoot!.querySelector('.thread-toggle');
    expect(toggle!.getAttribute('aria-expanded')).toBe('false');
  });

  it('applies commitment-success CSS class for FULFILLED state', async () => {
    const el = document.createElement('channel-thread') as any;
    el.rootMessage = msg('1', 'COMMAND', 'Task');
    el.replies = [msg('2', 'DONE', 'Done')];
    el.commitmentState = 'FULFILLED';
    el.collapsed = true;
    document.body.appendChild(el);
    await el.updateComplete;

    const badge = el.shadowRoot!.querySelector('.thread-commitment');
    expect(badge!.classList.contains('commitment-success')).toBe(true);
  });

  // --- renderContent passthrough ---

  it('passes renderContent to root channel-message', async () => {
    const renderContent = vi.fn(() => html`<span class="custom">custom</span>`);
    const el = document.createElement('channel-thread') as any;
    el.rootMessage = msg('1', 'COMMAND', 'Task');
    el.replies = [];
    el.renderContent = renderContent;
    document.body.appendChild(el);
    await el.updateComplete;

    const msgEl = el.shadowRoot!.querySelector('channel-message') as any;
    expect(msgEl.renderContent).toBe(renderContent);
  });

  it('passes renderContent to reply channel-messages', async () => {
    const renderContent = vi.fn(() => undefined);
    const el = document.createElement('channel-thread') as any;
    el.rootMessage = msg('1', 'COMMAND', 'Task');
    el.replies = [msg('2', 'DONE', 'Done')];
    el.renderContent = renderContent;
    el.collapsed = false;
    document.body.appendChild(el);
    await el.updateComplete;

    const messages = el.shadowRoot!.querySelectorAll('channel-message');
    expect((messages[1] as any).renderContent).toBe(renderContent);
  });

  // --- formatSender passthrough ---

  it('passes formatSender to channel-message elements', async () => {
    const formatSender = vi.fn((s: string) => s.toUpperCase());
    const el = document.createElement('channel-thread') as any;
    el.rootMessage = msg('1', 'COMMAND', 'Task');
    el.replies = [msg('2', 'DONE', 'Done')];
    el.formatSender = formatSender;
    el.collapsed = false;
    document.body.appendChild(el);
    await el.updateComplete;

    const messages = el.shadowRoot!.querySelectorAll('channel-message');
    expect((messages[0] as any).formatSender).toBe(formatSender);
    expect((messages[1] as any).formatSender).toBe(formatSender);
  });
});
