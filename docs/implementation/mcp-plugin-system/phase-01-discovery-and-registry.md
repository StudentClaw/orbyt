# Phase 01 - Discovery And Registry

Last updated: 2026-04-11

## Orientation Note

- Target feature: discover bundled and installed extensions, validate them, and surface registry state in the app
- Key dependencies: Phase 00 contracts, Electron Main app bootstrap, current extension packages in `packages/extensions/`
- Constraints and boundaries:
  - no process spawning yet
  - no Codex gateway work yet
  - no secret handling yet
- Acceptance criteria for this increment:
  - bundled extensions are discoverable
  - user extension store is scannable
  - invalid bundles surface clear registry errors
  - Settings can render registry output

## Beginning

### Objective

Prove that Student Claw can find installable extensions and represent their state deterministically before runtime behavior is added.

### Current State

- `packages/extensions/canvas-mcp` and `packages/extensions/template-mcp` exist, but there is no registry or discoverability UI.
- Settings is still a placeholder page.

### Out Of Scope

- starting a child process
- listing tools from a live MCP server
- credential vault and auth forms

### Acceptance Criteria

- Electron Main can scan a bundled catalog directory and a user extension directory.
- Registry output includes `system`, `bundled`, and `user` provenance.
- Settings can show discovered extensions and their validation state.
- Invalid manifests do not crash startup.

## Middle

### Implementation Slices

1. Create `PluginRegistry` in Electron Main.
2. Define the bundled catalog path and user extension store path.
3. Validate manifests during scan and record errors per extension.
4. Add a typed IPC read endpoint for registry state.
5. Render a basic extension list in Settings:
   - name
   - version
   - source
   - status
   - validation error if present

### Primary Directories

- `packages/electron/src/plugins/`
- `packages/electron/src/ipc/`
- `packages/ui/src/pages/`
- `packages/ui/src/components/`

### Verification Gates

- Unit:
  - registry scan finds valid manifests
  - registry scan records invalid manifests without throwing
- Integration:
  - Electron bootstrap can return extension registry state through IPC
- Manual smoke:
  - Settings shows Canvas and template extension rows
- Failure path:
  - one intentionally broken manifest shows `error` state in UI

### Evidence To Capture

- screenshot of Settings registry list
- sample registry payload
- one broken-manifest test

## End

### Done When

- bundled and user extension discovery both work
- registry state is visible in the app
- startup remains stable when the catalog contains a bad extension

### Handoff To Next Phase

Phase 02 should consume the registry output directly and use `template-mcp` as the first live spawn target.

### Risks To Carry Forward

- if registry paths differ between dev and packaged builds without a shared helper, Phase 07 will become expensive
- if validation logic lives only in Main and not in shared tests, regressions will be easy to miss

### First Recommended Next Step

Start [Phase 02 - Local Spawn And Lifecycle](phase-02-local-spawn-and-lifecycle.md).
