# Phase 04 - MentionPicker UI

Last updated: 2026-04-23

## Orientation Note

- Target feature: build the two-section dropdown shown when a user types `@`, with fuzzy filter, recents, `Browse...` fallback, and permissions-aware empty states
- Key dependencies: Phase 02 IPC (`FILE_SEARCH_WORKSPACE`), Phase 03 composer triggers, [packages/ui/src/hooks/useDashboard.ts](../../../packages/ui/src/hooks/useDashboard.ts) for `useCanvasUpcomingAssignments`, [packages/ui/src/components/chat/SkillPicker.tsx](../../../packages/ui/src/components/chat/SkillPicker.tsx) as a layout reference
- Constraints and boundaries:
  - do not wire into `PromptInput` yet (Phase 05 will do that)
  - do not call the composer's `insertAssignment` or `insertFile` directly; expose `onSelect` callbacks instead
  - match the SkillPicker visual treatment so the composer feels consistent
- Acceptance criteria for this increment:
  - `MentionPicker` renders two sections, narrows both on filter change, and dispatches `onSelectAssignment` / `onSelectFile`
  - an empty query shows recents plus "Browse..."; a non-empty query runs both backends and ranks per section
  - Assignments tab shows a "Grant access" CTA when the thread lacks Canvas capability

## Beginning

### Objective

Produce a self-contained UI component that is fully testable without the rest of the composer, so Phase 05 only has to plumb data in and events out.

### Current State

- `SkillPicker` demonstrates the dropdown visual + command list pattern we will mirror.
- No mention-specific picker exists.
- Assignments already live in a Jotai-backed hook (`useCanvasUpcomingAssignments`).

### Out Of Scope

- composer integration (Phase 05)
- skill editor usage (Phase 06; it consumes the same picker but wires it via the editor, not `PromptInput`)
- cross-section keyboard navigation polish beyond basics (arrow keys + enter); richer affordances can come later

### Acceptance Criteria

- Props:
  ```ts
  type MentionPickerProps = {
    readonly filter: string
    readonly assignments: readonly AssignmentPickerEntry[]
    readonly files: readonly FilePickerEntry[]
    readonly recents: readonly FilePickerEntry[]
    readonly canReadCanvas: boolean
    readonly onSelectAssignment: (a: AssignmentPickerEntry) => void
    readonly onSelectFile: (f: FilePickerEntry) => void
    readonly onBrowseFiles: () => void
    readonly onRequestCanvasAccess?: () => void
  }
  ```
- Sections render in order: Assignments, Files. Each section has a header and a bounded result count.
- With empty `filter`, Files shows `recents` first and an always-visible "Browse..." row at the bottom.
- With non-empty `filter`, both sections narrow; each section shows its own empty state.
- When `canReadCanvas` is `false`, the Assignments section shows a disabled state with "Grant access" that calls `onRequestCanvasAccess`.

## Middle

### Implementation Slices

1. Scaffold `MentionPicker.tsx` reusing the same `Command` + `CommandList` pattern as `SkillPicker`.
2. Add `AssignmentPickerEntry` and `FilePickerEntry` display types (separate from contract types to allow UI-only fields like `courseCode`).
3. Add the fuzzy narrowing (client-side filter on the `label` only; real ranking is already done by upstream hooks and the IPC).
4. Add the "Browse..." row that calls `onBrowseFiles`.
5. Add the permissions-gated Assignments empty state.

### Primary Directories

- `packages/ui/src/components/chat/`
- `packages/ui/src/__tests__/`

### TDD Cycle

1. RED: rendering with empty `assignments` and `files` plus `canReadCanvas: true` shows both section headers and two empty states.
   GREEN: add the section scaffolding.
2. RED: rendering with one assignment and one file with empty `filter` shows both entries plus a "Browse..." row.
   GREEN: render the lists and append the browse row.
3. RED: typing a `filter` that matches the file label but not the assignment label hides the assignment and keeps the file.
   GREEN: add the label-level narrowing.
4. RED: clicking an assignment row calls `onSelectAssignment` with that assignment.
   GREEN: wire the `onSelect` callback.
5. RED: clicking the "Browse..." row calls `onBrowseFiles`.
   GREEN: wire the callback.
6. RED: with `canReadCanvas: false`, the assignments section is disabled and a "Grant access" button calls `onRequestCanvasAccess`.
   GREEN: add the permissions-gated branch.
7. RED: when `recents` is non-empty and `filter` is empty, recents render above non-recent files.
   GREEN: splice `recents` at the top of the Files section for the empty-filter case.
8. RED: keyboard `Enter` on the first visible row fires the appropriate `onSelect*` callback (matches SkillPicker behavior).
   GREEN: mirror the `CommandItem` `onSelect` wiring.
9. Refactor: extract a shared `PickerSection` component if the Assignments and Files sections accumulate duplicated list rendering.

### Verification Gates

- Unit:
  - all the RED/GREEN pairs above pass as component-level tests
- Integration:
  - a wrapper test harness drives the picker through a scripted sequence (empty -> filter -> select -> browse -> permissions missing) and asserts the callbacks in order
- Manual smoke:
  - in a Storybook-like test harness or `bun --cwd packages/ui vitest --ui`, verify the dropdown visually matches `SkillPicker` density and spacing
- Failure path:
  - passing `assignments: undefined` (bad input) does not crash; render empty state

### Evidence To Capture

- passing test names
- one rendered screenshot of each of: empty state, populated state, permissions-missing state

## End

### Done When

- the picker passes the TDD cycle green in isolation
- the props surface is stable enough that Phase 05 can wire it without further iteration

### Handoff To Next Phase

Phase 05 will render `MentionPicker` inside `PromptInput` and connect its callbacks to the composer's `insertAssignment` / `insertFile` and to the existing `FILE_SELECT_ATTACHMENTS` IPC.

### Risks To Carry Forward

- if the two sections share too much state, filter behavior will be hard to reason about; keep each section's data path separate
- if the "Grant access" affordance does not match the existing `SkillPicker` missing-capability treatment, users will see two different patterns for the same concept

### First Recommended Next Step

Start [Phase 05 - Chat Composer Wiring](phase-05-chat-composer-wiring.md).
