# blocks-ui Workspace
**Name:** casehub-blocks-ui

**Physical path:** `/Users/mdproctor/claude/casehub/blocks-ui/CLAUDE.md`
**Symlinked at:** `/Users/mdproctor/claude/public/casehub/blocks-ui/CLAUDE.md`
**Project repo:** `/Users/mdproctor/claude/casehub/blocks-ui`
**Workspace:** `/Users/mdproctor/claude/public/casehub/blocks-ui`
**Workspace type:** public

## Session Start

Run `add-dir /Users/mdproctor/claude/casehub/blocks-ui` before any other work.

## Artifact Locations

| Skill | Writes to |
|-------|-----------|
| brainstorming (specs) | `specs/` |
| writing-plans (plans) | `plans/` |
| handover | `HANDOFF.md` |
| idea-log | `IDEAS.md` |
| design-snapshot | `snapshots/` |
| adr | `adr/` |
| write-blog | `blog/` |

## Structure

- `HANDOFF.md` — session handover (single file, overwritten each session)
- `IDEAS.md` — idea log (single file)
- `specs/` — brainstorming / design specs (superpowers output)
- `plans/` — implementation plans (superpowers output)
- `snapshots/` — design snapshots with INDEX.md (auto-pruned, max 10)
- `adr/` — architecture decision records with INDEX.md
- `blog/` — project diary entries with INDEX.md
- `design/` — epic journal (created by `epic` at branch start)

## Git Discipline

Two git repositories are active in every session:
- **Workspace** (`/Users/mdproctor/claude/public/casehub/blocks-ui`) — methodology artifacts: handover, blog (staging before publish), plans, snapshots
- **Project repo** (`/Users/mdproctor/claude/casehub/blocks-ui`) — source code, ADRs (`docs/adr/`), specs

Never rely on CWD for git operations — the session may have started in either repo. Always use explicit paths:
```bash
git -C /Users/mdproctor/claude/public/casehub/blocks-ui ...   # workspace artifacts
git -C /Users/mdproctor/claude/casehub/blocks-ui ...           # project artifacts
```
The file path determines the repo: if the file lives under `Workspace`, use the workspace path; if under `Project repo`, use the project path.

## Rules

- All methodology artifacts go here, not in the project repo
- Promotion to project repo is always explicit — never automatic
- Workspace branches mirror project branches — switch both together

## Routing

| Artifact   | Destination | Notes |
|------------|-------------|-------|
| adr        | project     | lands in `docs/adr/` |
| blog       | workspace   | staged here; published to mdproctor.github.io via publish-blog |
| design     | project     | journal file lives in workspace design/; DESIGN.md merge target is project docs/DESIGN.md |
| snapshots  | workspace   | |
| specs      | project     | lands in project `docs/` |
| plans      | workspace   | |
| handover   | workspace   | |

---

# CaseHub Blocks UI

## Project Type

type: custom

## What This Project Is

Shared UI components for CaseHub applications — the UI parallel to [casehub-blocks](https://github.com/casehubio/blocks) (shared Java coordination patterns). Each component consumes `casehub-pages` APIs (`registerPanel`, `pages-event`, dataset contracts) but knows nothing about a specific app's domain model.

TypeScript/Yarn workspace monorepo with TypeScript project references.

## Platform Context

- [PLATFORM.md](https://raw.githubusercontent.com/casehubio/parent/main/docs/PLATFORM.md) — full platform architecture
- [APPLICATIONS.md](https://raw.githubusercontent.com/casehubio/parent/main/docs/APPLICATIONS.md) — application inventory

## Repository Role

Reusable, domain-aware UI components that multiple CaseHub applications share. Consumes casehub-pages APIs. Framework-agnostic Web Components where possible.

**Peer repos (each has its own Claude session — do not commit to these):**
platform, eidos, ledger, connectors, iot, work, worker, qhorus, pages, engine, claudony, openclaw, neural-text, devtown, aml, clinical, drafthouse, life, quarkmind, flow, soc, fsitrading, ras, ops, workers, desiredstate, blocks

## Build Commands

```bash
yarn install
yarn build
yarn test
yarn typecheck
```

## Key Directories

| Path | Contents |
|------|----------|
| `packages/blocks-ui-core/` | Shared theme, dataset helpers, event contracts |
| `components/case-timeline/` | Case lifecycle timeline — status progression, milestone markers, agent activity |
| `components/trust-score-panel/` | Agent trust score visualisation — Bayesian Beta scores, trend lines, per-capability breakdown |
| `components/channel-activity/` | Qhorus channel activity feed — message stream, commitment status, speech act badges |

## Design Philosophy

- Components should be framework-agnostic Web Components where possible
- Each component defines its dataset contract (what data shape it consumes)
- Components communicate via `pages-event` CustomEvent — no direct component-to-component coupling
- Components should work standalone in a test harness AND embedded via pages `hostPanel`
- Visual consistency through the shared `BlocksTheme` from `blocks-ui-core`
- Design for the full platform: trust scores from ledger, channel activity from qhorus, case timelines from engine, IoT device state from iot

## IntelliJ MCP Routing

One IntelliJ MCP server is available:

- **`mcp__intellij-index__*`** — use this for ALL code intelligence and navigation. Supports auto-opening projects via `project_path` — pass the project path and the plugin opens it automatically. Never ask the user to open a project manually.

`mcp__intellij__*` (built-in JetBrains MCP) is **disabled** due to a memory leak. Do not attempt to use it. All operations (find class, find references, type hierarchy, diagnostics, rename, move) go through `mcp__intellij-index__*`.

**If a project is not open:** pass `project_path` to any `mcp__intellij-index__` tool — it opens automatically. Do not fall back to bash. Do not launch IntelliJ from the command line.

## Development Workflow

Before designing: `superpowers:brainstorming`
Before implementing: `superpowers:test-driven-development`
For all TypeScript work: `ts-dev`
Before committing: `superpowers:requesting-code-review`
After implementation: `implementation-doc-sync` (scoped doc sweep)

## Writing Style Guide

**The writing style guide at `~/claude-workspace/writing-styles/blog-technical.md` is mandatory for all blog and diary entries.** Load it in full before drafting. Complete the pre-draft voice classification (I / we / Claude-named) before generating any prose. Do not show a draft without verifying it against the style guide.

## Project Artifacts

Paths that are project content (not workspace noise). Skills use this to avoid
filtering or dropping commits that touch these paths.

| Path | What it is |
|------|------------|
| `CLAUDE.md` | Project conventions |
| `docs/` | Documentation |

## Work Tracking

Issue tracking: enabled
GitHub repo: casehubio/blocks-ui
Changelog: GitHub Releases
