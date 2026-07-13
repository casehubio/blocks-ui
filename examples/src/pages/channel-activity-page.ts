import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@casehubio/blocks-ui-channel-activity';
import type { QhorusMessage, QhorusChannel, ChannelMember, Reaction } from '@casehubio/blocks-ui-channel-activity';

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

@customElement('channel-activity-page')
export class ChannelActivityPage extends LitElement {
  @state() private _selectedChannelId = 'ch-1';

  static override styles = css`
    :host { display: block; padding: 24px; }
    h2 { margin: 0 0 8px; font-size: 18px; font-weight: 600; color: var(--pages-neutral-12, #111); }
    p { margin: 0 0 24px; font-size: 14px; color: var(--pages-neutral-10, #666); }
    .demo-container { display: grid; grid-template-columns: 200px 1fr 180px; gap: 16px; height: 480px; border: 1px solid var(--pages-neutral-5, #e0e0e0); border-radius: 8px; overflow: hidden; }
  `;

  override render() {
    const channelMessages = mockMessages(this._selectedChannelId);
    const channelMembers = MEMBERS.filter(m => m.channelId === this._selectedChannelId);

    return html`
      <h2>Channel Activity</h2>
      <p>Qhorus channel messaging — nav, feed, input, member panel. Promoted from connectors chat-demo.</p>
      <div class="demo-container">
        <channel-nav
          .channels=${CHANNELS}
          .selectedChannelId=${this._selectedChannelId}
          @channel-select=${(e: CustomEvent) => { this._selectedChannelId = e.detail.channelId; }}
        ></channel-nav>
        <div style="display:flex;flex-direction:column;overflow:hidden;">
          <channel-feed
            .messages=${channelMessages}
            .reactions=${REACTIONS}
            .currentUserId=${'user-1'}
          ></channel-feed>
          <channel-input
            .channelId=${this._selectedChannelId}
          ></channel-input>
        </div>
        <channel-member-panel
          .members=${channelMembers}
        ></channel-member-panel>
      </div>
    `;
  }
}
