# Phase 05 - UI, Snapshot, History, And Hardening

Last updated: 2026-04-22

## Orientation Note

- Target feature: finish the rollout with renderer parity, snapshot parity, and
  lifecycle hardening
- Key dependencies: [PLAN.md](../../internal/PLAN.md),
  [docs/architecture/04-react-ui.md](../../architecture/04-react-ui.md),
  [phase-01-thread-lifecycle-contracts-and-command-surface.md](phase-01-thread-lifecycle-contracts-and-command-surface.md),
  [phase-02-durable-runtime-bindings-and-session-recovery.md](phase-02-durable-runtime-bindings-and-session-recovery.md),
  [phase-04-delete-cleanup-reactors-and-terminal-lifecycle.md](phase-04-delete-cleanup-reactors-and-terminal-lifecycle.md)
- Constraints and boundaries:
  - renderer must reflect real lifecycle state, not infer it loosely
  - archived threads must not be accidental send targets
  - restart behavior must stay deterministic
  - deferred projection parity and rollback or revert work must remain deferred
- Acceptance criteria for this increment:
  - snapshot and renderer represent archived and unarchived thread behavior
  - archived threads are not treated as active-sendable by default
  - restart and recovery behavior is hardened around the stronger binding model
  - the rollout closes with explicit deferred follow-up notes

## Objective

Close the rollout by aligning snapshot and UI behavior with the expanded thread
lifecycle and proving the final lifecycle model is stable.

## Current State

- queued, streaming, interrupted, and completed semantics already exist from the
  predecessor runtime-isolation work
- archive and unarchive renderer behavior does not yet exist
- stronger runtime-binding recovery and delete cleanup behavior need final
  renderer and hardening coverage

## Out Of Scope

- full event-authoritative projection migration
- rollback or revert support
- UI redesign beyond what is needed for lifecycle correctness

## Public Interface Changes

- snapshot and renderer consumers must understand archived and unarchived thread
  state
- sidebar or history behavior for archived threads must be documented and
  implemented consistently
- final rollout docs must record the deferred follow-up for projection parity
  and rollback or revert work

## Behavior Priority

1. archived thread is no longer treated as active-sendable
2. unarchive restores active visibility and normal targeting
3. delete-from-archived works cleanly
4. stop-session without thread loss remains visible and understandable
5. restart with persisted runtime bindings stays deterministic

## Tracer Bullet

Archive a thread and confirm the next snapshot and renderer state no longer
treat it as an active-sendable chat target.

## Incremental Red -> Green Slices

1. Update snapshot consumers and chat-history or selection helpers for archived
   state.
2. Add archived-thread visibility behavior in the renderer and lock the chosen
   default in tests and docs.
3. Verify unarchive restores active behavior.
4. Verify delete-from-archived behavior.
5. Verify stop-session then reopen or resend keeps the thread while resetting
   runtime-side state.
6. Add restart and stale-binding hardening around the final lifecycle model.

## Refactor Gate

After archived visibility and send blocking are green, consolidate renderer
state derivation behind existing snapshot or selection helpers rather than
duplicating archive checks across components. Do not refactor while UI behavior
still disagrees with snapshot truth.

## Verification Gates

- Unit:
  - snapshot and chat-history helpers treat archived threads as non-sendable by
    default
  - restart reconciliation preserves thread history while respecting binding
    semantics
- Integration:
  - archive, unarchive, stop-session, and delete-from-archived flows all work
    through public RPC and orchestration paths
  - restart does not auto-promote archived or stale runtime state incorrectly
- Manual smoke:
  - archive thread, unarchive thread, delete archived thread, stop session, then
    continue same thread
- Failure path:
  - archived-thread send path rejects clearly even after restart or stale-state
    reconciliation

## Evidence To Capture

- passing renderer and orchestration tests for archived-thread behavior
- one snapshot example showing archived state
- one restart-reconciliation note with persisted runtime bindings
- one explicit deferred follow-up note for projection parity and rollback or
  revert support

## Done When

- renderer and snapshot behavior match the expanded lifecycle model
- archived threads are not accidental active targets
- restart and recovery behavior is hardened for the final rollout scope
- deferred follow-up is recorded clearly at rollout closeout

## First Recommended Next Step

No further phase is required for core lifecycle parity. Remaining work, if
needed, is a separate rollout for event-authoritative projection parity and
rollback or revert support.
