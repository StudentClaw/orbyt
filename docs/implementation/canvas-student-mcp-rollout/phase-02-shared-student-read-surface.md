# Phase 02 - Shared Student Read Surface

Last updated: 2026-04-17

## Orientation Note

- Target feature: define the student-accessible shared read surface for courses, content, files, discussions, conversations, and discovery
- Key dependencies: Phase 01 student-safe client rules, [docs/features/02-canvas-integration.md](../../features/02-canvas-integration.md), current Canvas tool modules under `packages/extensions/canvas-mcp/src/tools/`
- Constraints and boundaries:
  - stay read-only in this phase
  - keep course capability differences explicit
  - do not define local file writes yet
  - do not add educator or admin behavior
- Acceptance criteria for this increment:
  - shared student-readable tools are fully enumerated
  - capability-scoped behavior is defined for each tool family
  - read-tool inputs, outputs, and partial-success semantics are explicit
  - consumer teams know which tools are baseline versus course-permission-dependent

## Beginning

### Objective

Define the non-self but still student-appropriate read surface that replaces the old coursework-centric Canvas tools.

### Current State

- The reference student role mixes true self tools with a broad shared read surface for courses, pages, modules, files, discussions, and conversations.
- Some of those reads may be available in one course and denied in another, even for the same student.
- The current Orbyt Canvas surface does not separate baseline student tools from optional shared student reads.

### Out Of Scope

- discussion posting and replies
- marking conversations read
- local file download behavior
- gateway or UI consumer migration

### Acceptance Criteria

- Shared read tools are grouped and scoped clearly.
- Each read tool family defines whether `403` means:
  - tool-level denial
  - course-level partial success
  - hidden or unavailable content
- The plan names the replacement read surface for:
  - courses
  - assignments
  - pages
  - modules and course structure
  - files metadata
  - discussions read paths
  - conversations read paths
  - unread count
  - Canvas tool discovery

## Middle

### Implementation Slices

1. Define course and assignment read behavior for:
   - `list_courses`
   - `get_course_details`
   - `list_assignments`
   - `get_assignment_details`
2. Define course-content read behavior for:
   - `get_course_content_overview`
   - `list_pages`
   - `get_page_content`
   - `get_page_details`
   - `get_front_page`
   - `list_modules`
   - `list_module_items`
   - `get_course_structure`
3. Define file and discussion read behavior for:
   - `list_course_files`
   - `list_discussion_topics`
   - `get_discussion_topic_details`
   - `list_discussion_entries`
   - `get_discussion_entry_details`
   - `get_discussion_with_replies`
4. Define conversation and discovery read behavior for:
   - `list_conversations`
   - `get_conversation_details`
   - `get_unread_count`
   - `search_canvas_tools`
5. Define shared-read result semantics:
   - summary text expectations
   - structured result families
   - course-level denial handling
   - empty-state behavior when a course exposes no readable content

### Primary Directories

- `packages/extensions/canvas-mcp/src/tools/`
- `packages/extensions/canvas-mcp/src/canvas-client.ts`
- `packages/contracts/src/schemas/`
- `packages/server/src/mcp/`

### Verification Gates

- Unit:
  - future tool tests cover shared read result schemas and denied-course behavior
  - future discovery tests prove educator-only tools are absent
- Integration:
  - a student token can read at least one full course/content/discussion/file/message slice through the new tool set
- Manual smoke:
  - one student session can browse course content and conversations without touching the old coursework tools
- Failure path:
  - hidden pages, modules, files, or discussions surface as clear capability outcomes instead of generic plugin errors

### Evidence To Capture

- shared read surface inventory by tool family
- one partial-success example for mixed-access courses
- one discovery output showing only student-surface tools

## End

### Done When

- the full read-only student surface is defined without relying on the legacy coursework and sync abstractions
- later action and migration phases can treat the read surface as settled

### Handoff To Next Phase

Phase 03 can add student-side effects and local download behavior on top of the now-defined shared read surface.

### Risks To Carry Forward

- if shared read tools do not distinguish “not found” from “not allowed,” later UX will stay confusing
- if discovery includes hidden or out-of-scope tools, Codex-facing behavior will drift from the intended student contract

### First Recommended Next Step

Start [Phase 03 - Student Actions And Local Downloads](phase-03-student-actions-and-local-downloads.md).
