# Phase 01 - Memorize Scheduler And Run Checkpointing

Last updated: 2026-04-19

## Orientation Note

- Target feature: define the isolated twice-daily memorize runner, local-time
  scheduling semantics, and durable checkpoint contract
- Key dependencies: [PLAN.md](../../internal/PLAN.md),
  [GLOSSARY.md](GLOSSARY.md),
  [phase-00-memory-filesystem-scaffold-and-contracts.md](phase-00-memory-filesystem-scaffold-and-contracts.md),
  [docs/architecture/02-electron-shell.md](../../architecture/02-electron-shell.md),
  [docs/architecture/03-local-server.md](../../architecture/03-local-server.md),
  [docs/implementation/thread-runtime-isolation/README.md](../thread-runtime-isolation/README.md)
- Constraints and boundaries:
  - memorize runs in its own isolated thread
  - memorize runs twice a day in the student's local timezone
  - scheduling must support catch-up on app resume or restart
  - checkpointing must be idempotent and safe to reread after partial failure
  - do not implement summarization or graph promotion in this phase
- Acceptance criteria for this increment:
  - the scheduler behavior is decision-complete
  - checkpoint fields and update timing are defined clearly
  - catch-up behavior is fixed for missed runs and partial runs
  - the phase names the ownership boundary between Electron scheduling and
    server-side memorize execution

## Beginning

### Objective

Define how the memorize gets scheduled, launched, resumed, and checkpointed so
the later summarization and graph phases can assume reliable execution
semantics.

### Current State

- Electron already contains a scheduler pattern for weekly insights with
  start/stop and catch-up-on-resume behavior.
- Thread runtime work already establishes the repo pattern for isolated runtime
  ownership.
- The approved memory design requires memorize to process only incremental
  changes since the last successful run.

### Out Of Scope

- prompt design for distillation
- retention pruning
- graph file mutation
- UI display of memorize status

### Acceptance Criteria

- The rollout fixes a twice-daily cadence and states that times are interpreted
  in the student's local timezone.
- The scheduler distinguishes between:
  - the next planned run
  - a catch-up run after missed intervals
  - a rerun after partial failure
- The checkpoint contract names at least:
  - last successful run time
  - last processed turn id or timestamp boundary
  - files touched
  - promotions made
  - last run outcome
- The doc states exactly when the checkpoint is written and when it is not.

## Middle

### Implementation Slices

1. Define the ownership split:
   - Electron owns schedule computation and wake-up timing
   - the local server or orchestration layer owns the isolated memorize turn
     body
2. Define the cadence rules for morning and evening runs, including how the app
   computes the next run in local time.
3. Define catch-up behavior for:
   - app launch after a missed run
   - long sleep or suspend
   - one failed memorize followed by the next scheduled slot
4. Define checkpoint update semantics:
   - write only after a successful run commits its outputs
   - preserve the last successful checkpoint on failure
   - record enough metadata to prevent duplicate reprocessing
5. Define idempotency expectations so a repeated run over the same input window
   does not create duplicate daily, weekly, or graph changes.

### Primary Directories

- `packages/electron/src/`
- `packages/server/src/orchestration/`
- `packages/server/src/db/` if durable run metadata later needs a local DB home
- `docs/implementation/memorize/`

### Verification Gates

- Unit:
  - scheduler tests can prove the next-run computation for the twice-daily
    cadence in local time
  - checkpoint tests can prove failed runs do not overwrite the last successful
    boundary
- Integration:
  - one isolated memorize run can be started from the scheduler with a stable
    checkpoint boundary
- Manual smoke:
  - a developer can suspend or restart the app and observe one catch-up pass
    rather than duplicate runs
- Failure path:
  - if a run fails after reading inputs but before committing outputs, the next
    run restarts from the last successful checkpoint without corrupting memory

### Evidence To Capture

- scheduler timeline examples for the two daily slots
- one checkpoint example before and after a successful run
- one catch-up example after a missed run

## End

### Done When

- the isolated memorize scheduler and checkpoint contract are decision-complete
- later phases no longer need to debate cadence, checkpoint ownership, or
  catch-up semantics

### Handoff To Next Phase

Phase 02 can now define daily and weekly distillation behavior against one
stable incremental-read contract.

### Risks To Carry Forward

- if checkpoint boundaries are underspecified, distillation phases may duplicate
  outputs
- if scheduling and execution ownership blur together, future retries and
  monitoring will be harder to reason about

### First Recommended Next Step

Start [Phase 02 - Daily And Weekly Distillation Pipeline](phase-02-daily-and-weekly-distillation-pipeline.md).
