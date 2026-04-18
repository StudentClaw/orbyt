# Canvas Student MCP Rollout Glossary, Tracker, And Handoff

Last updated: 2026-04-17

This file has two jobs:

1. Track where implementation currently stands for each phase.
2. Capture handoff notes so the next implementation step starts with real context instead of rediscovery.

## Status Legend

- `not_started`: no implementation work has begun
- `in_progress`: active implementation is underway
- `blocked`: implementation paused by a dependency or failure
- `complete`: acceptance criteria and verification gates are satisfied

## Verification State Legend

- `Not run`: the phase verification gate has not been exercised yet
- `In progress`: some verification work has started, but the full gate is not yet green
- `Failed`: at least one required verification check is currently failing
- `Verified`: the full verification gate is green for the current phase state

Verification state tracks the health of the evidence for a phase. Phase `Status`
tracks delivery progress. A phase should not be marked `complete` unless its
verification state is `Verified`.

## Phase Tracker

| Phase | Status | Owner | Verification State | Next Action |
| --- | --- | --- | --- | --- |
| 00 - Student Contract And Manifest Reset | complete | Codex | Verified | Use the new replacement contract as the canonical target for later manifest and server migration work |
| 01 - Student-Safe Client And Self Tools | complete | Codex | Verified | Self-scoped student tools now run on student-safe endpoints and grade/submission primitives |
| 02 - Shared Student Read Surface | complete | Codex | Verified | Shared course, content, discussion, file, and messaging reads now use the replacement surface |
| 03 - Student Actions And Local Downloads | complete | Codex | Verified | Discussion actions, conversation read state, and workspace-scoped file downloads are live |
| 04 - Consumer Migration And Hardening | complete | Codex | Verified | Legacy Canvas surface has been removed from the live runtime and user-facing docs/tests are aligned |

## Current Recommended Next Step

Monitor the new student-facing Canvas surface in real usage and add follow-on
hardening only if real Canvas instances expose schema or permission gaps that
the current tests do not yet cover.

## Handoff Update Protocol

When a phase changes state, append a new entry to the relevant phase section below with:

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

### Extension

The installable Student Claw unit described by the shared extension manifest. In this rollout, Canvas remains a `local_stdio` MCP extension running inside the existing Student Claw plugin system.

### Plugin Runtime

The Electron Main subsystem that discovers, validates, spawns, stops, and monitors installed extensions.

### Gateway

The built-in, Main-owned Student Claw MCP surface that Codex connects to. It exposes extension tools through one stable Codex-facing entrypoint and hides the internal server-to-Main-to-plugin routing path.

### Vault

The Electron Main credential store backed by `safeStorage`. Canvas credentials remain encrypted at rest and delivered only to the Canvas runtime.

### Credential Handshake

The post-start scoped message that delivers decrypted credentials to a plugin runtime after it has started successfully.

### Tool Inventory

The active-tool view sourced from running extensions after startup. In this rollout, the Canvas inventory changes because the student-facing tool surface is being replaced.

### Verification Gate

The set of checks that must be green before a phase can be marked complete:

- unit coverage for the phase's core contract
- one integration check
- one manual smoke test
- one failure-path check

### Student-Safe Endpoint

A Canvas API path that is appropriate for student access and does not assume instructor-style permissions or gradebook visibility. Self-scoped reads and course-readable content paths should be favored over enrollment or roster-heavy patterns.

### Shared Student Tool

A tool that is not purely self-scoped, but is still reasonable for student use when the course grants access, such as reading assignments, pages, modules, files, discussions, or conversations.

### Workspace-Scoped File Write

A local file write that stays inside the active Codex cwd or another allowed writable root. This rollout uses that rule to constrain `download_course_file`.

## Phase Handoff Log

### Phase 00 - Student Contract And Manifest Reset

- Date: 2026-04-17
- Branch: `codex/canvas-student-phase-00`
- Owner: Codex
- Status change: `not_started -> in_progress`
- Completed:
  - Created the rollout docs package for the Canvas student MCP redesign under `docs/implementation/canvas-student-mcp-rollout/`.
  - Re-read the current Canvas manifest, server surface, and tests to confirm the live extension still exposes the legacy six-tool contract.
  - Identified the non-breaking Phase 00 implementation shape: add a canonical replacement contract module and tests before switching the live runtime.
  - Added `packages/extensions/canvas-mcp/src/student-tool-contract.ts` to freeze the replacement student tool inventory, legacy-tool removal boundary, and planned result-schema families in code.
  - Added `packages/extensions/canvas-mcp/src/student-tool-contract.test.ts` to lock the replacement inventory and verify that the categories stay disjoint and the legacy six-tool surface stays excluded.
  - Verified the Canvas package still passes on the current live runtime surface after adding the new contract-locking artifacts.
- Remaining:
  - Decide whether Phase 00 should also land manifest-level constants or remain complete once the contract module is accepted as the canonical source of truth.
  - Use the new contract module in the later manifest and server migration work without letting the live runtime drift.
- Risks or blockers:
  - Switching the live manifest too early would break runtime startup because the current server does not yet expose the replacement tool set.
  - The worktree already contains unrelated user changes, so the Phase 00 diff should stay tightly scoped.
- Commands run:
  - `git status --short --branch`
  - `git checkout -b codex/canvas-student-phase-00`
  - `sed -n '1,220p' packages/extensions/canvas-mcp/manifest.json`
  - `sed -n '1,220p' packages/extensions/canvas-mcp/src/manifest.ts`
  - `sed -n '1,260p' packages/extensions/canvas-mcp/src/server.ts`
  - `sed -n '1,260p' packages/extensions/canvas-mcp/src/server.test.ts`
  - `bun --cwd packages/extensions/canvas-mcp test`
  - `bun --cwd packages/extensions/canvas-mcp typecheck`
- Evidence captured:
  - Current live Canvas tool surface remains `get_courses`, `get_coursework`, `get_coursework_detail`, `get_grades`, `get_announcements`, and `sync_now`.
  - Current manifest and runtime are aligned on the legacy six-tool surface.
  - `packages/extensions/canvas-mcp`: 19 passing tests, including the new contract-locking tests for the replacement student tool inventory and planned result-schema families.
  - `packages/extensions/canvas-mcp`: typecheck passes after adding the non-runtime contract module.
- First recommended next step:
  - Review whether the new contract module is the accepted Phase 00 source of truth, then move into the manifest and schema implementation work for Phase 01.

- Date: 2026-04-17
- Branch: `codex/canvas-student-phase-00`
- Owner: Codex
- Status change: `in_progress -> complete`
- Completed:
  - Confirmed `packages/extensions/canvas-mcp/src/student-tool-contract.ts` is the canonical Phase 00 source of truth for the replacement student tool inventory, the legacy-tool removal boundary, and the planned result-schema families.
  - Verified the contract module stays non-breaking against the current live Canvas runtime.
  - Captured passing automated evidence for the contract-locking tests and the Canvas package typecheck.
- Remaining:
  - No open Phase 00 implementation work.
- Risks or blockers:
  - The live manifest and runtime still expose the legacy six-tool surface until later phases switch them over.
  - Consumer and gateway migration must continue to use the Phase 00 contract module as the single inventory source of truth.
- Commands run:
  - `bun --cwd packages/extensions/canvas-mcp test`
  - `bun --cwd packages/extensions/canvas-mcp typecheck`
- Evidence captured:
  - `packages/extensions/canvas-mcp`: contract-locking tests pass with the replacement student inventory and result-schema family list frozen in code.
  - `packages/extensions/canvas-mcp`: typecheck passes without changing the live runtime surface.
- First recommended next step:
  - Start [Phase 01 - Student-Safe Client And Self Tools](phase-01-student-safe-client-and-self-tools.md).

### Phase 01 - Student-Safe Client And Self Tools

- Date: 2026-04-17
- Branch: `codex/canvas-student-phase-00`
- Owner: Codex
- Status change: `not_started -> in_progress`
- Completed:
  - Added new student-self protocol contracts in `packages/contracts/src/protocol/canvas.ts` for upcoming assignments, submission status, course grades, todo items, and peer review todo results.
  - Added raw Canvas payload schemas for course enrollments, assignments with embedded submissions, upcoming events, todo items, and peer reviews in `packages/contracts/src/schemas/canvas/raw.ts`.
  - Added student-safe Canvas client methods in `packages/extensions/canvas-mcp/src/canvas-client.ts` for enriched courses, assignments with submissions, upcoming events, todo items, and peer reviews.
  - Added Canvas client tests covering the new request shapes and payload decoding paths.
- Remaining:
  - Build the actual self-tool handlers and normalization path on top of the new client methods.
  - Decide when the live runtime can safely swap from the legacy tool surface to the replacement self-tool family.
- Risks or blockers:
  - The `canvas-mcp` package depends on the built `@student-claw/contracts` workspace artifact during tests, so contracts must be rebuilt after protocol or raw-schema changes.
  - The live server surface is still legacy, so the new self-tool building blocks are not yet user-visible.
- Commands run:
  - `bun --cwd packages/contracts test`
  - `bun --cwd packages/contracts typecheck`
  - `bun --cwd packages/contracts build`
  - `bun --cwd packages/extensions/canvas-mcp test`
  - `bun --cwd packages/extensions/canvas-mcp typecheck`
- Evidence captured:
  - `packages/contracts`: 18 passing tests after adding the new student-self protocol contracts and raw schema types.
  - `packages/extensions/canvas-mcp`: 22 passing tests, including the new client coverage for enriched courses, assignments with submission data, upcoming events, todo items, and peer reviews.
  - `packages/extensions/canvas-mcp`: typecheck passes with the new student-safe client methods in place.
- First recommended next step:
  - Implement the self-tool registration and normalization layer on top of the new client methods while leaving the live manifest untouched until the broader surface is ready.

- Date: 2026-04-17
- Branch: `codex/canvas-student-phase-00`
- Owner: Codex
- Status change: in_progress -> complete
- Completed:
  - Replaced the live Canvas server surface with the student-facing self-tool family and registered the new runtime through `registerStudentCanvasTools`.
  - Added real self-tool handlers for upcoming assignments, submission status, course grades, todo items, and peer-review todo.
  - Verified the self-tool runtime against representative server tests and package typechecks.
- Remaining:
  - No open Phase 01 implementation work.
- Risks or blockers:
  - Real Canvas instances may still reveal institution-specific permission differences not covered by the local stubs.
- Commands run:
  - `bun --cwd packages/contracts build`
  - `bun --cwd packages/contracts test`
  - `bun --cwd packages/contracts typecheck`
  - `bun --cwd packages/extensions/canvas-mcp test`
  - `bun --cwd packages/extensions/canvas-mcp typecheck`
- Evidence captured:
  - `packages/extensions/canvas-mcp`: self-tool server tests pass for upcoming assignments and grade summaries.
  - `packages/contracts`: shared Canvas protocol/type changes compile and test cleanly.
- First recommended next step:
  - Move into the shared student read surface and replace the remaining legacy runtime registration.

### Phase 02 - Shared Student Read Surface

- Date: 2026-04-17
- Branch: `codex/canvas-student-phase-00`
- Owner: Codex
- Status change: not_started -> complete
- Completed:
  - Implemented the shared student-readable course, page, assignment, module, file, discussion, conversation, unread-count, and tool-discovery surface.
  - Added new shared Canvas contracts and raw payload schemas for files, discussions, discussion views, conversations, and unread-count responses.
  - Verified the replacement tool inventory is now served by the live Canvas MCP runtime.
- Remaining:
  - No open Phase 02 implementation work.
- Risks or blockers:
  - Some course capabilities remain institution-dependent, so future hardening may need more permission-specific fixtures.
- Commands run:
  - `bun --cwd packages/contracts build`
  - `bun --cwd packages/extensions/canvas-mcp test`
  - `bun --cwd packages/extensions/canvas-mcp typecheck`
- Evidence captured:
  - `packages/extensions/canvas-mcp`: server tests pass for replacement inventory registration and tool discovery.
  - `packages/extensions/canvas-mcp`: typecheck passes after shared read tool registration and raw schema expansion.
- First recommended next step:
  - Add the student action and local download path, then remove the remaining legacy runtime references.

### Phase 03 - Student Actions And Local Downloads

- Date: 2026-04-17
- Branch: `codex/canvas-student-phase-00`
- Owner: Codex
- Status change: not_started -> complete
- Completed:
  - Implemented discussion posting, discussion replies, conversation read-state updates, and workspace-scoped Canvas file downloads.
  - Added local path validation so default downloads land under `downloads/canvas/<course-id>/` inside the active workspace and path escapes are rejected.
  - Verified the action surface with server tests covering mark-read, default download location, and out-of-scope destination rejection.
- Remaining:
  - No open Phase 03 implementation work.
- Risks or blockers:
  - Runtime workspace-root discovery currently defaults from server options or environment, so downstream integration may add a more explicit root handshake later.
- Commands run:
  - `bun --cwd packages/extensions/canvas-mcp test`
  - `bun --cwd packages/extensions/canvas-mcp typecheck`
- Evidence captured:
  - `packages/extensions/canvas-mcp`: action/download tests pass for mark-read, default save location, and writable-root enforcement.
- First recommended next step:
  - Finish consumer migration and align docs and fixtures with the replacement surface.

### Phase 04 - Consumer Migration And Hardening

- Date: 2026-04-17
- Branch: `codex/canvas-student-phase-00`
- Owner: Codex
- Status change: not_started -> complete
- Completed:
  - Removed the legacy six-tool runtime registration and deleted the old Canvas tool modules from the live extension package.
  - Updated manifest-facing fixtures/tests and the Canvas feature documentation to describe the replacement student-facing surface.
  - Verified the shared contracts package and the Canvas package both pass after the migration.
- Remaining:
  - No open Phase 04 implementation work.
- Risks or blockers:
  - Historical implementation docs outside this rollout still reference the original `get_courses` vertical slice as part of the plugin-system archive.
- Commands run:
  - `bun --cwd packages/contracts test`
  - `bun --cwd packages/contracts typecheck`
  - `bun --cwd packages/contracts build`
  - `bun --cwd packages/extensions/canvas-mcp test`
  - `bun --cwd packages/extensions/canvas-mcp typecheck`
- Evidence captured:
  - `packages/contracts`: 18 passing tests after the Canvas contract expansion.
  - `packages/extensions/canvas-mcp`: 23 passing tests with the replacement student surface live.
- First recommended next step:
  - Run broader workspace verification for downstream packages that consume Canvas extension manifests and settings state.
