# Phase 0 Stabilization Design

Date: 2026-04-07
Status: Approved in chat, pending implementation

## Goal

Complete the Phase 0 foundation work so the repository satisfies the existing verification checklist with real, repeatable command passes instead of partial or placeholder implementations.

Phase 0 is considered complete when the local stack builds, typechecks, tests, and boots through the expected development entrypoints:

- `bun run build:shared`
- `bun run typecheck`
- `bun run test`
- `bun run dev:server`
- `bun run dev:ui`
- `bun run dev:electron`

## Non-goals

- No Phase 1 chat implementation beyond Phase 0 plumbing
- No new product scope for Canvas, planner, memory, or notifications
- No UI redesign beyond fixing Phase 0 verification blockers
- No speculative refactors unrelated to the blocked checks

## Problem Summary

The current codebase contains a substantial portion of the intended Phase 0 scaffolding, but it does not yet meet the operational acceptance criteria.

The main gaps are:

1. `@orbyt/shared` is not reliably consumable by downstream workspaces.
2. Cross-cutting typecheck is failing in both server and UI.
3. Server runtime verification is blocked because the server cannot boot cleanly.
4. Electron Phase 0 helpers exist, but the main process is still a placeholder and the dev command fails before startup.
5. Documentation and checklist state have drifted ahead of verified behavior.

## Success Criteria

The stabilization pass succeeds when all of the following are true:

- Shared contracts build into a consumable workspace package with usable root entrypoints.
- Server imports `@orbyt/shared` cleanly in dev, typecheck, and tests.
- Server boots on the configured port, creates the SQLite database, runs migration 1, and responds to `health.ping`.
- UI typecheck passes without changing the existing Phase 0 shell scope.
- Electron dev startup launches the app shell, starts the server child process, registers IPC, and loads the renderer.
- The existing root and package-level verification commands complete successfully.
- Phase tracking documentation is updated to reflect verified completion state.

## Constraints

- Favor the fastest path to a genuinely green Phase 0 verification run.
- Packaging-level fixes are allowed where needed, especially in `@orbyt/shared`.
- Keep implementation focused on current findings and Phase 0 acceptance.
- Preserve the existing architecture direction unless a packaging or startup fix requires a small structural adjustment.

## Proposed Approach

### 1. Shared package stabilization

Make `@orbyt/shared` a reliable internal package for Bun, TypeScript, and downstream workspaces.

This work includes:

- verify why the built package root entrypoints are missing or unusable,
- fix build/package metadata so the root package entry resolves consistently,
- add or adjust package exports if required for stable workspace consumption,
- confirm downstream imports work from both `packages/server` and `packages/electron`.

This is the first dependency because server and Electron both rely on it.

### 2. Cross-cutting compile health

Fix only the concrete compile-time issues blocking Phase 0 verification.

Known examples:

- SQLite parameter typing in `packages/server/src/db/Database.ts`
- router typing once shared imports resolve cleanly
- UI `Spinner` prop typing in `packages/ui/src/components/ui/spinner.tsx`

This step keeps scope tight: resolve failures that prevent `bun run typecheck` and `bun run test` from passing, without expanding product behavior.

### 3. Server runtime verification

Once the shared package and compile issues are resolved, make the server path operational against the existing Phase 0 acceptance.

Expected outcome:

- `bun run dev:server` starts on the configured port,
- SQLite DB file is created at the configured path,
- migration 1 is applied,
- the WebSocket server accepts a connection,
- `health.ping` returns `health.pong`,
- invalid JSON returns an error event,
- server tests pass.

The implementation should remain intentionally minimal and keep the router focused on current Phase 0 behavior.

### 4. Electron completion

Convert the placeholder Electron shell into a working Phase 0 main-process bootstrap.

This includes:

- create the `BrowserWindow`,
- load the renderer in development and production,
- spawn the local server child process,
- run the health-check flow before exposing the app as ready,
- register IPC handlers with the active server port,
- create the tray and menu,
- terminate the child server process during shutdown,
- fix the `electron-vite` configuration so `bun run dev:electron` becomes a valid verification path.

The goal is not feature depth. The goal is a dependable local shell that proves the three-tier path exists.

### 5. Documentation reconciliation

After implementation, rerun the verification commands and update tracking docs to reflect actual state.

Documentation outputs:

- update `docs/checklist/V1-PHASE-TRACKER.md`,
- update any Phase 0 checklist items that can now be marked as verified,
- preserve a distinction between completed, partially complete, and later-phase work.

## Verification Plan

The implementation is verified using the existing repo commands and current checklist expectations:

- `bun install`
- `bun run build:shared`
- `bun run typecheck`
- `bun test --cwd packages/shared`
- `bun test --cwd packages/server`
- `bun --cwd packages/ui vitest run`
- `bun run dev:server`
- `bun run dev:ui`
- `bun run dev:electron`
- `bun run test`

If a command still fails, the remaining gap must be fixed or explicitly documented before Phase 0 is considered complete.

## Risks and Mitigations

### Workspace package resolution remains inconsistent

Mitigation:

- fix the problem at the shared package metadata/build layer instead of adding consumer-specific import hacks.

### Electron startup depends on multiple local processes

Mitigation:

- keep the startup flow simple,
- use explicit server-port passing,
- keep health-check logic narrow and deterministic,
- fail early with actionable logs when startup does not complete.

### Verification drift returns after code changes

Mitigation:

- use the documented command set as the source of truth,
- update the tracker immediately after re-verification,
- avoid marking checklist items complete without a successful run.

## Implementation Order

1. Fix `@orbyt/shared` packaging and resolution.
2. Fix remaining typecheck blockers in server and UI.
3. Re-run shared, server, and root verification commands.
4. Implement and verify Electron main-process startup.
5. Re-run the full Phase 0 command set.
6. Update tracker and checklist documentation to match verified state.

## Out of Scope Decisions

- We are not redefining the Phase 0 checklist.
- We are not adding Phase 1 features during this pass.
- We are not treating placeholder UI content as a bug unless it blocks Phase 0 acceptance.

## Expected Deliverables

- Reliable `@orbyt/shared` workspace package behavior
- Passing Phase 0 typecheck and test commands
- Runnable server development entrypoint
- Runnable Electron development entrypoint
- Updated phase tracking documentation
