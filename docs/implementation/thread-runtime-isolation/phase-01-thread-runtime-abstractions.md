# Phase 01 - Thread Runtime Abstractions

Last updated: 2026-04-16

## Orientation Note

- Target feature: introduce a thread-scoped Codex runtime abstraction that can own one process per thread
- Key dependencies: [PLAN.md](../../internal/PLAN.md), [docs/superpowers/specs/2026-04-16-thread-runtime-isolation-and-parallel-chat-design.md](../../superpowers/specs/2026-04-16-thread-runtime-isolation-and-parallel-chat-design.md), [docs/features/01-ai-harness.md](../../features/01-ai-harness.md), [docs/architecture/03-local-server.md](../../architecture/03-local-server.md)
- Constraints and boundaries:
  - keep admission logic simple in this phase
  - do not enable parallel work beyond the current behavior yet
  - keep one runtime bound to one thread only
  - preserve current approval, tool-call, and interrupt semantics inside each runtime
- Acceptance criteria for this increment:
  - a server abstraction exists for thread-owned Codex processes
  - one runtime instance can stream one thread end-to-end without using the shared global Codex process path
  - provider thread id and session state are owned by the runtime instance, not shared globally

## Beginning

### Objective

Refactor the Codex harness boundary so orchestration can start treating runtimes as per-thread resources rather than one global singleton.

### Current State

- `CodexCli` is currently modeled as one long-lived shared app-server process.
- provider-thread mappings and active turns live in shared maps inside that singleton.
- orchestration assumes one runtime lane and a single queue drain loop.

### Out Of Scope

- `max 4` admission rules
- queued scheduling
- warm-slot reuse across admissions
- LRU eviction
- shutdown reconciliation

### Acceptance Criteria

- a thread-runtime interface exists that can:
  - initialize a thread-owned Codex process
  - stream one turn
  - interrupt one active turn
  - expose pending approvals for that thread
  - shut down cleanly
- orchestration can target this new interface without depending on global mutable provider maps
- tests prove one isolated runtime can execute a thread correctly

## Middle

### Implementation Slices

1. Extract the current `CodexCli` process logic into a reusable runtime instance type, for example `CodexThreadRuntime`.
2. Move provider-thread id tracking, pending approvals, and active-turn maps from global singleton state into that instance.
3. Introduce a manager-facing interface that can create and dispose thread runtimes.
4. Keep a compatibility path so current orchestration can still run with one runtime while the new abstraction is being introduced.
5. Add focused tests around isolated runtime behavior:
   - thread session creation
   - token streaming
   - approval routing
   - interrupt
   - shutdown

### Primary Directories

- `packages/server/src/ai/`
- `packages/server/src/orchestration/`
- `packages/server/src/__tests__/`

### Verification Gates

- Unit:
  - runtime instance maps provider events only to its own thread
  - approval resolution cannot cross threads
- Integration:
  - one thread can execute end-to-end through the new runtime abstraction
- Manual smoke:
  - one normal chat thread still works after the refactor
- Failure path:
  - runtime startup failure is surfaced as a typed error and does not corrupt another thread's state

### Evidence To Capture

- passing runtime-instance tests
- one trace showing thread-local approval or token routing
- one note confirming no cross-thread provider mapping remains in shared singleton state

## End

### Done When

- orchestration has a thread-runtime abstraction it can schedule against
- a runtime instance owns its own process and provider session state
- the global shared-process assumption is removed from the main execution path

### Handoff To Next Phase

Phase 02 can start once orchestration can create thread runtimes on demand.

### Risks To Carry Forward

- if shared maps remain reachable from the new instance path, later phases can still leak state across threads
- if backward-compatibility glue is too large, admission-control work will become harder to reason about

### First Recommended Next Step

Start [Phase 02 - Admission Control And Parallel Execution](phase-02-admission-control-and-parallel-execution.md).
