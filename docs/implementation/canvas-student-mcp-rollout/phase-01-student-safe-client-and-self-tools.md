# Phase 01 - Student-Safe Client And Self Tools

Last updated: 2026-04-17

## Orientation Note

- Target feature: redesign the Canvas client strategy around student-safe endpoints and define the self-scoped student tools that depend on it
- Key dependencies: Phase 00 contract reset, [docs/features/02-canvas-integration.md](../../features/02-canvas-integration.md), [docs/architecture/05-external-services.md](../../architecture/05-external-services.md), current `packages/extensions/canvas-mcp/src/canvas-client.ts`
- Constraints and boundaries:
  - keep the current plugin runtime and credential handshake
  - prefer self-safe Canvas patterns over gradebook or roster-style reads
  - do not widen into shared read tools yet
  - do not migrate consumers yet
- Acceptance criteria for this increment:
  - student-safe endpoint strategy is explicit
  - permission semantics for `401`, `403`, and partial access are defined for self tools
  - self-scoped tools have clear input, output, and failure behavior
  - enrollment-based grade fetching is no longer part of the planned baseline

## Beginning

### Objective

Define the safe Canvas client behavior and self-scoped student tool set that can serve as the dependable baseline for the rest of the rollout.

### Current State

- The current Canvas client uses a mix of student-safe and more permission-sensitive course-scoped reads.
- The current grade flow depends on course enrollments plus per-assignment submissions.
- Discovery work showed the reference repo's student tools rely more heavily on self endpoints and assignment submission includes.

### Out Of Scope

- shared course, content, discussion, file, and messaging tools
- local file download writes
- gateway inventory migration
- feature-doc rewrites

### Acceptance Criteria

- A student-safe endpoint strategy is documented for:
  - upcoming assignments
  - submission status
  - course grades
  - todo items
  - peer review todo
- Self tools define whether they are single-call, aggregate, or per-course composite behaviors.
- `401` is treated as auth failure and `403` as capability denial without collapsing the whole plugin plan.
- Grade and submission plans do not rely on course enrollment reads as the primary baseline.

## Middle

### Implementation Slices

1. Define the student-safe client rules:
   - favor `/users/self/*` where a self path exists
   - use course-scoped reads only when students normally have equivalent access
   - treat teacher-only filters and roster assumptions as invalid
2. Define the self-tool behavior for:
   - `get_my_upcoming_assignments`
   - `get_my_submission_status`
   - `get_my_course_grades`
   - `get_my_todo_items`
   - `get_my_peer_reviews_todo`
3. Define the data-shaping strategy for each self tool:
   - summary text expectations
   - structured result expectations
   - ordering and aggregation rules
4. Define error and partial-success semantics:
   - auth failure
   - per-course denial
   - no-visible-data states
   - rate-limit handling assumptions
5. Identify the Canvas client methods that later implementation must remove, replace, or narrow.

### Primary Directories

- `packages/extensions/canvas-mcp/src/`
- `packages/extensions/canvas-mcp/src/tools/`
- `packages/contracts/src/schemas/`
- `docs/implementation/canvas-student-mcp-rollout/`

### Verification Gates

- Unit:
  - future client tests cover self-safe request construction and permission mapping
  - future tool tests cover structured results for each self tool
- Integration:
  - a student token can drive all self tools without depending on enrollments or instructor-only reads
- Manual smoke:
  - one student credential flow can show upcoming work, grades, todo items, and submission status from the new self tools
- Failure path:
  - one denied or hidden course does not poison aggregate self-tool responses

### Evidence To Capture

- endpoint mapping table for each self tool
- one example partial-success response
- one example auth failure response

## End

### Done When

- the Canvas client baseline is student-safe by default
- the self-scoped tool family is decision-complete enough to implement without re-opening endpoint strategy debates

### Handoff To Next Phase

Phase 02 can now build the shared student read surface on top of a stable permission model and client strategy.

### Risks To Carry Forward

- if self-tool result contracts are too loose, shared tools will repeat the same ambiguity
- if `403` handling is inconsistent across client methods, later phases will make the student experience feel random

### First Recommended Next Step

Start [Phase 02 - Shared Student Read Surface](phase-02-shared-student-read-surface.md).
