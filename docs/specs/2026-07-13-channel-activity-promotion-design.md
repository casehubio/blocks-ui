# Channel Activity — Promote Connectors Chat Primitives to blocks-ui

**Date:** 2026-07-13
**Issue:** casehubio/blocks-ui#39 (parent: #35)
**Status:** Approved

## Summary

Promote the qhorus chat primitives from `connectors/chat-demo` into
`blocks-ui/components/channel-activity` as shared platform components.
Claudony consumes them with domain-specific customisation via typed config
properties and render callbacks (per protocol PP-20260713-8ea1af). Claudony's
hand-rolled channel-panel is retired — its transport code is superseded by
pages' `EventStreamController`, and its UI features are a subset of what
connectors already built.

## Scope

This spec covers **component promotion** — moving the connectors chat
primitives into blocks-ui as shared platform components. It does not close
epic #39 in its entirety. Remaining epic requirements are tracked separately:

| Requirement | Status | Tracking |
|-------------|--------|----------|
| Dual-mode delivery (SSE + polling fallback) | Out of scope | Superseded by pages' `EventStreamController` (real-time push) and `DataSourceMixin` (REST fetch) — the host selects the appropriate data pipeline and passes data to components via Lit properties |
| Stale cursor detection | Included | §Gaps Closed #5 (timestamp-based, superseded by casehub-pages#174 when it lands) |
| Message type filtering | Included | §Gaps Closed #1 |
| Human message posting | Included | Existing in connectors primitives |
| Configurable endpoints | Out of scope | Host responsibility — components receive data via Lit properties; the host configures its own data pipeline endpoints |
| Worker panel (`<worker-panel>`) | Out of scope | Separate spec needed — tracked in epic #39 |

## Background

Three implementations of channel/message feed UI exist across the platform:

1. **blocks-ui `channel-activity`** — stub (two lines, no implementation)
2. **claudony `channel-panel`** — fully built but predates the pages data
   pipeline and the rich qhorus chat model. Hand-rolled SSE + poll, manual
   cursor management, flat message list, no threading or reactions.
3. **connectors `chat-demo`** — full Lit-based chat UI with the qhorus
   speech-act model: threaded replies, reactions, emoji, member panel,
   presence, artefact references, commitment tracking, markdown rendering,
   keyboard accessibility, responsive layout.

Epic #39 recommends claudony's `channel-panel` as the promotion base ("most
feature-complete"). This spec reverses that recommendation: connectors'
primitives have the richer data model (threading, reactions, artefact
references, commitment tracking, Lit architecture) and already use the pages
event system. Claudony's advantages (stale cursor detection, dual-mode
delivery) are operational features that can be layered onto the promoted
components — the data model and component architecture are harder to retrofit.
**Prerequisite:** Update epic #39 to reflect this decision before
implementation begins — the epic currently recommends claudony as the
promotion base, which contradicts this spec.

Connectors' primitives are the most complete and already use the pages event
system (`pages-event` CustomEvents). The design decision is to promote these
as the shared components, not port claudony's older implementation.

## Architecture

### What Moves to blocks-ui

The `chat-demo` **primitives and composites** — the reusable UI building blocks:

| Connectors source | blocks-ui target | Tag name |
|-------------------|-----------------|----------|
| `primitives/qhorus-message.ts` | `channel-message.ts` | `<channel-message>` |
| `primitives/qhorus-message-input.ts` | `channel-input.ts` | `<channel-input>` |
| `primitives/qhorus-emoji-picker.ts` | `channel-emoji-picker.ts` | `<channel-emoji-picker>` |
| `primitives/qhorus-reaction-bar.ts` | `channel-reaction-bar.ts` | `<channel-reaction-bar>` |
| `primitives/qhorus-thread.ts` | `channel-thread.ts` | `<channel-thread>` |
| `composites/qhorus-channel-feed.ts` | `channel-feed.ts` | `<channel-feed>` |
| `composites/qhorus-channel-nav.ts` | `channel-nav.ts` | `<channel-nav>` |
| `composites/qhorus-member-panel.ts` | `channel-member-panel.ts` | `<channel-member-panel>` |
| `types.ts` | `types.ts` | — |
| `events.ts` | `events.ts` | — |
| `markdown.ts` | `markdown.ts` | — |

### What Moves to a Standalone Chat App Module

All UI code leaves connectors. The chat workbench and its adapter become a
separate deployable module — no longer embedded inside connectors' Maven build.

| Connectors source | Destination | Notes |
|-------------------|-------------|-------|
| `qhorus-workbench` | Chat app module | App shell — consumes blocks-ui primitives |
| `ChatDemoAdapter` | Chat app module | WebSocket data materialisation |
| `SwipeController` | Chat app module | Phone gesture handling |
| `chat-demo-identity` | Chat app module | Identity widget |
| `chat-demo` webui build (package.json, vite, etc.) | Chat app module | Entire frontend build |

The chat app module's final home (standalone repo, connectors submodule, or
claudony) is deferred (tracked: casehubio/blocks-ui#TBD — file before
implementation begins). During implementation, it lives as a standalone
directory at `connectors/chat-app/` — a sibling to `chat-demo/` that is not
part of the Maven build (no `pom.xml`). It has its own `package.json`,
`vite.config.ts`, and build scripts. This is the temporary buildable location
until a permanent home is decided. It depends on
`@casehubio/blocks-ui-channel-activity` and connectors' backend.

### What Stays in Connectors

Connectors' Maven build becomes pure Java — no webui directory in the
Maven project, no npm build step. The `chat-app/` directory is a temporary
frontend resident outside the Maven build (see §What Moves to a Standalone
Chat App Module):

- Backend (ChatResource, SqliteChatBackend, ChatWebSocket)
- Platform connectors (Slack, Discord, IRC)
- Chat SPI (`chat-spi` module)
- REST + WebSocket endpoints

This keeps connectors clean for consumption by work, engine, and other apps
that need the chat backend without inheriting a UI build.

### Package Structure

```
blocks-ui/components/channel-activity/
├── package.json              @casehubio/blocks-ui-channel-activity
│                             dependencies: @casehubio/blocks-ui-core, lit,
│                             marked, dompurify, emoji-picker-element
├── src/
│   ├── types.ts              QhorusMessage, QhorusChannel, MessageType, etc.
│   ├── events.ts             ChatEventTopics, payload interfaces (uses emitPagesEvent from blocks-ui-core)
│   ├── markdown.ts           renderMarkdown() — marked + DOMPurify wrapper
│   ├── channel-message.ts    Single message renderer
│   ├── channel-input.ts      Message input with optional type selector
│   ├── channel-feed.ts       Grouped message feed with threading
│   ├── channel-nav.ts        Channel list with keyboard navigation
│   ├── channel-thread.ts     Inline thread renderer
│   ├── channel-emoji-picker.ts  Emoji picker
│   ├── channel-reaction-bar.ts  Reaction display
│   ├── channel-member-panel.ts  Member list with presence
│   └── index.ts              Re-exports all components, types, events
├── tsconfig.json
└── tsconfig.build.json
```

### Naming Convention

Components rename from `qhorus-*` to `channel-*` — they are platform-shared,
not qhorus-demo-specific. The data types retain the `Qhorus` prefix
(`QhorusMessage`, `QhorusChannel`) since they represent the qhorus domain model.

## Component Data Interface

Components receive data via Lit reactive properties. The host is responsible
for data acquisition (via `EventStreamController`, `DataSourceMixin`, or
direct fetch) and passes results to components as properties.

| Component | Property | Type | Default | Purpose |
|-----------|----------|------|---------|---------|
| `channel-feed` | `messages` | `QhorusMessage[]` | `[]` | Message list to render |
| `channel-feed` | `reactions` | `Reaction[]` | `[]` | Reactions across all messages |
| `channel-feed` | `commitments` | `Map<string, CommitmentState>` | `new Map()` | Commitment tracking state per message |
| `channel-feed` | `channelId` | `string` | `''` | Channel identifier — used for sessionStorage cursor keying and `CursorActionPayload` events |
| `channel-feed` | `channelName` | `string \| undefined` | `undefined` | Display name for channel header |
| `channel-nav` | `channels` | `QhorusChannel[]` | `[]` | Channel list to render |
| `channel-nav` | `selectedChannelId` | `string \| undefined` | `undefined` | Currently selected channel |
| `channel-member-panel` | `members` | `ChannelMember[]` | `[]` | Member list to render |
| `channel-member-panel` | `presence` | `PresenceState[]` | `[]` | Online/offline state per member |
| `channel-message` | `message` | `QhorusMessage` | — (required) | Single message to render |
| `channel-message` | `reactions` | `Reaction[]` | `[]` | Reactions on this message |
| `channel-message` | `commitmentState` | `CommitmentState \| undefined` | `undefined` | Commitment tracking state |
| `channel-message` | `parentMessage` | `QhorusMessage \| undefined` | `undefined` | Parent message (for reply context) |
| `channel-message` | `channelName` | `string \| undefined` | `undefined` | Channel name for cross-channel context |
| `channel-input` | `channelId` | `string` | `''` | Target channel for message submission |
| `channel-input` | `replyTo` | `{ messageId: string; senderName: string } \| undefined` | `undefined` | Reply context (shows reply indicator) |
| `channel-thread` | `rootMessage` | `QhorusMessage` | — (required) | Thread root message |
| `channel-thread` | `replies` | `QhorusMessage[]` | `[]` | Thread replies |
| `channel-thread` | `collapsed` | `boolean` | `true` | Thread expansion state |
| `channel-thread` | `commitmentState` | `CommitmentState \| undefined` | `undefined` | Root message commitment state |
| `channel-reaction-bar` | `reactions` | `Reaction[]` | `[]` | Reactions to display |
| `channel-reaction-bar` | `messageId` | `string` | `''` | Message these reactions belong to (included in outbound event payloads) |
| `channel-reaction-bar` | `currentActorId` | `string \| undefined` | `undefined` | Current user's actor ID — highlights their own reactions |
| `channel-emoji-picker` | `skinToneEmoji` | `string \| undefined` | `undefined` | Preferred skin tone for emoji rendering |

All types (`QhorusMessage`, `QhorusChannel`, `Reaction`, `CommitmentState`,
`ChannelMember`, `PresenceState`) are exported from the package's `types.ts`.

## Extension Points

Per protocol PP-20260713-8ea1af: typed config properties + optional render
callbacks with defaults. No slots for content customisation.

### Typed Config Properties

| Property | Component | Type | Default | Purpose |
|----------|-----------|------|---------|---------|
| `messageTypes` | `channel-input` | `MessageType[]` | All 9 types | Speech acts available in the type selector |
| `allowedTypes` | `channel-input` | `MessageType[] \| undefined` | `undefined` (all) | Per-channel type whitelist — intersected with `messageTypes` |
| `deniedTypes` | `channel-input` | `MessageType[] \| undefined` | `undefined` (none) | Per-channel type blacklist — subtracted after `allowedTypes` intersection (see §Gaps Closed #1 filtering algorithm) |
| `showTypeSelector` | `channel-input` | `boolean` | `false` | Show/hide the speech act type dropdown |
| `showSpeechAct` | `channel-message` | `boolean` | `true` | Existing — show/hide speech-act badge |
| `showActorBadge` | `channel-message` | `boolean` | `true` | Existing — show/hide actor type icon. Currently CSS-hidden in connectors via `display: none` as a visual simplification for the demo app, not because the rendering is broken — the `_actorIcon()` method works correctly, rendering 👤/🤖/⚙ emojis by actor type. Fix during migration by removing the CSS override. Defaulting to `true` is intentional: in a shared platform component where messages from different actor types (human, agent, system) mix, actor attribution provides essential context. |
| `terminalDimming` | `channel-feed` | `boolean` | `true` | Dim DONE/FAILURE/DECLINE/HANDOFF messages |
| `eventStyling` | `channel-feed` | `boolean` | `true` | Italic + dim EVENT messages |
| `autoScroll` | `channel-feed` | `boolean` | `true` | Scroll to bottom on new messages |
| `staleCursorMinutes` | `channel-feed` | `number` | `30` | Minutes before a cursor is considered stale (0 disables stale detection) |

### Render Callbacks

| Callback | Component | Signature | Default | Purpose |
|----------|-----------|-----------|---------|---------|
| `renderContextHeader` | `channel-feed` | `() => TemplateResult \| undefined` | `undefined` (no header) | Domain context above the feed (claudony: case header + worker lineage). Consumer owns the full data lifecycle — fetching, polling, collapsible state. The callback is re-invoked on each Lit render cycle; the consumer triggers re-render by updating any reactive property on the host component (standard Lit pattern — same as `renderEntryPayload` on `audit-trail-viewer`). |
| `formatSender` | `channel-message` | `(sender: string, actorType: ActorType) => string` | Identity function | Domain-specific sender display (claudony: strip `claudony-worker-` prefix) |
| `renderError` | `channel-input` | `(error: string) => TemplateResult` | Inline error span | Custom error display |

### Factory Method Overrides

None — data delivery is handled by pages' `EventStreamController` and
`DataSourceMixin`, which have their own override points. Channel components
receive data via Lit properties, not direct fetch.

### Outbound Event Contract

Components emit `pages-event` CustomEvents via `emitPagesEvent` from
blocks-ui-core in response to user actions. The host listens for these
events and handles the side effects (API calls, state updates, property
updates back to the component).

Event topics rename from `chat:*` to `channel:*` to match the component
naming convention. Unused topics (`SELECT_TOPIC`, `RESOLVE_TOPIC` — never
emitted in the connectors source) are dropped during migration.

| Topic | Emitted by | Payload | Purpose |
|-------|-----------|---------|---------|
| `channel:send-message` | `channel-input` | `SendMessagePayload { channelId: string, content: string, topic?: string, inReplyTo?: string, speechAct?: MessageType, artefactRefs?: readonly ArtefactRef[] }` | User submitted a message |
| `channel:react` | `channel-reaction-bar` | `ReactPayload { messageId: string, emoji: string }` | User added a reaction |
| `channel:unreact` | `channel-reaction-bar` | `ReactPayload { messageId: string, emoji: string }` | User removed a reaction |
| `channel:selected` | `channel-nav` | `SelectChannelPayload { channelId: string }` | User selected a channel |
| `channel:create` | `channel-nav` | `CreateChannelPayload { name: string, description?: string, spaceId?: string, semantic?: string }` | User created a channel |
| `channel:delete` | `channel-nav` | `DeleteChannelPayload { channelId: string }` | User deleted a channel |
| `channel:message-selected` | `channel-message` | `MessageSelectedPayload { message: QhorusMessage }` | User clicked a message (for threading, detail view) |
| `channel:cursor-catchup` | `channel-feed` | `CursorActionPayload { channelId: string, cursorId: string }` | User chose "Catch up" on stale cursor prompt — host should fetch from cursor forward |
| `channel:cursor-reload` | `channel-feed` | `CursorActionPayload { channelId: string }` | User chose "Reload" on stale cursor prompt — host should load full history |

All payload interfaces and the `ChannelEventTopics` constant are exported
from `events.ts`. The `channel:emoji-selected` event (emoji picker → reaction
bar) is internal wiring between `channel-emoji-picker` and
`channel-reaction-bar` — not part of the host-facing contract.

## Gaps Closed During Migration

### 1. Message Type Selector (`channel-input`)

Connectors' input sends plain text with no type selection. Add an optional
type dropdown controlled by `showTypeSelector`:

- Populated from `messageTypes` property
- Filtered by `allowedTypes` (per-channel whitelist from `QhorusChannel`)
- Further filtered by `deniedTypes` (per-channel blacklist from `QhorusChannel`)
  — types present in `deniedTypes` are subtracted from available options.
  `deniedTypes` exists for governance enforcement (e.g. `deniedTypes = {EVENT}`
  on oversight channels per claudony ADR-0009). Both fields exist on the
  `QhorusChannel` interface in `types.ts`; claudony's
  `updateTypeSelectForChannel()` currently uses only `allowedTypes` — the
  migrated component adds `deniedTypes` filtering.

**Filtering algorithm:**
1. Start with `messageTypes` (all 9 speech-act types by default)
2. If `allowedTypes` is defined and non-empty, intersect: keep only types
   present in both `messageTypes` and `allowedTypes`
3. If `deniedTypes` is defined and non-empty, subtract: remove any types
   present in `deniedTypes`
4. **Precedence:** `deniedTypes` wins — a type in both `allowedTypes` and
   `deniedTypes` is denied
5. **Null semantics:** `undefined` and empty array `[]` both mean "no
   constraint" for either field
- Selected type sent as `SendMessagePayload.speechAct`
- When hidden (default), behaviour unchanged from connectors

### 2. Terminal/EVENT Message Styling (`channel-feed`)

Add CSS styling in `channel-feed` rendering logic:

- Terminal types (DONE, FAILURE, DECLINE, HANDOFF): `opacity: 0.8`
- EVENT type: italic body text, `opacity: 0.55`
- Uses existing `isTerminalMessageType()` and `messageTypeCategory()` helpers
- Controlled by `terminalDimming` and `eventStyling` properties

### 3. Auto-Scroll (`channel-feed`)

Wire the existing `_prevMessageCount` tracking to scroll behaviour:

- If the feed was scrolled to bottom before update, scroll to bottom after
- If user has scrolled up (reading history), do not auto-scroll
- Controlled by `autoScroll` property

### 4. Error Feedback (`channel-input`)

Add error display for send failures:

- `renderError` callback receives error string, returns `TemplateResult`
- Default: inline `<span>` below the textarea
- Cleared on next successful send

### 5. Stale Cursor Detection (`channel-feed`)

Port claudony's timestamp-based stale cursor detection as an opt-in feature.
The component owns the detection UX but not data fetching — consistent with
the "data via Lit properties" architecture.

**Component responsibilities (passive renderer + UX):**
- Store cursor ID + timestamp per channel in `sessionStorage` (local
  bookkeeping — not data fetching)
- `staleCursorMinutes` config property (default: 30, 0 disables)
- On channel selection, check if stored cursor is older than threshold
- If stale, show an inline catch-up/reload prompt above the message feed

**Host interaction (event-driven):**
- User clicks "Catch up" → component emits `channel:cursor-catchup` with
  `CursorActionPayload { channelId, cursorId }` — host fetches messages
  from cursor forward and updates the `messages` property
- User clicks "Reload" → component emits `channel:cursor-reload` with
  `CursorActionPayload { channelId }` — host discards cursor context and
  loads full history into `messages`
- Stale prompt is cleared automatically when the `messages` property
  changes (standard Lit reactive update — no separate "clear" signal needed)

This uses simple timestamp-based staleness (no pages infrastructure needed).
When casehub-pages#174 lands and surfaces gap detection through
`EventStream.onReconnect`, the component upgrades to gap-based detection —
the UX (catch-up vs reload prompt) remains the same, only the trigger changes.

## Deferred (Parallel Work in Pages)

These features depend on pages infrastructure not yet built. They do not
block the migration — the component works without them and upgrades when
they land. Issues are in the `casehubio/casehub-pages` repository.

### Gap-Based Reconnection — casehubio/casehub-pages#174

When pages surfaces `gaps[]` through `EventStream.onReconnect`:

1. Update `EventStreamController` in blocks-ui-core to pass gap info through
2. Upgrade `channel-feed` stale cursor detection from timestamp-based
   (§Gaps Closed #5) to gap-based — more precise, detects actual data loss
   rather than time elapsed

### Cursor Persistence — casehubio/casehub-pages#175

When pages adds optional `topicSeqs` persistence:

1. Configure `EventConnection` with `persistCursors: true` for channel topics
2. Page reloads resume from last-known position instead of full snapshot
3. Supersedes the component-level `sessionStorage` cursor persistence in
   §Gaps Closed #5 with a pages-native mechanism

## Build Order

The dependency graph remains strictly layered after migration:

```
pages  ←──  blocks-ui  ←──  chat app module  ──→  connectors (Java backend)
                ↑                                        ↑
                └──────────  claudony  ──────────────────┘
                             work, engine, etc.  ────────┘
```

- **pages** — leaf node, no dependencies on blocks-ui or connectors
- **blocks-ui** — depends on pages (npm). No dependency on connectors.
- **connectors** — pure Java. No npm build. No dependency on blocks-ui.
- **chat app module** — depends on blocks-ui (npm) and connectors (backend API)
- **claudony, work, engine** — depend on blocks-ui (npm) and connectors (Maven)

No circular dependencies. Connectors is consumable by any app without
pulling in UI code or npm tooling.

## Consumer Integration

### Chat App Module

The extracted workbench imports all UI primitives from
`@casehubio/blocks-ui-channel-activity`. It owns the app shell (responsive
three-panel layout, WebSocket connection, REST calls) and delegates all
message/channel/member rendering to the shared blocks-ui components.

### Claudony

Claudony builds a thin wrapper component that:

- Embeds `<channel-feed>` with `renderContextHeader` providing case header
  and worker lineage
- Embeds `<channel-input>` with `showTypeSelector: true`
- Uses `formatSender` to strip the `claudony-worker-` prefix
- Manages channel preselection by case ID from its own context
- Fetches lineage data from `/api/sessions/{id}/lineage` independently

The existing `claudony-channel-panel.ts` is retired.

## CSS Theming

All components use `--pages-*` CSS custom properties from `pages-ui-tokens`,
consistent with the rest of blocks-ui. The connectors components already use
this convention — no changes needed.

## Cross-Repo Overlap

Epic #35's Cross-Repo Overlap Watch identifies `<channel-feed>` as a shared
pattern across OpenClaw, Clinical (audit trail), and DevTown (event stream).

OpenClaw's `<channel-feed>` (117 lines, casehubio/blocks-ui#36) is a
simplified chronological message stream with role attribution and auto-scroll.
It is planned to become a *consumer* of blocks-ui's `<channel-feed>` — not a
competing implementation. The OpenClaw migration plan (Phase 1) registers its
channel feed as a tab inside `<case-detail-pane>`, consuming the blocks-ui
component. Clinical's audit trail and DevTown's event stream are structurally
different (different data models, not qhorus speech acts) and would use
`<channel-feed>` only if they adopt the qhorus message model.

## Testing

### Test Migration

The connectors qhorus directory has 12 test files that migrate alongside
their source files:

| Test file | Migrates as |
|-----------|------------|
| `qhorus-message.test.ts` | `channel-message.test.ts` |
| `qhorus-message-input.test.ts` | `channel-input.test.ts` |
| `qhorus-emoji-picker.test.ts` | `channel-emoji-picker.test.ts` |
| `qhorus-reaction-bar.test.ts` | `channel-reaction-bar.test.ts` |
| `qhorus-thread.test.ts` | `channel-thread.test.ts` |
| `qhorus-channel-feed.test.ts` | `channel-feed.test.ts` |
| `qhorus-channel-nav.test.ts` | `channel-nav.test.ts` |
| `qhorus-member-panel.test.ts` | `channel-member-panel.test.ts` |
| `events.test.ts` | `events.test.ts` |
| `types.test.ts` | `types.test.ts` |
| `markdown.test.ts` | `markdown.test.ts` |
| `theme-variables.test.ts` | `theme-variables.test.ts` |

These are the migration starting point — they cover existing behaviour and
catch regressions from the rename + restructure. They are adapted (tag name
updates, import path changes) rather than rewritten.

### Additional Test Coverage

- Type selector filtering by `allowedTypes` and `deniedTypes`
- `formatSender` callback application
- `renderContextHeader` rendering when provided vs absent
- Terminal/EVENT styling class application
- Auto-scroll behaviour (at bottom vs scrolled up)
- Stale cursor detection and catch-up/reload flows
- Keyboard accessibility: arrow key navigation in `channel-nav` (ArrowUp,
  ArrowDown, Enter), visible focus indicators, tab ordering
- Integration test: chat app module consuming shared components
