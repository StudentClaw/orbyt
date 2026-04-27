# Phase 06 - Skill Editor Mentions

Last updated: 2026-04-23

## Orientation Note

- Target feature: replace the plain `<Textarea>` in `SkillEditor` with a mention-aware editor so authors can embed literal `@assignment` and `@file` references that round-trip through saved markdown
- Key dependencies: Phase 03 (mentions lib + composer trigger), Phase 04 (`MentionPicker`), [packages/ui/src/components/skills/SkillEditor.tsx](../../../packages/ui/src/components/skills/SkillEditor.tsx), existing `saveCustomSkill` server path
- Constraints and boundaries:
  - literal-only in v1: mentions bind to a specific assignment or file at author time; no slot / template mechanic
  - curated skills stay read-only; chips still render but cannot be inserted or removed
  - serialized form is plain markdown links; `SKILL.md` files on disk stay portable and Codex reads them without our parser
  - preserve a "View raw markdown" toggle so advanced users can always see and edit the underlying text
- Acceptance criteria for this increment:
  - loading a skill whose markdown contains a mention link renders the matching chip
  - inserting and saving a chip writes a canonical markdown link to disk
  - curated skills render with chips but disallow edits
  - the raw-markdown toggle preserves the entire file without lossy conversion

## Beginning

### Objective

Make skill authoring feel like chat composing: the same `@` affordance, the same chips, the same mental model. Leave the underlying `SKILL.md` file format clean enough that someone editing it outside Orbyt still sees readable markdown.

### Current State

- `SkillEditor` is a `<Textarea>` over the raw markdown string.
- Saving calls `onSave({skillId, markdown})` which hits the `SaveCustomSkillParams` schema (up to 200k chars).
- Curated skills set `editable: false`, which disables Save/Delete but still lets the textarea accept keystrokes (read-only).

### Out Of Scope

- slot / template mentions (deferred)
- mention-aware skill search or indexing
- server-side validation of mention link targets at save time (let invalid links fail at Codex tool-call time, consistent with the chat path)

### Acceptance Criteria

- `SkillEditor` renders a `RichComposer`-based editor with `/` trigger disabled and `@` trigger enabled.
- The editor hydrates from the saved markdown by running `parseMarkdownToMentions` and rendering chips inline.
- On save, the editor serializes its current state back to markdown via `serializeMarkdownWithMentions`.
- Curated skills display chips but cannot mutate the editor.
- A toggle switches between the rich editor and a plain `<Textarea>` view of the exact raw markdown; the two views share the same underlying string.

## Middle

### Implementation Slices

1. Add a thin wrapper `SkillComposer` (or a mode-prop on `RichComposer`) that disables the `/` trigger but keeps `@`.
2. In [SkillEditor.tsx](../../../packages/ui/src/components/skills/SkillEditor.tsx), replace the single `<Textarea>` with a tabbed `{Rich, Raw}` view and hydrate both from the same string state.
3. Reuse the Phase 04 `MentionPicker` here; feed it assignments from the same hook used by `PromptInput`, and files from the same workspace search IPC. The picker is skill-editor-agnostic.
4. On save, call `serializeMarkdownWithMentions` and pass the result to the existing `onSave` prop.
5. Ensure the "Read-only (curated)" chrome disables insertion UI but still renders chips.

### Primary Directories

- `packages/ui/src/components/skills/`
- `packages/ui/src/__tests__/`

### TDD Cycle

1. RED: `SkillEditor` loaded with markdown `"Review [Essay 3](https://canvas.../courses/42/assignments/12345) carefully"` renders one assignment chip inline.
   GREEN: run `parseMarkdownToMentions` on the initial string and hydrate the rich editor.
2. RED: inserting a new assignment chip and clicking Save calls `onSave` with a markdown string that contains the corresponding link in the right position.
   GREEN: wire `serializeMarkdownWithMentions` into the save path.
3. RED: inserting an `@file` chip and saving produces a `[name](file:///abs/path)` link in the saved markdown.
   GREEN: reuse the file serializer.
4. RED: a curated (`editable: false`) skill with a mention link still renders the chip but does not show `@` trigger affordances and Save remains disabled.
   GREEN: gate trigger listeners behind `editable`.
5. RED: toggling to the raw view shows the exact markdown currently serialized by the rich view and lets the user edit freely; toggling back re-parses into chips.
   GREEN: share the source-of-truth string and re-run parse/serialize across the toggle.
6. RED: editing the raw markdown to include an unrelated link such as `[more notes](https://example.com)` preserves the link as text (no chip) after the toggle.
   GREEN: already covered by the Phase 03 parser (unrelated links return empty from `parseMarkdownToMentions`).
7. RED: a round-trip test loads markdown, makes no edits, clicks Save, and expects the saved string to byte-match the loaded string.
   GREEN: confirm serializer is stable (ordering, link form, trailing newline) and adjust as needed.
8. Refactor: if `PromptInput` and `SkillEditor` both duplicate picker wiring, extract a `useMentionPicker` hook that owns the assignments/files fetch and `onBrowseFiles`.

### Verification Gates

- Unit:
  - hydrate from a markdown string with zero, one, and multiple mentions
  - save path produces expected markdown for each chip kind
  - curated read-only state disables trigger but renders chips
  - raw/rich toggle round-trips the exact string
- Integration:
  - a full edit-save-reload cycle inside the skill list page preserves the chip content
- Manual smoke:
  - in Settings -> Skills, open a custom skill, insert an `@assignment` and an `@file`, save, reload the page, confirm chips are present and markdown file on disk contains the right links
- Failure path:
  - an invalid URL in the saved markdown (malformed Canvas link) renders as plain text and does not throw

### Evidence To Capture

- passing test names
- one `SKILL.md` diff showing the literal markdown links produced by saving
- a screenshot of a custom skill with chips in the rich view and the same content in the raw view

## End

### Done When

- custom skills support literal `@` mentions in their markdown
- curated skills still render correctly (chips visible, no mutations)
- on-disk `SKILL.md` files remain portable markdown

### Handoff To Next Phase

v1 is complete at the end of this phase. Next-rollout candidates (not planned here) include `@course`, `@page`, `@thread`, and slot / template mentions for skills.

### Risks To Carry Forward

- if the rich and raw views diverge silently (for example due to trimming whitespace differently), Save will cause spurious diffs; pin this with a round-trip snapshot test
- if mentions are ever added to the curated `skills/*` files in-repo, make sure they still render for users who do not have that Canvas assignment visible; invalid links should degrade gracefully

### First Recommended Next Step

Mark the rollout complete in [GLOSSARY.md](GLOSSARY.md) and close out the feature branch. Open a follow-up issue for any deferred mention kinds.
