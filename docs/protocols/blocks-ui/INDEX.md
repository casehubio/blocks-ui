# blocks-ui Protocols

| File | Rule Summary | Applies To |
|------|-------------|------------|
| [component-customisation-pattern.md](component-customisation-pattern.md) | Use typed config properties + render callbacks for domain customisation; slots only for layout shells | All blocks-ui components allowing domain extension |
| [diagram-viewer-composition.md](diagram-viewer-composition.md) | Diagram viewers compose shared pipeline pieces independently — no extraction or duplication from editors | All diagram components |
| [node-decoration-runtime-boundary.md](node-decoration-runtime-boundary.md) | Runtime visual state in NodeDecoration, not GraphNode.properties | All graph-stencil-* packages and NodeDecoration consumers |
| [stencil-package-isolation.md](stencil-package-isolation.md) | Stencil packages must not import from each other — use registry inversion | All graph-stencil-* packages |
