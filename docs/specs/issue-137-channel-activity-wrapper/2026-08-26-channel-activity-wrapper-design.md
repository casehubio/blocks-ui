# Channel Activity Convenience Wrapper

**Date:** 2026-08-26
**Issue:** casehubio/blocks-ui#137
**Status:** Approved

## Summary

Add a `<blocks-channel-activity>` custom element that composes the 12
channel-activity sub-components into a default chat-style arrangement.
Follows the workbench wrapper pattern established by trust-workbench,
session-workbench, orchestration-workbench, and conversation-workbench.

Consumers who need custom composition continue using the primitives
directly. The wrapper removes the "figure out which 12 pieces to wire
together" step for the common case.

## Architecture

### Layout

```
┌────────────────────────────────────────────────────────┐
│ [header: sidebar toggle]                               │
├─────────────┬──────────────────────┬───────────────────┤
│             │  topic-bar           │  ┌─────────────┐  │
│  channel-   │  ──────────────────  │  │[Members][T] │  │
│  nav        │  channel-feed        │  │[Tasks]  [A] │  │
│             │  (messages)          │  │[Links]      │  │
│             │                      │  │             │  │
│             │                      │  │  (active    │  │
│             │  ──────────────────  │  │   tab       │  │
│             │  channel-input       │  │   content)  │  │
│             │                      │  └─────────────┘  │
└─────────────┴──────────────────────┴───────────────────┘
```

`blocks-split-workbench` provides the outer shell:

- **List slot:** `blocks-channel-nav`
- **Detail slot:** A vertical column containing `blocks-channel-topic-bar`,
  `blocks-channel-feed`, and `blocks-channel-input`, plus a collapsible
  tabbed sidebar on the right for optional panels

### Tabbed Sidebar

The sidebar contains four tabs:

| Tab | Component | Data source (controller mode) | Data source (inline mode) |
|-----|-----------|-------------------------------|---------------------------|
| Members | `blocks-channel-member-panel` | `MembershipController` state | `members`, `presence` props |
| Tasks | `blocks-channel-task-panel` | `CommitmentController` state + current messages | `commitments`, `messages` props |
| Artifacts | `blocks-channel-artifact-panel` | `channel:artefact-selected` event | `resolveArtifact` callback |
| Links | `blocks-channel-correlation-panel` | `CommitmentController` state + current messages | `commitments`, `messages` props |

- **Hidden by default.** A toggle button in the header slot shows/hides
  the sidebar.
- **Lazy creation.** Tab content elements are created via
  `document.createElement()` on first tab activation and cached in a Map
  (same pattern as `detail-pane`).
- **Data wiring on activation.** When a tab is activated, the wrapper
  sets the panel element's properties from controller state (or inline
  props). Controller-driven state updates trigger `requestUpdate()` on
  the wrapper, which updates the active panel's properties in `render()`.
- **Sidebar open/close** persisted to `localStorage` via
  `channel-activity-sidebar-${selectionTopic}`.

### Component Tree

```
blocks-channel-activity
└─ blocks-split-workbench (selection-topic from property)
   ├─ slot="header" → toggle button for sidebar
   ├─ slot="list" → blocks-channel-nav
   └─ slot="detail" → div.detail-area
      ├─ div.main-column
      │  ├─ blocks-channel-topic-bar
      │  ├─ blocks-channel-feed
      │  └─ blocks-channel-input
      └─ div.sidebar (hidden by default)
         ├─ tab-bar (Members | Tasks | Artifacts | Links)
         └─ tab-content (active panel element)
```

## Data Delivery

### Controller Model (D1 — revised after review)

The wrapper accepts a `PushController` (transport-agnostic) and creates
domain controllers internally, binding itself as the `ReactiveControllerHost`.
This is necessary because Lit ReactiveControllers call
`host.requestUpdate()` on their constructor host — passing pre-created
controllers from another host would prevent the wrapper from re-rendering.

**Host provides:**

| Property | Type | Purpose |
|----------|------|---------|
| `pushController` | `PushController` | Transport-agnostic push dispatch — host wires SSE, WebSocket, or test stubs |
| `messagingConfig` | `MessagingConfig \| undefined` | Config for MessagingController (REST endpoints, etc.) |
| `reactionConfig` | `ReactionConfig \| undefined` | Config for ReactionController |

**Wrapper creates internally (in `connectedCallback` when `pushController` is set):**

| Controller | Binds to | Purpose |
|------------|----------|---------|
| `ChannelStateController(this, pushController)` | wrapper | Channel/space state, unread tracking |
| `MessagingController(this, channelState, messagingConfig)` | wrapper | Message send/receive |
| `MembershipController(this, pushController)` | wrapper | Member state, presence |
| `ReactionController(this, pushController, reactionConfig)` | wrapper | Reaction state |
| `CommitmentController(this, pushController)` | wrapper | Commitment tracking |

When `pushController` changes (or is initially set in `updated()`),
controllers are torn down and recreated. When `pushController` is
`undefined`, no controllers exist — the wrapper falls back to inline
data mode.

### Event Routing

The wrapper is the natural home for routing pages-events to controller
methods. All controllers have `handleEvent(topic, payload)` methods
with zero call sites elsewhere in the project — the wrapper completes
this wiring.

In `connectedCallback` (when controllers exist):

```typescript
this._unsubs.push(
  // Channel state
  onPagesEvent(document, 'channel:selected', p => this._channels.handleEvent('channel:selected', p)),
  onPagesEvent(document, 'channel:create', p => this._channels.handleEvent('channel:create', p)),
  onPagesEvent(document, 'channel:delete', p => this._channels.handleEvent('channel:delete', p)),
  onPagesEvent(document, 'channel:view-mode', p => this._channels.handleEvent('channel:view-mode', p)),
  onPagesEvent(document, 'channel:select-topic', p => this._channels.handleEvent('channel:select-topic', p)),

  // Messaging
  onPagesEvent(document, 'channel:send-message', p => this._messaging.handleEvent('channel:send-message', p)),
  onPagesEvent(document, 'channel:cursor-catchup', p => this._messaging.handleEvent('channel:cursor-catchup', p)),
  onPagesEvent(document, 'channel:cursor-reload', p => this._messaging.handleEvent('channel:cursor-reload', p)),

  // Reactions
  onPagesEvent(document, 'channel:react', p => this._reactions.handleEvent('channel:react', p)),
  onPagesEvent(document, 'channel:unreact', p => this._reactions.handleEvent('channel:unreact', p)),

  // Commitments
  onPagesEvent(document, 'channel:message-selected', p => this._commitments.handleEvent('channel:message-selected', p)),

  // Membership
  onPagesEvent(document, 'channel:member-action', p => this._membership.handleEvent('channel:member-action', p)),
);
```

**Internal coordination events** (sibling component sync, not bubbled):

| Event | Wrapper action |
|-------|----------------|
| `channel:selected` | Update feed/input `channelId`, topic-bar `selectedTopicId`, clear `replyTo` |
| `channel:select-topic` | Update feed `selectedTopicId`, topic-bar `selectedTopicId` |
| `channel:view-mode` | Update feed and topic-bar `viewMode` |
| `channel:message-selected` | Update feed `selectedMessageId`, task/correlation panel `selectedMessageId` |
| `channel:artefact-selected` | Update artifact-panel `selectedArtefactRef` |
| `channel:cursor-catchup/reload` | Announce via LiveRegionMixin |

### Inline Data Mode

For demos, tests, and simple integrations, data can be passed directly
as properties without controllers:

| Property | Type | Default | Target |
|----------|------|---------|--------|
| `channels` | `QhorusChannel[]` | `[]` | channel-nav |
| `messages` | `QhorusMessage[]` | `[]` | channel-feed |
| `members` | `ChannelMember[]` | `[]` | channel-member-panel |
| `presence` | `PresenceState[]` | `[]` | channel-member-panel |
| `reactions` | `Reaction[]` | `[]` | channel-feed |
| `commitments` | `Map<string, CommitmentRecord>` | `new Map()` | channel-task-panel, channel-correlation-panel |
| `channelTree` | `ChannelTree \| undefined` | `undefined` | channel-nav (overrides `channels` for space grouping) |
| `topics` | `QhorusTopic[]` | `[]` | channel-feed, channel-input, channel-topic-bar |

When inline data properties are set AND `pushController` is undefined,
the wrapper passes them through directly. Unread counts in inline mode
travel with the `QhorusChannel` objects (`channel.unreadCount`).

### Three Consumption Tiers

**Tier 1 — Standalone:**
```html
<blocks-channel-activity
  .pushController=${myPush}
  .messagingConfig=${myConfig}
  selection-topic="channel">
</blocks-channel-activity>
```

**Tier 2 — Panel-hosted:**
```typescript
class MyPanel implements PanelLifecycle {
  async init(host: HostPanel) {
    const el = document.createElement('blocks-channel-activity');
    el.configure({
      pushController: this.push,
      messagingConfig: this.config,
    });
    host.content.appendChild(el);
  }
}
```

**Tier 3 — Inline (demos/tests):**
```html
<blocks-channel-activity
  .channels=${demoChannels}
  .messages=${demoMessages}
  .members=${demoMembers}>
</blocks-channel-activity>
```

## Properties

### Own Properties

| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| `selectionTopic` | `string` | `'channel'` | Event topic prefix for split-workbench and channel coordination |
| `sidebarOpen` | `boolean` | `false` | Sidebar visibility state |
| `channelNavLayout` | `'sidebar' \| 'dropdown'` | `'sidebar'` | Channel nav layout mode |
| `currentActorId` | `string \| undefined` | `undefined` | Current user's actor ID — passed to feed for reaction highlighting |

### Pass-Through: channel-nav

| Property | Type | Default | Notes |
|----------|------|---------|-------|
| `showCreate` | `boolean` | `true` | |
| `showDelete` | `boolean` | `true` | Matches channel-nav default |

### Pass-Through: channel-feed

| Property | Type | Default |
|----------|------|---------|
| `autoScroll` | `boolean` | `true` |
| `staleCursorMinutes` | `number` | `30` |
| `terminalDimming` | `boolean` | `true` |
| `eventStyling` | `boolean` | `true` |
| `viewMode` | `'flat' \| 'threaded' \| 'topics'` | `'flat'` |
| `selectedMessageId` | `string \| undefined` | `undefined` |
| `messageHighlights` | `Record<string, string>` | `undefined` |
| `renderContextHeader` | `() => TemplateResult \| undefined` | `undefined` |
| `renderContent` | `(msg: QhorusMessage) => TemplateResult \| undefined` | `undefined` |
| `formatSender` | `(sender: string, actorType: ActorType) => string` | `undefined` |

`formatSender` is set on channel-feed directly (feed passes it to
messages internally). The wrapper does not reach through to
channel-message.

### Pass-Through: channel-input

| Property | Type | Default |
|----------|------|---------|
| `showTypeSelector` | `boolean` | `false` |
| `showTopicSelector` | `boolean` | `false` |
| `messageTypes` | `MessageType[]` | All 9 types |
| `allowedTypes` | `MessageType[] \| undefined` | `undefined` |
| `deniedTypes` | `MessageType[] \| undefined` | `undefined` |
| `renderError` | `(error: string) => TemplateResult` | `undefined` |

### Pass-Through: channel-topic-bar

| Property | Type | Source (controller mode) |
|----------|------|-------------------------|
| `topics` | `QhorusTopic[]` | `ChannelStateController.topics` |
| `selectedTopicId` | `string \| undefined` | Internal state, updated by `channel:select-topic` |
| `viewMode` | `'flat' \| 'threaded' \| 'topics'` | Internal state, updated by `channel:view-mode` |

### Pass-Through: sidebar panels

| Panel | Properties wired from controller / inline |
|-------|------------------------------------------|
| `channel-member-panel` | `members`, `presence` |
| `channel-task-panel` | `messages` (current channel), `commitments`, `selectedMessageId` |
| `channel-correlation-panel` | `messages` (current channel), `commitments`, `selectedMessageId` |
| `channel-artifact-panel` | `selectedArtefactRef` (from event), `resolveArtifact` callback |

The `resolveArtifact` callback is a pass-through property on the wrapper:
```typescript
@property({ attribute: false }) resolveArtifact?: (ref: ArtefactRef) => Promise<ResolvedArtifact>;
```

### `configure()` Method

```typescript
configure(props: {
  pushController?: PushController;
  messagingConfig?: MessagingConfig;
  reactionConfig?: ReactionConfig;
  selectionTopic?: string;
  channelNavLayout?: 'sidebar' | 'dropdown';
  currentActorId?: string;
  formatSender?: (sender: string, actorType: ActorType) => string;
  renderContextHeader?: () => TemplateResult | undefined;
  resolveArtifact?: (ref: ArtefactRef) => Promise<ResolvedArtifact>;
}): void {
  Object.assign(this, props);
  this.requestUpdate();
}
```

## Event Coordination

### Channel selection (primary coordination)

On `channel:selected`:
1. Update `channel-feed.channelId` and `channel-feed.channelName`
2. Update `channel-input.channelId`
3. Update `channel-input.replyTo = undefined` (clear reply context)
4. Update `channel-topic-bar.selectedTopicId = undefined` (reset topic)
5. Route to `ChannelStateController.handleEvent()` (unread tracking)
6. Announce via `LiveRegionMixin`: `"Switched to ${channelName}"`

### Topic and view mode coordination

On `channel:select-topic`:
- Update `channel-feed.selectedTopicId`, `channel-topic-bar.selectedTopicId`

On `channel:view-mode`:
- Update `channel-feed.viewMode`, `channel-topic-bar.viewMode`

### Message selection coordination

On `channel:message-selected`:
- Update `channel-feed.selectedMessageId`
- Update active task/correlation panel `selectedMessageId`
- Route to `CommitmentController.handleEvent()`

### Artifact selection

On `channel:artefact-selected`:
- Update `channel-artifact-panel.selectedArtefactRef`

## Keyboard Shortcuts

Via `KeyboardShortcutMixin`:

| Key | Action |
|-----|--------|
| `?` | Show/hide keyboard shortcut overlay |
| `Escape` | Close sidebar if open; otherwise deselect channel |
| `m` | Toggle sidebar (members tab) |

Wrapper-level shortcuts fire on `keydown` at the wrapper element.
Feed-level shortcuts (arrow keys for message navigation within
`FocusTrapMixin`) fire when focus is inside the feed. No conflict —
different scopes.

## ARIA

| Element | Attribute |
|---------|-----------|
| Host | `role="region"`, `aria-label="Channel activity"` |
| Sidebar toggle | `aria-expanded`, `aria-controls` |
| Sidebar tabs | `role="tablist"` / `role="tab"` / `role="tabpanel"` |
| Sidebar tab buttons | `aria-selected` |

`LiveRegionMixin` announces:
- Channel selection changes
- Sidebar open/close
- Tab switches within sidebar
- Cursor catchup/reload actions

## CSS

The wrapper uses `--pages-*` custom properties from `pages-ui-tokens`.

Key layout styles:
- `.detail-area`: `display: flex; height: 100%`
- `.main-column`: `flex: 1; display: flex; flex-direction: column; min-width: 0`
- `.sidebar`: `width: 280px; border-left: 1px solid var(--pages-border-color)`
- `.sidebar[hidden]`: collapsed via `display: none`

## Testing

### Unit Tests

- Renders all sub-components when pushController is provided
- Controllers created internally and bound to wrapper as host
- Controller teardown and recreation on pushController change
- Inline data mode: channels/messages/members passed through to children
- Channel selection updates feed, input, and topic-bar
- Event routing: `channel:send-message` reaches MessagingController
- Event routing: `channel:react` reaches ReactionController
- Sidebar toggle shows/hides sidebar, updates `aria-expanded`
- Tab switching creates and caches panel elements lazily
- Sidebar panel data wiring: task-panel receives messages + commitments
- `configure()` sets properties and triggers update
- Keyboard shortcuts: `m` toggles sidebar, `Escape` closes sidebar
- Topic/view-mode coordination between feed and topic-bar

### ARIA Tests

- Host has `role="region"` and `aria-label`
- Sidebar tabs have correct `role="tablist"` / `role="tab"` / `role="tabpanel"`
- `aria-selected` tracks active tab
- `aria-expanded` on sidebar toggle reflects state

## Package

The wrapper lives in the existing `components/channel-activity/` package
as a new file `blocks-channel-activity.ts`. It is NOT a separate package —
it composes sub-components from its own package. Export added to `index.ts`.

```
components/channel-activity/src/
├── blocks-channel-activity.ts       ← NEW: convenience wrapper
├── blocks-channel-activity.test.ts  ← NEW: tests
├── channel-feed.ts
├── channel-nav.ts
├── channel-input.ts
├── ... (existing sub-components)
└── index.ts                         ← updated: export wrapper
```

## References

- docs/specs/2026-07-13-channel-activity-promotion-design.md — channel-activity architecture, sub-component data interfaces, event contract
- docs/specs/2026-07-08-generic-workbench-design.md — split-workbench/list-pane/detail-pane composition pattern
- docs/protocols/blocks-ui/component-customisation-pattern.md (PP-20260713-8ea1af) — slots for layout only, content via typed properties + callbacks
- components/trust-workbench/src/trust-workbench.ts — dual data mode pattern
- components/session-workbench/src/session-workbench.ts — configure() pattern
- components/orchestration-workbench/src/orchestration-workbench.ts — selectionTopic as property, controller creation pattern
- components/conversation-viewer/src/blocks-conversation-workbench.ts — double mixin (LiveRegion + KeyboardShortcut) pattern
- components/channel-activity/src/channel-state-controller.ts — ReactiveController binding model
- components/channel-activity/src/events.ts — 18 event topics requiring routing
- casehubio/blocks-ui#137 — issue
