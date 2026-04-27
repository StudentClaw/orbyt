# Phase 01 - Thread Lifecycle Contracts And Command Surface

Last updated: 2026-04-22

## Orientation Note

- Target feature: add archive and unarchive as first-class thread lifecycle
  operations
- Key dependencies: [PLAN.md](../../internal/PLAN.md),
  [docs/architecture/01-shared-contracts.md](../../architecture/01-shared-contracts.md),
  [docs/architecture/03-local-server.md](../../architecture/03-local-server.md),
  [docs/architecture/04-react-ui.md](../../architecture/04-react-ui.md),
  [docs/implementation/thread-runtime-isolation/phase-00-contracts-and-renderer-state-separation.md](../thread-runtime-isolation/phase-00-contracts-and-renderer-state-separation.md)
- Constraints and boundaries:
  - keep delete as hard delete in this phase
  - do not add full runtime recovery yet
  - archived threads must not be normal send targets
  - public lifecycle semantics must be explicit before backend recovery work
- Acceptance criteria for this increment:
  - archive and unarchive exist as public thread operations
  - thread snapshot surface exposes archived state
  - archived-thread command invariants are enforced
  - renderer and routing consumers can see archived state distinctly

## Objective

Define and land the public lifecycle contract for reversible thread closure
before expanding runtime-binding behavior.

## Current State

- threads can be created, renamed, deleted, and used for sends
- snapshots do not expose archived state
- no RPC or orchestration command surface exists for archive or unarchive
- current thread behavior assumes a thread is either active history or deleted

## Out Of Scope

- resumable runtime bindings
- live-runtime recovery from persisted binding state
- lazy session attachment changes
- delete cleanup reactors
- archived history UI polish beyond what is needed for correctness

## Public Interface Changes

- add RPC methods:
  - `archiveThread(threadId)`
  - `unarchiveThread(threadId)`
- add orchestration domain events:
  - `thread.archived`
  - `thread.unarchived`
- extend thread snapshot and contracts with `archivedAt` or equivalent
- document archived-thread invariants for:
  - send
  - rename
  - access-mode changes
  - delete

## Behavior Priority

1. archive through the public orchestration surface
2. archived state visible in snapshot and renderer consumers
3. archived-thread send rejection
4. unarchive restores normal commandability
5. delete remains valid from archived state

## Tracer Bullet

Archive a thread through the public orchestration API and observe that the next
snapshot reports the thread as archived and no longer normal-sendable.

## Incremental Red -> Green Slices

1. Add the shared thread contract field for archived state and prove it flows
   through snapshot decoding.
2. Add archive command and event handling end to end.
3. Reject `sendTurn` for archived threads through the public orchestration API.
4. Add unarchive command and restore normal sendability.
5. Reject rename and access-mode mutation for archived threads unless the locked
   contract explicitly allows them.
6. Confirm delete still works from archived state.

## Refactor Gate

After archive and unarchive work end to end, consolidate lifecycle invariant
checks behind a small orchestration module or helper. Do not refactor while any
archive-flow tracer bullet is red.

## Verification Gates

- Unit:
  - thread contract accepts archived state metadata
  - lifecycle invariant helpers reject archived-thread send paths
- Integration:
  - archive then snapshot shows archived state
  - unarchive restores the same thread to active commandability
- Manual smoke:
  - archive a thread and confirm it no longer behaves like an active chat target
- Failure path:
  - archived-thread send rejects clearly without deleting or corrupting the
    thread

## Evidence To Capture

- passing contract or API tests for archive and unarchive
- one snapshot example containing archived thread state
- one failure-path result for archived-thread send rejection

## Done When

- archive and unarchive are first-class thread lifecycle operations
- archived state is visible in snapshots
- archived-thread invariants are enforced consistently

## First Recommended Next Step

Start
[Phase 02 - Durable Runtime Bindings And Session Recovery](phase-02-durable-runtime-bindings-and-session-recovery.md).
