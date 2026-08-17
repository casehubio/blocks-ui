import { describe, it, expect } from 'vitest';
import { ChannelStateController } from './channel-state-controller.js';
import { PushController } from './push-controller.js';
import type { DatasetOp } from './push-controller.js';
import { ChannelEventTopics } from './events.js';

class MockHost {
  controllers: any[] = [];
  updateCount = 0;
  addController(c: any) { this.controllers.push(c); }
  removeController() {}
  requestUpdate() { this.updateCount++; }
  get updateComplete() { return Promise.resolve(true); }
}

function createPair() {
  const host = new MockHost();
  const push = new PushController(host as any);
  const ctrl = new ChannelStateController(host as any, push);
  return { host, push, ctrl };
}

function channelRow(id: string, name: string, opts?: {
  description?: string; spaceId?: string; spaceName?: string; parentSpaceId?: string;
}): unknown[] {
  return [
    id, name, '', opts?.description ?? '', 'false',
    opts?.spaceId ?? '', opts?.spaceName ?? '', opts?.parentSpaceId ?? '',
  ];
}

function messageRow(channelId: string, messageId: string, opts?: {
  parentId?: string; sender?: string; text?: string; timestamp?: string;
  messageType?: string; actorType?: string; topicId?: string;
  correlationId?: string; artefactRefs?: string; target?: string;
}): unknown[] {
  return [
    channelId, messageId, opts?.parentId ?? '', opts?.sender ?? 'alice',
    opts?.text ?? 'hello', opts?.timestamp ?? '2026-01-01T00:00:00Z',
    opts?.messageType ?? 'EVENT', opts?.actorType ?? 'HUMAN',
    opts?.topicId ?? '', opts?.correlationId ?? '',
    opts?.artefactRefs ?? '[]', opts?.target ?? '',
  ];
}

function topicRow(topicId: string, channelId: string, name: string, opts?: {
  state?: string; messageCount?: string; latestActivityTs?: string; createdAt?: string;
}): unknown[] {
  return [
    topicId, channelId, name, opts?.state ?? 'ACTIVE',
    opts?.messageCount ?? '0', opts?.latestActivityTs ?? '',
    opts?.createdAt ?? '2026-01-01T00:00:00Z',
  ];
}

describe('ChannelStateController', () => {
  describe('channel ops', () => {
    it('applies channel snapshot and maps to QhorusChannel', () => {
      const { push, ctrl } = createPair();
      push.applyOp({
        op: 'snapshot', dataset: 'channels',
        rows: [channelRow('ch-1', 'general', { description: 'Main channel' })],
      });
      expect(ctrl.channels).toHaveLength(1);
      expect(ctrl.channels[0]!.id).toBe('ch-1');
      expect(ctrl.channels[0]!.name).toBe('general');
      expect(ctrl.channels[0]!.description).toBe('Main channel');
      expect(ctrl.channels[0]!.semantic).toBe('APPEND');
      expect(ctrl.channels[0]!.paused).toBe(false);
    });

    it('maps space fields from channel row', () => {
      const { push, ctrl } = createPair();
      push.applyOp({
        op: 'snapshot', dataset: 'channels',
        rows: [channelRow('ch-1', 'work', {
          spaceId: 'sp-1', spaceName: 'Project Alpha', parentSpaceId: 'sp-root',
        })],
      });
      expect(ctrl.channels[0]!.spaceId).toBe('sp-1');
      expect(ctrl.channels[0]!.spaceName).toBe('Project Alpha');
      expect(ctrl.channels[0]!.parentSpaceId).toBe('sp-root');
    });

    it('treats empty space fields as undefined', () => {
      const { push, ctrl } = createPair();
      push.applyOp({
        op: 'snapshot', dataset: 'channels',
        rows: [channelRow('ch-1', 'general')],
      });
      expect(ctrl.channels[0]!.spaceId).toBeUndefined();
      expect(ctrl.channels[0]!.spaceName).toBeUndefined();
      expect(ctrl.channels[0]!.parentSpaceId).toBeUndefined();
    });

    it('appends channels', () => {
      const { push, ctrl } = createPair();
      push.applyOp({ op: 'snapshot', dataset: 'channels', rows: [channelRow('ch-1', 'general')] });
      push.applyOp({ op: 'append', dataset: 'channels', rows: [channelRow('ch-2', 'random')] });
      expect(ctrl.channels).toHaveLength(2);
      expect(ctrl.channels[1]!.name).toBe('random');
    });

    it('removes channels by key', () => {
      const { push, ctrl } = createPair();
      push.applyOp({
        op: 'snapshot', dataset: 'channels',
        rows: [channelRow('ch-1', 'general'), channelRow('ch-2', 'random')],
      });
      push.applyOp({ op: 'remove', dataset: 'channels', key: 'ch-1' });
      expect(ctrl.channels).toHaveLength(1);
      expect(ctrl.channels[0]!.id).toBe('ch-2');
    });
  });

  describe('channelTree', () => {
    it('groups channels by space', () => {
      const { push, ctrl } = createPair();
      push.applyOp({
        op: 'snapshot', dataset: 'channels',
        rows: [
          channelRow('ch-1', 'general'),
          channelRow('ch-2', 'work', { spaceId: 'sp-1', spaceName: 'Alpha' }),
          channelRow('ch-3', 'observe', { spaceId: 'sp-1', spaceName: 'Alpha' }),
        ],
      });
      const tree = ctrl.channelTree;
      expect(tree.ungrouped).toHaveLength(1);
      expect(tree.ungrouped[0]!.name).toBe('general');
      expect(tree.spaces).toHaveLength(1);
      expect(tree.spaces[0]!.space.name).toBe('Alpha');
      expect(tree.spaces[0]!.channels).toHaveLength(2);
    });

    it('handles multiple spaces', () => {
      const { push, ctrl } = createPair();
      push.applyOp({
        op: 'snapshot', dataset: 'channels',
        rows: [
          channelRow('ch-1', 'a', { spaceId: 'sp-1', spaceName: 'Alpha' }),
          channelRow('ch-2', 'b', { spaceId: 'sp-2', spaceName: 'Beta' }),
        ],
      });
      const tree = ctrl.channelTree;
      expect(tree.spaces).toHaveLength(2);
      expect(tree.ungrouped).toHaveLength(0);
    });

    it('nests child spaces under parent spaces', () => {
      const { push, ctrl } = createPair();
      push.applyOp({
        op: 'snapshot', dataset: 'channels',
        rows: [
          channelRow('ch-1', 'parent-ch', { spaceId: 'sp-parent', spaceName: 'Parent' }),
          channelRow('ch-2', 'child-ch', {
            spaceId: 'sp-child', spaceName: 'Child', parentSpaceId: 'sp-parent',
          }),
        ],
      });
      const tree = ctrl.channelTree;
      expect(tree.spaces).toHaveLength(1);
      expect(tree.spaces[0]!.space.name).toBe('Parent');
      expect(tree.spaces[0]!.children).toHaveLength(1);
      expect(tree.spaces[0]!.children[0]!.space.name).toBe('Child');
      expect(tree.spaces[0]!.children[0]!.channels).toHaveLength(1);
    });

    it('treats child spaces with unknown parent as roots', () => {
      const { push, ctrl } = createPair();
      push.applyOp({
        op: 'snapshot', dataset: 'channels',
        rows: [
          channelRow('ch-1', 'orphan', {
            spaceId: 'sp-1', spaceName: 'Orphan', parentSpaceId: 'sp-missing',
          }),
        ],
      });
      const tree = ctrl.channelTree;
      expect(tree.spaces).toHaveLength(1);
      expect(tree.spaces[0]!.space.name).toBe('Orphan');
    });

    it('returns empty tree for no channels', () => {
      const { ctrl } = createPair();
      const tree = ctrl.channelTree;
      expect(tree.spaces).toHaveLength(0);
      expect(tree.ungrouped).toHaveLength(0);
    });
  });

  describe('channel selection', () => {
    it('selects channel via handleEvent', () => {
      const { push, ctrl } = createPair();
      push.applyOp({ op: 'snapshot', dataset: 'channels', rows: [channelRow('ch-1', 'general')] });
      ctrl.handleEvent(ChannelEventTopics.SELECT_CHANNEL, { channelId: 'ch-1' });
      expect(ctrl.selectedChannelId).toBe('ch-1');
    });

    it('clears topic selection when channel changes', () => {
      const { push, ctrl } = createPair();
      push.applyOp({ op: 'snapshot', dataset: 'channels', rows: [channelRow('ch-1', 'a'), channelRow('ch-2', 'b')] });
      push.applyOp({ op: 'snapshot', dataset: 'topics', rows: [topicRow('t-1', 'ch-1', 'design')] });
      ctrl.handleEvent(ChannelEventTopics.SELECT_CHANNEL, { channelId: 'ch-1' });
      ctrl.handleEvent(ChannelEventTopics.SELECT_TOPIC, { channelId: 'ch-1', topicId: 't-1' });
      ctrl.handleEvent(ChannelEventTopics.SELECT_CHANNEL, { channelId: 'ch-2' });
      expect(ctrl.selectedTopicId).toBeNull();
    });
  });

  describe('view mode', () => {
    it('starts in flat mode', () => {
      const { ctrl } = createPair();
      expect(ctrl.viewMode).toBe('flat');
    });

    it('changes view mode via handleEvent', () => {
      const { ctrl } = createPair();
      ctrl.handleEvent(ChannelEventTopics.VIEW_MODE, { mode: 'threaded' });
      expect(ctrl.viewMode).toBe('threaded');
      ctrl.handleEvent(ChannelEventTopics.VIEW_MODE, { mode: 'topics' });
      expect(ctrl.viewMode).toBe('topics');
    });
  });

  describe('message ops', () => {
    it('applies message snapshot', () => {
      const { push, ctrl } = createPair();
      push.applyOp({
        op: 'snapshot', dataset: 'messages',
        rows: [messageRow('ch-1', 'msg-1', { text: 'hello world' })],
      });
      expect(ctrl.messages).toHaveLength(1);
      expect(ctrl.messages[0]!.id).toBe('msg-1');
      expect(ctrl.messages[0]!.channelId).toBe('ch-1');
      expect(ctrl.messages[0]!.content).toBe('hello world');
      expect(ctrl.messages[0]!.sender).toBe('alice');
      expect(ctrl.messages[0]!.messageType).toBe('EVENT');
      expect(ctrl.messages[0]!.actorType).toBe('HUMAN');
    });

    it('appends messages', () => {
      const { push, ctrl } = createPair();
      push.applyOp({ op: 'snapshot', dataset: 'messages', rows: [messageRow('ch-1', 'msg-1')] });
      push.applyOp({ op: 'append', dataset: 'messages', rows: [messageRow('ch-1', 'msg-2')] });
      expect(ctrl.messages).toHaveLength(2);
    });

    it('removes messages by key', () => {
      const { push, ctrl } = createPair();
      push.applyOp({
        op: 'snapshot', dataset: 'messages',
        rows: [messageRow('ch-1', 'msg-1'), messageRow('ch-1', 'msg-2')],
      });
      push.applyOp({ op: 'remove', dataset: 'messages', key: 'msg-1' });
      expect(ctrl.messages).toHaveLength(1);
      expect(ctrl.messages[0]!.id).toBe('msg-2');
    });

    it('parses artefactRefs from JSON string', () => {
      const refs = JSON.stringify([{ uri: '/doc', type: 'DOCUMENT', label: 'spec' }]);
      const { push, ctrl } = createPair();
      push.applyOp({
        op: 'snapshot', dataset: 'messages',
        rows: [messageRow('ch-1', 'msg-1', { artefactRefs: refs })],
      });
      expect(ctrl.messages[0]!.artefactRefs).toHaveLength(1);
      expect(ctrl.messages[0]!.artefactRefs[0]!.uri).toBe('/doc');
    });

    it('handles malformed artefactRefs gracefully', () => {
      const { push, ctrl } = createPair();
      push.applyOp({
        op: 'snapshot', dataset: 'messages',
        rows: [messageRow('ch-1', 'msg-1', { artefactRefs: 'not-json' })],
      });
      expect(ctrl.messages[0]!.artefactRefs).toEqual([]);
    });

    it('recomputes reply counts after message changes', () => {
      const { push, ctrl } = createPair();
      push.applyOp({
        op: 'snapshot', dataset: 'messages',
        rows: [
          messageRow('ch-1', 'msg-1'),
          messageRow('ch-1', 'msg-2', { parentId: 'msg-1' }),
          messageRow('ch-1', 'msg-3', { parentId: 'msg-1' }),
        ],
      });
      const parent = ctrl.messages.find(m => m.id === 'msg-1')!;
      expect(parent.replyCount).toBe(2);
    });

    it('resolves topic name from topics array', () => {
      const { push, ctrl } = createPair();
      push.applyOp({ op: 'snapshot', dataset: 'topics', rows: [topicRow('t-1', 'ch-1', 'design')] });
      push.applyOp({
        op: 'snapshot', dataset: 'messages',
        rows: [messageRow('ch-1', 'msg-1', { topicId: 't-1' })],
      });
      expect(ctrl.messages[0]!.topic).toBe('design');
      expect(ctrl.messages[0]!.topicId).toBe('t-1');
    });
  });

  describe('filteredMessages', () => {
    it('returns empty when no channel selected', () => {
      const { push, ctrl } = createPair();
      push.applyOp({ op: 'snapshot', dataset: 'messages', rows: [messageRow('ch-1', 'msg-1')] });
      expect(ctrl.filteredMessages()).toEqual([]);
    });

    it('returns messages for selected channel only', () => {
      const { push, ctrl } = createPair();
      push.applyOp({
        op: 'snapshot', dataset: 'messages',
        rows: [messageRow('ch-1', 'msg-1'), messageRow('ch-2', 'msg-2')],
      });
      ctrl.handleEvent(ChannelEventTopics.SELECT_CHANNEL, { channelId: 'ch-1' });
      const filtered = ctrl.filteredMessages();
      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.channelId).toBe('ch-1');
    });

    it('filters by topic when topic is selected', () => {
      const { push, ctrl } = createPair();
      push.applyOp({
        op: 'snapshot', dataset: 'topics',
        rows: [topicRow('t-1', 'ch-1', 'design'), topicRow('t-2', 'ch-1', 'bugs')],
      });
      push.applyOp({
        op: 'snapshot', dataset: 'messages',
        rows: [
          messageRow('ch-1', 'msg-1', { topicId: 't-1' }),
          messageRow('ch-1', 'msg-2', { topicId: 't-2' }),
          messageRow('ch-1', 'msg-3'),
        ],
      });
      ctrl.handleEvent(ChannelEventTopics.SELECT_CHANNEL, { channelId: 'ch-1' });
      ctrl.handleEvent(ChannelEventTopics.SELECT_TOPIC, { channelId: 'ch-1', topicId: 't-1' });
      const filtered = ctrl.filteredMessages();
      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.topicId).toBe('t-1');
    });
  });

  describe('topic ops', () => {
    it('applies topic snapshot', () => {
      const { push, ctrl } = createPair();
      push.applyOp({
        op: 'snapshot', dataset: 'topics',
        rows: [topicRow('t-1', 'ch-1', 'design')],
      });
      expect(ctrl.topics).toHaveLength(1);
      expect(ctrl.topics[0]!.name).toBe('design');
      expect(ctrl.topics[0]!.state).toBe('ACTIVE');
    });

    it('replaces topic by key', () => {
      const { push, ctrl } = createPair();
      push.applyOp({ op: 'snapshot', dataset: 'topics', rows: [topicRow('t-1', 'ch-1', 'design')] });
      push.applyOp({
        op: 'replace', dataset: 'topics',
        row: ['t-1', 'ch-1', 'design-v2', 'RESOLVED', '5', '', '2026-01-01T00:00:00Z'],
        key: 't-1',
      });
      expect(ctrl.topics).toHaveLength(1);
      expect(ctrl.topics[0]!.name).toBe('design-v2');
      expect(ctrl.topics[0]!.state).toBe('RESOLVED');
    });

    it('removes topic by key', () => {
      const { push, ctrl } = createPair();
      push.applyOp({
        op: 'snapshot', dataset: 'topics',
        rows: [topicRow('t-1', 'ch-1', 'a'), topicRow('t-2', 'ch-1', 'b')],
      });
      push.applyOp({ op: 'remove', dataset: 'topics', key: 't-1' });
      expect(ctrl.topics).toHaveLength(1);
      expect(ctrl.topics[0]!.id).toBe('t-2');
    });
  });

  describe('channelTopics', () => {
    it('returns non-MERGED topics for selected channel', () => {
      const { push, ctrl } = createPair();
      push.applyOp({
        op: 'snapshot', dataset: 'topics',
        rows: [
          topicRow('t-1', 'ch-1', 'active'),
          topicRow('t-2', 'ch-1', 'merged', { state: 'MERGED' }),
          topicRow('t-3', 'ch-2', 'other'),
        ],
      });
      ctrl.handleEvent(ChannelEventTopics.SELECT_CHANNEL, { channelId: 'ch-1' });
      const topics = ctrl.channelTopics();
      expect(topics).toHaveLength(1);
      expect(topics[0]!.name).toBe('active');
    });

    it('returns empty when no channel selected', () => {
      const { push, ctrl } = createPair();
      push.applyOp({ op: 'snapshot', dataset: 'topics', rows: [topicRow('t-1', 'ch-1', 'a')] });
      expect(ctrl.channelTopics()).toEqual([]);
    });
  });

  describe('host updates', () => {
    it('triggers host update on channel snapshot', () => {
      const { host, push } = createPair();
      const before = host.updateCount;
      push.applyOp({ op: 'snapshot', dataset: 'channels', rows: [channelRow('ch-1', 'general')] });
      expect(host.updateCount).toBeGreaterThan(before);
    });

    it('triggers host update on message append', () => {
      const { host, push } = createPair();
      const before = host.updateCount;
      push.applyOp({ op: 'append', dataset: 'messages', rows: [messageRow('ch-1', 'msg-1')] });
      expect(host.updateCount).toBeGreaterThan(before);
    });

    it('triggers host update on handleEvent', () => {
      const { host, ctrl } = createPair();
      const before = host.updateCount;
      ctrl.handleEvent(ChannelEventTopics.SELECT_CHANNEL, { channelId: 'ch-1' });
      expect(host.updateCount).toBeGreaterThan(before);
    });
  });
});
