# Protocols — blocks-ui

## blocks-ui

Component design and extension rules for the shared UI library.

→ [Full listing](blocks-ui/INDEX.md)

| File | Rule Summary | Applies To |
|------|-------------|------------|
| [component-customisation-pattern.md](blocks-ui/component-customisation-pattern.md) | Typed config + render callbacks + factory overrides; no slots for content | All extensible components |
| [custom-event-namespace-prefix.md](blocks-ui/custom-event-namespace-prefix.md) | Custom events use component namespace prefixes | All components emitting bubbling composed events |
| [diagram-viewer-composition.md](blocks-ui/diagram-viewer-composition.md) | Viewers compose shared pipeline — no extraction or duplication | All diagram components |
| [node-decoration-runtime-boundary.md](blocks-ui/node-decoration-runtime-boundary.md) | Runtime state in NodeDecoration, not GraphNode.properties | All graph-stencil-* + NodeDecoration consumers |
| [stencil-package-isolation.md](blocks-ui/stencil-package-isolation.md) | No cross-imports between stencil packages — registry inversion | All graph-stencil-* packages |
