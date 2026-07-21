import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@casehubio/blocks-ui-channel-activity';
import type { QhorusMessage, QhorusChannel, ChannelMember, Reaction, QhorusTopic } from '@casehubio/blocks-ui-channel-activity';

const CHANNELS: QhorusChannel[] = [
  { id: 'ch-1', name: 'case-review', description: 'Case review discussion', semantic: 'DISCUSSION', paused: false },
  { id: 'ch-2', name: 'ops-commands', description: 'Operational commands', semantic: 'COMMAND', paused: false },
  { id: 'ch-3', name: 'audit-log', description: 'Audit trail events', semantic: 'AUDIT', paused: false, deniedTypes: ['HUMAN'] },
];

const MEMBERS: ChannelMember[] = [
  { channelId: 'ch-1', memberId: 'user-1', displayName: 'Alice Chen', role: 'MODERATOR', actorType: 'HUMAN' },
  { channelId: 'ch-1', memberId: 'agent-1', displayName: 'CaseBot', role: 'PARTICIPANT', actorType: 'AGENT' },
  { channelId: 'ch-1', memberId: 'user-2', displayName: 'Bob Martinez', role: 'PARTICIPANT', actorType: 'HUMAN' },
  { channelId: 'ch-2', memberId: 'user-1', displayName: 'Alice Chen', role: 'PARTICIPANT', actorType: 'HUMAN' },
  { channelId: 'ch-2', memberId: 'system-1', displayName: 'Orchestrator', role: 'PARTICIPANT', actorType: 'SYSTEM' },
];

let nextId = 1;

function mockMessages(channelId: string): QhorusMessage[] {
  if (channelId === 'ch-1') {
    return [
      { id: `m${nextId++}`, channelId, sender: 'user-1', messageType: 'HUMAN', actorType: 'HUMAN', content: 'Can someone review case AML-4521?', topic: 'case-review', replyCount: 0, artefactRefs: [], createdAt: '2026-07-13T09:00:00Z' },
      { id: `m${nextId++}`, channelId, sender: 'agent-1', messageType: 'INFORM', actorType: 'AGENT', content: 'Case AML-4521: 3 transactions flagged, total $125,000. Risk score 0.87.', topic: 'case-review', replyCount: 0, artefactRefs: [], createdAt: '2026-07-13T09:00:05Z' },
      { id: `m${nextId++}`, channelId, sender: 'user-2', messageType: 'HUMAN', actorType: 'HUMAN', content: 'The third transaction looks like a false positive.', topic: 'case-review', replyCount: 0, artefactRefs: [], createdAt: '2026-07-13T09:01:00Z' },
    ];
  }
  if (channelId === 'ch-2') {
    return [
      { id: `m${nextId++}`, channelId, sender: 'system-1', messageType: 'COMMAND', actorType: 'SYSTEM', content: 'Escalate case AML-4521 to senior review.', topic: 'ops', replyCount: 0, artefactRefs: [], createdAt: '2026-07-13T08:55:00Z' },
      { id: `m${nextId++}`, channelId, sender: 'user-1', messageType: 'ACCEPT', actorType: 'HUMAN', content: 'Acknowledged. Routing to compliance team.', topic: 'ops', replyCount: 0, artefactRefs: [], createdAt: '2026-07-13T08:55:30Z' },
    ];
  }
  return [];
}

const REACTIONS: Reaction[] = [];

const MESSAGE_COUNTS: Record<string, number> = { 'ch-1': 14, 'ch-2': 3 };

const TOPICS: QhorusTopic[] = [
  { id: 'topic-1', channelId: 'ch-1', name: 'AML-4521 Review', state: 'ACTIVE', messageCount: 5, createdAt: '2026-07-13T08:50:00Z', latestActivityTs: '2026-07-13T09:01:00Z' },
  { id: 'topic-2', channelId: 'ch-1', name: 'Compliance Policy Update', state: 'ACTIVE', messageCount: 2, createdAt: '2026-07-13T08:00:00Z', latestActivityTs: '2026-07-13T08:30:00Z' },
  { id: 'topic-3', channelId: 'ch-1', name: 'Q2 Metrics', state: 'RESOLVED', messageCount: 8, createdAt: '2026-07-10T10:00:00Z' },
  { id: 'topic-4', channelId: 'ch-1', name: 'Old Discussion', state: 'ARCHIVED', messageCount: 3, createdAt: '2026-07-01T10:00:00Z' },
];

function topicMessages(): QhorusMessage[] {
  return [
    { id: 'tm1', channelId: 'ch-1', sender: 'user-1', messageType: 'HUMAN', actorType: 'HUMAN', content: 'Can someone review case AML-4521?', topic: 'case-review', topicId: 'topic-1', replyCount: 0, artefactRefs: [], createdAt: '2026-07-13T09:00:00Z' },
    { id: 'tm2', channelId: 'ch-1', sender: 'agent-1', messageType: 'INFORM', actorType: 'AGENT', content: 'Case AML-4521: 3 transactions flagged, total $125,000. Risk score 0.87.', topic: 'case-review', topicId: 'topic-1', replyCount: 0, artefactRefs: [], createdAt: '2026-07-13T09:00:05Z' },
    { id: 'tm3', channelId: 'ch-1', sender: 'user-2', messageType: 'HUMAN', actorType: 'HUMAN', content: 'The third transaction looks like a false positive.', topic: 'case-review', topicId: 'topic-1', replyCount: 0, artefactRefs: [], createdAt: '2026-07-13T09:01:00Z' },
    { id: 'tm4', channelId: 'ch-1', sender: 'user-1', messageType: 'HUMAN', actorType: 'HUMAN', content: 'I agree, flagging for manual override.', topic: 'case-review', topicId: 'topic-1', parentId: 'tm3', replyCount: 0, artefactRefs: [], createdAt: '2026-07-13T09:02:00Z' },
    { id: 'tm5', channelId: 'ch-1', sender: 'agent-1', messageType: 'INFORM', actorType: 'AGENT', content: 'Override applied. Transaction cleared.', topic: 'case-review', topicId: 'topic-1', replyCount: 0, artefactRefs: [], createdAt: '2026-07-13T09:03:00Z' },
    { id: 'tm6', channelId: 'ch-1', sender: 'user-2', messageType: 'HUMAN', actorType: 'HUMAN', content: 'New FATF guidance requires us to update our thresholds.', topic: 'compliance', topicId: 'topic-2', replyCount: 0, artefactRefs: [], createdAt: '2026-07-13T08:00:00Z' },
    { id: 'tm7', channelId: 'ch-1', sender: 'user-1', messageType: 'HUMAN', actorType: 'HUMAN', content: 'I have the draft — will share after the review.', topic: 'compliance', topicId: 'topic-2', replyCount: 0, artefactRefs: [], createdAt: '2026-07-13T08:30:00Z' },
  ];
}

function renderContent(message: QhorusMessage): TemplateResult | undefined {
  if (message.messageType === 'INFORM') {
    const parts = message.content.split('. ');
    return html`<div style="font-size:13px;">
      <strong style="color:var(--pages-accent-11,#3730a3);">${parts[0]}</strong>
      ${parts.slice(1).map(p => html`<div style="color:var(--pages-neutral-10,#666);margin-top:2px;">${p}</div>`)}
    </div>`;
  }
  return undefined;
}

function formatSender(sender: string, actorType: string): string {
  if (actorType === 'AGENT') return `🤖 ${sender}`;
  if (actorType === 'SYSTEM') return `⚙ ${sender}`;
  return sender;
}

@customElement('channel-activity-page')
export class ChannelActivityPage extends LitElement {
  @state() private _selectedChannelId = 'ch-1';
  @state() private _viewMode: 'flat' | 'threaded' | 'topics' = 'flat';
  @state() private _selectedTopicId: string | null = null;

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin: 0 0 8px; font-size: 18px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    h3 { margin: 24px 0 8px; font-size: 15px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin: 0 0 16px; font-size: 14px; color: var(--pages-neutral-10, #666); }
    .demo-container { display: grid; grid-template-columns: 200px 1fr 180px; gap: 16px; height: 480px; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 8px; overflow: hidden; }
    .claudony-container { display: grid; grid-template-columns: 180px 1fr; gap: 16px; height: 360px; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 8px; overflow: hidden; }
    .claudony-sidebar { display: flex; flex-direction: column; gap: 12px; padding: 12px; border-right: 1px solid var(--pages-neutral-5, #e0e0e0); }
  `;

  override render() {
    const channelMessages = mockMessages(this._selectedChannelId);
    const channelMembers = MEMBERS.filter(m => m.channelId === this._selectedChannelId);

    return html`
      <h2>Channel Activity</h2>
      <p>Qhorus channel messaging — nav, feed, input, member panel.</p>

      <h3>Standard (sidebar nav, message counts, renderContent, formatSender)</h3>
      <p>INFORM messages get structured rendering via renderContent. Sender names are prefixed by actor type via formatSender. Message counts shown as badges.</p>
      <div class="demo-container">
        <channel-nav
          .channels=${CHANNELS}
          .selectedChannelId=${this._selectedChannelId}
          .messageCounts=${MESSAGE_COUNTS}
          @channel-select=${(e: CustomEvent) => { this._selectedChannelId = e.detail.channelId; }}
        ></channel-nav>
        <div style="display:flex;flex-direction:column;overflow:hidden;">
          <channel-feed
            .messages=${channelMessages}
            .reactions=${REACTIONS}
            .renderContent=${renderContent}
            .formatSender=${formatSender}
          ></channel-feed>
          <channel-input
            .channelId=${this._selectedChannelId}
          ></channel-input>
        </div>
        <channel-member-panel
          .members=${channelMembers}
        ></channel-member-panel>
      </div>

      <h3>Claudony mode (dropdown nav, no create/delete, message counts)</h3>
      <p>Compact dropdown layout for narrow panels. Create/delete disabled — channel lifecycle managed externally.</p>
      <div class="claudony-container">
        <div class="claudony-sidebar">
          <channel-nav
            layout="dropdown"
            .channels=${CHANNELS}
            .selectedChannelId=${this._selectedChannelId}
            .messageCounts=${MESSAGE_COUNTS}
            .showCreate=${false}
            .showDelete=${false}
            @channel-select=${(e: CustomEvent) => { this._selectedChannelId = e.detail.channelId; }}
          ></channel-nav>
        </div>
        <div style="display:flex;flex-direction:column;overflow:hidden;">
          <channel-feed
            .messages=${channelMessages}
            .reactions=${REACTIONS}
            .renderContent=${renderContent}
            .formatSender=${formatSender}
          ></channel-feed>
          <channel-input
            .channelId=${this._selectedChannelId}
          ></channel-input>
        </div>
      </div>

      <h3>Topic bar (pills, view mode toggle, archived toggle)</h3>
      <p>Horizontal scrollable topic pills with message counts. View mode toggle (flat/threaded/topics). Show-archived toggle reveals archived topics.</p>
      <div style="border:1px solid var(--pages-neutral-5,#e0e0e0);border-radius:8px;overflow:hidden;">
        <channel-topic-bar
          .topics=${TOPICS}
          .selectedTopicId=${this._selectedTopicId}
          .viewMode=${this._viewMode}
          @pages-event=${(e: CustomEvent) => {
            if (e.detail?.topic === 'channel:select-topic') this._selectedTopicId = e.detail.payload?.topicId ?? null;
            if (e.detail?.topic === 'channel:view-mode') this._viewMode = e.detail.payload?.mode ?? 'flat';
          }}
        ></channel-topic-bar>
      </div>

      <h3>Feed view modes (flat → threaded → topics)</h3>
      <p>Same messages rendered three ways. Use the topic bar above to switch modes — the feed below responds. Topic view groups messages by topic with section headers and state badges.</p>
      <div class="demo-container" style="grid-template-columns:1fr;">
        <div style="display:flex;flex-direction:column;overflow:hidden;">
          <channel-topic-bar
            .topics=${TOPICS}
            .selectedTopicId=${this._selectedTopicId}
            .viewMode=${this._viewMode}
            @pages-event=${(e: CustomEvent) => {
              if (e.detail?.topic === 'channel:select-topic') this._selectedTopicId = e.detail.payload?.topicId ?? null;
              if (e.detail?.topic === 'channel:view-mode') this._viewMode = e.detail.payload?.mode ?? 'flat';
            }}
          ></channel-topic-bar>
          <channel-feed
            .messages=${topicMessages()}
            .topics=${TOPICS}
            .reactions=${REACTIONS}
            .viewMode=${this._viewMode}
            .renderContent=${renderContent}
            .formatSender=${formatSender}
          ></channel-feed>
          <channel-input
            .channelId=${'ch-1'}
            .showTopicSelector=${true}
            .topics=${TOPICS}
            .topicId=${this._selectedTopicId ?? ''}
          ></channel-input>
        </div>
      </div>
    `;
  }
}
