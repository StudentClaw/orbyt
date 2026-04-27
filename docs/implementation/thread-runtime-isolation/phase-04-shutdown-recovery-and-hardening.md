# Phase 04 - Shutdown Recovery And Hardening

Last updated: 2026-04-16

## Orientation Note

- Target feature: make shutdown and restart deterministic and harden the isolated runtime path
- Key dependencies: [PLAN.md](../../internal/PLAN.md), [docs/superpowers/specs/2026-04-16-thread-runtime-isolation-and-parallel-chat-design.md](../../superpowers/specs/2026-04-16-thread-runtime-isolation-and-parallel-chat-design.md), [docs/features/01-ai-harness.md](../../features/01-ai-harness.md), [docs/architecture/03-local-server.md](../../architecture/03-local-server.md), [docs/architecture/04-react-ui.md](../../architecture/04-react-ui.md)
- Constraints and boundaries:
  - shutdown must be terminal for queued and streaming work
  - startup must not auto-resume prior work
  - preserve user-visible history while finalizing interrupted states
  - use tests and observability to prove determinism
- Acceptance criteria for this increment:
  - app shutdown converts queued and streaming turns to interrupted
  - all active and warm runtimes are destroyed on shutdown
  - startup reconciles stale queued and streaming state to interrupted
  - hardening tests cover isolation, lifecycle, and failure handling

## Beginning

### Objective

Finish the rollout by making lifecycle termination and recovery predictable, then lock in regression coverage around the new model.

### Current State

- after Phase 03, the manager can own active and warm idle runtimes
- without explicit shutdown rules, queued or active work could be left ambiguous on app exit

### Out Of Scope

- product changes beyond this feature
- UI polish unrelated to queued, streaming, or interrupted semantics
- new runtime analytics dashboards

### Acceptance Criteria

- shutdown path marks queued turns interrupted without starting them
- shutdown path marks streaming turns interrupted before destroying runtimes
- startup path never requeues prior work automatically
- regression coverage exists across renderer and server for the final lifecycle model

## Middle

### Implementation Slices

1. Add manager shutdown sequencing that:
   - stops new admissions
   - interrupts queued turns
   - interrupts active turns
   - destroys warm idle runtimes
2. Add startup reconciliation for stale `queued` and `streaming` turns.
3. Ensure snapshot rebuild after restart shows interrupted history and zero warm ownership.
4. Add hardening coverage for:
   - multi-thread isolation
   - queued interrupt
   - active interrupt
   - shutdown terminal behavior
   - restart no-resume behavior
5. Update docs and operational notes where runtime lifecycle semantics changed.

### Primary Directories

- `packages/server/src/orchestration/`
- `packages/server/src/ai/`
- `packages/server/src/index.ts`
- `packages/server/src/__tests__/`
- `packages/ui/src/__tests__/`

### Verification Gates

- Unit:
  - stale queued turns reconcile to interrupted on startup
  - stale streaming turns reconcile to interrupted on startup
  - manager shutdown destroys active and warm runtimes
- Integration:
  - app restart does not auto-resume prior work
  - renderer shows interrupted state after reconnect
- Manual smoke:
  - close the app during queued work and confirm the thread comes back interrupted
  - close the app during streaming work and confirm the thread comes back interrupted
- Failure path:
  - if one runtime refuses to exit cleanly, shutdown still finalizes persisted turn state and logs the runtime cleanup failure explicitly

### Evidence To Capture

- passing shutdown and recovery tests
- one before-and-after snapshot showing queued or streaming work becoming interrupted after restart
- one note confirming no auto-resume behavior remains

## End

### Done When

- shutdown behavior is terminal and deterministic
- restart behavior is deterministic and manual-only
- regression coverage exists for the final isolated runtime model

### Handoff To Next Phase

No further implementation phase is required. Remaining work, if any, is optimization or UX polish.

### Risks To Carry Forward

- if shutdown ordering is not stable, intermittent orphan-process bugs may remain
- if test coverage does not include mixed active and warm states, regressions may hide until later changes

### First Recommended Next Step

Start implementation from [Phase 00 - Contracts And Renderer State Separation](phase-00-contracts-and-renderer-state-separation.md).
