# Phase 02 - Workspace File Search IPC

Last updated: 2026-04-23

## Orientation Note

- Target feature: let the renderer ask Electron Main for files matching a fuzzy query under the thread's workspace root, with a denylist, depth cap, and recents boost, matching Cursor-style `@file` UX
- Key dependencies: [packages/contracts/src/protocol/ipc-channels.ts](../../../packages/contracts/src/protocol/ipc-channels.ts), [packages/electron/src/ipc/bridge.ts](../../../packages/electron/src/ipc/bridge.ts), existing `FILE_SELECT_ATTACHMENTS` and `FILE_GET_ATTACHMENT_METADATA` handlers
- Constraints and boundaries:
  - stay read-only on disk; no writes, no downloads
  - do not index eagerly at app boot; search lazily per query
  - denylist must include `node_modules`, `.git`, `.DS_Store`, and common binary extensions we cannot attach
  - depth cap stays small (default 8) to bound walk cost on noisy workspaces
- Acceptance criteria for this increment:
  - `FILE_SEARCH_WORKSPACE` channel exists with typed params and result
  - handler walks the workspace root, applies denylist and depth cap, fuzzy-ranks matches, and honors a result limit
  - recently attached files rank first on empty or short queries

## Beginning

### Objective

Unlock the `@file` picker UX in Phase 04 by giving it a reliable, cheap way to ask Main for candidate files. This phase is intentionally self-contained so it can run in parallel with the composer work.

### Current State

- Attachments today flow only through the OS picker (`FILE_SELECT_ATTACHMENTS`) or drag-and-drop. There is no enumeration API.
- The workspace root is known per thread via `OrchestrationService.createWorkspace` and is already the safe root for `download_course_file`.
- No recents store exists; we will add an in-memory per-session one here.

### Out Of Scope

- persistent recents across app restarts
- watching the workspace for filesystem changes
- indexing into a search database; this phase uses a naive walker + scorer, which is fine at student-scale workspace sizes

### Acceptance Criteria

- `FILE_SEARCH_WORKSPACE` params: `{ workspaceRoot: string; query: string; limit?: number }`. Result: `TurnAttachmentInput[]` (same shape as the picker returns, so the downstream pipeline is unchanged).
- Handler returns `[]` for a missing or inaccessible workspace root without throwing.
- Denylist excludes `node_modules`, `.git`, `.DS_Store`, `.next`, `dist`, and common binary extensions (`.zip`, `.mp4`, and so on) we cannot render or attach.
- Default depth cap 8, default limit 25, both overridable via params.
- Scorer ranks exact-prefix matches above subsequence matches; recents boost adds a bounded additive score.

## Middle

### Implementation Slices

1. Add the IPC channel name, params type, and result type to the contracts file.
2. Add a pure `fuzzyScore` function in [packages/electron/src/ipc/](../../../packages/electron/src/ipc/) with subsequence matching and an optional recents boost argument.
3. Add the async handler: bounded directory walk, denylist filter, score, sort, slice to limit.
4. Add an in-memory recents ring buffer keyed per-session that the existing attachment selection path writes to.
5. Wire the channel in the preload so the renderer can `electronAPI.invoke(IpcChannel.FILE_SEARCH_WORKSPACE, ...)`.

### Primary Directories

- `packages/contracts/src/protocol/`
- `packages/electron/src/ipc/`
- `packages/electron/src/__tests__/`

### TDD Cycle

1. RED: contracts include `FILE_SEARCH_WORKSPACE` with the declared params and result, proven by a type-level decode test.
   GREEN: add the channel and schema.
2. RED: handler returns `[]` when given a workspace root that does not exist on disk.
   GREEN: guard with `fs.stat` and early-return.
3. RED: handler finds a single file `draft.md` by exact name under a temp workspace.
   GREEN: implement a naive recursive walker that yields `TurnAttachmentInput`-shaped entries.
4. RED: handler skips entries under `node_modules/` and `.git/`.
   GREEN: add the denylist check at directory level.
5. RED: handler does not descend past `depth=8` by default.
   GREEN: thread depth through the walker.
6. RED: for query `"drft"`, a file named `draft.md` outranks a file named `rubric.md` where neither is an exact match.
   GREEN: add the subsequence scorer.
7. RED: a file recorded in the recents store ranks above an otherwise-equally-scored file not in recents.
   GREEN: add the in-memory recents ring buffer and additive boost.
8. RED: calling the handler with `limit: 5` returns at most 5 results.
   GREEN: slice after sort.
9. Refactor: extract the walker into a generator for clarity and reuse in future phases (for example if Phase 04 wants to stream partial results for large workspaces).

### Verification Gates

- Unit:
  - scorer: exact-prefix vs subsequence ranking; empty query yields ordered recents first
  - walker: denylist, depth cap, result limit
  - handler: missing root returns `[]`
- Integration:
  - handler wired through the preload contract produces the expected result when invoked from a renderer test harness
- Manual smoke:
  - none required; the UI consumer lands in Phase 04
- Failure path:
  - unreadable subdirectory (permissions error) is skipped without aborting the search

### Evidence To Capture

- passing test names
- one temp-workspace fixture tree with expected ordering for a sample query
- recents-boost before/after ranking for the same query

## End

### Done When

- the channel is callable from the renderer
- handler coverage for the TDD cycle is green
- no leaked file descriptors under a 1000-file fixture walk

### Handoff To Next Phase

Phase 04 (MentionPicker UI) consumes this channel directly. Phase 03 does not depend on it.

### Risks To Carry Forward

- if the denylist is too narrow, noisy workspaces will produce too many low-signal matches
- if recents are not bounded, long-running sessions will leak memory; cap the buffer length

### First Recommended Next Step

Proceed to [Phase 04 - MentionPicker UI](phase-04-mention-picker-ui.md) once Phase 03 is also ready, since the picker consumes both.
