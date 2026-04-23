# Phase 01 - Prompt And Display Serialization

Last updated: 2026-04-23

## Orientation Note

- Target feature: extend the string Codex sees so it understands references alongside attachments, and strip that block back out for transcript display
- Key dependencies: Phase 00 contracts (`TurnReferenceInput`), [packages/ui/src/lib/chatAttachments.ts](../../../packages/ui/src/lib/chatAttachments.ts)
- Constraints and boundaries:
  - do not touch IPC, composer, picker, or skill editor code
  - do not introduce Canvas-specific string templates that could drift from MCP tool expectations
  - preserve exact existing output when zero references are present
- Acceptance criteria for this increment:
  - `buildPromptContent` emits a `Referenced Canvas assignments:` block before the attachments block when references are present
  - `extractDisplayContent` strips both blocks in either order
  - pure-function coverage is exhaustive for every combination of refs and attachments

## Beginning

### Objective

Prove that Codex can read references in the prompt without any runtime tool change. `get_assignment_details` already exists; the prompt just needs to mention enough metadata (assignment id, course id, url) that Codex can call it.

### Current State

- [packages/ui/src/lib/chatAttachments.ts](../../../packages/ui/src/lib/chatAttachments.ts) contains `buildPromptContent` and `extractDisplayContent` as pure functions with a single `Attached files:` header.
- Nothing in the lib is aware of references yet.

### Out Of Scope

- reading references from a persisted turn (Phase 00 already handles the data path)
- IPC, composer, picker, editor work
- server-side prompt construction (this lib runs in both the renderer and the server path through `buildPromptContent` before a turn is sent)

### Acceptance Criteria

- When references exist, the prompt emits:
  ```
  Referenced Canvas assignments:
  - "<label>" (assignment_id=<id>, course_id=<id>, url=<url>)
  ```
- When references and attachments both exist, the references block precedes the attachments block.
- When only attachments exist, output is byte-identical to today's output.
- `extractDisplayContent` strips whichever blocks are present and returns the bare user message.

## Middle

### Implementation Slices

1. Add `REFERENCED_ASSIGNMENTS_HEADER` and a formatter for one reference line.
2. Extend `buildPromptContent` to accept `references: readonly TurnReferenceInput[]` and emit the block.
3. Extend `extractDisplayContent` with a symmetric strip for the references block.
4. Update call sites in `useChat` and the orchestration send path to pass references (signature widening only; no wiring yet beyond plumbing the argument).

### Primary Directories

- `packages/ui/src/lib/`
- `packages/ui/src/__tests__/`

### TDD Cycle

1. RED: `buildPromptContent("hi", [], [oneRef])` returns a string that starts with `Referenced Canvas assignments:` and contains the assignment id and url.
   GREEN: add the header constant and the references block.
2. RED: `buildPromptContent("hi", [oneAttachment], [oneRef])` contains the references block before the attachments block.
   GREEN: order the two blocks deterministically.
3. RED: `buildPromptContent("hi", [oneAttachment], [])` produces output byte-identical to today's `buildPromptContent("hi", [oneAttachment])`.
   GREEN: skip the references block when empty; no behavior change for attachments-only turns.
4. RED: `buildPromptContent("", [], [])` returns the empty string (no spurious headers).
   GREEN: short-circuit the trivial path.
5. RED: `extractDisplayContent(buildPromptContent("hi", [], [oneRef]), [], [oneRef])` returns `"hi"`.
   GREEN: extend `extractDisplayContent` with the symmetric strip.
6. RED: `extractDisplayContent` with both blocks present strips both and returns the user message.
   GREEN: chain the two strip passes.
7. RED: `extractDisplayContent` on an input that does not start with either header returns the input unchanged.
   GREEN: guard the strip with a prefix check (already the pattern for attachments).
8. Refactor: pull the header-strip helper into a shared internal function so future kinds can plug in without duplication.

### Verification Gates

- Unit:
  - exhaustive coverage for the cross product of (refs present / absent) x (attachments present / absent) x (body present / absent)
- Integration:
  - a `sendTurn` test asserts the string Codex would see contains the references block (no live Codex call)
- Manual smoke:
  - none (pure functions)
- Failure path:
  - reference with `url: null` still renders a clean line without literal `"null"` in the output

### Evidence To Capture

- passing test names covering the cross product above
- one rendered sample string for each of the four matrix cells
- byte-identical regression proof for attachments-only output

## End

### Done When

- the lib renders both blocks deterministically
- existing attachments-only turns produce byte-identical output
- no call site downstream of this lib is broken

### Handoff To Next Phase

Phase 05 (Chat Composer Wiring) consumes this lib directly. Phase 02 and Phase 03 do not depend on it but may proceed in parallel.

### Risks To Carry Forward

- if the reference line format drifts later, Codex may stop parsing assignment ids correctly; pin it with a snapshot test
- if `extractDisplayContent` does not cover both orders symmetrically, transcripts will show raw headers to the user

### First Recommended Next Step

Start [Phase 02 - Workspace File Search IPC](phase-02-workspace-file-search-ipc.md) or [Phase 03 - Mention Lib And Composer @ Trigger](phase-03-mention-lib-and-composer-at-trigger.md); both can run in parallel.
