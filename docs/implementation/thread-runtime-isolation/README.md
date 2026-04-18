# Thread Runtime Isolation Implementation Plans

Last updated: 2026-04-16

This docs package is the implementation source of truth for the thread-runtime isolation and parallel chat rollout described in [docs/superpowers/specs/2026-04-16-thread-runtime-isolation-and-parallel-chat-design.md](../../superpowers/specs/2026-04-16-thread-runtime-isolation-and-parallel-chat-design.md).

It exists because this feature crosses shared contracts, server orchestration, the Codex harness, and the React chat renderer. The work needs to land in small verifiable phases rather than as one large refactor.

## How To Use These Plans

1. Read the design spec first.
2. Work phases in order unless a phase explicitly says it can be parallelized.
3. Before coding a phase, use its Orientation Note and follow the required Beginning -> Middle -> End flow from [PLAN.md](../../../PLAN.md).
4. Do not mark a phase complete until its verification gates are green and its handoff notes are recorded in the phase doc or branch notes.

## Phase Order

- [Phase 00 - Contracts And Renderer State Separation](phase-00-contracts-and-renderer-state-separation.md)
- [Phase 01 - Thread Runtime Abstractions](phase-01-thread-runtime-abstractions.md)
- [Phase 02 - Admission Control And Parallel Execution](phase-02-admission-control-and-parallel-execution.md)
- [Phase 03 - Warm Runtime Reuse And Eviction](phase-03-warm-runtime-reuse-and-eviction.md)
- [Phase 04 - Shutdown Recovery And Hardening](phase-04-shutdown-recovery-and-hardening.md)

## Planning Principles For This Rollout

- Separate thread-local execution state from global provider-health state first.
- Do not collapse queued and streaming semantics anywhere in the stack.
- Keep the `max 4` concurrency rule owned by one server-side manager.
- Treat runtime isolation as a server concern, not a renderer workaround.
- Each phase must be shippable, testable, and backward-safe where possible.
- Favor deterministic shutdown and restart behavior over auto-recovery magic.

## Deliverables Across The Full Rollout

- queued thread and turn states in shared contracts
- thread-local chat state resolution in the renderer
- thread-scoped Codex runtime abstraction
- parallel admission control with a hard cap of `4`
- per-thread send blocking while queued or streaming
- warm runtime reuse for repeated turns in the same thread
- LRU eviction of warm idle runtimes only
- shutdown reconciliation that interrupts queued and streaming work
- startup reconciliation that does not auto-resume prior work
