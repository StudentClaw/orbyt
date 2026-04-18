# Phase 03 - Student Actions And Local Downloads

Last updated: 2026-04-17

## Orientation Note

- Target feature: define the student-side actions that remain in scope and the local download contract for Canvas files
- Key dependencies: Phase 02 shared read surface, [docs/architecture/05-external-services.md](../../architecture/05-external-services.md), Student Claw workspace and writable-root constraints, current file and discussion tool patterns
- Constraints and boundaries:
  - include student-safe Canvas-side effects only
  - all local writes must stay inside the active Codex cwd or writable roots
  - do not widen into educator messaging or file upload
  - do not migrate consumers yet
- Acceptance criteria for this increment:
  - student-side action tools are fully defined
  - `download_course_file` has a decision-complete local write contract
  - path-safety and failure behavior are explicit
  - action tools and download flows use the same permission language as earlier phases

## Beginning

### Objective

Define the student-side effects that the new Canvas surface will support and make local file download behavior safe and predictable in the Student Claw environment.

### Current State

- The target student surface includes discussion participation, conversation state changes, and real local file downloads.
- The app runs through Codex CLI with workspace-scoped write access rather than an unrestricted desktop filesystem model.
- The current rollout has not yet defined how a Canvas file download chooses a save location or rejects unsafe paths.

### Out Of Scope

- educator messaging send flows
- file upload
- page or module mutations
- consumer migration and gateway cleanup

### Acceptance Criteria

- Student action tools are defined for:
  - `post_discussion_entry`
  - `reply_to_discussion_entry`
  - `mark_conversations_read`
- `download_course_file` defines:
  - default save location
  - optional destination path behavior
  - path normalization and escape rejection
  - returned metadata and saved-path contract
  - overwrite or collision handling expectations
- Permission and failure semantics are explicit for both Canvas-side effects and local-write failures.

## Middle

### Implementation Slices

1. Define the student action contract for:
   - posting a new discussion entry
   - replying to an existing discussion entry
   - marking conversations read
2. Define action-tool input, output, and failure behavior:
   - capability denied
   - resource hidden or locked
   - validation failure
   - successful state-change response
3. Define the local download contract for `download_course_file`:
   - optional `destinationPath`
   - default fallback path under the active workspace
   - course-based folder strategy
   - sanitized filename strategy
4. Define file-write safety rules:
   - resolve relative paths against the active cwd
   - allow writes only inside the active workspace or writable roots
   - reject traversal or out-of-scope writes
   - surface local permission and collision errors clearly
5. Define the structured download result:
   - source file metadata
   - final saved path
   - overwrite or collision result
   - any warnings about adjusted filenames or paths

### Primary Directories

- `packages/extensions/canvas-mcp/src/tools/`
- `packages/extensions/canvas-mcp/src/canvas-client.ts`
- `packages/contracts/src/schemas/`
- `packages/server/src/mcp/`
- `packages/electron/src/plugins/`

### Verification Gates

- Unit:
  - future action-tool tests cover validation, success, and permission-denied outcomes
  - future download tests cover path normalization, escape rejection, and result shaping
- Integration:
  - one student token can perform a discussion action and download a file into a workspace-scoped location
- Manual smoke:
  - one student can trigger a discussion reply and save a Canvas file into the active workspace
- Failure path:
  - invalid destination paths and out-of-scope writes fail safely without partial local writes outside policy

### Evidence To Capture

- one action success response
- one denied action response
- one successful workspace-scoped file download example
- one rejected path-traversal example

## End

### Done When

- the student-side action surface is decision-complete
- local file downloads can be implemented without re-opening workspace-safety or save-path questions

### Handoff To Next Phase

Phase 04 can migrate consumers and harden the rollout now that both the read surface and the action/download surface are fixed.

### Risks To Carry Forward

- if local download policy is underspecified, later implementation will create inconsistent save behavior across environments
- if action tools and read tools use different permission language, user-facing recovery paths will feel inconsistent

### First Recommended Next Step

Start [Phase 04 - Consumer Migration And Hardening](phase-04-consumer-migration-and-hardening.md).
