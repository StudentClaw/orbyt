# Phase 02 - Daily And Weekly Distillation Pipeline

Last updated: 2026-04-19

## Orientation Note

- Target feature: define how memorize reads unprocessed chat activity and turns
  it into rolling daily and weekly memory layers
- Key dependencies: [PLAN.md](../../internal/PLAN.md),
  [GLOSSARY.md](GLOSSARY.md),
  [phase-00-memory-filesystem-scaffold-and-contracts.md](phase-00-memory-filesystem-scaffold-and-contracts.md),
  [phase-01-memorize-scheduler-and-run-checkpointing.md](phase-01-memorize-scheduler-and-run-checkpointing.md),
  [docs/architecture/03-local-server.md](../../architecture/03-local-server.md)
- Constraints and boundaries:
  - memorize reads workspace-wide thread history incrementally
  - daily memory is a rolling `7`-file layer
  - weekly memory is a rolling `4`-file layer
  - daily and weekly files may be rewritten as long as updates remain
    deterministic for the same input window
  - do not promote graph nodes in this phase beyond naming promotion
    candidates
- Acceptance criteria for this increment:
  - the read window for each memorize run is fixed
  - daily file contents and weekly file contents are clearly distinct
  - retention pruning behavior is decision-complete
  - the phase encodes the no-duplication rule for two runs in one day

## Beginning

### Objective

Define how memorize turns raw recent chats into bounded short-term memory
layers that later promotion logic can trust.

### Current State

- The approved lifecycle is:
  - `daily = what happened`
  - `weekly = what it means recently`
  - `graph = what the student should keep learning from`
- Thread history already exists in the local orchestration data model.
- The checkpoint phase establishes that memorize should only process content
  since the last successful boundary.

### Out Of Scope

- long-term graph mutation
- stale-node review
- runtime or UI consumers of compiled memory

### Acceptance Criteria

- The doc defines exactly what memorize reads on each run:
  - chat turns created or updated since the last successful checkpoint
  - the active daily and weekly files needed for context
  - the current graph root and relevant graph nodes only if needed for
    duplicate-prevention or context
- Daily files are event-oriented and weekly files are pattern-oriented.
- A second memorize run on the same day updates the day's file without
  duplicating already-processed content.
- Retention rules are explicit:
  - prune day `N-8` while keeping the newest `7`
  - prune week `N-5` while keeping the newest `4`

## Middle

### Implementation Slices

1. Define the incremental read window for recent thread activity and what thread
   metadata the memorize needs to inspect.
2. Define the daily file structure, including:
   - key events
   - assignment and course observations
   - learning signals
   - promotion candidates
3. Define the weekly file structure, including:
   - recurring struggles
   - recurring wins
   - emerging study strategies
   - class-specific operating knowledge
   - possible long-term lessons
4. Define how the current week summary gets updated from multiple daily files
   without becoming a transcript dump.
5. Define pruning behavior and safe deletion ordering for daily and weekly
   windows only after successful commits.

### Primary Directories

- `packages/server/src/orchestration/`
- `packages/server/src/db/`
- `packages/electron/src/` if scheduling needs retention hooks
- `docs/implementation/memorize/`

### Verification Gates

- Unit:
  - retention tests can prove day `N-8` and week `N-5` are pruned only after a
    successful commit
  - update tests can prove two runs in one day do not duplicate prior
    distillation output
- Integration:
  - one memorize run can read new thread activity, update the correct daily
    file, and refresh the correct weekly file from the checkpoint boundary
- Manual smoke:
  - a reviewer can compare a raw chat window to the daily and weekly outputs and
    see that daily captures events while weekly captures meaning
- Failure path:
  - a pruning attempt cannot delete old files if the replacement daily or weekly
    writes failed

### Evidence To Capture

- one example daily file
- one example weekly file
- one retention example showing before and after file sets

## End

### Done When

- the rolling daily and weekly distillation pipeline is decision-complete
- later phases no longer need to debate read windows, file purpose, or
  retention behavior

### Handoff To Next Phase

Phase 03 can now promote repeated patterns and durable facts into the graph
without redefining what daily and weekly layers mean.

### Risks To Carry Forward

- if daily and weekly semantics drift together, graph promotion will become
  noisy and harder to trust
- if pruning is not tied to successful commits, recovery behavior may delete
  useful short-term context

### First Recommended Next Step

Start [Phase 03 - Graph Promotion And Node Evolution](phase-03-graph-promotion-and-node-evolution.md).
