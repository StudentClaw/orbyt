# Phase 03 - Mention Lib And Composer @ Trigger

Last updated: 2026-04-23

## Orientation Note

- Target feature: teach the composer to detect `@`, insert kind-aware chips (assignment and file), and round-trip those chips through plain markdown links
- Key dependencies: Phase 00 contracts, [packages/ui/src/components/chat/RichComposer.tsx](../../../packages/ui/src/components/chat/RichComposer.tsx), existing `/` trigger and chip factory
- Constraints and boundaries:
  - keep `/` behavior for skills unchanged
  - serialize mentions as plain markdown links with recognizable URL shapes; no Orbyt-specific tags so saved `SKILL.md` files stay portable
  - chip rendering reuses the existing `buildChip` surface area; do not fork a second DOM pattern
  - no picker UI in this phase (Phase 04)
- Acceptance criteria for this increment:
  - `packages/ui/src/lib/mentions.ts` has pure serialize and parse functions for both mention kinds
  - `RichComposer` exposes `insertAssignment` and `insertFile` plus a `getReferences()` extractor and emits `onMentionTrigger(filter, show, kind?)` when the caret is in an `@` context
  - existing `getSkillId` / `getText` behavior is unchanged; a regression test pins this

## Beginning

### Objective

Get the purely-client-side half of the mention system working end to end: a caller can programmatically insert a chip, extract references, and round-trip through markdown without any picker or server touching the code.

### Current State

- `RichComposer` watches for `/` and exposes `insertSkill` / `getSkillId`.
- Chip construction is in `buildChip`, keyed to skills only.
- No mention lib exists.

### Out Of Scope

- the picker dropdown UI (Phase 04)
- wiring into `PromptInput` or `useChat` (Phase 05)
- skill editor integration (Phase 06)
- server-side parsing of mentions (Codex does this natively via markdown links)

### Acceptance Criteria

- `mentions.ts` exports:
  - `serializeMentionToMarkdown(mention)` for both `canvas-assignment` and `file`
  - `parseMarkdownToMentions(markdown)` returning a list of `{ mention, startOffset, endOffset }`
  - `serializeMarkdownWithMentions(parts)` as the inverse for editor save paths
- `RichComposer`:
  - detects `@` with the same pattern used for `/` (no trailing space or newline, open until the caret)
  - emits `onMentionTrigger(filter, show, kind?)` where `kind` is optional and only set after the caller commits (currently both kinds share the same picker)
  - provides `insertAssignment(assignment)` and `insertFile(file)` imperative handles
  - provides `getReferences(): readonly TurnReferenceInput[]` and `getAttachments(): readonly TurnAttachmentInput[]` based on chip metadata
  - `getText()` returns text with chips stripped (matching `/` behavior)

## Middle

### Implementation Slices

1. Create [packages/ui/src/lib/mentions.ts](../../../packages/ui/src/lib/mentions.ts) with pure serialize/parse helpers and its own unit tests.
2. Generalize `buildChip` in [packages/ui/src/components/chat/RichComposer.tsx](../../../packages/ui/src/components/chat/RichComposer.tsx) to a kind-parameterized factory (`buildAssignmentChip`, `buildFileChip`, shared internal builder).
3. Add an `@` trigger mirroring the `/` path, tracking `atRef` alongside `slashRef`.
4. Add `insertAssignment`, `insertFile`, `getReferences`, `getAttachments` to the imperative handle.
5. Add regression coverage for existing skill chip behavior so `/` does not regress.

### Primary Directories

- `packages/ui/src/lib/`
- `packages/ui/src/components/chat/`
- `packages/ui/src/__tests__/`

### TDD Cycle

1. RED: `serializeMentionToMarkdown({kind:'canvas-assignment', label:'Essay 3', url:'https://canvas.../courses/42/assignments/12345', id:'canvas-course:42:assignment:12345'})` returns `[Essay 3](https://canvas.../courses/42/assignments/12345)`.
   GREEN: implement the serializer for the assignment kind.
2. RED: `parseMarkdownToMentions("[Essay 3](https://canvas.../courses/42/assignments/12345)")` returns one mention with matching label, id (parsed from URL), and `kind: "canvas-assignment"`.
   GREEN: add a URL-shape matcher and the parser entry for assignments.
3. RED: `serializeMentionToMarkdown({kind:'file', label:'draft.md', path:'/abs/draft.md'})` returns `[draft.md](file:///abs/draft.md)`.
   GREEN: add the file serializer.
4. RED: `parseMarkdownToMentions("[draft.md](file:///abs/draft.md)")` returns a file mention with `path: "/abs/draft.md"`.
   GREEN: add the file parser branch.
5. RED: `parseMarkdownToMentions("see [my docs](https://example.com/readme)")` returns an empty list (unrelated links pass through).
   GREEN: guard the parser behind kind-specific URL shape checks.
6. RED: a `RichComposer` test types `@` and expects `onMentionTrigger("", true)` to fire.
   GREEN: add the `@` trigger path parallel to the existing `/` path.
7. RED: `insertAssignment` inserts a non-editable chip whose `dataset` contains `kind="canvas-assignment"`, `referenceId`, `label`, and `url`.
   GREEN: extend `buildChip` with kind-aware attributes.
8. RED: after inserting one assignment chip, `getReferences()` returns a single `TurnReferenceInput` with the right `kind`, `id`, `label`, `url`.
   GREEN: walk the DOM extracting chip metadata into reference shape.
9. RED: inserting a `/skill` chip still returns `getSkillId()` unchanged (regression).
   GREEN: nothing expected; this proves the `@` path did not break `/`.
10. RED: composer state serializes to markdown containing `[Essay 3](...)` and re-loads into the same chip shape.
    GREEN: add the round-trip helpers used by the skill editor.
11. Refactor: consolidate `slashRef` and `atRef` into a single `triggerRef` with a `kind` discriminant; unify the matching regex helpers.

### Verification Gates

- Unit:
  - mentions lib: serialize, parse, and round-trip for both kinds plus a non-mention link pass-through
  - composer: `@` trigger emits, chip insertion writes correct dataset, `getReferences()` extraction
- Integration:
  - a composer instance mixing `/skill`, `@assignment`, `@file`, and plain text returns the right `skillId`, `references`, `attachments`, and `text`
- Manual smoke:
  - none required at this phase (no picker UI yet)
- Failure path:
  - typing `@` followed by a space hides the trigger and clears `atRef` (matches `/` behavior)

### Evidence To Capture

- passing test names
- DOM snapshot of a composer containing one of each chip kind
- a sample markdown round-trip proving chip -> markdown -> chip preserves id and label

## End

### Done When

- the mentions lib and composer pass their cycles green
- the `/` behavior has an active regression test that did not exist before

### Handoff To Next Phase

Phase 04 consumes `onMentionTrigger` and calls `insertAssignment` / `insertFile`. Phase 06 consumes `serializeMarkdownWithMentions` / `parseMarkdownToMentions` directly.

### Risks To Carry Forward

- if the URL-shape matcher is too strict, hand-authored links in skills will fail to parse back to chips
- if `atRef` and `slashRef` are both active simultaneously, the composer may insert the wrong kind; the refactor step eliminates this class of bug

### First Recommended Next Step

Start [Phase 04 - MentionPicker UI](phase-04-mention-picker-ui.md).
