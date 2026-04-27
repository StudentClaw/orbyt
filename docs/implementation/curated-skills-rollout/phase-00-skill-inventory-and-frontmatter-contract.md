# Phase 00 - Skill Inventory And Frontmatter Contract

Last updated: 2026-04-22

## Orientation Note

- **Target feature:** freeze the v1 curated skill inventory, directory layout, expanded `SKILL.md` frontmatter contract, and logical capability-request namespace mapped to real Canvas and Apple Calendar MCP tool names.
- **Key dependencies:** [PLAN.md](../../internal/PLAN.md), [docs/features/03-skill-system.md](../../features/03-skill-system.md), [docs/features/01-ai-harness.md](../../features/01-ai-harness.md), [packages/server/src/skills/SkillParser.ts](../../../packages/server/src/skills/SkillParser.ts), [packages/extensions/canvas-mcp/src/student-tool-contract.ts](../../../packages/extensions/canvas-mcp/src/student-tool-contract.ts), [packages/extensions/apple-calendar-mcp/src/server.ts](../../../packages/extensions/apple-calendar-mcp/src/server.ts), [packages/electron/src/codex/runtime.ts](../../../packages/electron/src/codex/runtime.ts).
- **Constraints and boundaries:**
  - Do not change the feature spec file in this phase; this phase only locks rollout engineering contracts.
  - Do not implement parser changes yet; Phase 03 consumes this contract.
  - Capability requests are **strings in YAML**; the policy gate maps them to concrete MCP tools (below).
- **Acceptance criteria for this increment:**
  - Six curated slugs are named and frozen.
  - `skills/plan/` rename to `skills/plan-mode/` is recorded as the canonical slug alignment task for Phase 01.
  - Frontmatter field list and semantics are explicit enough for Phase 01 authors and Phase 03 implementers without reinterpretation.
  - Three-directory ownership model is documented.
  - Every logical `requested_capabilities` value used in Phase 01 maps to one or more concrete tool names in the tables below.

## Beginning

### Objective

Make later phases cite **one** stable contract: which skills ship, how they are stored, what metadata they carry, and how declared capabilities relate to real MCP tools.

### Current State

- One sample skill exists at `skills/plan/SKILL.md` with slug directory `plan` (product spec uses `plan-mode`).
- [SkillParser.ts](../../../packages/server/src/skills/SkillParser.ts) currently requires `name` and `description` in frontmatter; optional `context` maps to context injection.
- [SkillResolver.ts](../../../packages/server/src/skills/SkillResolver.ts) discovers `skills/<id>/SKILL.md` and `.agents/skills/` trees.
- Electron prepares an isolated Codex home and creates `.agents/skills` under the process home ([runtime.ts](../../../packages/electron/src/codex/runtime.ts)).

### Out Of Scope

- Authoring full SKILL.md bodies (Phase 01).
- Build scripts and reconciler implementation (Phase 02).
- UI for fork/promotion (Phase 04).

### Acceptance Criteria

- Inventory table lists all six curated slugs with one-line purpose.
- Frontmatter schema lists every field with type, required/optional, and consumer (Codex vs server vs UI).
- Capability namespace table maps each logical key to Canvas or Apple Calendar **registered tool names** (must match MCP server registration strings).

## Middle

### Implementation Slices

1. **Freeze curated inventory** (directory = slug):

   | Slug | Purpose |
   | --- | --- |
   | `plan-mode` | Weekly academic planning across coursework, memory context, and calendar availability; calendar writes only after explicit approval. |
   | `study-helper` | General study assistance grounded in course pages and assignment details; optional calendar same-day workload check. |
   | `essay-reviewer` | Draft review grounded in assignment prompts, rubric pages, and optional local draft file via workspace-scoped download. |
   | `exam-prep` | Exam-centric study structure from modules, course structure, and upcoming assignments; optional scheduled study blocks. |
   | `citation-helper` | Citation formatting help; may infer style hints from assignment or file metadata. |
   | `explain-like` | Lightweight explanation tone helper; **no** MCP capability requests in v1. |

2. **Rename task (Phase 01 execution):** move `skills/plan/` → `skills/plan-mode/` and ensure `SKILL.md` frontmatter `name` remains human-readable (e.g. "Plan Mode").

3. **Three-directory model:**

   | Location | Role |
   | --- | --- |
   | `skills/` in repo | Authoring source for curated skills; versioned in git. |
   | `<app-resources>/bundled-skills/` | Read-only copy embedded in the shipped artifact (Phase 02 staging). |
   | `<userData>/codex-user-home/.agents/skills/` | Runtime directory Codex scans; reconciler installs upgrades here; user forks/edits live here. |

4. **Frontmatter contract (v1 rollout extension)** — fields Phase 03 will parse; Phase 01 authors should include them in curated files even before parser supports all (parser may warn-skip unknown keys until Phase 03 lands):

   | Field | Required | Type / shape | Notes |
   | --- | --- | --- | --- |
   | `name` | yes | string | Display name. |
   | `description` | yes | string | Shown in picker; Codex skill discovery uses this for matching. |
   | `version` | yes for curated | semver string | Bumped on curated content changes; used in `forkedFrom`. |
   | `tier` | yes | `curated` \| `custom` | Curated ship default `curated`; forks must use `custom`. |
   | `context` | no | string | Existing harness key (e.g. `canvas`) for context injection. |
   | `triggers` | no | list of strings | Suggested utterances; UI and docs only until intent routing exists. |
   | `requested_capabilities` | no | list of strings | Logical keys from namespace table below. |
   | `forkedFrom` | no | string | Format `<slug>@<version>` when forked from curated. |

5. **Logical capability namespace → MCP tools**

   **Canvas — self-scoped reads** (`canvas.self.read`):

   - `get_my_upcoming_assignments`
   - `get_my_submission_status`
   - `get_my_course_grades`
   - `get_my_todo_items`
   - `get_my_peer_reviews_todo`

   **Canvas — shared reads** (`canvas.shared.read`):

   - `list_courses`, `get_course_details`, `get_course_content_overview`
   - `list_pages`, `get_page_content`, `get_page_details`, `get_front_page`
   - `list_assignments`, `get_assignment_details`
   - `list_modules`, `list_module_items`, `get_course_structure`
   - `list_course_files`
   - `list_discussion_topics`, `get_discussion_topic_details`, `list_discussion_entries`, `get_discussion_entry_details`, `get_discussion_with_replies`
   - `list_conversations`, `get_conversation_details`, `get_unread_count`
   - `search_canvas_tools`

   **Canvas — file download** (`canvas.files.download`):

   - `download_course_file`

   **Canvas — student actions** (`canvas.student.write` — higher risk; suggest-then-confirm):

   - `post_discussion_entry`, `reply_to_discussion_entry`, `mark_conversations_read`

   **Apple Calendar — read** (`calendar.calendars.read`):

   - `getCalendars`

   **Apple Calendar — events read** (`calendar.events.read` — includes availability-style reads):

   - `getCalendarEvents`

   **Apple Calendar — events write** (`calendar.events.write` — requires grant + user approval for curated workflows):

   - `createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent`

   **Apple Calendar — calendar mutate** (`calendar.calendars.write`):

   - `createCalendar`, `deleteCalendar`

   **Memory** (`memory.read`):

   - Not an MCP tool in this table; maps to Orbyt memory read APIs the harness injects. Phase 03 gate may treat as always-on read within planner scope per [docs/features/03-skill-system.md](../../features/03-skill-system.md).

### Primary Directories

- `skills/`
- `docs/implementation/curated-skills-rollout/`
- Future: `scripts/` (Phase 02), `packages/electron/src/codex/`, `packages/server/src/skills/`

### Verification Gates

- **Unit:** N/A for Phase 00 (docs-only).
- **Integration:** N/A.
- **Manual smoke:** Two reviewers independently map `requested_capabilities` strings from Phase 01 draft frontmatter to rows in the tables above with no ambiguity.
- **Failure path:** If a Phase 01 author needs a capability not listed, Phase 00 must be amended before merging that skill.

### Evidence To Capture

- This phase doc as the canonical contract.
- PR or handoff note in [GLOSSARY.md](GLOSSARY.md) linking any amendments.

## End

### Done When

- README and Phase 01 can cite this file without restating inventory or capability mappings.

### Handoff To Next Phase

Phase 01 authors create six `skills/<slug>/SKILL.md` files using the frontmatter contract and per-skill MCP requirements in [phase-01-author-curated-skills-with-mcp-workflows.md](phase-01-author-curated-skills-with-mcp-workflows.md).

### Risks To Carry Forward

- Parser strictness: adding required fields may break existing `skills/plan` until Phase 03 lands; mitigate by staging Phase 01 + Phase 03 in close succession or by keeping new fields optional for one release.
- Apple Calendar tools are powerful; `calendar.events.write` must never be granted implicitly from markdown alone.

### First Recommended Next Step

Start [Phase 01 - Author Curated Skills With MCP Workflows](phase-01-author-curated-skills-with-mcp-workflows.md).
