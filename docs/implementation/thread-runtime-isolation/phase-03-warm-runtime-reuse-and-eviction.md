# Phase 03 - Warm Runtime Reuse And Eviction

Last updated: 2026-04-16

## Orientation Note

- Target feature: keep finished thread runtimes warm and reuse them for later turns in the same thread, with LRU eviction under pressure
- Key dependencies: [PLAN.md](../../../PLAN.md), [docs/superpowers/specs/2026-04-16-thread-runtime-isolation-and-parallel-chat-design.md](../../superpowers/specs/2026-04-16-thread-runtime-isolation-and-parallel-chat-design.md), [docs/features/01-ai-harness.md](../../features/01-ai-harness.md), [docs/architecture/03-local-server.md](../../architecture/03-local-server.md)
- Constraints and boundaries:
  - warm reuse must stay within the same thread only
  - active runtimes must never be evicted
  - eviction must fully clear runtime ownership before reassignment
  - do not add idle TTL logic in this phase
- Acceptance criteria for this increment:
  - completed threads leave behind warm idle runtimes
  - the same thread can reuse its warm runtime on a later turn
  - when capacity is exhausted, the least-recently-used warm idle runtime is evicted
  - active runtimes are never chosen for eviction

## Beginning

### Objective

Reduce follow-up latency for repeated turns in the same thread without giving up isolation or admission fairness.

### Current State

- after Phase 02, threads can run in parallel but runtime processes are still likely one-turn resources
- there is no slot lifecycle beyond active execution

### Out Of Scope

- shutdown and restart reconciliation
- exposing extensive runtime metrics in the UI
- adaptive idle TTL tuning

### Acceptance Criteria

- manager tracks warm idle state and `lastUsedAt`
- admission prefers same-thread warm reuse before starting a new process
- the least-recently-used warm idle runtime is evicted when a queued thread needs capacity
- eviction cannot route another thread into the previous thread's provider session accidentally

## Middle

### Implementation Slices

1. Extend slot state to include `warm-idle` and `lastUsedAt`.
2. Move completed threads from active to warm-idle rather than destroying their runtime immediately.
3. Update admission to check for same-thread warm reuse first.
4. Add LRU selection logic for warm-idle eviction when:
   - all `4` slots are occupied
   - at least one slot is warm-idle
5. Ensure eviction fully shuts down the old runtime and clears thread-session ownership before creating a runtime for the waiting thread.
6. Update interrupt and completion flows so they preserve or destroy warm runtimes intentionally.

### Primary Directories

- `packages/server/src/orchestration/`
- `packages/server/src/ai/`
- `packages/server/src/__tests__/`

### Verification Gates

- Unit:
  - same-thread follow-up work reuses a warm runtime
  - LRU chooses the oldest warm idle slot
  - active slots are excluded from eviction
- Integration:
  - a queued thread starts after eviction of a warm idle runtime
  - provider-thread ownership does not leak across eviction boundaries
- Manual smoke:
  - run a thread, let it complete, then send again and verify noticeably faster startup
  - hold four slots, leave one warm idle, then start another thread and confirm the warm idle slot is the one reclaimed
- Failure path:
  - if eviction shutdown fails, the queued thread remains queued and no partially reassigned slot is exposed

### Evidence To Capture

- passing warm-reuse and eviction tests
- one trace showing reuse of a thread's own warm runtime
- one trace showing LRU eviction under pressure

## End

### Done When

- warm idle reuse exists for the same thread
- LRU eviction under capacity pressure works correctly
- runtime ownership remains isolated even during eviction

### Handoff To Next Phase

Phase 04 can start once runtime lifecycle is stable for active, queued, and warm idle states.

### Risks To Carry Forward

- if `lastUsedAt` updates are inconsistent, eviction fairness will drift
- if slot cleanup is incomplete, startup reconciliation will be much harder to trust

### First Recommended Next Step

Start [Phase 04 - Shutdown Recovery And Hardening](phase-04-shutdown-recovery-and-hardening.md).
