import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { PushController, DatasetOp } from './push-controller.js';
import type { QhorusChannel, QhorusMessage, QhorusTopic, ArtefactRef, MessageType, ActorType, TopicState } from './types.js';
import { ChannelEventTopics } from './events.js';
import type { SelectChannelPayload, SelectTopicPayload, ViewModePayload } from './events.js';

export interface Space {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly parentSpaceId?: string;
}

export interface SpaceNode {
  readonly space: Space;
  readonly channels: QhorusChannel[];
  readonly unreadCount: number;
  readonly children: SpaceNode[];
}

export interface ChannelTree {
  readonly spaces: SpaceNode[];
  readonly ungrouped: QhorusChannel[];
}

export class ChannelStateController implements ReactiveController {
  channels: QhorusChannel[] = [];
  topics: QhorusTopic[] = [];
  messages: QhorusMessage[] = [];
  selectedChannelId = '';
  selectedTopicId: string | null = null;
  viewMode: 'flat' | 'threaded' | 'topics' = 'flat';

  private _host: ReactiveControllerHost;

  constructor(host: ReactiveControllerHost, push: PushController) {
    this._host = host;
    host.addController(this);
    push.registerDatasetHandler('channels', (op) => { this._applyChannels(op); this._host.requestUpdate(); });
    push.registerDatasetHandler('topics', (op) => { this._applyTopics(op); this._host.requestUpdate(); });
    push.registerDatasetHandler('messages', (op) => { this._applyMessages(op); this._host.requestUpdate(); });
  }

  get channelTree(): ChannelTree {
    const spaceMap = new Map<string, { space: Space; channels: QhorusChannel[]; children: SpaceNode[] }>();
    const ungrouped: QhorusChannel[] = [];

    for (const ch of this.channels) {
      if (ch.spaceId && ch.spaceName) {
        let node = spaceMap.get(ch.spaceId);
        if (!node) {
          const space: Space = { id: ch.spaceId, name: ch.spaceName };
          if (ch.parentSpaceId) (space as { parentSpaceId: string }).parentSpaceId = ch.parentSpaceId;
          node = { space, channels: [], children: [] };
          spaceMap.set(ch.spaceId, node);
        }
        node.channels.push(ch);
      } else {
        ungrouped.push(ch);
      }
    }

    const roots: SpaceNode[] = [];
    for (const node of spaceMap.values()) {
      const parentId = node.space.parentSpaceId;
      if (parentId) {
        const parent = spaceMap.get(parentId);
        if (parent) {
          parent.children.push({ ...node, unreadCount: 0 });
          continue;
        }
      }
      roots.push({ ...node, unreadCount: 0 });
    }

    return { spaces: roots, ungrouped };
  }

  filteredMessages(): QhorusMessage[] {
    if (!this.selectedChannelId) return [];
    let msgs = this.messages.filter(m => m.channelId === this.selectedChannelId);
    if (this.selectedTopicId) {
      msgs = msgs.filter(m => m.topicId === this.selectedTopicId);
    }
    return msgs;
  }

  channelTopics(): QhorusTopic[] {
    if (!this.selectedChannelId) return [];
    return this.topics.filter(t => t.channelId === this.selectedChannelId && t.state !== 'MERGED');
  }

  handleEvent(topic: string, payload: unknown) {
    switch (topic) {
      case ChannelEventTopics.SELECT_CHANNEL: {
        this.selectedChannelId = (payload as SelectChannelPayload).channelId;
        this.selectedTopicId = null;
        this._host.requestUpdate();
        break;
      }
      case ChannelEventTopics.VIEW_MODE: {
        this.viewMode = (payload as ViewModePayload).mode;
        this._host.requestUpdate();
        break;
      }
      case ChannelEventTopics.SELECT_TOPIC: {
        this.selectedTopicId = (payload as SelectTopicPayload).topicId;
        this._host.requestUpdate();
        break;
      }
    }
  }

  private _applyChannels(op: DatasetOp) {
    if (op.op === 'snapshot') {
      this.channels = (op.rows ?? []).map(r => this._toChannel(r));
    } else if (op.op === 'append' && op.rows) {
      this.channels = [...this.channels, ...op.rows.map(r => this._toChannel(r))];
    } else if (op.op === 'remove' && op.key) {
      this.channels = this.channels.filter(c => c.id !== op.key);
    }
  }

  private _toChannel(row: unknown[]): QhorusChannel {
    const ch: QhorusChannel = { id: row[0] as string, name: row[1] as string, semantic: 'APPEND', paused: false };
    const desc = row[3] as string;
    const spaceId = row[5] as string;
    const spaceName = row[6] as string;
    const parentSpaceId = row[7] as string;
    if (desc) (ch as { description: string }).description = desc;
    if (spaceId) (ch as { spaceId: string }).spaceId = spaceId;
    if (spaceName) (ch as { spaceName: string }).spaceName = spaceName;
    if (parentSpaceId) (ch as { parentSpaceId: string }).parentSpaceId = parentSpaceId;
    return ch;
  }

  private _applyTopics(op: DatasetOp) {
    if (op.op === 'snapshot') {
      this.topics = (op.rows ?? []).map(r => this._toTopic(r));
    } else if (op.op === 'append' && op.rows) {
      this.topics = [...this.topics, ...op.rows.map(r => this._toTopic(r))];
    } else if (op.op === 'replace' && op.row && op.key) {
      this.topics = this.topics.map(t => t.id === op.key ? this._toTopic(op.row!) : t);
    } else if (op.op === 'remove' && op.key) {
      this.topics = this.topics.filter(t => t.id !== op.key);
    }
  }

  private _toTopic(row: unknown[]): QhorusTopic {
    const t: QhorusTopic = {
      id: row[0] as string, channelId: row[1] as string, name: row[2] as string,
      state: row[3] as TopicState, messageCount: Number(row[4]) || 0, createdAt: row[6] as string,
    };
    const latest = row[5] as string;
    if (latest) (t as { latestActivityTs: string }).latestActivityTs = latest;
    return t;
  }

  private _resolveTopicName(topicId: string | null | undefined): string {
    if (!topicId) return '';
    const topic = this.topics.find(t => t.id === topicId);
    return topic?.name ?? '';
  }

  private _applyMessages(op: DatasetOp) {
    if (op.op === 'snapshot') {
      this.messages = (op.rows ?? []).map(r => this._toMessage(r));
    } else if (op.op === 'append' && op.rows) {
      this.messages = [...this.messages, ...op.rows.map(r => this._toMessage(r))];
    } else if (op.op === 'remove' && op.key) {
      this.messages = this.messages.filter(m => m.id !== op.key);
    }
    this._recomputeReplyCounts();
  }

  private _recomputeReplyCounts() {
    const counts = new Map<string, number>();
    for (const m of this.messages) {
      if (m.inReplyTo) {
        counts.set(m.inReplyTo, (counts.get(m.inReplyTo) ?? 0) + 1);
      }
    }
    this.messages = this.messages.map(m => ({
      ...m,
      replyCount: counts.get(m.id) ?? 0,
    }));
  }

  private _toMessage(row: unknown[]): QhorusMessage {
    let artefactRefs: readonly ArtefactRef[] = [];
    try {
      const refsStr = row[10] as string;
      if (refsStr && refsStr !== '[]') artefactRefs = JSON.parse(refsStr);
    } catch { /* ignore parse errors */ }
    const msg: QhorusMessage = {
      id: row[1] as string, channelId: row[0] as string, sender: row[3] as string,
      messageType: (row[6] as string as MessageType) || 'EVENT',
      actorType: (row[7] as string as ActorType) || 'HUMAN',
      content: row[4] as string, topicId: (row[8] as string) || '',
      topic: this._resolveTopicName(row[8] as string),
      replyCount: 0, artefactRefs, createdAt: row[5] as string,
    };
    const corr = row[9] as string;
    const parent = row[2] as string;
    const target = row[11] as string;
    if (corr) (msg as { correlationId: string }).correlationId = corr;
    if (parent) (msg as { inReplyTo: string }).inReplyTo = parent;
    if (target) (msg as { target: string }).target = target;
    return msg;
  }

  hostConnected() {}
  hostDisconnected() {}
}
