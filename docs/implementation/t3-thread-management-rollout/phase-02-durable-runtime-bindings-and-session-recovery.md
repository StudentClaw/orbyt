# Phase 02 - Durable Runtime Bindings And Session Recovery

Last updated: 2026-04-22

## Orientation Note

- Target feature: strengthen runtime-binding persistence so a thread can adopt
  or recreate its provider session intentionally
- Key dependencies: [PLAN.md](../../../PLAN.md),
  [docs/architecture/03-local-server.md](../../architecture/03-local-server.md),
  [docs/features/01-ai-harness.md](../../features/01-ai-harness.md),
  [phase-01-thread-lifecycle-contracts-and-command-surface.md](phase-01-thread-lifecycle-contracts-and-command-surface.md)
- Constraints and boundaries:
  - keep `ThreadRuntimeManager` as the live-runtime owner
  - recovery must not silently create a new thread record
  - stop-session semantics must remain distinct from delete-thread semantics
  - do not migrate to event-authoritative projections in this phase
- Acceptance criteria for this increment:
  - runtime bindings persist enough metadata to support recovery decisions
  - public flows can adopt an existing live runtime or resume from a binding
  - missing resumability data fails clearly
  - stop-session behavior preserves the thread

## Objective

Turn `provider_runtime_sessions` into a durable runtime-binding record that can
support intentional stop and recovery flows.

## Current State

- thread persistence and runtime-session persistence are partially conflated
- `provider_runtime_sessions` stores status and some runtime payload data, but
  not a clearly documented resumability contract
- current flow assumes the live runtime path more than the durable binding path
- stop-session behavior is not yet a first-class user-facing lifecycle concept

## Out Of Scope

- thread creation semantics
- lazy session attachment
- delete cleanup reactors
- renderer archive-history behavior

## Public Interface Changes

- strengthen runtime-binding persistence with fields such as:
  - `lastSeenAt`
  - `resumeCursor`
  - richer `runtimePayload`
  - `runtimeMode` if recovery requires it
- add or document stop-session behavior as distinct from delete-thread
- define recovery contract for:
  - adopt-existing live runtime
  - resume-from-binding
  - explicit failure when resumability data is missing

## Behavior Priority

1. stop a session without deleting the thread
2. send again and recover the same thread through public orchestration flow
3. adopt existing live runtime when available
4. resume from persisted binding when live runtime is absent
5. fail clearly when recovery data is incomplete

## Tracer Bullet

Stop a thread session, then send again through the public flow and recover the
same thread without creating a replacement thread record.

## Incremental Red -> Green Slices

1. Extend runtime-binding persistence and decoding contracts.
2. Add explicit stop-session orchestration behavior that preserves the thread.
3. Recover by adopting an already-live runtime when one still exists.
4. Recover by recreating provider session state from persisted binding data.
5. Surface a clear failure when no resumability data exists.
6. Refresh provider-thread and binding metadata after successful recovery.

## Refactor Gate

After both adopt-existing and resume-from-binding paths are green, extract the
routing decision into one small recovery module. Do not refactor while recovery
branches are still diverging under failing tests.

## Verification Gates

- Unit:
  - runtime-binding contract persists and decodes the recovery fields
  - recovery decision logic distinguishes live, resumable, and missing-binding
    states
- Integration:
  - stop session then send again recovers the same thread
  - provider binding refreshes after recovery
- Manual smoke:
  - stop a session from a used thread and continue the same conversation later
- Failure path:
  - missing resume cursor leaves the thread intact and returns a clear recovery
    failure

## Evidence To Capture

- passing recovery-path tests
- one trace of adopt-existing runtime behavior
- one trace of resume-from-binding behavior
- one failure example for missing resumability data

## Done When

- runtime bindings are durable enough to support recovery decisions
- stop-session semantics are distinct from delete-thread semantics
- public recovery behavior is explicit, deterministic, and test-covered

## First Recommended Next Step

Start
[Phase 03 - Thread Runtime Separation And Lazy Session Attachment](phase-03-thread-runtime-separation-and-lazy-session-attachment.md).
