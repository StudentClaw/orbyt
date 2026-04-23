# Phase 00 - Contracts And Scaffolding

Last updated: 2026-04-11

## Orientation Note

- Target feature: create the shared contract and planning foundation for the Orbyt MCP plugin system rollout
- Key dependencies: [PLAN.md](../../../PLAN.md), [docs/architecture/02-electron-shell.md](../../architecture/02-electron-shell.md), [docs/architecture/03-local-server.md](../../architecture/03-local-server.md), current extension packages under `packages/extensions/`
- Constraints and boundaries:
  - ignore `docs/features/05-plugin-system.md`; it is outdated for sequencing
  - do not spawn real plugin processes yet
  - do not wire Canvas credentials yet
  - do not change Codex runtime behavior yet
- Acceptance criteria for this increment:
  - shared extension schemas exist
  - lifecycle states and IPC shapes are defined
  - feature flags allow the runtime to stay dark by default
  - automated schema coverage exists

## Beginning

### Objective

Define the types, state model, and implementation boundaries so the rest of the rollout has a stable foundation.

### Current State

- `Extension` is currently too small to support installability, auth, or lifecycle richness.
- Canvas has a manifest shape that is useful, but it is extension-specific and not yet the canonical shared schema.
- Electron/Main and server/plugin ownership are documented, but not implemented in code.

### Out Of Scope

- plugin discovery scans
- process spawning
- gateway routing
- vault writes
- packaged runtime work

### Acceptance Criteria

- A shared `ExtensionManifest` or equivalent exists in shared contracts.
- Lifecycle status supports at least `discovered`, `disabled`, `starting`, `ready`, `active`, `stopping`, `stopped`, `error`.
- Shared types exist for extension auth schema, install source, and tool inventory summaries.
- IPC channel contracts exist for lifecycle state reads and extension management actions.
- The plugin system can be gated behind a feature flag without impacting current app startup.

## Middle

### Implementation Slices

1. Expand shared schemas in `packages/contracts` and `packages/shared`.
2. Add typed error shapes for manifest validation, spawn failure, auth failure, and registry mismatch.
3. Add Electron/Main bridge contract types for:
   - list extensions
   - install bundled extension
   - enable or disable extension
   - uninstall extension
   - read extension status
4. Define a single status model used by UI, Main, and server.
5. Add a feature flag and default it to off.

### Primary Directories

- `packages/contracts/src/schemas/`
- `packages/contracts/src/protocol/`
- `packages/shared/src/schemas/`
- `packages/shared/src/errors/`
- `packages/electron/src/ipc/`

### Verification Gates

- Unit:
  - manifest schema accepts valid bundled extension metadata
  - manifest schema rejects invalid transport, status, and auth payloads
- Integration:
  - Electron and UI still build with the plugin feature flag disabled
- Manual smoke:
  - app boots exactly as before with no plugin UI regressions
- Failure path:
  - malformed manifest data decodes into a typed error, not a crash

### Evidence To Capture

- passing test names
- one sample valid manifest
- one sample invalid manifest and resulting error

## End

### Done When

- schema and protocol work is merged
- tests are passing
- no runtime behavior depends on real plugin processes yet

### Handoff To Next Phase

Phase 01 can start once discovery code has one canonical manifest schema and one canonical lifecycle status model to target.

### Risks To Carry Forward

- if multiple packages define near-duplicate lifecycle enums, later phases will drift
- if auth schema is underspecified here, Phase 04 will require contract churn

### First Recommended Next Step

Start [Phase 01 - Discovery And Registry](phase-01-discovery-and-registry.md).
