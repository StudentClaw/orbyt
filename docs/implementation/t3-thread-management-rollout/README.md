# T3 Thread Management Rollout

Last updated: 2026-04-22

This docs package is the implementation source of truth for bringing Orbyt's
thread lifecycle closer to `t3code` core lifecycle behavior.

It exists because the repo already has thread-runtime isolation work under
[docs/implementation/thread-runtime-isolation/](../thread-runtime-isolation/README.md),
but that rollout stops short of the broader thread-management lifecycle now
needed: archive and unarchive, durable resumable runtime bindings, clean thread
versus runtime separation, deterministic delete cleanup, and renderer parity for
those lifecycle states.

This rollout does not attempt full architectural parity with `t3code`. Event-
authoritative projections and rollback or revert flows are explicitly deferred.

## How To Use These Plans

1. Start with [GLOSSARY.md](GLOSSARY.md) to see current status, shared
   vocabulary, and the handoff record.
2. Read the predecessor runtime-isolation package for prior implementation
   context:
   [docs/implementation/thread-runtime-isolation/README.md](../thread-runtime-isolation/README.md).
3. Work phases in order unless a later phase explicitly says it can start in
   parallel.
4. Before coding a phase, read that phase's Orientation Note and follow the
   required Beginning -> Middle -> End flow from [PLAN.md](../../../PLAN.md).
5. Do not mark a phase complete until its verification gates are green and its
   handoff notes are recorded in [GLOSSARY.md](GLOSSARY.md).

## Phase Order

- [Phase 00 - Rollout Scaffold And State Audit](phase-00-rollout-scaffold-and-state-audit.md)
- [Phase 01 - Thread Lifecycle Contracts And Command Surface](phase-01-thread-lifecycle-contracts-and-command-surface.md)
- [Phase 02 - Durable Runtime Bindings And Session Recovery](phase-02-durable-runtime-bindings-and-session-recovery.md)
- [Phase 03 - Thread Runtime Separation And Lazy Session Attachment](phase-03-thread-runtime-separation-and-lazy-session-attachment.md)
- [Phase 04 - Delete Cleanup Reactors And Terminal Lifecycle](phase-04-delete-cleanup-reactors-and-terminal-lifecycle.md)
- [Phase 05 - UI, Snapshot, History, And Hardening](phase-05-ui-snapshot-history-and-hardening.md)

## Planning Principles For This Rollout

- Keep `ThreadRuntimeManager` as the runtime owner.
- Treat a thread record and a runtime binding as different lifecycle objects.
- Prefer reversible archive and unarchive behavior over delete when the user
  only wants a thread out of the active path.
- Make session stop semantics distinct from thread delete semantics.
- Keep renderer state aligned with real server lifecycle state instead of
  guessing from global provider status.
- Land every phase in TDD-friendly vertical slices with one tracer bullet test
  first and no horizontal "write all tests first" planning.
- Defer full event-sourced projections and rollback or revert support until the
  core lifecycle parity is complete and stable.

## Deliverables Across The Full Rollout

- archive and unarchive as first-class thread lifecycle operations
- durable runtime-binding persistence with resumability data
- recovery paths that can adopt an existing live runtime or recreate one from a
  persisted binding
- thread creation that does not require an immediately meaningful live provider
  session
- deterministic delete cleanup across queued, active, warm, and terminal state
- renderer and snapshot parity for archived and unarchived thread behavior
- explicit documentation of deferred follow-up for event-authoritative
  projections and rollback or revert support
