# Memorize Glossary, Tracker, And Handoff

Last updated: 2026-04-19

This file has two jobs:

1. Track where implementation currently stands for each phase.
2. Capture handoff notes so the next implementation step starts with real
   context instead of rediscovery.

## Status Legend

- `not_started`: no implementation work has begun
- `in_progress`: active implementation is underway
- `blocked`: implementation paused by a dependency or failure
- `complete`: acceptance criteria and verification gates are satisfied

## Verification State Legend

- `Not run`: the phase verification gate has not been exercised yet
- `In progress`: some verification work has started, but the full gate is not
  yet green
- `Failed`: at least one required verification check is currently failing
- `Verified`: the full verification gate is green for the current phase state

Verification state tracks the health of the evidence for a phase. Phase
`Status` tracks delivery progress. A phase should not be marked `complete`
unless its verification state is `Verified`.

## Phase Tracker

| Phase | Status | Owner | Verification State | Next Action |
| --- | --- | --- | --- | --- |
| 00 - Memory Filesystem Scaffold And Contracts | complete | rereynrd | Verified | Proceed to Phase 01; see phase-00-spec.md for the frozen contract |
| 01 - Memorize Scheduler And Run Checkpointing | complete | rereynrd | Verified | Proceed to Phase 02; see phase-01-spec.md for the frozen contract |
| 02 - Daily And Weekly Distillation Pipeline | complete | rereynrd | Verified | Proceed to Phase 03; see phase-02-spec.md for the frozen contract |
| 03 - Graph Promotion And Node Evolution | not_started | Unassigned | Not run | Define durable-fact promotion and graph update behavior |
| 04 - Integration With Threads, Canvas Context, And Memory Reads | not_started | Unassigned | Not run | Connect memorize inputs and memory consumers across server, Canvas, and app surfaces |
| 05 - Hardening, Verification, And Recovery | not_started | Unassigned | Not run | Lock recovery, duplicate-prevention, and end-to-end verification behavior |

## Current Recommended Next Step

Start [Phase 03 - Graph Promotion And Node Evolution](phase-03-graph-promotion-and-node-evolution.md). The daily/weekly pipeline is locked in [phase-02-spec.md](phase-02-spec.md); Phase 03 parses promotion candidates from those files and promotes them into the durable graph.

## Handoff Update Protocol

When a phase changes state, append a new entry to the relevant phase section
below with:

- date
- branch
- owner
- what was completed
- what remains
- blockers or risks
- commands run
- evidence captured
- first recommended next step

### Handoff Entry Template

```md
- Date: YYYY-MM-DD
- Branch: feature/<name>
- Owner: <name>
- Status change: not_started -> in_progress | in_progress -> complete | etc.
- Completed:
  - item
  - item
- Remaining:
  - item
  - item
- Risks or blockers:
  - item
  - item
- Commands run:
  - `bun run typecheck`
  - `bun test --cwd <package>`
- Evidence captured:
  - test output
  - screenshot
  - log snippet
- First recommended next step:
  - item
```

## Shared Vocabulary

### Memorize

The isolated background turn that runs twice a day in the student's local time,
reads unprocessed workspace-wide conversation activity, and updates memory
artifacts without sharing runtime state with the active chat thread.

### Daily Memory

A short-horizon markdown summary in `~/.student-claw/memory/daily/` that
captures notable recent events, assignment observations, learning signals, and
promotion candidates for one calendar day.

### Weekly Memory

A distilled markdown summary in `~/.student-claw/memory/weekly/` that compresses
recent daily files into recurring struggles, recurring wins, emerging
strategies, and candidate long-term lessons. Weekly memory is a rolling layer,
not a durable graph node.

### Graph Node

A durable markdown page under `~/.student-claw/memory/graph/` that stores
stable guidance, patterns, preferences, or operating knowledge. Graph nodes are
linked from `MEMORY.md` directly or through other graph nodes.

### Promotion Candidate

An idea surfaced during daily or weekly distillation that might deserve graph
promotion if it is repeated enough or if it is an explicit high-confidence fact.

### Durable Fact

A stable statement that can be promoted into the graph immediately without
waiting for repeated evidence. Examples include student-stated preferences,
course Canvas structure, or stable professor workflow rules.

### Course Strategy

The durable operating guidance for succeeding in one course. Course strategy
includes what the professor seems to reward, the student's effective approach
for that course, common pitfalls, and course-specific Canvas organization.

### Canvas Layout Memory

The part of course strategy that describes where a course actually hides work or
important materials in Canvas, such as preferring `Modules` over
`Assignments`, relying on `Announcements`, or storing instructions in attached
files or pages.

### Assignment Playbook

A reusable strategy for how this student should approach a class of work such as
problem sets, essays, labs, or coding assignments. Assignment playbooks live
under the `school` graph branch and can be cross-course rather than
course-specific.

### Checkpoint

The persisted run state in `memorize-state.json` that tells memorize what it
processed successfully last time, which files it updated, and where a catch-up
run should resume after app restart or failure.

### Stale Node

A graph node that should not be auto-deleted but may be marked for review if
newer evidence no longer supports it or if it has not received confirming
updates for a long period.

## Phase Handoff Log

### Phase 00 - Memory Filesystem Scaffold And Contracts

- Date: 2026-04-19
- Branch: memorize-system
- Owner: rereynrd
- Status change: not_started -> complete
- Completed:
  - froze filesystem contract at `~/.student-claw/memory/` with `STUDENT_CLAW_HOME` env override
  - wrote authoritative spec at [phase-00-spec.md](phase-00-spec.md)
  - locked mandatory H2 heading order for base graph nodes and course nodes
  - locked course identity model: kebab-case slug directory + `canvasId` frontmatter
  - locked `memorize-state.json` v1 shape (renamed from `heartbeat-state.json`)
  - added Effect schemas in `packages/contracts/src/schemas/memorize.ts`
  - added `MemoryPaths` helper in `packages/server/src/memory/paths.ts` with env override
  - added 12 unit tests for path resolution and validation
- Remaining:
  - delete stale `docs/implementation/memory-heartbeat-rollout/` directory in a separate housekeeping commit
  - runtime seeding of the root tree (owned by Phase 01's runner)
- Risks or blockers:
  - `memory-heartbeat-rollout/` folder still exists alongside `memorize/`; if both get referenced, readers may land on stale heartbeat-named docs
- Commands run:
  - `bun run --filter '@student-claw/contracts' typecheck` -> pass
  - `bun run --filter '@student-claw/contracts' build` -> pass
  - `bun test packages/server/src/__tests__/memory-paths.test.ts` -> 12 pass / 0 fail
- Evidence captured:
  - spec doc at `docs/implementation/memorize/phase-00-spec.md`
  - passing test run
- First recommended next step:
  - start Phase 01: define the isolated Memorize runner loop, twice-daily schedule, and checkpoint read/write flow against the `MemoryPaths` helper and `MemorizeState` schema

### Phase 01 - Memorize Scheduler And Run Checkpointing

- Date: 2026-04-19
- Branch: memorize-system
- Owner: rereynrd
- Status change: not_started -> complete
- Completed:
  - froze cadence (07:00 / 20:00 local time) and timezone source (system)
  - froze ownership split: Electron owns timer, server owns turn body
  - froze catch-up: one consolidated run, not per-slot backfill
  - froze checkpoint write semantics: write on success only, atomic temp+rename
  - wrote authoritative spec at [phase-01-spec.md](phase-01-spec.md)
  - `MemorizeScheduler` in `packages/electron/src/memorize/`
  - `MemorizeStateStore` (atomic read/write/commitSuccess/recordFailure) in `packages/server/src/memory/`
  - `MemorizeTurnRunner` interface + `NoOpMemorizeTurnRunner` stub in `packages/server/src/memory/runner.ts`
  - `MemorizeRunResult`, `MemorizeRunError` schemas in contracts
  - 15 scheduler tests + 7 state store tests = 22 passing
- Remaining:
  - Electron activation (IPC wiring) deferred to Phase 04; heartbeats system will call `start()` and `runCatchUpIfNeeded()`
- Risks or blockers:
  - `NoOpMemorizeTurnRunner` must be swapped in Phase 02 before Memorize produces any real output
- Commands run:
  - `bun run --filter '@student-claw/contracts' build` -> pass
  - `bun test packages/electron/src/__tests__/memorize-scheduler.test.ts` -> 15 pass / 0 fail
  - `bun test packages/server/src/__tests__/memorize-state-store.test.ts` -> 7 pass / 0 fail
- Evidence captured:
  - spec doc at `docs/implementation/memorize/phase-01-spec.md`
  - passing test runs above
- First recommended next step:
  - start Phase 02: real `MemorizeTurnRunner` that reads conversation activity, writes daily files, and triggers weekly distillation

### Phase 02 - Daily And Weekly Distillation Pipeline

- Date: 2026-04-19
- Branch: memorize-system
- Owner: rereynrd
- Status change: not_started -> complete
- Completed:
  - locked read window: completed turns since `_global` cursor
  - locked daily file format: run-stamped blocks, no duplication on same-day re-run
  - locked weekly accumulation: expiring daily folds into its own ISO week's file
  - locked retention: 7 daily / 4 weekly, prune-after-commit only
  - prompt templates: daily-distillation.md + weekly-distillation.md (markdown sources + TS exports)
  - `LiveMemorizeTurnRunner` replacing `NoOpMemorizeTurnRunner`
  - `CodexMemorizeDistiller` wrapping `CodexCliService.streamTurn()`
  - utility modules: turn-reader, daily-writer, weekly-writer, pruner, week, distiller
  - 25 tests passing (week utils 8, daily writer 5, pruner 8, live runner 4)
  - wrote authoritative spec at [phase-02-spec.md](phase-02-spec.md)
- Remaining:
  - Phase 04 must inject real `CodexCliService` into `CodexMemorizeDistiller` and wire the IPC activation
- Risks or blockers:
  - `_global` cursor is a v1 simplification; per-thread cursors are more correct if threads diverge significantly in activity
- Commands run:
  - `bun run --filter '@student-claw/contracts' build` -> pass
  - `bun test packages/server/src/__tests__/memorize-*.test.ts` -> 25 pass / 0 fail
- Evidence captured:
  - spec doc at `docs/implementation/memorize/phase-02-spec.md`
  - passing test runs above
- First recommended next step:
  - start Phase 03: parse promotion candidates from daily/weekly files and promote durable facts into graph nodes

### Phase 03 - Graph Promotion And Node Evolution

No handoff entries yet.

### Phase 04 - Integration With Threads, Canvas Context, And Memory Reads

No handoff entries yet.

### Phase 05 - Hardening, Verification, And Recovery

No handoff entries yet.
