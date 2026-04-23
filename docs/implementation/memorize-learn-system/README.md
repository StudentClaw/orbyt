# Memorize Plans

Last updated: 2026-04-19

This docs package is the implementation source of truth for the markdown-based
memory graph and isolated memorize system in Orbyt.

It is intentionally separate from
[docs/features/04-memory-system.md](../../features/04-memory-system.md), which
still describes the earlier mem0-oriented direction and should not be rewritten
as part of creating this rollout package.

## How To Use These Plans

1. Start with [GLOSSARY.md](GLOSSARY.md) for status, shared vocabulary, and the
   handoff record.
2. Work phases in order unless a later phase explicitly says it can begin in
   parallel.
3. Before coding a phase, read that phase's Orientation Note and follow the
   required Beginning -> Middle -> End flow from [PLAN.md](../../../PLAN.md).
4. Do not mark a phase complete until its verification gates are green and its
   handoff notes are recorded in [GLOSSARY.md](GLOSSARY.md).

## Phase Order

- [Phase 00 - Memory Filesystem Scaffold And Contracts](phase-00-memory-filesystem-scaffold-and-contracts.md)
- [Phase 01 - Memorize Scheduler And Run Checkpointing](phase-01-memorize-scheduler-and-run-checkpointing.md)
- [Phase 02 - Daily And Weekly Distillation Pipeline](phase-02-daily-and-weekly-distillation-pipeline.md)
- [Phase 03 - Graph Promotion And Node Evolution](phase-03-graph-promotion-and-node-evolution.md)
- [Phase 04 - Integration With Threads, Canvas Context, And Memory Reads](phase-04-integration-with-threads-canvas-context-and-memory-reads.md)
- [Phase 05 - Hardening, Verification, And Recovery](phase-05-hardening-verification-and-recovery.md)

## Planning Principles For This Rollout

- Memorize always runs in its own isolated thread rather than the active chat
  thread.
- Memory is markdown-first in v1. The filesystem is the public interface, while
  any structured helper state remains subordinate to that filesystem contract.
- The memory lifecycle is incremental:
  - `daily` remembers what happened
  - `weekly` remembers what it means recently
  - `graph` remembers guidance and durable lessons
- The graph keeps a fixed top-level scaffold:
  - `school`
  - `work`
  - `relationships`
  - `personality`
  - `routine`
- Memorize may add important child nodes under that scaffold, but it must
  prefer updating existing nodes over creating new ones.
- `school` must support both:
  - course-specific strategy
  - cross-course assignment playbooks
- Course strategy includes course operating knowledge plus Canvas layout and
  navigation structure.
- Promotion into the graph requires repeated evidence by default, except for
  explicit high-confidence facts such as student-stated preferences or stable
  course-structure facts.
- Rolling retention is fixed in v1:
  - newest `7` daily files
  - newest `4` weekly files

## Filesystem Contract For This Rollout

- `~/.orbyt/memory/MEMORY.md`
- `~/.orbyt/memory/memorize-state.json`
- `~/.orbyt/memory/daily/YYYY-MM-DD.md`
- `~/.orbyt/memory/weekly/YYYY-Www.md`
- `~/.orbyt/memory/graph/**`

## Deliverables Across The Full Rollout

- A stable on-disk memory layout rooted at `MEMORY.md`
- A twice-daily isolated memorize runner with reliable checkpointing and
  catch-up behavior
- Incremental daily summary generation and weekly distillation with bounded
  rolling retention
- Durable graph promotion for student learning patterns, course strategy,
  assignment playbooks, and Canvas layout knowledge
- Integration guidance for reading thread history, Canvas-derived observations,
  and compiled memory from runtime and UI surfaces
- Failure-safe update rules that protect `MEMORY.md`, prevent duplicate
  promotion, and preserve the last successful checkpoint
