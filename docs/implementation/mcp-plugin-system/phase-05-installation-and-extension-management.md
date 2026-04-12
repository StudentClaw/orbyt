# Phase 05 - Installation And Extension Management

Last updated: 2026-04-11

## Orientation Note

- Target feature: make curated extensions installable, enableable, disableable, and removable through the app
- Key dependencies: Phase 04 auth flow, bundled extension catalog, registry and lifecycle runtime
- Constraints and boundaries:
  - curated bundled extensions first
  - system gateway remains preinstalled and hidden from normal install UX
  - arbitrary custom local MCP support stays deferred
- Acceptance criteria for this increment:
  - bundled install works
  - enable and disable work
  - uninstall works for user-installed items
  - tool inventory updates live after state changes

## Beginning

### Objective

Turn the runtime into a real extension product surface without taking on arbitrary third-party command execution yet.

### Current State

- Discovery, lifecycle, routing, and auth should already exist from earlier phases.
- `packages/extensions/*` should now be treated as the bundled catalog source.

### Out Of Scope

- arbitrary custom command-based MCP definitions
- public extension marketplace
- remote MCP OAuth beyond what is necessary for current curated extensions

### Acceptance Criteria

- App ships with a bundled extension catalog.
- User can install Canvas and template from the app.
- Enable and disable update runtime state immediately.
- Uninstall stops the runtime and removes the installed bundle reference.

## Middle

### Implementation Slices

1. Define the bundled catalog build output location.
2. Add install flow:
   - copy or materialize extension bundle into the user extension store
   - register install metadata
3. Add enable and disable actions in Settings.
4. Add uninstall action for non-system extensions.
5. Emit live tool inventory updates after state changes.

### Primary Directories

- `packages/extensions/`
- `packages/electron/src/plugins/`
- `packages/ui/src/pages/`
- `packages/ui/src/components/`

### Verification Gates

- Unit:
  - install metadata write and read tests
  - state transition tests for enable, disable, uninstall
- Integration:
  - install bundled extension, start it, stop it, uninstall it
- Manual smoke:
  - install Canvas or template from the UI and watch the list update live
- Failure path:
  - partially failed install rolls back cleanly and does not leave a broken active entry

### Evidence To Capture

- install flow screenshot
- registry diff before and after install
- rollback evidence for failed install

## End

### Done When

- the app has a usable extension management surface
- bundled extensions can be installed and controlled without touching config files manually

### Handoff To Next Phase

Phase 06 should use the now-real install and auth flow to drive one production Canvas slice through the system.

### Risks To Carry Forward

- if install metadata is not version-aware, updates will become fragile later
- if UI actions and runtime actions are not transactional, state drift will appear under failure

### First Recommended Next Step

Start [Phase 06 - Canvas Vertical Slice](phase-06-canvas-vertical-slice.md).
