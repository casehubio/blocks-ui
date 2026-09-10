# 0001 — Layered Layout Rule Engine Architecture

Date: 2026-09-11
Status: Accepted

## Context and Problem Statement

The org diagram's layout logic was scattered across 6+ files (archetype detection, layout strategy mapping, node sizing, internal layout, container stacking, edge handle selection, hard constraints) with no shared structure. As more diagram types adopt compound-node layouts (case, SWF), the same layout patterns would need reimplementation per domain.

## Decision Drivers

* Layout patterns (horizontal internal layout, container stacking, edge routing) are generic graph operations, not org-specific
* Archetype detection (federation, pipeline, hierarchy) describes structural graph patterns applicable to any domain
* Domain-specific concerns (agent card sizing, org edge types) should layer on top, not mix with generic logic
* Deterministic layout: same graph → same facts → same rules → same output

## Considered Options

* **Option A** — Monolithic layout in each diagram component
* **Option B** — Shared utility functions (no engine, just extract and reuse)
* **Option C** — Forward-chaining rule engine with layered architecture

## Decision Outcome

Chosen option: **Option C**, because it provides deterministic composition with mutual exclusion groups, lets domain layers override generic defaults via priority, and pre-flight composition validation catches misconfigured rule sets before layout runs.

### Positive Consequences

* Generic engine in pages/graph-renderer — reusable by case, SWF, and future diagram types
* Domain layer (blocks-ui) is thin — sizing classifier + node-type bindings
* Explain mode provides debug visibility into which rules fired and why
* Hard constraints verify layout correctness independently of which rules produced it

### Negative Consequences / Tradeoffs

* More indirection than direct function calls — engine.preLayout + engine.postLayout vs calling functions directly
* Rule registration pattern requires understanding of groups, priorities, and preconditions

## Pros and Cons of the Options

### Option A — Monolithic layout per component

* Good — simple, all logic in one place
* Bad — duplicates layout patterns across diagram types
* Bad — no composition validation or explain mode

### Option B — Shared utility functions

* Good — reusable without framework overhead
* Good — easy to understand, just function calls
* Bad — no mutual exclusion, caller must know which functions conflict
* Bad — no precondition checking, wrong function called silently produces bad layout

### Option C — Forward-chaining rule engine

* Good — deterministic composition with group resolution
* Good — domain layers override via priority without modifying generic code
* Good — pre-flight validation catches missing providers and conflicting guarantees
* Bad — more concepts to learn (FactBase, ClassificationRule, LayoutRule, HardConstraint)

## Links

* [Issue #157](https://github.com/casehubio/blocks-ui/issues/157) — Rich org diagram
