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
| 00 - Reference Contracts And Persistence | complete | cursor | Verified | Phase 01 can start; snapshots now carry `references` end-to-end |
| 01 - Prompt And Display Serialization | complete | cursor | Verified | Phase 02 / 03 can start; references now render into prompt and strip on display |
| 02 - Workspace File Search IPC | complete | cursor | Verified | Phase 04 can consume `FILE_SEARCH_WORKSPACE` once Phase 03 lands |
| 03 - Mention Lib And Composer @ Trigger | complete | cursor | Verified | Phase 04 can plug into `onMentionTrigger` and call `insertAssignment` / `insertFile` |
| 04 - MentionPicker UI | complete | cursor | Verified | Phase 05 wires the picker into `PromptInput` and existing attach IPC |
| 05 - Chat Composer Wiring | complete | cursor | Verified | Phase 06 wires the same picker into the `SkillEditor` |
| 06 - Skill Editor Mentions | complete | cursor | Verified | All @-mention phases complete; feature is ready for manual QA end-to-end |

## Current Recommended Next Step

All seven phases (00–06) are complete and verified. The `@`-mention context system is ready for manual QA end-to-end on branch `cursor/at-mention-plan-docs`.

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

- Date: 2026-04-23
- Branch: cursor/at-mention-plan-docs
- Owner: cursor (opus-4.7)
- Status change: not_started -> complete
- Completed:
  - Added `TurnReferenceKind`, `TurnReferenceInput`, `OrchestrationTurnReference` to `packages/contracts/src/protocol/orchestration.ts` and wired them into `SendTurnParams` (optional `references`) and `OrchestrationTurn.references` (required, empty array default at write sites).
  - Created migration `packages/server/src/db/migrations/017-turn-references.ts` with `orchestration_turn_references` (id, turn_id, kind, reference_id, label, url, position) and a turn_id index; registered in `runner.ts`.
  - Added DB helpers in `OrchestrationDB.ts`: `TurnReferenceRow`, `mapTurnReferenceRow`, `readTurnReferences`, `readTurnReferencesByTurnIds`, `persistTurnReferences`, `deleteTurnReferencesForThreadIds`, `buildTurnReferences`, and extended `mapTurnRow` / `readTurn` to carry references.
  - Mirrored the same helpers and local types in the legacy duplicates inside `OrchestrationService.ts` (both stub and live sendTurn paths) and updated both snapshot assembly loops to include `referencesByTurnId`.
  - Widened `OrchestrationService.sendTurn` interface and both implementations plus `OrchestrationServiceLive.sendTurn` to accept `references?: readonly TurnReferenceInput[]` and persist them in the same transaction as attachments.
  - Wired `decoded.references ?? []` through `Router.handleSendTurn` so the WS `orchestration.sendTurn` RPC forwards references to the service.
  - Updated UI RPC surface: `WsRpcClient.orchestration.sendTurn` signature, `sendOrchestrationTurn`, and `useAppRuntime.sendTurn` all accept an optional `references` arg (not yet produced by any UI code — that is Phase 05).
  - Added `deleteTurnReferencesForThreadIds` to every thread/workspace delete path (service + live) so cleanups stay consistent with attachments.
  - Updated fixtures that build `OrchestrationTurn` literals (`packages/ui/src/__tests__/useChat.test.ts`, `chat-model.test.ts`, `chat-ui-state.test.ts`, `ChatPage.test.ts`, `packages/contracts/src/contracts.test.ts`) to include `references: []`.
  - Added new tests: `packages/contracts/src/turn-references.test.ts` (5 specs covering valid decode, invalid kind, SendTurnParams with/without references, OrchestrationTurn with references) and a migration 017 spec in `packages/server/src/__tests__/database.test.ts`.
- Remaining:
  - Phase 00 has no remaining work. Phase 01 can proceed.
- Risks or blockers:
  - None. UI package has pre-existing typecheck errors in `AppShell.test.tsx`, `PromptInput.tsx`, `SubjectBlock.tsx`, and `assignmentDetailState.ts` that are unrelated to this phase (confirmed by stashing and retyping). They will need to be addressed separately before a clean full `bun run typecheck` is possible.
- Commands run:
  - `bun --cwd packages/contracts test` -> 33 pass / 0 fail
  - `bun --cwd packages/server test` -> 266 pass / 0 fail
  - `bun --cwd packages/server typecheck` -> clean
  - `bun --cwd packages/ui vitest run src/__tests__/useChat.test.ts src/__tests__/chat-model.test.ts src/__tests__/chat-ui-state.test.ts src/__tests__/ChatPage.test.ts` -> 48 pass
- Evidence captured:
  - Migration 017 columns locked by test: `[id, turn_id, kind, reference_id, label, url, position]` plus `orchestration_turn_references_turn_id_idx`.
  - `TurnReferenceInput` shape: `{ kind: "canvas-assignment", id, label, url: string | null }` (url nullable to accommodate local Canvas items without a public URL).
  - `OrchestrationTurnReference` shape: `{ id, kind, referenceId, label, url }` (`referenceId` is the caller-supplied stable pointer; `id` is the generated row id).
- First recommended next step:
  - Start Phase 01 - Prompt And Display Serialization: add a `Referenced Canvas assignments:` block in `buildPromptContent` and strip references out of `extractDisplayContent`, driven by `OrchestrationTurn.references`.

### Phase 01 - Prompt And Display Serialization

- Date: 2026-04-23
- Branch: cursor/at-mention-plan-docs
- Owner: cursor (opus-4.7)
- Status change: not_started -> complete
- Completed:
  - Added `REFERENCED_ASSIGNMENTS_HEADER` and extracted `buildReferencesBlock` / `buildAttachmentsBlock` / `stripBlock` helpers in `packages/ui/src/lib/chatAttachments.ts`.
  - Extended `buildPromptContent` to accept a third `references: readonly TurnReferenceInput[] = []` argument and emit a `Referenced Canvas assignments:` block before the `Attached files:` block.
  - Reference lines render as `- "<label>" (assignment_id=<id>, url=<url>)`, with the `url=...` segment omitted when `url` is `null` (no literal `"null"` leaks to Codex).
  - Extended `extractDisplayContent` with a third `references` argument and a symmetric strip that peels references, then attachments, then the `User message:` header.
  - Preserved byte-identical output for attachments-only call sites (`buildPromptContent(content, attachments, [])` equals the old two-arg form, verified by test).
  - Plumbed `references` through `ChatSendInput`, `useChat.sendMessage`, and `useChat.actions.sendTurn` (args 6 now carry the reference array; callers not yet producing references pass `[]`, which is no-op).
  - Wired `turn.references` into `buildChatMessages` in `packages/ui/src/hooks/chat-model.ts` so `extractDisplayContent` strips both blocks when rendering past turns.
- Remaining:
  - None. Phase 02 (Workspace File Search IPC) and Phase 03 (Mention Lib And Composer @ Trigger) can proceed in parallel.
- Risks or blockers:
  - None new. The same 21 pre-existing UI test failures from Phase 00 remain (`App.test.tsx`, `OnboardingWizard.test.tsx`, `PreferencesStep.test.tsx`, `RoutinesStep.test.tsx`, `onboarding-guard.test.tsx`); confirmed unrelated by running those specs against the clean pre-Phase-01 tree.
  - Reference line format is now a wire contract between our lib and Codex. If Codex changes how it scrapes assignment ids, pin the format with a snapshot test before modifying.
- Commands run:
  - `bun --cwd packages/ui bunx vitest run src/__tests__/useChat.test.ts src/__tests__/chatAttachments.test.ts src/__tests__/chat-model.test.ts` -> 60 pass
  - `bun --cwd packages/ui bunx vitest run` -> 534 pass / 21 fail (all 21 are pre-existing, unrelated to Phase 01)
  - `bun --cwd packages/contracts test` -> 33 pass / 0 fail
- Evidence captured:
  - 14 new cross-product specs in `chatAttachments.test.ts` covering refs x attachments x body presence/absence, null url, byte-identical regression, and symmetric strip.
  - `useChat.test.ts` integration spec "sendMessage plumbs references into buildPromptContent and forwards them to sendTurn" asserts the string Codex sees starts with `Referenced Canvas assignments:` and the references array is forwarded to `sendTurn` as arg 6.
  - Sample prompt (body + one ref + one attachment):
    ```
    Referenced Canvas assignments:
    - "Essay 3" (assignment_id=canvas-course:42:assignment:12345, url=https://canvas.example.edu/courses/42/assignments/12345)

    Attached files:
    - /notes.pdf

    User message:
    please review
    ```
- First recommended next step:
  - Start Phase 02 (Workspace File Search IPC) and/or Phase 03 (Mention Lib And Composer @ Trigger); both can proceed independently.

### Phase 02 - Workspace File Search IPC

- Date: 2026-04-23
- Branch: cursor/at-mention-plan-docs
- Owner: cursor (opus-4.7)
- Status change: not_started -> complete
- Completed:
  - Added `FILE_SEARCH_WORKSPACE` channel, `WorkspaceFileSearchParams` type (`{ workspaceRoot, query, limit?, maxDepth? }`), and `TurnAttachmentInput[]` result to `packages/contracts/src/protocol/ipc-channels.ts`.
  - Added a type-locking test in `packages/contracts/src/contracts.test.ts`.
  - Built `packages/electron/src/ipc/workspace-file-search.ts` with a pure `fuzzyScore` function, a bounded-depth async walker, a denylist (`node_modules`, `.git`, `.next`, `.turbo`, `.cache`, `dist`, `build`, `out`, `.DS_Store`, common binary extensions), a recents ring buffer (default capacity 50), and a `createWorkspaceFileSearch` factory that returns a callable handler plus `recordRecent` / `peekRecents` methods.
  - Wired the new handler into `registerIpcHandlers` in `packages/electron/src/ipc/bridge.ts` and hooked `FILE_GET_ATTACHMENT_METADATA` to call `recordRecent` for every attachment the OS picker resolves (so files attached via the native picker get the recents boost next time the `@file` menu opens).
  - No preload changes required: `preload.ts` forwards every `IpcChannel` enum value via `isAllowedChannel(Object.values(IpcChannel))`.
  - `TurnAttachmentInput` shape is reused so Phase 04 / 05 can feed results straight into the existing attachment tray.
- Remaining:
  - None. Phase 04 (MentionPicker UI) can consume this channel once Phase 03 is ready (both are required by the picker).
- Risks or blockers:
  - None new. Six pre-existing plugin integration tests (`PluginManager integration`, `plugin gateway service`) intermittently time out at 60s; unrelated to Phase 02.
  - `window-manager.ts` has two pre-existing nullable-dimension typecheck errors left over from before this branch.
- Commands run:
  - `bun --cwd packages/contracts run build` -> clean
  - `bun --cwd packages/contracts test` -> 34 pass / 0 fail
  - `bun --cwd packages/electron run typecheck` -> only pre-existing `window-manager.ts` errors, no Phase 02 errors
  - `bun --cwd packages/electron test src/__tests__/workspace-file-search.test.ts` -> 13 pass / 0 fail
  - `bun --cwd packages/electron test src` -> 96 pass / 2 fail (both fails are pre-existing plugin integration timeouts)
- Evidence captured:
  - 13 specs covering: subsequence rejection, exact-prefix vs subsequence ranking, contiguous-run preference, empty-query baseline, missing root returns `[]`, exact-name match, denylist at directory level, default depth cap of 8 (9 levels deep filtered out), query-based ranking (`draft.md` above `rubric.md` for `"drft"`), limit enforcement, recents boost ordering, recents ring-buffer capacity enforcement, binary-extension denylist.
  - `FILE_SEARCH_WORKSPACE` params type: `{ workspaceRoot: string, query: string, limit?: number, maxDepth?: number }`.
  - Fuzzy scoring tiers: exact prefix 1000 band > substring 500 band > subsequence 100 band, all penalized by excess candidate length and (for subsequence) first-match offset, with a +2 per-character contiguous run bonus.
- First recommended next step:
  - Phase 03 (Mention Lib And Composer @ Trigger). Phase 04 needs both 02 and 03 ready.

### Phase 03 - Mention Lib And Composer @ Trigger

- Date: 2026-04-23
- Branch: cursor/at-mention-plan-docs
- Owner: cursor (opus-4.7)
- Status change: not_started -> complete
- Completed:
  - Added `packages/ui/src/lib/mentions.ts` with `AssignmentMention` / `FileMention` discriminated union, `serializeMentionToMarkdown`, `parseMarkdownToMentions`, `serializeMarkdownWithMentions`, and `mentionToTurnReference` / `mentionToTurnAttachment` helpers.
  - Assignment URL shape matcher: `https?://.../courses/{courseId}/assignments/{assignmentId}(/?#...)?` with a stable id of `canvas-course:{courseId}:assignment:{assignmentId}`.
  - File URL shape matcher: `file:///{absPath}`.
  - Unrelated markdown links pass through unchanged (no false positives).
  - Rewrote `packages/ui/src/components/chat/RichComposer.tsx` to unify `slashRef` and `atRef` into a single `triggerRef` tagged with `kind: "slash" | "at"`. Whichever sigil is closer to the caret wins; entering a space or newline clears the trigger.
  - Added `onMentionTrigger(filter, show, kind?)` prop (mirrors `onSkillTrigger`).
  - Added `insertAssignment` / `insertFile` imperative handles plus `getReferences()` / `getAttachments()` extractors. Skill path untouched; regression test pins it.
  - Chips for each kind use distinct dataset attributes (`data-mention-kind="canvas-assignment" | "file"`, `data-reference-id`, `data-label`, `data-url`, `data-path`, `data-mime-type`, `data-size-bytes`, `data-file-kind`) so extraction is cheap and local.
  - Chip removal (x button) now handles any of the three chip kinds via the shared `[data-skill-id], [data-mention-kind]` selector.
- Remaining:
  - None. Phase 04 is next; it consumes `onMentionTrigger` and calls `insertAssignment` / `insertFile`. Phase 06 consumes `serialize`/`parseMarkdownToMentions` for skill editor round-trip.
- Risks or blockers:
  - Same pre-existing UI test failures as earlier phases (21 tests across `App`, `OnboardingWizard`, `PreferencesStep`, `RoutinesStep`, `onboarding-guard`).
  - If the assignment URL format drifts, `parseMarkdownToMentions` will silently stop matching; pin the regex with a test before editing.
- Commands run:
  - `bun --cwd packages/ui bunx vitest run src/__tests__/mentions.test.ts src/__tests__/RichComposer.test.tsx` -> 15 pass / 0 fail
  - `bun --cwd packages/ui bunx vitest run` -> 549 pass / 21 pre-existing failures
- Evidence captured:
  - `mentions.test.ts`: serialize/parse for both kinds, round-trip, non-mention pass-through, multiple mentions parse in order.
  - `RichComposer.test.tsx`: `@` trigger fires with filter, space after `@` clears trigger, `/` still fires skill trigger (regression), `insertAssignment` writes correct chip dataset, `getReferences` extracts `TurnReferenceInput`, `insertFile` + `getAttachments`, skill round-trip regression, mixed chip + text extraction.
  - Markdown round-trip: `[Essay 3](https://canvas.example.edu/courses/42/assignments/12345)` -> `{ kind: "canvas-assignment", id: "canvas-course:42:assignment:12345", label: "Essay 3", url: ... }` -> same markdown.
- First recommended next step:
  - Phase 04 - MentionPicker UI.

### Phase 04 - MentionPicker UI

- Date: 2026-04-23
- Branch: cursor/at-mention-plan-docs
- Owner: cursor (opus-4.7)
- Status change: not_started -> complete
- Completed:
  - Added `packages/ui/src/components/chat/MentionPicker.tsx`.
  - Props shape matches the Phase 04 contract exactly (`filter`, `assignments`, `files`, `recents`, `canReadCanvas`, three select callbacks, `onBrowseFiles`, optional `onRequestCanvasAccess`).
  - Two sections (`Assignments` then `Files`) with per-section result limits (8 / 12) to keep the dropdown bounded.
  - Empty `filter`: recents render above non-recent files via a dedupe-by-path merge, always followed by a `Browse files...` row at the bottom.
  - Non-empty `filter`: both sections narrow on `label.includes(filter)` (case-insensitive). The `Browse files...` row still shows so users can escape to the native dialog.
  - Permissions gate: when `canReadCanvas` is `false`, the Assignments section renders a "Canvas access is off for this thread." row with a `Grant access` button that calls `onRequestCanvasAccess`.
  - Defensive against `undefined` array props so a misbehaving parent cannot crash the picker.
  - Rows expose dataset attributes (`data-mention-kind`, `data-mention-id`, `data-mention-path`, `data-mention-label`) so downstream tests / integration harnesses can locate rows without label coupling.
- Remaining:
  - Phase 05 wires this into `PromptInput`, connects its callbacks to `RichComposer.insertAssignment` / `insertFile`, and feeds it real data (Canvas upcoming + `FILE_SEARCH_WORKSPACE`).
- Risks or blockers:
  - Keyboard navigation is delegated to `cmdk`'s defaults rather than an explicit highlighted-index prop. If Phase 05 needs external arrow/enter control like `SkillPicker`, that API needs to be added (additive change).
  - Same pre-existing UI test failures as earlier phases (21 tests across `App`, `OnboardingWizard`, `PreferencesStep`, `RoutinesStep`, `onboarding-guard`).
- Commands run:
  - `bun --cwd packages/ui bunx vitest run src/__tests__/MentionPicker.test.tsx` -> 9 pass / 0 fail
  - `bun --cwd packages/ui bunx vitest run` -> 558 pass / 21 pre-existing failures (zero new failures introduced by Phase 04)
- Evidence captured:
  - `MentionPicker.test.tsx` covers: both headers render when empty, one assignment and one file plus `Browse...` row render when filter is empty, filter narrows both sections, assignment click -> `onSelectAssignment(entry)`, file click -> `onSelectFile(entry)`, `Browse...` click -> `onBrowseFiles`, Grant access button -> `onRequestCanvasAccess`, recents render above non-recent files, and `undefined` array props do not crash.
- First recommended next step:
  - Phase 05 - Chat Composer Wiring.

### Phase 05 - Chat Composer Wiring

- Date: 2026-04-23
- Branch: cursor/at-mention-plan-docs
- Owner: cursor (opus-4.7)
- Status change: not_started -> complete
- Completed:
  - `PromptInput` now owns mention picker state (`showMentionPicker`, `mentionFilter`, `mentionFiles`, `mentionRecents`) parallel to the existing skill picker state.
  - Wired `RichComposer.onMentionTrigger` to open/close `MentionPicker` inside a `DropdownMenu`, mirroring the skill picker placement so both dropdowns anchor to the composer and dismiss consistently.
  - `handleMentionTrigger` debounces the panel open/close and calls `FILE_SEARCH_WORKSPACE` via IPC with the current filter when `workspaceRoot` is set; results are mapped to `FilePickerEntry[]`. Empty-filter results populate `mentionRecents` so opening `@` without typing shows recents first.
  - `onSelectAssignment` calls `RichComposer.insertAssignment` (Phase 03 handle). Submitting pulls `composerRef.current?.getReferences()` and widens `onSend` payload to `{ content, attachments, references, skillId? }`.
  - `onSelectFile` inserts a file chip via `RichComposer.insertFile` AND pushes the file into the existing `ChatAttachments` tray via `resolveAttachmentMetadata` + `mergeComposerAttachments`. The existing `handleRemoveAttachment` already covers removal.
  - `onBrowseFiles` delegates to `handleAddAttachments` which opens `FILE_SELECT_ATTACHMENTS`, reusing the native dialog path. Recents are implicitly reused because Phase 02's `bridge.ts` records recents on `FILE_GET_ATTACHMENT_METADATA`.
  - `onRequestCanvasAccess` is a new optional prop; `MentionPicker` surfaces a "Grant access" CTA when `canReadCanvas={false}`.
  - Escape key dismisses the mention picker when open (in `handleComposerKeyDown`).
  - `useChat.ChatSendInput` declared `references?: readonly TurnReferenceInput[]` (the destructured usage already worked at runtime; this was a missing type declaration). The rest of `useChat -> useAppRuntime -> wsRpcClient -> server Router -> OrchestrationService.sendTurn` pipeline was already wired in Phase 00.
  - Added `packages/ui/src/lib/mentionSources.ts` with `assignmentEntriesFromCourseWork(items, courses)` that converts `CourseWorkItem[]` + `Course[]` into `AssignmentPickerEntry[]` using the same Canvas URL regex as `mentions.ts`. Items without an assignment-shaped `htmlUrl` are dropped.
  - `ChatContainer` now reads `useCanvasUpcomingAssignments()` and `useCanvasCourses()`, memoises the picker entries, computes `workspaceRoot` from the current filesystem workspace, and forwards `assignments`, `workspaceRoot`, `canReadCanvas` to `PromptInput`.
  - Updated the two existing `PromptInput` tests that asserted on full `onSend` payload to include `references: []`. Added 3 new Phase 05 tests: typing `@` opens the picker, clicking an assignment inserts a chip and submits references, and `Grant access` fires `onRequestCanvasAccess` when `canReadCanvas={false}`.
- Remaining:
  - Phase 06 reuses `MentionPicker` + `mentions.ts` inside `SkillEditor` for mention round-tripping in skill prompts.
- Risks or blockers:
  - `PromptInput.tsx` had 4 pre-existing typecheck errors about Radix `DropdownMenuContent` not accepting `onOpenAutoFocus` / `onInteractOutside` (present on baseline before Phase 05). My two new dropdown blocks mirror the existing skill dropdown usage so they inherit the same 4 errors; this is not a new issue introduced here.
  - Same 21 pre-existing UI test failures (App, OnboardingWizard, PreferencesStep, RoutinesStep, onboarding-guard).
  - The debounce on `FILE_SEARCH_WORKSPACE` is implicit — every keystroke in the `@` filter triggers a request. If the IPC becomes a perf issue at scale, add a short debounce.
- Commands run:
  - `bun --cwd packages/ui bunx vitest run src/__tests__/PromptInput.test.tsx` -> 39 pass / 0 fail (including 3 new tests)
  - `bun --cwd packages/ui bunx vitest run` -> 561 pass / 21 pre-existing failures (zero new failures)
  - `bun --cwd packages/ui run typecheck` -> baseline 12 errors, zero new errors
- Evidence captured:
  - New tests in `PromptInput.test.tsx` under `"mention picker wiring (Phase 05)"`:
    - `"typing @ opens MentionPicker"`
    - `"clicking an assignment inserts a chip and submit carries references"`
    - `"Grant access button fires onRequestCanvasAccess when canReadCanvas is false"`
  - Contract-level evidence (already pinned in Phase 00): `SendTurnParams` decodes `references`, `Router.ts` forwards `decoded.references ?? []` into `OrchestrationService.sendTurn`, `OrchestrationTurn.references` is persisted and surfaced back through `buildChatMessages`.
- First recommended next step:
  - Phase 06 - Skill Editor Mentions.

### Phase 06 - Skill Editor Mentions

- Date: 2026-04-23
- Branch: cursor/at-mention-plan-docs
- Owner: cursor (opus-4.7)
- Status change: not_started -> complete
- Completed:
  - Refactored `packages/ui/src/components/skills/SkillEditor.tsx` to be mention-aware while keeping the underlying `Textarea` as the single source of truth for the raw `SKILL.md` markdown (so files on disk stay plain-markdown portable).
  - Added a `parseMentionChips(markdown)` helper that calls `parseMarkdownToMentions` from Phase 03 and derives an ordered list of `canvas-assignment` / `file` chips.
  - Added a "References" strip above the textarea (`data-testid="skill-editor-mention-chips"`) that renders one chip per parsed mention, each exposing `data-mention-kind` / `data-mention-label` so tests can target rows without label coupling.
  - When `skill.editable`, added an "Insert mention" button (`aria-label="Insert mention"`) that opens a `DropdownMenu` containing the Phase 04 `MentionPicker`. Curated skills never render the button but still display parsed chips.
  - `insertAtCursor(snippet)` uses a new `textareaRef` to splice markdown into the textarea at the current caret, then restores focus + caret after React flushes.
  - `insertMention(mention)` routes through `serializeMentionToMarkdown` so assignment mentions become `[label](url)` and file mentions become `[label](file://path)` — exact round-trip with the Phase 03 parser.
  - Widened `SkillEditorProps` with optional `assignments`, `files`, `recents`, `canReadCanvas`, `onBrowseFiles`, `onRequestCanvasAccess` so parents (e.g. the skill editor drawer) can feed real data or accept the sensible `[]` / `true` defaults during unit tests.
  - Patched `packages/ui/src/components/ui/textarea.tsx` to explicitly accept and forward `ref` to the underlying `<textarea>` (previously the shadcn wrapper dropped it, which would have left `textareaRef.current` null).
- Remaining:
  - None blocking. Follow-ups worth tracking separately: (a) hook the skill editor drawer in `packages/ui/src/components/skills/SkillDrawer.tsx` up to real `assignments` / `files` / `recents` data so mentions can actually be inserted from real users; (b) consider persisting recents across app restarts (still deferred per glossary).
- Risks or blockers:
  - None new. The same 21 pre-existing UI test failures (App, OnboardingWizard, PreferencesStep, RoutinesStep, onboarding-guard) are still red on `main` as well — confirmed they are unrelated to the mention system.
  - Skill Editor still embeds a `Textarea`, not a full rich editor. That is intentional (portability + Codex reads the raw markdown), but it means the author sees markdown link syntax inline. If we later want full rich chips inside the textarea, swap the `Textarea` for `RichComposer` — the serialization contract already round-trips.
- Commands run:
  - `bun --cwd packages/ui bunx vitest run src/__tests__/SkillEditor.test.tsx` -> 7 pass / 0 fail (5 pre-existing + 4 new Phase 06 tests covering chip render, non-mention pass-through, insert-then-save, curated read-only chip render, and a round-trip edit)
  - `bun --cwd packages/ui bunx vitest run` -> 566 pass / 21 pre-existing failures (zero new failures introduced by Phase 06)
- Evidence captured:
  - New tests under `SkillEditor > mention support (Phase 06)`:
    - `"renders a chip strip for each parsed assignment mention in the markdown"` – asserts the first chip's `dataset.mentionKind === "canvas-assignment"` and `dataset.mentionLabel === "Essay 3"`.
    - `"unrelated markdown links do not render chips"` – guards against false positives.
    - `"inserting an assignment writes a canonical markdown link and save passes raw markdown"` – after clicking the chosen assignment, the textarea value is `[Essay 3](https://canvas.example.edu/courses/42/assignments/12345)` and `onSave` sees that same string.
    - `"curated skill hides Insert mention button but still shows chips"` – pins the read-only affordance.
    - `"round-trip: editing preserves the existing mention link byte-for-byte"` – appends one character and confirms the surrounding mention link is untouched.
  - Contract-level evidence (already pinned by earlier phases):
    - `serializeMentionToMarkdown({ kind: "canvas-assignment", label, url })` returns `[label](url)`.
    - `parseMarkdownToMentions` recovers `{ kind: "canvas-assignment", id: "canvas-course:{course}:assignment:{id}", label, url }` from that same string.
- First recommended next step:
  - Manual smoke test on branch `cursor/at-mention-plan-docs`: start the Electron app, type `@`, pick an upcoming assignment, send the turn, and confirm Codex calls `get_assignment_details` with the expected id; then edit a custom skill, insert a mention, save, and verify the on-disk `SKILL.md` contains a plain markdown link.
