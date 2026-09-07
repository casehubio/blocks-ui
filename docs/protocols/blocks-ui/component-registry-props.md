---
id: PP-20260907-fd8ee7
title: "Every blocks-* component must export a Props interface and register in BlocksComponentRegistry"
type: rule
scope: repo
applies_to: "Any new @customElement('blocks-*') component in components/"
severity: important
refs:
  - packages/blocks-ui-schema/src/registry.ts
  - packages/blocks-ui-schema/src/registry-completeness.test.ts
violation_hint: "registry-completeness.test.ts fails — a blocks-* element exists without a registry entry"
created: 2026-09-07
---

New components must export a typed `FooProps` interface from their index.ts and
add a corresponding entry to `BlocksComponentRegistry` in
`packages/blocks-ui-schema/src/registry.ts`. The completeness test verifies
every `blocks-*` custom element has a registry entry — CI fails if one is missing.
After adding the entry, run `yarn workspace @casehubio/blocks-ui-schema run generate`
to regenerate the Zod schemas.
