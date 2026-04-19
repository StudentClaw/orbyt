# Memory Heartbeat Rollout Glossary, Tracker, And Handoff

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
| 00 - Memory Filesystem Scaffold And Contracts | not_started | Unassigned | Not run | Lock the on-disk memory contract, fixed root scaffold, and markdown update rules |
| 01 - Heartbeat Scheduler And Run Checkpointing | not_started | Unassigned | Not run | Define the isolated twice-daily heartbeat runner and checkpoint semantics |
| 02 - Daily And Weekly Distillation Pipeline | not_started | Unassigned | Not run | Define incremental chat ingestion, summary generation, and rolling retention |
| 03 - Graph Promotion And Node Evolution | not_started | Unassigned | Not run | Define durable-fact promotion and graph update behavior |
| 04 - Integration With Threads, Canvas Context, And Memory Reads | not_started | Unassigned | Not run | Connect heartbeat inputs and memory consumers across server, Canvas, and app surfaces |
| 05 - Hardening, Verification, And Recovery | not_started | Unassigned | Not run | Lock recovery, duplicate-prevention, and end-to-end verification behavior |

## Current Recommended Next Step

Start [Phase 00 - Memory Filesystem Scaffold And Contracts](phase-00-memory-filesystem-scaffold-and-contracts.md) and treat the markdown filesystem layout as the first contract to stabilize before scheduler or summarization implementation begins.

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

### Heartbeat

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

The persisted run state in `heartbeat-state.json` that tells heartbeat what it
processed successfully last time, which files it updated, and where a catch-up
run should resume after app restart or failure.

### Stale Node

A graph node that should not be auto-deleted but may be marked for review if
newer evidence no longer supports it or if it has not received confirming
updates for a long period.

## Phase Handoff Log

### Phase 00 - Memory Filesystem Scaffold And Contracts

No handoff entries yet.

### Phase 01 - Heartbeat Scheduler And Run Checkpointing

No handoff entries yet.

### Phase 02 - Daily And Weekly Distillation Pipeline

No handoff entries yet.

### Phase 03 - Graph Promotion And Node Evolution

No handoff entries yet.

### Phase 04 - Integration With Threads, Canvas Context, And Memory Reads

No handoff entries yet.

### Phase 05 - Hardening, Verification, And Recovery

No handoff entries yet.
