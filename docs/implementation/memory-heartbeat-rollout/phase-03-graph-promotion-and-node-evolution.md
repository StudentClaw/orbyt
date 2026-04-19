# Phase 03 - Graph Promotion And Node Evolution

Last updated: 2026-04-19

## Orientation Note

- Target feature: define how durable facts and repeated patterns get promoted
  from daily and weekly memory into the long-term markdown graph
- Key dependencies: [PLAN.md](../../../PLAN.md),
  [GLOSSARY.md](GLOSSARY.md),
  [phase-00-memory-filesystem-scaffold-and-contracts.md](phase-00-memory-filesystem-scaffold-and-contracts.md),
  [phase-02-daily-and-weekly-distillation-pipeline.md](phase-02-daily-and-weekly-distillation-pipeline.md),
  [docs/features/02-canvas-integration.md](../../features/02-canvas-integration.md)
- Constraints and boundaries:
  - the graph is rooted at `MEMORY.md`
  - top-level branches stay fixed, but heartbeat may add child nodes below them
  - promotion requires repeated evidence by default
  - explicit high-confidence facts may promote immediately
  - heartbeat must prefer updating existing nodes over creating new ones
- Acceptance criteria for this increment:
  - promotion rules are decision-complete
  - the graph can represent both course-specific strategy and cross-course
    playbooks
  - course nodes explicitly include Canvas layout memory
  - duplicate promotion prevention is clearly defined

## Beginning

### Objective

Define how the durable memory graph grows so it reflects how the student learns
through the semester rather than becoming a dump of old events.

### Current State

- The approved product direction is that graph nodes should store lessons rather
  than transcripts.
- `school` must represent both:
  - course-specific strategy
  - assignment playbooks and study patterns that can span multiple classes
- Course strategy must also preserve how the Canvas for that course is actually
  organized.

### Out Of Scope

- scheduler behavior
- daily or weekly pruning
- UI rendering or editing of graph nodes

### Acceptance Criteria

- The default promotion rule requires the same idea to appear at least twice
  across recent evidence before graph creation or graph update.
- Immediate-promotion rules are fixed for:
  - explicit stable student preferences
  - explicit course-structure facts
  - explicit professor or course workflow rules
  - clear reusable assignment strategies
- The graph update contract prefers:
  - update existing node
  - create new child node only if the idea does not fit an existing branch
- The `school` branch includes at least:
  - `courses/`
  - `assignment-playbooks/`
  - `study-patterns`
  - `wins-and-improvements`

## Middle

### Implementation Slices

1. Define the promotion inputs:
   - promotion candidates from daily files
   - repeated patterns from weekly files
   - explicit high-confidence facts from either layer
2. Define the graph-writing rule that durable memories should be phrased as
   guidance rather than events.
3. Define node-selection rules so heartbeat chooses between:
   - existing node update
   - existing branch child creation
   - no promotion yet
4. Define the standard child-node patterns under `school`, especially:
   - course pages for one class
   - assignment playbook pages for reusable approaches
   - study-pattern or improvement pages for semester-long behaviors
5. Define duplicate-prevention and source-note handling so the same pattern does
   not get promoted repeatedly from overlapping daily and weekly evidence.

### Primary Directories

- `packages/server/src/`
- `packages/electron/src/` if heartbeat execution helpers live there
- `docs/implementation/memory-heartbeat-rollout/`

### Verification Gates

- Unit:
  - promotion tests can prove repeated evidence promotes exactly once
  - durable-fact tests can prove an explicit Canvas layout fact can promote
    immediately
- Integration:
  - one heartbeat run can update an existing course node and an existing
    assignment-playbook node without creating unnecessary duplicate pages
- Manual smoke:
  - a reviewer can compare an event-style daily note to a lesson-style graph
    node and see the intended transformation clearly
- Failure path:
  - overlapping evidence from multiple runs cannot promote the same idea into
    duplicate graph nodes

### Evidence To Capture

- one sample course node with Canvas layout and success strategy
- one sample assignment-playbook node
- one before-and-after example of repeated evidence becoming one graph update

## End

### Done When

- graph promotion and node evolution rules are decision-complete
- later phases no longer need to debate what qualifies as durable memory or how
  the graph should grow

### Handoff To Next Phase

Phase 04 can now connect real thread and Canvas inputs to the graph without
reopening the memory-model design.

### Risks To Carry Forward

- if promotion rules are too loose, the graph will become noisy
- if new-node creation is too easy, the graph will fragment into hard-to-maintain
  micro-pages

### First Recommended Next Step

Start [Phase 04 - Integration With Threads, Canvas Context, And Memory Reads](phase-04-integration-with-threads-canvas-context-and-memory-reads.md).
