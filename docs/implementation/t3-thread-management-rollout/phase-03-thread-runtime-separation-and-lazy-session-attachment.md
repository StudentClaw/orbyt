# Phase 03 - Thread Runtime Separation And Lazy Session Attachment

Last updated: 2026-04-22

## Orientation Note

- Target feature: let a thread exist independently from a meaningful runtime
  attachment and create runtime bindings only when needed
- Key dependencies: [PLAN.md](../../internal/PLAN.md),
  [docs/architecture/03-local-server.md](../../architecture/03-local-server.md),
  [phase-02-durable-runtime-bindings-and-session-recovery.md](phase-02-durable-runtime-bindings-and-session-recovery.md)
- Constraints and boundaries:
  - preserve current `ThreadRuntimeManager`
  - thread creation must remain lightweight
  - session attachment should happen lazily on real runtime need, not on thread
    creation alone
  - access-mode and workspace rebinding must stay compatible with the stronger
    runtime-binding model
- Acceptance criteria for this increment:
  - threads can be created without requiring an immediately meaningful session
  - runtime binding creation or refresh happens lazily
  - access-mode and workspace reset flows preserve clean thread/runtime
    separation

## Objective

Separate thread existence from runtime attachment so thread records are durable
conversation objects and runtime bindings are demand-driven lifecycle
attachments.

## Current State

- thread creation currently writes both thread and provider-session rows
- runtime binding state is initialized eagerly even before the thread does any
  useful runtime work
- access-mode and workspace relink flows already reset runtime-side state but
  are still shaped by eager binding assumptions

## Out Of Scope

- delete cleanup reactors
- archived-thread renderer polish
- full projection-backed read models

## Public Interface Changes

- document `createThread` as thread-record creation, not live-session creation
- update runtime-binding semantics so first real runtime need can create or
  refresh the binding
- keep access-mode and workspace rebinding public behavior stable while
  changing the runtime-binding timing behind it

## Behavior Priority

1. create a thread without requiring live runtime ownership
2. first send lazily creates or refreshes the runtime binding
3. access-mode change cleanly resets runtime-side state without harming the
   thread record
4. workspace relink or rebind resets runtime-side state compatibly

## Tracer Bullet

Create a thread and confirm no live runtime is required before the first send,
then send once and observe runtime binding creation on demand.

## Incremental Red -> Green Slices

1. Stop treating thread creation as proof of meaningful runtime attachment.
2. Move runtime-binding creation or refresh into the first real runtime path.
3. Verify first-send behavior still queues and starts correctly with lazy
   attachment.
4. Re-check access-mode reset behavior under the new separation.
5. Re-check workspace relink or rebind behavior under the new separation.

## Refactor Gate

After lazy attachment is green, extract any duplicated "ensure runtime binding"
logic into one small orchestration path. Do not refactor before first-send lazy
attachment works end to end.

## Verification Gates

- Unit:
  - thread creation no longer requires meaningful live-session ownership
  - lazy binding helper creates or refreshes state only when needed
- Integration:
  - create thread then first send produces on-demand binding creation
  - access-mode reset still leaves the thread usable
- Manual smoke:
  - create a fresh thread and confirm it behaves normally on first send without
    pre-start session assumptions
- Failure path:
  - lazy-binding creation failure leaves the thread record intact and reports a
    clear runtime-side error

## Evidence To Capture

- passing tests for thread creation and first-send lazy attachment
- one trace showing no pre-existing live runtime requirement
- one trace showing access-mode or workspace reset still working after the
  separation

## Done When

- thread creation is decoupled from meaningful runtime attachment
- runtime bindings are created or refreshed lazily
- access-mode and workspace reset flows remain correct under the new model

## First Recommended Next Step

Start
[Phase 04 - Delete Cleanup Reactors And Terminal Lifecycle](phase-04-delete-cleanup-reactors-and-terminal-lifecycle.md).
