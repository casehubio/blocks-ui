# Preferences Editor — Design Spec

**Issue:** casehubio/blocks-ui#92
**Date:** 2026-07-24
**Status:** Draft

---

## 1. Purpose

A generic tree-table UI for browsing and editing platform preferences at any scope level. Scope paths form a tree (system → tenant → team → user); preference key-value pairs are leaves under their scope node. Type-aware editing driven by the platform's `PreferenceSchemaDescriptor`.

Not a hand-coded settings page — a generic editor that works for any preference namespace. Custom per-preference UIs can be built later on top of the same REST API.

## 2. REST API Surface

All endpoints are in the platform `preferences-editor/` module.

### Schema

`GET /preferences/schema` — all registered preference key definitions.
`GET /preferences/schema?namespace=casehub.work` — filtered to one namespace.

Returns `List<PreferenceSchemaDescriptor>`:

```typescript
interface PreferenceSchemaDescriptor {
  namespace: string;
  name: string;
  qualifiedName: string;       // "casehub.work.sla.default-hours"
  type: string;                // "string" | "integer" | "number" | "boolean" | "duration" | "enum"
  label: string;
  description: string | null;
  defaultValue: string;
  multiValue: boolean;         // true = sub-keyed, renders as sub-table
  constraints: Record<string, unknown>;  // min, max, pattern, minLength, maxLength
  options: EnumOption[];       // non-empty only for type=enum
}

interface EnumOption {
  value: string;
  label: string;
}
```

### CRUD

`GET /preferences` — all preference records across all scopes for the tenant (bulk, one call).
`GET /preferences?scope=<path>` — records at a specific scope only.
`PUT /preferences?scope=<path>` ← `PreferenceInput(namespace, name, subKey, value)` — set a preference.
`DELETE /preferences?scope=<path>&namespace=<ns>&name=<n>&subKey=<sk>` — delete a single preference.
`DELETE /preferences/by-namespace?scope=<path>&namespace=<ns>` — delete all in a namespace at a scope.

### Resolved

`GET /preferences/resolved?scope=<path>` — merged values with inheritance applied. Not used by the editor directly — the editor computes inheritance client-side from the bulk response.

## 3. Data Model

### Tree structure

The tree-table has two row types sharing the same column set:

| Row type | id | parentId | What it shows |
|----------|---|----------|---------------|
| **Scope node** | scope path (e.g. `system`) | parent scope path (e.g. `""`) | Expandable parent — the scope label |
| **Preference leaf** | `<scope>:<qualifiedName>` | scope path | The preference key, value, type, and edit actions |

Scope nodes come from the `scopeTree` config property (passed in by the consuming app — the editor doesn't discover org hierarchy). Preference leaves come from merging the schema response with the bulk records response.

### Inheritance computation

For each scope node, the editor shows ALL known preference keys (from schema), not just the ones explicitly set at that scope:

- **Locally set** — a record exists at this exact scope. Editable. Shows edit/delete actions.
- **Inherited** — no record at this scope, but a record exists at an ancestor scope. Dimmed, read-only. Shows "from: `<scope>`" badge. "Override" action creates a local copy.
- **Default only** — no record at any scope. Shows the schema `defaultValue`. Dimmed, "from: default" badge.
- **Overridden** — locally set AND a record exists at a parent scope. Normal text with subtle indicator showing what it overrides.

The bulk `GET /preferences` response provides all records; the component walks the scope tree to resolve inheritance per key.

### Compact middle nodes

Scope paths that have no locally-set preferences and a single child collapse visually — like IntelliJ's "compact middle packages". `system / tenant/acme / team/compliance` compresses when middle levels are empty pass-throughs.

## 4. Component API

```typescript
<preferences-editor
  .scopeTree=${scopeTree}     // hierarchy of scope paths
  endpoint="/preferences"      // base URL for REST calls
  .fetchFn=${fetch}           // optional, for testing/mocking
></preferences-editor>
```

### ScopeNode

```typescript
interface ScopeNode {
  readonly path: string;                    // e.g. "system", "tenant/acme"
  readonly label: string;                   // e.g. "System", "Acme Corp"
  readonly children?: readonly ScopeNode[];
}
```

The component handles everything internally: fetching schema, fetching records, building the tree-table dataset, rendering type-aware editors, saving changes.

### Events

- `preference-changed` — after a successful PUT. Detail: `{ scope, qualifiedName, oldValue, newValue }`
- `preference-deleted` — after a successful DELETE. Detail: `{ scope, qualifiedName }`

### Data loading

Two calls on `connectedCallback`:
1. `GET <endpoint>/schema` — preference key definitions
2. `GET <endpoint>` — all records for the tenant

Both cached; refresh on save/delete to keep inheritance computation current.

No per-node fetching — the bulk endpoint returns everything, avoiding N+1 network calls.

## 5. Editing

### Type-aware editors

| Schema type | Editor widget | Constraints used |
|-------------|--------------|------------------|
| `string` | Text input | `pattern` (regexp validation), `minLength`, `maxLength` |
| `integer` | Number input, `step=1` | `min`, `max` |
| `number` | Number input, decimal | `min`, `max` |
| `boolean` | Toggle/checkbox | — |
| `duration` | Duration picker (hours/minutes, ISO 8601 output) | `min`, `max` (ISO 8601) |
| `enum` | Dropdown | `options: [{value, label}]` |

`multiValue: true` preferences render as an expandable sub-table of subKey→value pairs under the preference leaf node.

### Edit flow

1. Click a value cell → inline editor appears (type-aware widget)
2. Edit the value → client-side validation against schema constraints
3. Save → `PUT /preferences?scope=<scope>` with `PreferenceInput`
4. Optimistic update — tree-table shows new value immediately
5. On error → rollback to previous value, surface error

### Delete flow

1. Click delete action on a locally-set preference
2. `DELETE /preferences?scope=<scope>&namespace=&name=&subKey=`
3. Row reverts to inherited state (shows parent scope's value) or default state

### Add override

Button on scope nodes: "Add override" → dropdown of schema keys not already set at this scope → selecting one creates a leaf row in edit mode with the inherited/default value pre-filled.

## 6. File Structure

```
components/preferences-editor/
  src/
    types.ts                  — ScopeNode, PreferenceSchemaDescriptor, PreferenceRecord, etc.
    api.ts                    — PreferencesApi REST client
    preferences-editor.ts     — Main component: fetch, merge, tree-table, edit lifecycle
    value-editor.ts           — Type-aware inline editor: schema type → input widget
    index.ts                  — Re-exports
    preferences-editor.test.ts
    value-editor.test.ts
    api.test.ts
  package.json
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts
```

No `DataSourceMixin` — the component manages its own fetch lifecycle (three endpoints with custom merge logic). Follows the same pattern as case-explorer's `entity-list`.

## 7. Testing

### api.test.ts

- Schema fetch — returns parsed `PreferenceSchemaDescriptor[]`
- Bulk list — returns parsed `PreferenceRecord[]`
- Set preference — sends correct PUT with `PreferenceInput`
- Delete preference — sends correct DELETE with query params
- Delete namespace — sends correct DELETE to `/by-namespace`

### preferences-editor.test.ts

- **Data loading** — two-call merge: schema keys × scope records → tree-table dataset
- **Tree construction** — scope nodes as expandable parents, preference leaves as children
- **Inheritance** — local (editable), inherited (dimmed + source badge), overridden (with parent indicator), default-only (dimmed + "from: default")
- **Edit** — click value cell → editor appears → save → PUT fired → optimistic update
- **Delete** — remove override → row reverts to inherited
- **Add override** — dropdown of available keys → creates leaf in edit mode
- **Compact middle nodes** — scopes with no preferences and single child collapse
- **multiValue** — sub-table expansion under preference leaf

### value-editor.test.ts

- Type dispatch — each schema type renders the correct widget
- Constraint enforcement — min/max for numbers, pattern for strings, options for enums
- Duration parsing — ISO 8601 round-trip (PT24H ↔ 24 hours)
- Validation — rejects invalid input, shows error state
- Enum — dropdown populated from options, selected value matches current

### Edge cases

- Schema key with no record at any scope — shows `defaultValue` as inherited from schema
- Empty scope tree — renders empty state message
- Network failure on save — rollback to previous value, error indication
- Scope with no preferences and no children — still visible (not compacted away)

## 8. Dependencies

| Dependency | Status |
|------------|--------|
| Platform `GET /preferences/schema` (platform#195) | Delivered |
| Platform `GET /preferences` bulk (no scope param) | Delivered |
| Platform CRUD endpoints (platform#193) | Delivered |
| pages-data-table tree-table (`expandable`) | Exists in pages |
| pages-data-table tree filter fix (pages#240) | Delivered |

## 9. Not In Scope

- Custom per-preference UIs (hand-coded settings pages) — future work
- Scope tree discovery (e.g. listing all tenants) — consuming app provides the tree
- Permission enforcement (who can edit which scope) — future, server-side
- Preference change history / audit log
- Real-time updates (SSE/WebSocket for concurrent editors)

## 10. Protocol Compliance

- **PP-20260713-8ea1af** (component customisation pattern): `scopeTree` is a typed config property. `fetchFn` is a factory-level override. No slots. Value editors use inline styles for cross-shadow rendering.
- **Boundary rules**: UI component in blocks-ui calls platform REST API. No platform-api Java types imported. Clean boundary.
