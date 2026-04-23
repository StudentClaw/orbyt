# At-Mention Context System Glossary, Tracker, And Handoff

Last updated: 2026-04-23

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
| 00 - Reference Contracts And Persistence | not_started | Unassigned | Not run | Add `TurnReferenceInput` contracts, migration, and DB helpers so turns carry references end-to-end in data |
| 01 - Prompt And Display Serialization | not_started | Unassigned | Not run | Extend `buildPromptContent` / `extractDisplayContent` with a `Referenced Canvas assignments:` block |
| 02 - Workspace File Search IPC | not_started | Unassigned | Not run | Add `FILE_SEARCH_WORKSPACE` IPC with fuzzy match, denylist, depth cap, and recents boost |
| 03 - Mention Lib And Composer @ Trigger | not_started | Unassigned | Not run | Add `mentions.ts` and teach `RichComposer` to detect `@` and insert kind-aware chips |
| 04 - MentionPicker UI | not_started | Unassigned | Not run | Build the two-section dropdown with permissions-aware empty states |
| 05 - Chat Composer Wiring | not_started | Unassigned | Not run | Route picker selections through `PromptInput` -> `useChat` -> `sendTurn` with references |
| 06 - Skill Editor Mentions | not_started | Unassigned | Not run | Replace `SkillEditor` textarea with mention-aware composer and round-trip markdown |

## Current Recommended Next Step

Cut a feature branch `feature/at-mention-context-system` and start [Phase 00 - Reference Contracts And Persistence](phase-00-reference-contracts-and-persistence.md).

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

### Mention

An inline reference the user inserts with `@` that points to a concrete context object the agent should read before acting. Cardinality: many per turn. Contrasts with a **Skill**, which is invoked with `/`, is bounded to one per turn, and changes how the agent behaves.

### Reference

A structured, path-less pointer to an external object (currently `canvas-assignment`). Persisted in `orchestration_turn_references`. Carried through the turn as `TurnReferenceInput`. Contrasts with an **Attachment**, which is a filesystem-backed object with a real `path`.

### Attachment

The existing `TurnAttachmentInput` shape (`path`, `name`, `mimeType`, `sizeBytes`, `kind: "image" | "file"`). `@file` mentions flow through this pipeline unchanged; the only thing `@file` adds is an inline entry point from the composer into the attachment tray.

### Late Binding

The turn payload carries only a stable reference, never resolved content. Codex calls the appropriate MCP tool (for example `get_assignment_details`) at tool-call time to materialize the content. This keeps turn payloads small, avoids staleness at author time, and removes resolver responsibility from our codebase.

### MentionPicker

The dropdown shown when the user types `@` in a mention-aware composer. Renders two sections in v1: Assignments (pulled from `useCanvasUpcomingAssignments`) and Files (pulled from the `FILE_SEARCH_WORKSPACE` IPC plus in-session recents), with a `Browse...` row that falls back to the existing native file picker.

### Mention Chip

The non-editable inline DOM node inserted into `RichComposer` when a mention is picked. Chips carry enough `dataset` metadata to reconstruct the underlying `TurnReferenceInput` or `TurnAttachmentInput` on send, and to round-trip to a plain markdown link when saved inside a skill's `SKILL.md`.

### Skill Editor Round-Trip

The loop where skill markdown on disk -> parsed mentions -> chips in the editor -> re-serialized markdown -> disk. Serialization uses plain markdown link syntax (no Orbyt-specific annotations) so `SKILL.md` files remain portable and Codex reads them natively.

### Workspace Root

The per-thread directory created via `OrchestrationService.createWorkspace`. `@file` searches walk this root with a depth cap and a denylist (`node_modules`, `.git`, common binary extensions). `download_course_file` already enforces that Canvas downloads land inside this root.

### Recents Boost

The ranking rule that surfaces recently attached or referenced files at the top of the `@file` picker, matching Cursor's frecency-style behavior. In v1 recents live in an in-memory per-session store; persistence across app restarts is deferred.

### Permissions Gate

The UI affordance that disables a `@`-menu section when the thread lacks the required capability (for example the Assignments section requires `canvas.shared.read`). Mirrors the "Needs permission (N)" pattern already used by `SkillPicker`.

### Verification Gate

The set of checks that must be green before a phase can be marked complete:

- unit coverage for the phase's core contract
- one integration check
- one manual smoke test
- one failure-path check

### TDD Cycle

The per-phase ordered list of red/green pairs under "Middle -> TDD Cycle". Each pair is one failing test followed by the minimal implementation that makes it pass. No test in a later pair may be written before its predecessor's implementation is green. Refactor steps live at the end of the cycle, never while red.

## Phase Handoff Log

### Phase 00 - Reference Contracts And Persistence

- Pending first implementation pass.

### Phase 01 - Prompt And Display Serialization

- Pending first implementation pass.

### Phase 02 - Workspace File Search IPC

- Pending first implementation pass.

### Phase 03 - Mention Lib And Composer @ Trigger

- Pending first implementation pass.

### Phase 04 - MentionPicker UI

- Pending first implementation pass.

### Phase 05 - Chat Composer Wiring

- Pending first implementation pass.

### Phase 06 - Skill Editor Mentions

- Pending first implementation pass.
