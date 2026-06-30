# casehub-blocks-ui

Shared UI components for CaseHub applications — composed from [casehub-pages](https://github.com/casehubio/casehub-pages) primitives.

## What This Is

Domain-aware UI components that multiple CaseHub applications reuse. Each component consumes `casehub-pages` APIs (`registerPanel`, `pages-event`, dataset contracts) but knows nothing about a specific app's domain model.

The UI parallel to [casehub-blocks](https://github.com/casehubio/blocks) (shared Java coordination patterns).

## Status

Scaffold — package structure, build tooling, stub components. No implementation yet.

## Structure

```
packages/
  blocks-ui-core/     — shared theme, dataset helpers, event contracts
components/
  case-timeline/      — case lifecycle timeline
  trust-score-panel/  — agent trust score visualisation
  channel-activity/   — qhorus channel activity feed
```

## Build

```bash
yarn install
yarn build
yarn test
```

## Documentation

- [PLATFORM.md](https://raw.githubusercontent.com/casehubio/parent/main/docs/PLATFORM.md)
- [casehub-pages](https://github.com/casehubio/casehub-pages)
