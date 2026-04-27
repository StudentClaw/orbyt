# Phase 00 - Contracts And Renderer State Separation

Last updated: 2026-04-16

## Orientation Note

- Target feature: add explicit queued semantics and remove shared chat-busy status leakage in the renderer
- Key dependencies: [PLAN.md](../../internal/PLAN.md), [docs/superpowers/specs/2026-04-16-thread-runtime-isolation-and-parallel-chat-design.md](../../superpowers/specs/2026-04-16-thread-runtime-isolation-and-parallel-chat-design.md), [docs/architecture/01-shared-contracts.md](../../architecture/01-shared-contracts.md), [docs/architecture/03-local-server.md](../../architecture/03-local-server.md), [docs/architecture/04-react-ui.md](../../architecture/04-react-ui.md)
- Constraints and boundaries:
  - do not introduce per-thread Codex processes yet
  - do not land parallel execution yet
  - do not silently map `queued` to `streaming`
  - preserve existing app-level auth and offline handling
- Acceptance criteria for this increment:
  - shared contracts support `queued` thread and turn state
  - orchestration events distinguish `turn.queued` from `turn.started`
  - renderer chat state is resolved from thread-local state instead of global provider streaming status
  - queued turns render as queued, not active thinking

## Beginning

### Objective

Create the state-model foundation for isolated parallel chat without changing the runtime execution model yet.

### Current State

- `OrchestrationThread.status` does not support `queued`.
- `OrchestrationTurn.status` uses `pending`, but renderer code currently treats pending and global provider streaming as equivalent to active work.
- `resolveChatState` allows one thread's provider activity to make all threads appear busy.
- `turn.started` is currently emitted when a turn is merely accepted, not when it actually begins execution.

### Out Of Scope

- per-thread Codex runtime ownership
- concurrency cap enforcement
- warm runtime reuse
- LRU eviction
- shutdown process lifecycle changes

### Acceptance Criteria

- Shared schemas in `packages/contracts` and any dependent re-exports support `queued`.
- Domain-event handling in `packages/ui/src/rpc/orchestrationState.ts` can represent queued and started as different transitions.
- Chat UI surfaces a distinct queued state for the active thread.
- Sidebar and message rendering no longer inherit streaming status from unrelated threads.

## Middle

### Implementation Slices

1. Update `OrchestrationThread` and `OrchestrationTurn` schemas to include `queued`.
2. Replace ambiguous `pending` handling with explicit queued semantics in snapshot and event consumers.
3. Add `turn.queued` as a distinct orchestration domain event and stop using `turn.started` for pre-admission work.
4. Update renderer state reducers and chat-model helpers to derive status from:
   - current thread
   - current turn
   - connection and provider-health state
5. Update message and composer UI so queued work shows queued copy rather than streaming indicators.

### Primary Directories

- `packages/contracts/src/protocol/`
- `packages/server/src/orchestration/`
- `packages/ui/src/rpc/`
- `packages/ui/src/hooks/`
- `packages/ui/src/components/chat/`
- `packages/ui/src/components/shell/`

### Verification Gates

- Unit:
  - contract schemas accept `queued` and reject invalid status values
  - chat-model helpers return `queued` for queued thread and turn combinations
- Integration:
  - renderer state updates correctly on `turn.queued`, `turn.started`, and `turn.completed`
- Manual smoke:
  - a queued thread shows `Queued`
  - another idle thread remains sendable
  - a streaming thread no longer makes unrelated threads appear streaming
- Failure path:
  - global provider auth or offline state still disables chat appropriately without overwriting thread-local queued or streaming meaning

### Evidence To Capture

- passing test names for contract and UI-state coverage
- one snapshot example containing a queued thread and queued turn
- one short UI note showing queued copy versus streaming copy

## End

### Done When

- queued is a first-class contract and renderer concept
- `turn.queued` exists and is consumed distinctly from `turn.started`
- shared-status leakage is removed from the chat UI

### Handoff To Next Phase

Phase 01 can start once the state model no longer assumes one global active chat turn.

### Risks To Carry Forward

- if any server code still emits `turn.started` before execution begins, later phases will reintroduce UI confusion
- if any renderer path still keys off global provider streaming state, isolation will remain partial

### First Recommended Next Step

Start [Phase 01 - Thread Runtime Abstractions](phase-01-thread-runtime-abstractions.md).
