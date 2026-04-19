# Phase 04 - Integration With Threads, Canvas Context, And Memory Reads

Last updated: 2026-04-19

## Orientation Note

- Target feature: define how heartbeat reads workspace-wide thread history,
  captures Canvas-derived course observations, and exposes the compiled memory
  graph to future runtime and app consumers
- Key dependencies: [PLAN.md](../../../PLAN.md),
  [GLOSSARY.md](GLOSSARY.md),
  [phase-01-heartbeat-scheduler-and-run-checkpointing.md](phase-01-heartbeat-scheduler-and-run-checkpointing.md),
  [phase-02-daily-and-weekly-distillation-pipeline.md](phase-02-daily-and-weekly-distillation-pipeline.md),
  [phase-03-graph-promotion-and-node-evolution.md](phase-03-graph-promotion-and-node-evolution.md),
  [docs/features/01-ai-harness.md](../../features/01-ai-harness.md),
  [docs/features/02-canvas-integration.md](../../features/02-canvas-integration.md),
  [docs/architecture/03-local-server.md](../../architecture/03-local-server.md)
- Constraints and boundaries:
  - heartbeat reads across the student's whole workspace memory, not one chat
    thread only
  - thread history remains the source of recent behavioral evidence
  - Canvas observations should enrich course strategy rather than create a
    separate memory silo
  - this phase should define readers and ownership boundaries without forcing a
    UI design or editing workflow
- Acceptance criteria for this increment:
  - the heartbeat input surface is decision-complete
  - Canvas layout observations have a clear path into course nodes
  - runtime and app consumers have a clear way to read compiled memory later
  - the phase fixes ownership boundaries across server, Electron, and future UI
    readers

## Beginning

### Objective

Define how the memory system plugs into existing Student Claw conversation and
Canvas context so heartbeat operates on real product signals rather than an
isolated side channel.

### Current State

- Orchestration threads already persist conversation state in the local server.
- Canvas work in the repo already models course-aware data and student-facing
  access patterns.
- The approved memory design expects course nodes to include Canvas layout and
  operating knowledge alongside learning strategy.

### Out Of Scope

- a memory editing UI
- prompt tuning for summarization
- end-user notification behavior for heartbeat results

### Acceptance Criteria

- The rollout names the thread-history inputs heartbeat needs from the server
  layer.
- The rollout states how Canvas-derived observations get attached to course
  memory without building a separate Canvas-only graph.
- The rollout names likely memory readers for later implementation, such as:
  - AI context assembly
  - course-aware assistance
  - planner or dashboard surfaces
- Ownership boundaries are explicit enough that later code work will know where
  filesystem reads, thread reads, and Canvas enrichment belong.

## Middle

### Implementation Slices

1. Define the heartbeat read surface over orchestration threads and turns:
   - required ids, timestamps, and content boundaries
   - any filters for completed, interrupted, or failed turns
2. Define how Canvas observations enter the memory pipeline, especially:
   - course navigation structure
   - location of assignments or instructions
   - professor workflow patterns visible through Canvas use
3. Define the merge rule for course nodes so Canvas layout memory sits beside:
   - course strategy
   - professor patterns
   - recurring pitfalls
   - improvements
4. Define the likely read surfaces for later consumers and how they should
   depend on the markdown graph rather than rebuilding their own memory model.
5. Define the minimum compile-or-read behavior needed so later phases can read
   memory safely without mutating it.

### Primary Directories

- `packages/server/src/orchestration/`
- `packages/server/src/ai/`
- `packages/extensions/canvas-mcp/`
- `packages/ui/src/`
- `docs/implementation/memory-heartbeat-rollout/`

### Verification Gates

- Unit:
  - thread-history readers can prove heartbeat sees the correct incremental turn
    window
  - course-memory merge tests can prove Canvas layout and strategy coexist in
    one course node
- Integration:
  - one heartbeat run can consume thread history plus a Canvas-derived course
    observation and update the correct course node
- Manual smoke:
  - a reviewer can trace one course insight from chat or Canvas source through
    daily memory into the course graph node
- Failure path:
  - missing Canvas context must not block heartbeat from updating other memory
    branches, and missing thread reads must not corrupt graph files

### Evidence To Capture

- one data-flow example from thread turn to daily file to course node
- one example Canvas observation attached to a course node
- one example of a read-only memory consumer interface once implementation
  begins

## End

### Done When

- the integration boundaries for heartbeat inputs and memory readers are
  decision-complete
- later implementation work no longer needs to debate where thread history,
  Canvas knowledge, or memory reads belong

### Handoff To Next Phase

Phase 05 can now harden the full memory lifecycle with end-to-end recovery and
verification rules.

### Risks To Carry Forward

- if Canvas enrichment is modeled separately from course strategy, course memory
  will fragment
- if future consumers bypass the markdown graph directly, the rollout will lose
  its single-source-of-truth advantage

### First Recommended Next Step

Start [Phase 05 - Hardening, Verification, And Recovery](phase-05-hardening-verification-and-recovery.md).
