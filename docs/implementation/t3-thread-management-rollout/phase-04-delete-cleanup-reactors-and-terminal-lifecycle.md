# Phase 04 - Delete Cleanup Reactors And Terminal Lifecycle

Last updated: 2026-04-22

## Orientation Note

- Target feature: make thread delete cleanup explicit, complete, and future-safe
- Key dependencies: [PLAN.md](../../internal/PLAN.md),
  [docs/architecture/03-local-server.md](../../architecture/03-local-server.md),
  [phase-03-thread-runtime-separation-and-lazy-session-attachment.md](phase-03-thread-runtime-separation-and-lazy-session-attachment.md)
- Constraints and boundaries:
  - delete remains a permanent operation
  - cleanup must cover queued, active, and warm runtime state
  - cleanup responsibilities should not remain hidden in unrelated orchestration
    paths
  - do not adopt full event-authoritative projections in this phase
- Acceptance criteria for this increment:
  - delete contract is explicit about cleanup responsibilities
  - runtime and queued-turn cleanup happen reliably for deleted threads
  - terminal or thread-scoped session history cleanup is covered
  - cleanup behavior is testable through public orchestration and manager paths

## Objective

Move thread-delete side effects toward an explicit cleanup-reactor model so
delete behavior is deterministic and extensible.

## Current State

- delete logic already removes thread data and disposes runtime state inline
- queued-turn cleanup and runtime cleanup are handled directly in service logic
- terminal cleanup is not yet framed as part of one explicit thread-delete
  lifecycle contract

## Out Of Scope

- archive and unarchive behavior
- runtime-binding recovery
- UI archived-history behavior
- event-authoritative projections

## Public Interface Changes

- define delete lifecycle contract explicitly:
  - emit `thread.deleted`
  - remove queued turns for the thread
  - dispose active or warm runtime ownership for the thread
  - clean thread-scoped terminal or session history if present
  - remove persisted thread-visible data
- introduce a cleanup reactor abstraction or equivalent explicit lifecycle owner
  for delete side effects

## Behavior Priority

1. delete through public orchestration API removes the thread
2. runtime ownership for the deleted thread is gone
3. queued work for the deleted thread is gone
4. warm runtime ownership for the deleted thread is gone
5. terminal history for the deleted thread is cleaned intentionally

## Tracer Bullet

Delete a thread through the public API and observe both thread disappearance and
runtime disposal for that thread.

## Incremental Red -> Green Slices

1. Lock the delete lifecycle contract in tests through the public API.
2. Move queued-turn cleanup into the explicit delete cleanup path.
3. Move active and warm runtime disposal into the explicit cleanup path.
4. Add terminal or session-history cleanup responsibility.
5. Add cleanup-failure logging or non-corrupting fallback behavior.

## Refactor Gate

After delete cleanup is green across queued, active, and warm paths, extract the
cleanup orchestration behind a dedicated reactor or equivalent service. Do not
refactor while delete behavior still relies on fragile mixed responsibilities.

## Verification Gates

- Unit:
  - delete cleanup path disposes runtime ownership for one thread only
  - queued-turn cleanup path removes only the deleted thread's queued work
- Integration:
  - deleting a thread clears thread data plus runtime and queue state
  - deleting a thread with warm ownership clears warm runtime state
- Manual smoke:
  - delete an active or recently used thread and confirm it disappears cleanly
- Failure path:
  - cleanup failure logs clearly without leaving partially deleted thread state
    visible to the user

## Evidence To Capture

- passing delete cleanup tests
- one trace showing active or warm runtime disposal on delete
- one trace showing queued-turn cleanup on delete
- one cleanup-failure example or log contract

## Done When

- delete behavior has an explicit cleanup contract
- queued, active, warm, and terminal cleanup responsibilities are covered
- delete side effects are easier to reason about than the prior inline-only path

## First Recommended Next Step

Start
[Phase 05 - UI, Snapshot, History, And Hardening](phase-05-ui-snapshot-history-and-hardening.md).
