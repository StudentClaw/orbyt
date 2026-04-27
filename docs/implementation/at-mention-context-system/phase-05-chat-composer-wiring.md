# Phase 05 - Chat Composer Wiring

Last updated: 2026-04-23

## Orientation Note

- Target feature: route `MentionPicker` selections through the composer into the turn payload so a sent turn carries both attachments and references end to end
- Key dependencies: Phase 00 (contract `sendTurn` accepts references), Phase 01 (prompt serialization reads them), Phase 02 (`FILE_SEARCH_WORKSPACE` IPC), Phase 03 (composer `insertAssignment` / `insertFile` / `getReferences`), Phase 04 (`MentionPicker` component), [PromptInput.tsx](../../../packages/ui/src/components/chat/PromptInput.tsx), [useChat.ts](../../../packages/ui/src/hooks/useChat.ts), [wsRpcClient.ts](../../../packages/ui/src/rpc/wsRpcClient.ts)
- Constraints and boundaries:
  - do not touch skill editor wiring (Phase 06)
  - do not change `TurnAttachmentInput` shape; `@file` flows straight through the existing tray
  - show mention chips inline in the composer and file chips in the existing `ChatAttachments` tray; the tray is the single source of truth for files
- Acceptance criteria for this increment:
  - `PromptInput` shows the `MentionPicker` when the composer emits the `@` trigger and hides it otherwise
  - selecting an assignment inserts a chip; selecting a file pushes into the attachments tray and inserts a file chip
  - `onSend` delivers `{content, attachments, references, skillId?}` to the caller
  - `useChat` and `wsRpcClient` pass references through to the server's `sendTurn`

## Beginning

### Objective

Close the loop. After this phase, a user can type `@`, pick an assignment or a file, and see the right data land at `OrchestrationService.sendTurn`, with Codex receiving the prompt block from Phase 01.

### Current State

- `PromptInput` already handles the `/` trigger with `SkillPicker` and forwards `skillId` on send.
- Attachments flow through the paperclip / drag-drop path into the `ChatAttachments` tray.
- `useChat.sendTurn` calls `wsRpcClient` which invokes the server turn-send RPC; both accept attachments but not references yet.

### Out Of Scope

- skill editor wiring (Phase 06)
- server-side prompt construction (Phase 01 lib is already shared with both renderer and server paths)
- polish on cross-section keyboard navigation inside the picker (lives in Phase 04)

### Acceptance Criteria

- `PromptInput` state includes `showMentionPicker`, `mentionFilter`, and a cached assignment / file list.
- The composer's `onMentionTrigger` callback toggles the picker; Escape and outside-click dismiss it.
- `onSend` signature:
  ```ts
  (input: {
    content: string
    attachments: readonly TurnAttachmentInput[]
    references: readonly TurnReferenceInput[]
    skillId?: string | null
  }) => void | Promise<void>
  ```
- `useChat.sendTurn` accepts and forwards references.
- `wsRpcClient` serializes references onto the outbound turn-send RPC.

## Middle

### Implementation Slices

1. Add the picker state block in `PromptInput` mirroring `showSkillPicker`, `skillFilter`.
2. Connect `onSelectAssignment` to `composerRef.current.insertAssignment` and `onSelectFile` to a combined path that (a) calls `insertFile` for the chip and (b) pushes the file onto the `attachments` state so `ChatAttachments` shows it.
3. Connect `onBrowseFiles` to the existing `FILE_SELECT_ATTACHMENTS` IPC and treat the result identically to a picker selection.
4. Widen `onSend` to include `references` pulled from `composerRef.current.getReferences()`.
5. Plumb `references` through `useChat` and `wsRpcClient`.
6. Update the server turn-send RPC and `OrchestrationService.sendTurn` call sites to forward the new arg (Phase 00 already widened the service signature; this is just the RPC edge).

### Primary Directories

- `packages/ui/src/components/chat/`
- `packages/ui/src/hooks/`
- `packages/ui/src/rpc/`
- `packages/server/src/ws/`

### TDD Cycle

1. RED: a `PromptInput` test fires the composer's `onMentionTrigger("", true)` callback and expects `MentionPicker` to appear.
   GREEN: wire `showMentionPicker` to the trigger.
2. RED: selecting an assignment in the picker calls the composer's `insertAssignment` and then `onSend` (after typing and submitting) carries that assignment in `references`.
   GREEN: connect `onSelectAssignment` and extend the submit payload.
3. RED: selecting a file in the picker renders the file in the `ChatAttachments` tray and, on submit, carries the file in `attachments`.
   GREEN: push the file onto the attachments state; keep the chip in the composer for affordance.
4. RED: clicking "Browse..." opens `FILE_SELECT_ATTACHMENTS` and treats the returned paths identically to a picker selection.
   GREEN: reuse `handleAddAttachments` and also call `insertFile` per result.
5. RED: removing the inline chip also removes the corresponding file from the attachments tray.
   GREEN: wire the chip's remove click to `handleRemoveAttachment`.
6. RED: Escape while the picker is open dismisses it and refocuses the composer (matches `SkillPicker` behavior).
   GREEN: mirror the existing dismissal path.
7. RED: `useChat.sendTurn` passes references to `wsRpcClient`.
   GREEN: widen both signatures.
8. RED: `wsRpcClient.sendTurn` serializes references into the outbound RPC payload.
   GREEN: thread the new field through.
9. RED: the server WS router decodes references from the incoming payload and calls `OrchestrationService.sendTurn` with them.
   GREEN: update the router mapping.
10. RED: an integration test sends a turn containing one assignment reference and one file attachment and asserts that both arrive at the service and that the persisted snapshot includes both.
    GREEN: prove the whole pipe.
11. Refactor: if `handleAddAttachments`, `onSelectFile`, and `onBrowseFiles` accumulate duplicated metadata resolution, extract a single helper that ingests a list of paths and returns `ComposerAttachment[]`.

### Verification Gates

- Unit:
  - picker toggle on composer trigger
  - assignment selection populates `references` on submit
  - file selection populates both `attachments` and the inline chip
  - chip removal clears the tray entry
- Integration:
  - one sent turn carries both a reference and an attachment end to end and the server snapshot shows them
- Manual smoke:
  - start the app, open a thread with Canvas access, type `@`, pick an upcoming assignment, pick a workspace file via Browse, and send; verify the prompt Codex saw includes both the references block and the attachments block
- Failure path:
  - disabling Canvas access mid-session renders the Assignments section in its permissions-gated state and does not crash on subsequent `@` triggers

### Evidence To Capture

- passing test names including the integration turn-send test
- one screenshot of the composer with an inline assignment chip plus a file chip and the `ChatAttachments` tray
- a server log line showing the prompt string with both blocks present

## End

### Done When

- the whole send path is green
- zero-mention turns are byte-identical in prompt output to today's behavior
- the manual smoke passes against live Canvas

### Handoff To Next Phase

Phase 06 reuses the picker component and mention lib inside `SkillEditor`. No further chat-composer changes are expected in v1.

### Risks To Carry Forward

- if the RPC wire format for references is defined here in an ad hoc way, it must match the contract schema exactly; use the contract's encode/decode, do not hand-roll serialization
- if the chat UI renders both a chip and a tray entry for the same file, make sure removing one always removes the other, or the user will be confused

### First Recommended Next Step

Start [Phase 06 - Skill Editor Mentions](phase-06-skill-editor-mentions.md).
