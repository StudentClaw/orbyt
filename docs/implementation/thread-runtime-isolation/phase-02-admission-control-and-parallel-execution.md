# Phase 02 - Admission Control And Parallel Execution

Last updated: 2026-04-16

## Orientation Note

- Target feature: admit up to `4` isolated thread runtimes in parallel and queue the rest
- Key dependencies: [PLAN.md](../../internal/PLAN.md), [docs/superpowers/specs/2026-04-16-thread-runtime-isolation-and-parallel-chat-design.md](../../superpowers/specs/2026-04-16-thread-runtime-isolation-and-parallel-chat-design.md), [docs/features/01-ai-harness.md](../../features/01-ai-harness.md), [docs/architecture/03-local-server.md](../../architecture/03-local-server.md)
- Constraints and boundaries:
  - concurrency cap must be enforced in one manager only
  - block re-entry within the same thread
  - preserve FIFO ordering for queued thread admissions
  - do not implement warm-slot eviction yet
- Acceptance criteria for this increment:
  - up to `4` threads can stream at once
  - the fifth and later threads remain queued
  - a thread with a queued or streaming turn rejects a new send
  - queued work is promoted to started work only when a slot is assigned

## Beginning

### Objective

Replace the current single serialized work queue with a thread-aware admission manager that can run isolated work in parallel.

### Current State

- orchestration uses one queue drain loop
- turn acceptance and turn start are still too close together
- thread-level re-entry blocking is not enforced by the backend

### Out Of Scope

- warm-idle reuse
- LRU eviction
- shutdown and restart reconciliation
- runtime count observability beyond what is needed to debug admission

### Acceptance Criteria

- a `ThreadRuntimeManager` or equivalent owns:
  - active runtime count
  - queued admission order
  - thread occupancy checks
- `sendTurn` persists queued work and returns immediately
- turn promotion from queued to streaming happens asynchronously through admission
- four independent threads can make progress in parallel

## Middle

### Implementation Slices

1. Add a manager that tracks:
   - active thread runtimes
   - queued thread admissions
   - current thread occupancy
2. Update `sendTurn` to:
   - reject thread-busy cases
   - persist queued turn state
   - enqueue for admission
3. Update admission flow to:
   - start a thread runtime when active count is below `4`
   - emit `turn.started` only after a slot is granted
   - keep overflow work in FIFO queue
4. Update interrupt logic for queued turns so they can be removed before runtime start.
5. Update tests and manual verification to prove real parallelism rather than global serialization.

### Primary Directories

- `packages/server/src/orchestration/`
- `packages/server/src/ai/`
- `packages/server/src/ws/`
- `packages/server/src/__tests__/`

### Verification Gates

- Unit:
  - manager admits four threads and queues the fifth
  - same-thread re-entry is rejected while queued
  - same-thread re-entry is rejected while streaming
- Integration:
  - multiple threads can receive independent token streams concurrently
  - interrupting a queued thread removes it from the queue cleanly
- Manual smoke:
  - start five chats and confirm four stream while one stays queued
  - send in one idle thread while another streams and confirm both can progress independently
- Failure path:
  - if one runtime fails, only that thread is interrupted or errored and the manager continues admitting other queued work

### Evidence To Capture

- test output proving the `4`-slot cap
- one trace of queued to started promotion
- one trace of same-thread send rejection

## End

### Done When

- real parallel execution exists up to `4` active threads
- thread re-entry blocking is enforced on the server
- queued turns wait for slots instead of pretending to stream

### Handoff To Next Phase

Phase 03 can start once the manager can run isolated thread work in parallel and maintain a clean queued backlog.

### Risks To Carry Forward

- if the queue is not strictly FIFO, later warm-slot behavior may feel unfair
- if turn-start emission is still too early, the UI will regress even with admission control in place

### First Recommended Next Step

Start [Phase 03 - Warm Runtime Reuse And Eviction](phase-03-warm-runtime-reuse-and-eviction.md).
