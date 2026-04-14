# Phase 07 - Hardening And Packaged Runtime

Last updated: 2026-04-11

## Orientation Note

- Target feature: make the plugin system reliable in packaged Electron builds, not just in dev mode
- Key dependencies: all previous phases, Electron packaging/runtime paths, production resource layout
- Constraints and boundaries:
  - prioritize correctness and operability over new features
  - packaged runtime behavior is the source of truth
  - no new extension categories should be added until packaging is stable
- Acceptance criteria for this increment:
  - packaged app can spawn extensions
  - runtime paths work outside dev mode
  - crash recovery, idle stop, and shutdown are reliable
  - extension inventory and auth state survive restart

## Beginning

### Objective

Close the dev-versus-packaged gap and make the system shippable.

### Current State

- Earlier phases will likely have been validated mostly in dev mode.
- Electron packaging, resource paths, and `asar` behavior are where plugin systems usually break.

### Out Of Scope

- public extension marketplace
- arbitrary custom MCP server support
- broad remote MCP support beyond what packaged reliability requires

### Acceptance Criteria

- Built Electron app can locate the bundled catalog.
- Built Electron app can run installed extensions outside `asar`.
- Crash recovery works without orphaning child processes.
- Idle timeout and app shutdown are both clean.
- Restart preserves install state and auth state.

## Middle

### Implementation Slices

1. Finalize packaged resource paths.
2. Ensure spawn targets live in an unpacked or copied executable location.
3. Add startup checks for catalog availability and extension store integrity.
4. Verify idle stop and restart paths.
5. Verify app quit cleanup.
6. Add observability for:
   - start failures
   - init failures
   - repeated crash loops
   - inventory mismatch

### Primary Directories

- `packages/electron/`
- `packages/electron/src/plugins/`
- `packages/electron/src/server/`
- packaging configuration files

### Verification Gates

- Unit:
  - packaged path resolution helpers
  - restart and retry policy tests
- Integration:
  - packaged build smoke test that starts one extension and calls one tool
- Manual smoke:
  - build app, install or enable extension, call one tool, restart app, call again
- Failure path:
  - intentionally corrupt installed extension path and confirm the app degrades cleanly

### Evidence To Capture

- packaged-build spawn log
- successful restart persistence evidence
- one graceful degraded-state example from corrupt runtime path

## End

### Done When

- packaged Electron behavior matches dev-mode behavior for the supported extension set
- the plugin system is stable enough to extend with new curated plugins

### Handoff To The Next Implementation Step

The next implementation step after this phase is not “more plumbing.” It is a product decision:

- either add more curated extensions
- or widen the Canvas feature set
- or carefully introduce advanced custom MCP support behind explicit trust controls

### Risks To Carry Forward

- if packaged path handling remains implicit, every new extension will reopen runtime bugs
- if observability is weak, future plugin failures will look like random Codex or Electron instability

### First Recommended Next Step

Reassess whether the next milestone should be:

- more first-party extensions
- deeper Canvas functionality
- or an advanced custom-server mode for power users
