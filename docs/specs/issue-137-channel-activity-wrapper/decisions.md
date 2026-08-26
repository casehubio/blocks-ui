## D1: Controller ownership

**Choice:** Own internally — wrapper accepts PushController + config, creates domain controllers bound to itself
**Alternatives:**
- Accept pre-created controllers from host — REJECTED: Lit ReactiveControllers bind to their constructor host via `host.addController(this)` and call `host.requestUpdate()` on that host. Passing controllers from another host prevents the wrapper from re-rendering on data changes.
- Hybrid (own by default, accept override) — unnecessary complexity given the ReactiveController binding constraint
**Rationale:** ReactiveControllers must be bound to the component that renders their data. The wrapper creates ChannelStateController, MessagingController, MembershipController, ReactionController, and CommitmentController internally from the host-provided PushController. Host retains transport control (PushController is transport-agnostic) without needing to know about domain controllers.
**Trade-offs:** Wrapper is thicker — owns controller lifecycle including teardown/recreation on pushController change.
**Sources:** components/channel-activity/src/channel-state-controller.ts (ReactiveController binding), design-review R1-02
**Exploration:** quick → revised after design review
**Status:** revised

## D2: Member panel placement

**Choice:** Toggle button in header, shows/hides as part of a tabbed sidebar
**Alternatives:**
- Always visible — takes space, no toggle
- Omitted — host composes manually; simpler wrapper but worse adoption story
**Rationale:** Most chat applications hide the member panel by default and toggle it. This keeps the feed area maximised until the user needs member context.
**Trade-offs:** Requires toggle state management in the wrapper.
**Sources:** Existing chat UIs (Slack, Discord, Teams pattern)
**Exploration:** quick
**Status:** captured

## D3: Panel scope

**Choice:** Include all panels (nav, feed, input, member-panel, topic-bar, task-panel, artifact-panel, correlation-panel)
**Alternatives:**
- Core four only (nav, feed, input, member) — simpler but missing commonly useful panels
- Core four + topic-bar — middle ground
**Rationale:** The wrapper's purpose is to be a complete convenience composition. Including all panels means consumers don't need to drop to primitives for the common arrangement. Panels that aren't needed remain hidden in the tabbed sidebar.
**Trade-offs:** More complex wrapper with more pass-through properties. But panels are lazy (only created when their tab is selected) so no runtime cost for unused panels.
**Sources:** Issue #137 description — "three consumption tiers" implies full-featured default
**Exploration:** quick
**Status:** captured

## D4: Optional panel layout

**Choice:** Tabbed sidebar — collapsible right sidebar within the detail area, with tabs for member/task/artifact/correlation
**Alternatives:**
- Individual toggle buttons — simpler but cluttered header with 4+ buttons
- Bottom drawer — different spatial model, less natural for chat UIs
**Rationale:** Scales cleanly to N panels. One toggle button controls sidebar visibility, tabs switch between panels. Clean header. Same pattern used by VS Code, Slack, and other panel-heavy UIs.
**Trade-offs:** Adds a sidebar container component or CSS region to the wrapper. Slightly more DOM complexity than individual toggles.
**Sources:** Common IDE/chat UI patterns
**Exploration:** quick
**Depends on:** D3 (panel scope — all panels included)
**Status:** captured
