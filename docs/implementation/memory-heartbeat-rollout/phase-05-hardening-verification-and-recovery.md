# Phase 05 - Hardening, Verification, And Recovery

Last updated: 2026-04-19

## Orientation Note

- Target feature: define failure handling, recovery behavior, duplicate
  prevention, and the end-to-end verification contract for the memory heartbeat
  rollout
- Key dependencies: [PLAN.md](../../../PLAN.md),
  [GLOSSARY.md](GLOSSARY.md),
  [phase-01-heartbeat-scheduler-and-run-checkpointing.md](phase-01-heartbeat-scheduler-and-run-checkpointing.md),
  [phase-02-daily-and-weekly-distillation-pipeline.md](phase-02-daily-and-weekly-distillation-pipeline.md),
  [phase-03-graph-promotion-and-node-evolution.md](phase-03-graph-promotion-and-node-evolution.md),
  [phase-04-integration-with-threads-canvas-context-and-memory-reads.md](phase-04-integration-with-threads-canvas-context-and-memory-reads.md)
- Constraints and boundaries:
  - protect `MEMORY.md` and graph nodes from partial-run corruption
  - preserve the last successful checkpoint on failure
  - prevent duplicate promotions across retries or overlapping evidence windows
  - support stale-node marking without automatic graph deletion
  - do not add speculative observability or rollout infrastructure beyond what
    is needed for implementation safety
- Acceptance criteria for this increment:
  - recovery semantics are decision-complete
  - the rollout has explicit automated, integration, manual, and failure-path
    verification expectations
  - stale-node and duplicate-prevention policies are fixed
  - end-to-end scenarios reflect the approved product behavior

## Beginning

### Objective

Define the safety rails that make the memory system reliable under retries,
app restarts, partial failures, and semester-long graph growth.

### Current State

- The approved product decisions already call out:
  - catch-up after missed runs
  - no duplication when heartbeat runs twice in one day
  - rolling retention for daily and weekly layers
  - durable graph promotion rules
- Earlier phases define the layout, checkpointing, distillation, promotion, and
  integration boundaries that now need one end-to-end verification contract.

### Out Of Scope

- new user-facing settings or notifications
- graph editing UX
- advanced analytics or monitoring systems beyond local implementation evidence

### Acceptance Criteria

- The phase encodes these end-to-end scenarios explicitly:
  - heartbeat runs twice in one day without duplicating prior distillation
    output
  - app restart after a missed run triggers a catch-up pass from the saved
    checkpoint
  - daily retention prunes day `N-8` while keeping the newest `7`
  - weekly retention prunes week `N-5` while keeping the newest `4`
  - repeated patterns promote into the graph exactly once
  - explicit high-confidence facts can promote immediately
  - graph updates prefer existing nodes over unnecessary new nodes
  - a partial run does not corrupt `MEMORY.md` or lose the last successful
    checkpoint
  - course nodes can hold both success strategy and Canvas layout memory
- Stale-node policy is fixed to mark for review rather than auto-delete.

## Middle

### Implementation Slices

1. Define safe write ordering across:
   - daily updates
   - weekly updates
   - graph updates
   - checkpoint writes
2. Define retry and rerun expectations after:
   - scheduler wake failure
   - isolated heartbeat runtime failure
   - partial file-write or file-commit failure
3. Define duplicate-prevention checks across:
   - repeated same-day runs
   - reruns from the same checkpoint boundary
   - overlapping weekly evidence
4. Define stale-node review rules so heartbeat can mark nodes as `active`,
   `watch`, or `stale` without deleting graph pages automatically.
5. Define the end-to-end verification matrix for the rollout:
   - one automated/unit gate per phase
   - one integration gate per phase
   - one manual smoke gate per phase
   - one failure-path gate per phase

### Primary Directories

- `packages/electron/src/`
- `packages/server/src/`
- `packages/server/src/__tests__/`
- `docs/implementation/memory-heartbeat-rollout/`

### Verification Gates

- Unit:
  - write-order and duplicate-prevention tests can prove retries do not produce
    extra promotions or checkpoint drift
- Integration:
  - one end-to-end heartbeat test can simulate new chat turns, course-memory
    promotion, retention pruning, and a saved checkpoint boundary
- Manual smoke:
  - a developer can inspect the memory folder after multiple runs and verify the
    expected daily, weekly, and graph behavior directly from files
- Failure path:
  - a forced partial failure preserves the last successful checkpoint and leaves
    existing graph files readable and intact

### Evidence To Capture

- one end-to-end run trace
- one failure-recovery trace
- one folder snapshot showing correct daily and weekly retention

## End

### Done When

- hardening and recovery rules are decision-complete
- the rollout has a clear end-to-end verification contract for implementation

### Handoff To Next Phase

No further rollout phase is required. Implementation can proceed through the
phases above with one stable safety and verification contract.

### Risks To Carry Forward

- if safe write ordering is not implemented consistently, retries could still
  corrupt graph state
- if stale-node policy is ignored, long-term memory quality may degrade over a
  semester

### First Recommended Next Step

Begin implementation from [Phase 00 - Memory Filesystem Scaffold And Contracts](phase-00-memory-filesystem-scaffold-and-contracts.md) and keep [GLOSSARY.md](GLOSSARY.md) updated as each phase moves.
