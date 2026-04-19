# Phase 00 - Memory Filesystem Scaffold And Contracts

Last updated: 2026-04-19

## Orientation Note

- Target feature: lock the markdown memory filesystem layout, root graph
  scaffold, and file-update contract before scheduler or summarization code
  begins
- Key dependencies: [PLAN.md](../../../PLAN.md),
  [GLOSSARY.md](GLOSSARY.md),
  [docs/features/INDEX.md](../../features/INDEX.md),
  [docs/features/04-memory-system.md](../../features/04-memory-system.md),
  [docs/architecture/02-electron-shell.md](../../architecture/02-electron-shell.md),
  [docs/architecture/03-local-server.md](../../architecture/03-local-server.md)
- Constraints and boundaries:
  - use a markdown-first memory system in v1
  - keep `MEMORY.md` as the graph root
  - keep the top-level scaffold fixed:
    - `school`
    - `work`
    - `relationships`
    - `personality`
    - `routine`
  - allow heartbeat to add important child nodes below the fixed scaffold
  - do not design vector search, mem0, or semantic-storage dependencies in this
    phase
- Acceptance criteria for this increment:
  - the on-disk memory layout is decision-complete
  - file naming rules for daily and weekly memory are fixed
  - the checkpoint/state file contract is clear
  - graph node structure is defined well enough for later phases to update
    nodes deterministically

## Beginning

### Objective

Define the filesystem contract for memory so later phases can schedule,
distill, and promote without debating where state lives or how files should be
organized.

### Current State

- The existing memory feature doc still centers mem0 and a generated
  `MEMORY.md`.
- The approved rollout direction replaces that approach with a markdown-first
  graph rooted in `~/.student-claw/memory/`.
- Existing implementation rollouts in this repo use docs packages to make
  cross-system work decision-complete before coding.

### Out Of Scope

- scheduler implementation
- chat summarization prompts
- graph promotion logic
- UI readers or renderer integration

### Acceptance Criteria

- The memory root is fixed to:
  - `~/.student-claw/memory/MEMORY.md`
  - `~/.student-claw/memory/heartbeat-state.json`
  - `~/.student-claw/memory/daily/YYYY-MM-DD.md`
  - `~/.student-claw/memory/weekly/YYYY-Www.md`
  - `~/.student-claw/memory/graph/**`
- `MEMORY.md` links to the fixed top-level scaffold only.
- Each top-level branch has a stable landing page that can link to child nodes.
- Course memory and assignment playbooks are explicitly modeled under
  `graph/school/`.
- The update contract distinguishes between:
  - rolling layers that can be pruned and rewritten
  - graph layers that are durable and updated in place

## Middle

### Implementation Slices

1. Freeze the v1 memory directory structure and naming conventions for daily,
   weekly, and graph files.
2. Define the fixed root graph scaffold and the stable landing-page files for
   each root branch.
3. Define the standard graph file sections so heartbeat can update them safely,
   especially:
   - title and purpose
   - linked child nodes
   - durable facts
   - observed patterns
   - evidence or source notes
4. Define the course node shape under `graph/school/courses/`, including:
   - course overview
   - Canvas layout
   - professor patterns
   - assignment strategy
   - recurring pitfalls
   - current improvements
5. Define the checkpoint/state file responsibilities and what operational data
   belongs there instead of in markdown.

### Primary Directories

- `docs/implementation/memory-heartbeat-rollout/`
- `packages/server/src/`
- `packages/electron/src/`
- `packages/contracts/src/` if typed filesystem helpers or state schemas are
  later added

### Verification Gates

- Unit:
  - filesystem helpers or schema tests can prove that daily, weekly, and graph
    paths resolve to the expected layout
- Integration:
  - one end-to-end heartbeat prototype can enumerate the root layout and update
    a course node without inventing extra directories
- Manual smoke:
  - one reviewer can read the phase doc and reconstruct the full memory tree
    without consulting other documents
- Failure path:
  - ambiguous placement of state between markdown and `heartbeat-state.json` is
    surfaced and resolved before implementation begins

### Evidence To Capture

- finalized filesystem tree example
- sample `MEMORY.md` root links
- one sample course-node outline
- one sample checkpoint/state payload sketch once implementation starts

## End

### Done When

- the markdown memory filesystem contract is fixed
- later phases no longer need to debate where files live, what is rolling, or
  what the root scaffold looks like

### Handoff To Next Phase

Phase 01 can now build the isolated heartbeat scheduler and checkpointing
behavior against one stable filesystem target.

### Risks To Carry Forward

- if the graph-file update shape remains vague, later phases may create brittle
  string-replacement logic
- if checkpoint responsibilities leak into markdown, recovery behavior will be
  harder to reason about

### First Recommended Next Step

Start [Phase 01 - Heartbeat Scheduler And Run Checkpointing](phase-01-heartbeat-scheduler-and-run-checkpointing.md).
