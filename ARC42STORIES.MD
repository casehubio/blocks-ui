# casehub-blocks-ui — ARC42STORIES.MD

**Spec:** Arc42Stories v0.1
**Profile:** Shared component library within the CaseHub platform
**Build position:** Mid-tier — depends on casehub-pages, consumed by application repos
**Consumed by:** DraftHouse, Claudony, DevTown, Clinical, AML, OpenClaw, SOC, and other CaseHub apps
**Depends on:** casehub-pages (@casehubio/pages-component, pages-table, pages-data, pages-primitives), Lit 3

---

## §1 Introduction and Goals

### Description

`casehub-blocks-ui` is the shared UI component library for the CaseHub platform — the frontend parallel to `casehub-blocks` (shared Java coordination patterns). Each component consumes `casehub-pages` APIs (DataSourceController, pages-event, CSS tokens) but knows nothing about a specific app's domain model. Components work standalone in a test harness AND embedded via pages `hostPanel`.

The repo ships 24 components across work management, trust/compliance, communication, case exploration, and notification domains — all framework-agnostic Web Components built with Lit.

### Stakeholders

| Stakeholder | Interest |
|---|---|
| Application developers | Compose domain UIs from shared components — no reimplementation of inbox, timeline, trust panels |
| casehub-pages | Components validate pages' DataSourceController, pages-table, and event model at scale |
| Platform architects | Component promotion pipeline — domain repos incubate, blocks-ui graduates |

### Quality Goals

| Goal | Scenario |
|---|---|
| Framework-agnostic | Components work in any host — React, vanilla, Quarkus Quinoa, standalone |
| Zero domain coupling | Components consume typed data contracts, never import domain models |
| Shadow DOM correctness | Components render correctly in nested shadow roots with scrolled containers |
| Spec-driven development | Every component has a design spec with adversarial review rounds before implementation |

---

## §2 Constraints

### Platform
TypeScript 5, Lit 3, Web Components. Yarn 4.10 workspaces with TypeScript project references. Node 18+.

### Build

```bash
yarn install && yarn build        # topological workspace build
yarn typecheck                     # TypeScript project references
yarn test                          # vitest across all packages
yarn examples                     # Vite showcase dev server
```

### Layering Rule
Components depend on `casehub-pages` packages but never on each other (except through `blocks-ui-core`). No circular dependencies. No domain-repo imports.

---

## §3 Context and Scope

```
┌──────────────────────────────────────────────────────────┐
│                    Application Repos                      │
│  (DraftHouse, Claudony, DevTown, Clinical, AML, ...)     │
│                                                           │
│   import { WorkItemInbox } from '@casehubio/...'          │
│   import { ChannelActivity } from '@casehubio/...'        │
│   import { CaseExplorer } from '@casehubio/...'           │
│                                                           │
├──────────────────────────────────────────────────────────┤
│                   casehub-blocks-ui                        │
│                                                           │
│   blocks-ui-core ─── DataSourceMixin, TrendSourceMixin    │
│                      fetchSource, tokens, events          │
│                                                           │
│   24 components ─── work-*, channel-*, trust-*, case-*    │
│                                                           │
├──────────────────────────────────────────────────────────┤
│                    casehub-pages                           │
│                                                           │
│   pages-component ── DataSourceController, emitPagesEvent │
│   pages-table ────── <pages-table> with TypedDataSet      │
│   pages-data ─────── TypedDataSet, extraction pipeline    │
│   pages-primitives ─ a11y mixins, schema-form             │
│   pages-ui-tokens ── --pages-* CSS custom properties      │
│                                                           │
├──────────────────────────────────────────────────────────┤
│                    Backend Services                        │
│                                                           │
│   casehub-engine ── case instances, workers, gates        │
│   casehub-qhorus ── channels, messages, topics            │
│   casehub-ledger ── trust scores, audit trail, Merkle     │
│   casehub-work ──── work items, queues, SLAs              │
└──────────────────────────────────────────────────────────┘
```

**Boundary:** blocks-ui owns component rendering, data presentation, and user interaction. Data fetching is delegated to pages' DataSourceController. Domain logic (authentication, routing decisions, case lifecycle) belongs to backend services and application repos.

---

## §4 Solution Strategy

### Data Flow: DataSourceMixin

Every data-fetching component uses the same pattern — a two-layer abstraction that eliminated ~200 lines of duplicated fetch lifecycle code (#44):

```
Component declares endpoint="..." property
    ↓
DataSourceMixin (convenience sugar)
    ↓
DataSourceAdapter (Lit ReactiveController wrapping DataSourceController)
    ↓
fetchSource / restSource → extraction pipeline → TypedDataSet
    ↓
Component receives this.data (typed) and renders
```

The key insight (blog: "The Controller Was the Point"): every component had its own fetchData method, its own loading flag, its own abort controller, its own connect/disconnect lifecycle. DataSourceController made all of that disappear. Components went from 80% boilerplate to pure rendering logic.

### TypedDataSet Pipeline

All data sources — HTTP fetch, inline JSON, simulated — produce TypedDataSet through the same 4-stage extraction pipeline (#49): parse, navigate/extract, tabulate, convert. This was the "Fetch Is Just Push" unification — a fetch is just a single-event push where the originator is HTTP instead of WebSocket.

The worst line in the codebase was `sink.apply({ type: 'snapshot', dataset: data as never })` — raw JSON cast to bypass the type system. The extraction pipeline eliminated every `as never` and `as any` cast in the data path.

### Event Communication

Components communicate via `pages-event` CustomEvent — no direct component-to-component coupling. Events use colon-delimited topic hierarchies (`work:item:selected`, `channel:message:sent`). The runtime dispatches on `document` with `composed: true` to cross shadow DOM boundaries.

### Component Customisation Protocol (PP-20260713-8ea1af)

Three mechanisms, in order of preference:
1. **Typed config properties** — data shape contracts (`columnConfig`, `tabs: TabDefinition[]`)
2. **Optional render callbacks** — functions returning `TemplateResult | undefined` with sensible defaults
3. **Factory method overrides** — protected methods on mixins for cross-cutting behaviour

Slots are reserved for layout shells only (split-workbench). Content components never use slots for domain customisation.

Critical rule: **render callbacks use inline styles**, not CSS classes. Callback output renders inside the consuming component's shadow DOM, not the defining component's — CSS classes from the parent's `static styles` have no effect across this boundary (#67).

---

## §5 Building Block View

### Package Taxonomy

| Layer | Package | Responsibility |
|---|---|---|
| Core | `blocks-ui-core` | Tokens, DataSourceMixin + DataSourceAdapter, TrendSourceMixin, fetchSource, renderSparkline, event helpers, SharedTimerController, EventStreamController, blocks-confirm-dialog |

### Component Inventory

| Domain | Components | Key Features |
|---|---|---|
| Work Management | work-item-inbox, work-item-detail, work-item-row, work-item-workbench | Queue pill bar, scope context bar, filter bar with counts, three-tab perspective (My/Claimable/All), SSE lifecycle |
| Layout Primitives | split-workbench, list-pane, detail-pane | Generic split-pane, draggable divider, responsive collapse, ARIA regions, selection events |
| Trust & Compliance | trust-score-panel, trust-feedback-display, trust-workbench, compliance-summary, routing-rationale | SVG gauge, capability breakdown, trend sparkline, trust-weighted routing explanation |
| Audit & SLA | audit-trail-viewer, sla-indicator, sla-breach-policy | Merkle verification banner, attestations, countdown, breach state, escalation tiers |
| Communication | channel-activity (8 sub-components) | Message feed with sender grouping and threading, channel nav, member panel, emoji reactions, topic bar, view modes |
| Case Exploration | case-explorer (entity-list, entity-detail, entity-tree, entity-command-bar) | Registration-based entity types, cursor-aware fetch, three-tier renderer resolution, lazy-loading tree, breadcrumbs |
| Notification | notification-inbox (bell, inbox, subscription-list) | Unread badge, tabs/filters/SSE, subscription CRUD |
| Data Display | blocks-timeline, grouped-data-view, kpi-metric-row, similarity-panel | Pluggable timeline strategies, grouped tables, metric cards with sparklines |
| Governance | approval-gate, gdpr-erasure-action | Structured decision point with quorum, three-phase erasure form |

### The Promotion Pipeline

Components are born in domain application repos, mature there, then get promoted to blocks-ui when a second app needs them. This is how the library grows:

- **Clinical promotion** (#38): similarity-panel, compliance-summary, trust-feedback-display, sla-breach-policy, gdpr-erasure-action — 5 components lifted from the clinical trials app
- **Channel-activity promotion** (#39): 8 components lifted from the connectors repo's chat demo, renamed from `qhorus-*` to `channel-*`
- **Schema-form migration** (#83): orchestrator moved to pages when it became clear it duplicated six input components pages already had

The blog entry "Three Repos, One Component Library" captures the design question: "not 'what do we port from claudony?' but 'what do we port from connectors, and what extension points does claudony need?'"

---

## §6 Runtime View

### SSE and DataSource Are Orthogonal

A common misconception: SSE is a mode of data-fetching that DataSourceController should absorb. The code tells a different story (blog: "The SSE Question Had the Wrong Premise"). Two completely independent patterns exist:

- **DataSourceMixin** delivers dataset snapshots via `sink.apply()` — HTTP fetch lifecycle
- **EventStreamController** handles event-driven state machines with domain-specific routing — SSE lifecycle

Components compose both, not choose one. work-item-inbox uses DataSourceMixin for list data AND EventStreamController for real-time status transitions. notification-inbox uses DataSourceMixin for the unread list AND SSE for new-notification events.

### Shadow DOM Rendering Contracts

Shadow DOM creates three classes of rendering problems that drove architectural decisions:

1. **CSS scoping** (#67): Column renderer output rendered inside pages-table's shadow DOM. Parent styles don't follow. Solution: inline styles mandate for all render callbacks.
2. **Native `<select>` positioning** (blog: "The Select That Lost Its Way"): Browser miscalculates popup position in nested shadow roots with scrolled containers. Solution: custom dropdown with `position: absolute` in a `position: relative` wrapper.
3. **Dead CSS with missing JS wiring** (#82): Emoji picker had correct `.flip` CSS class but nothing ever added the class. Solution: `_computePickerPosition()` measuring container bounding rect.

---

## §7 Deployment View

Packages published to GitHub Packages (`npm.pkg.github.com`) under the `@casehubio` scope. Host applications consume packages via Quarkus Quinoa — `npm install` at build time, static serving from `META-INF/resources/` at runtime. No Node.js at runtime.

CI: `publish-packages.yml` with `repository_dispatch` trigger (#1). Each component has its own `package.json` with `publishConfig.registry`.

---

## §8 Crosscutting Concepts

| Concern | Approach |
|---|---|
| Data lifecycle | DataSourceMixin wraps pages' DataSourceController — components declare `endpoint`, receive typed `this.data` |
| Trend data | TrendSourceMixin for time-series data — second data source pattern alongside DataSourceMixin |
| Visual tokens | `--pages-*` CSS custom properties from pages-ui-tokens — no hardcoded colours |
| Sparklines | Shared SVG sparkline renderer in core — gradient fill, configurable dimensions, reused by kpi-metric-row and trust-score-panel |
| Timer management | SharedTimerController — single shared 1s interval for all sla-indicator instances, not one per component |
| Confirmation | blocks-confirm-dialog — reusable confirmation with persistent mode and reason field, used by approval-gate and gdpr-erasure-action |
| Event topics | Colon-delimited hierarchies (`work:item:selected`), segment-level wildcard matching from pages |

---

## §9 Journeys and Chapters

### Chapter 1: Work Item Management

**Status:** ✅ complete — #4, #5, #6, #7, #15, #17, #19, #20

The founding epic. Built the inbox, detail panel, queue board, and workbench. Established the spec-driven development pattern (each component gets a design spec with adversarial review rounds) and the showcase app (#17). Queue board was later redesigned (#20) to an orthogonal scope x perspective model — the original Kanban layout didn't fit when queues multiplied.

### Chapter 2: Data Table

**Status:** ✅ complete (in blocks-ui), migrated to pages

Built pages-data-table (#22) with virtual scroll, pagination, sorting, filtering, selection, CSV export, tree/expandable rows. Then realised the layering violation — a generic table has no domain awareness — and migrated it to pages (#48). The blog "The Table Came Home" captures the moment: "generic UI primitives living in a domain-component repo."

A deeper problem surfaced during migration: the old table spoke TypedDataSet, the new table took `rows: unknown[]` — a type-safety downgrade. This led to Chapter 4.

### Chapter 3: UI Primitives and Consolidation

**Status:** ✅ complete — #8, #9, #10, #11, #12, #13, #23, #24, #25, #29

Built sla-indicator, kpi-metric-row, approval-gate, audit-trail-viewer, case-timeline, trust-score-panel. Established core infrastructure: DataEndpointMixin, SharedTimerController, schema-form, SSE connection manager, a11y mixins.

### Chapter 4: TypedDataSet Unification

**Status:** ✅ complete — #44, #45, #48, #49, #50

The architectural pivot. Four issues that form one story:
1. **DataSourceMixin** (#44) replaced DataEndpointMixin — wrapping pages' DataSourceController instead of reimplementing fetch lifecycle
2. **Trust-score sparkline** (#45) introduced TrendSourceMixin — second data source pattern
3. **Data-table migration** (#48) moved the table to pages, exposing the TypedDataSet gap
4. **TypedDataSet native** (#49) made every component consume TypedDataSet through the extraction pipeline, eliminating all `as never` casts

### Chapter 5: Pluggable Timeline

**Status:** ✅ complete — #55, #57, #58

Replaced the domain-specific case-timeline with blocks-timeline — a strategy-based architecture supporting event chronology, state progression, and commitment lifecycle strategies. Three layouts (vertical, horizontal, compact). Later added pagination (#57) that bypasses DataSourceMixin for raw JSON access.

### Chapter 6: Component Promotion

**Status:** ✅ complete — #38, #39, #52, #83

The library grew through promotion rather than greenfield development:
- **Clinical promotion** (#38): 5 components + commitmentLifecycleStrategy from clinical trials app
- **Channel-activity promotion** (#39): 8 chat components from connectors, establishing the extension point protocol (PP-20260713-8ea1af)
- **Schema-form migration** (#83): Moved to pages after gap analysis revealed duplication with 6 existing pages input components

### Chapter 7: Channel Activity Extensions

**Status:** ✅ complete — #64, #65, #66, #69, #73, #82, #86

Extended channel-activity with renderContent callback, channel-nav compact dropdown mode, message counts, topic bar with lifecycle actions, and flat/threaded/topics view modes. Fixed several rendering bugs — duplicate root messages (#66), missing thread reactions (#69), invisible Create Channel button (#68), emoji picker overflow (#82).

### Chapter 8: Trust and Routing

**Status:** ✅ complete — #54, #89

Built routing-rationale (#54) — trust-weighted assignment explanation with score vs threshold, alternatives table, phase badges. Then composed trust-workbench (#89) — a composite component combining trust-score-panel, trust-feedback-display, and routing-rationale into a unified trust visibility experience. Inline data mode for standalone demos.

### Chapter 9: Case Explorer

**Status:** ✅ complete — #87

The most architecturally ambitious component. Registration-based entity types with a generic SPI:
- **entity-list**: cursor-aware fetch with list-pane data-property mode
- **entity-detail**: three-tier renderer resolution (sub-type, entity-type, default)
- **entity-tree**: collapsible hierarchy with lazy loading, ARIA tree, M-of-N groups
- **entity-command-bar**: MCP-tools-style dynamic commands with confirmation
- **case-explorer**: full split-workbench composition with NavigationController, entity type tabs, list/tree mode, breadcrumbs

Presets for caseInstance, worker, caseDefinition, gate, channel. Convenience wrappers for drop-in usage. 7 review rounds on the spec before implementation.

### Chapter 10: Notification and Subscriptions

**Status:** ✅ complete — #33, #34, #80

Subscription editor and notification preferences UI. NotificationApi.getEventTypes() for populating event type selectors (#80). GDPR form migration integrated with subscription management.

### Backlog

| Issue | Title | Status |
|---|---|---|
| #26 | Cell spanning — single-grid rendering model | 🔲 spec complete, implementation in pages |
| #35 | Cross-repo component migration tracking | 🔲 epic open |
| #36 | OpenClaw demo UI migration | 🔲 epic open |
| #41 | DevTown governance workbench migration | 🔲 epic open |
| #56 | App delivery — all blocks-ui work needed by consuming apps | 🔲 epic open |
| #72 | Notification center frontend — bell icon, inbox dropdown, preferences | 🔲 open |
| #81 | Schema-form enhancements — real form capabilities | 🔲 epic open |
| #84 | Variable row heights with cell spanning | 🔲 open |
| #85 | Column resizing interaction with single-grid model | 🔲 open |
| #88 | pages-modal duplicate CustomElementRegistry crash in esbuild | 🔲 bug open |

---

## §10 Architectural Decisions

| Decision | Rationale |
|---|---|
| Lit over vanilla Web Components | Reactive properties, decorators, and shadow DOM rendering are foundational to every component. Vanilla would mean reimplementing Lit poorly. |
| DataSourceMixin wraps DataSourceController | Components delegate ALL fetch lifecycle to the controller. Domain logic moves to sourceFactory config. No component should have a fetchData method. |
| SSE and DataSource are orthogonal | SSE handles event-driven state machines with domain-specific routing. DataSource handles dataset snapshots. Components compose both, not choose one. |
| Typed config + render callbacks, not slots | Slots create untyped extension points. Typed properties and callbacks give compile-time safety and sensible defaults. Slots reserved for layout shells only. |
| Inline styles for cross-shadow rendering | Column renderer output lives in the consuming component's shadow DOM. CSS classes from the defining component don't follow. Inline styles are self-contained. |
| Promotion over greenfield | Components mature in domain repos before graduating to blocks-ui. The second consumer triggers promotion. |
| Spec-driven development | Every component gets a design spec with adversarial review rounds (typically 3-7 rounds) before implementation begins. |
| TypedDataSet everywhere | Raw JSON → extraction pipeline → TypedDataSet. No component handles raw JSON. The pipeline validates and types at the boundary. |
| Single-grid table model | One CSS Grid with explicit cell placement. Rows as `display: contents` wrappers. Removes the constraint that every grid library works around — cells in different rows having no layout relationship. |
| Extension point protocol | Config properties first, render callbacks with defaults second, factory method overrides for cross-cutting third. Documented as PP-20260713-8ea1af. |

---

## §11 Quality Requirements

| Requirement | Approach |
|---|---|
| Test coverage | vitest + jsdom across all 24 components + core |
| Visual testing | Vite showcase app with mock data, theme/density toggles, interactive demos |
| Spec review | Design specs reviewed adversarially (3-7 rounds) before implementation |
| Shadow DOM correctness | Inline styles mandate, custom dropdowns over native `<select>`, position-aware popups |
| Type safety | TypedDataSet pipeline eliminates `as any` / `as never` casts in data path |

---

## §12 Risks and Technical Debt

| Risk | Impact | Mitigation |
|---|---|---|
| pages-component source/dist mismatch | Vite dev server resolves TypeScript source, build resolves compiled dist — different module graphs | Vite aliases in showcase, documented workaround |
| pages-modal duplicate CustomElementRegistry crash | esbuild bundles duplicate CustomElement registrations when pages-modal is imported from multiple entry points (#88) | Open — needs pages-side fix |
| jsdom hides shadow DOM bugs | Tests pass but CSS scoping, scroll positioning, and popup placement fail in real browsers | Showcase app as visual regression baseline |
| TypeScript project reference cascading failures | Upstream compilation error produces misleading "no exported member" errors in all downstream packages | Check `.d.ts` output existence, not error messages (blog: "The Build That Lied") |
| Schema-form duplication with pages | Schema-form in pages duplicates 6 input components pages already had (#81) | Gap analysis complete, incremental fix planned |

---

## §13 Glossary

| Term | Definition |
|---|---|
| `DataSourceMixin` | Convenience mixin providing `endpoint` attribute resolution and fetch lifecycle via DataSourceController |
| `DataSourceAdapter` | Lit ReactiveController wrapping pages' DataSourceController — the reusable unit beneath the mixin |
| `fetchSource` | Raw JSON DataSource for domain components (vs pages' `restSource` which produces TypedDataSet) |
| `TrendSourceMixin` | Second data source pattern for time-series trend data — separate endpoint, produces TrendPoint[] |
| `TypedDataSet` | Column-oriented typed tabular data from pages — the wire format between data resolution and rendering |
| `SharedTimerController` | Single shared 1Hz interval for all sla-indicator instances — avoids N timers for N components |
| `EventStreamController` | Lit ReactiveController for SSE event streams — domain-specific routing, orthogonal to DataSourceMixin |
| `pages-event` | DOM custom event for inter-component communication — `composed: true` crosses shadow DOM boundaries |
| `blocks-confirm-dialog` | Reusable confirmation dialog with persistent mode and reason field |
| `split-workbench` | Generic split-pane layout shell — accepts any children via named slots (list, detail, header) |
| `NavigationController` | State manager for case-explorer — breadcrumbs, drill-down, view mode, entity type selection |
| `PP-20260713-8ea1af` | Component customisation protocol — typed config, render callbacks, factory overrides, inline styles |

---

*Created 2026-07-21 from git history (87 commits on main), 15 blog entries, 24 design specs, and 89 GitHub issues.*
