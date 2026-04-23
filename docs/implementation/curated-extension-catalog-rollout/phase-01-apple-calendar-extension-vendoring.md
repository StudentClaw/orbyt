# Phase 01 - Apple Calendar Extension Vendoring

Last updated: 2026-04-18

## Orientation Note

- Target feature: define how `~/Documents/calendar/apple-calendar-mcp` becomes a monorepo-native Orbyt extension package
- Key dependencies: Phase 00 source-ingestion boundary, current bundled extension conventions under `packages/extensions/`, existing shared extension manifest contract
- Constraints and boundaries:
  - keep Apple Calendar aligned with the current bundled extension system
  - do not leave runtime ownership split across external tarballs and repo code
  - keep the bridge self-contained with the extension package
- Acceptance criteria for this increment:
  - the target package shape is explicit
  - manifest normalization rules are locked
  - tool naming policy is decided
  - workspace and test participation expectations are stated

## Beginning

### Objective

Specify the exact Orbyt package shape for the vendored Apple Calendar
extension so implementation can copy or adapt external source into the repo
without architectural guesswork.

### Current State

- Current bundled extensions such as Canvas and template live under `packages/extensions/<plugin-id>/`.
- The external Apple Calendar package is a standalone Node or Bun TypeScript MCP server with a separate Swift bridge.
- The external server uses camelCase MCP tool names that mirror Apple Calendar operations.

### Out Of Scope

- bridge lifecycle ownership details beyond package placement
- Settings or runtime readiness UX
- packaged-app behavior

### Acceptance Criteria

- The extension target path is fixed at `packages/extensions/apple-calendar-mcp/`.
- The bridge target path is fixed at `packages/extensions/apple-calendar-mcp/bridge/`.
- The Orbyt package shape matches current bundled extensions:
  - `manifest.json`
  - `package.json`
  - `src/`
  - build output under `dist/`
  - tests
  - workspace build and test participation
- The manifest normalization rules are explicit.
- The tool naming policy is fixed and does not remain an open question.

## Middle

### Implementation Slices

1. Create the package directory and normalized file layout.
2. Normalize package metadata and runtime entry conventions.
3. Normalize manifest metadata to the shared Orbyt extension contract.
4. Decide tool naming and tool inventory policy.
5. Define test and workspace participation expectations.

### Required Package Shape

The vendored package should be structured as:

- `packages/extensions/apple-calendar-mcp/manifest.json`
- `packages/extensions/apple-calendar-mcp/package.json`
- `packages/extensions/apple-calendar-mcp/src/`
- `packages/extensions/apple-calendar-mcp/dist/`
- `packages/extensions/apple-calendar-mcp/bridge/`
- `packages/extensions/apple-calendar-mcp/README.md`
- package-level tests aligned with the rest of `packages/extensions/*`

### Manifest Normalization Rules

The vendored extension should normalize these fields to Orbyt conventions:

- `id`:
  - use `apple-calendar-mcp`
- `name`:
  - use a Orbyt-facing name such as `Apple Calendar`
- `transport`:
  - `type` remains `local_stdio`
  - `entry` points at the vendored runtime entry in `dist/`
  - `env` is omitted from the manifest. Runtime-derived values (ephemeral bridge port, per-session shared secret) are injected by the bridge manager at spawn time per the Phase 02 env passthrough contract. The manifest must never hard-code `MAC_API_BRIDGE_PORT`, tokens, or machine-specific values.
- `auth`:
  - must be exactly `{ "type": "none" }`
  - required because `ExtensionManifest` in `packages/contracts/src/schemas/extension.ts` requires an `auth` value
  - this signals Settings to suppress the credential form and render a readiness panel instead (Phase 04 contract)
- `permissions`:
  - must be drawn from the locked permissions vocabulary in the GLOSSARY
  - for Apple Calendar: `["local_os.calendar.read", "local_os.calendar.write"]`
  - free-form strings outside that vocabulary are not acceptable for curated extensions going forward
- `author` and `homepage`:
  - `author` reflects Orbyt ownership of the vendored runtime
  - `homepage` points at the Orbyt repository
  - upstream attribution is preserved in the package `README.md` under a `Vendored From` heading, not in the manifest
- `tools`:
  - list every supported Apple Calendar tool in the shared manifest inventory, with names unchanged from upstream per the tool-naming house rule below

### Tool Naming Policy

Apple Calendar is a vendored extension, so it follows the vendored branch of
the tool-naming house rule locked in the GLOSSARY: upstream tool names are
retained unchanged even though they differ from the first-party `snake_case`
convention used by Canvas.

Concretely, the Apple Calendar manifest keeps the upstream camelCase inventory:

- `getCalendars`
- `getCalendarEvents`
- `createCalendar`
- `createCalendarEvent`
- `updateCalendarEvent`
- `deleteCalendarEvent`
- and other supported Apple Calendar operations

Rationale:

- upstream sync correctness outweighs inter-extension convention uniformity
- the Orbyt gateway namespaces tool exposure, so the camelCase names are scoped by extension id at call time
- renaming tools here would create avoidable translation and maintenance work on every upstream sync

Trade-off acknowledged:

- the tool inventory presented to the model will mix `snake_case` (Canvas) and camelCase (Apple Calendar). This is a conscious product choice for vendored extensions; first-party-authored curated extensions must use `snake_case`.

### Workspace Participation Expectations

The vendored extension should participate in:

- root workspace discovery
- root extension build script participation
- root typecheck coverage
- root test coverage

The vendored package should behave like any other first-party bundled extension,
not like an opaque imported artifact.

### Primary Directories

- `packages/extensions/apple-calendar-mcp/`
- `packages/contracts/src/schemas/extension.ts`
- `package.json`

### Verification Gates

- Unit:
  - manifest validation for Apple Calendar, including `auth.type === "none"` and permissions drawn from the locked vocabulary
  - tool inventory alignment between manifest and server registration
  - negative case: a manifest with a free-form permission string outside the locked vocabulary fails a lint or schema check for curated extensions
- Integration:
  - the vendored Apple extension appears as a healthy bundled extension in registry discovery
  - discovery does not require the bridge to be present (Phase 02 owns bridge readiness)
- Manual smoke:
  - reviewer can compare the pinned upstream tree to the vendored target layout and see a one-to-one mapping
- Failure path:
  - missing or mismatched manifest metadata fails discovery cleanly
  - a manifest with `auth.type === "manual_token"` for Apple Calendar is rejected at review because readiness must not be driven by credentials for this extension

### Evidence To Capture

- vendored package tree
- manifest validation result
- one registry snapshot showing Apple Calendar as bundled and healthy

## End

### Done When

- Apple Calendar has a fully specified Orbyt package shape
- implementation can vendor code into the repo without reopening layout, metadata, or naming decisions

### Handoff To Next Phase

Phase 02 should define how Electron Main owns the Swift bridge lifecycle and
connects bridge health to Apple Calendar runtime readiness.

### Risks To Carry Forward

- if manifest normalization is inconsistent with other bundled extensions, future curated plugins will drift into bespoke packaging
- if tool naming is changed now without a strong reason, future upstream sync work becomes fragile

### First Recommended Next Step

Start [Phase 02 - Swift Bridge Lifecycle And Permissions](phase-02-swift-bridge-lifecycle-and-permissions.md).
