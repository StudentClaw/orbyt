# Phase 01 - Author Curated Skills With MCP Workflows

Last updated: 2026-04-22

## Orientation Note

- **Target feature:** author six first-party `skills/<slug>/SKILL.md` files that teach Codex how to run student-relevant workflows while **actually calling** Canvas and Apple Calendar MCP tools where required.
- **Key dependencies:** [Phase 00 - Skill Inventory And Frontmatter Contract](phase-00-skill-inventory-and-frontmatter-contract.md), [docs/features/03-skill-system.md](../../features/03-skill-system.md), Canvas tool inventory in [student-tool-contract.ts](../../../packages/extensions/canvas-mcp/src/student-tool-contract.ts), Apple Calendar tools in [packages/extensions/apple-calendar-mcp/src/server.ts](../../../packages/extensions/apple-calendar-mcp/src/server.ts).
- **Constraints and boundaries:**
  - Each skill body must instruct a **deterministic workflow** (numbered steps) that names MCP tools explicitly enough for an agent to invoke them; avoid vague "use Canvas" without tool names.
  - **Writes** (calendar events, Canvas discussion posts, mark read): instruct the model to **summarize intent and ask for confirmation** before calling write tools; align with suggest-then-confirm in the product spec.
  - `download_course_file` must stay within workspace-scoped writable roots enforced by the Canvas MCP server; the skill text must remind the agent to use allowed paths only.
  - `explain-like` is the only skill with **no** `requested_capabilities` entries in v1.
- **Acceptance criteria for this increment:**
  - Six directories exist: `skills/plan-mode/`, `skills/study-helper/`, `skills/essay-reviewer/`, `skills/exam-prep/`, `skills/citation-helper/`, `skills/explain-like/`, each containing `SKILL.md`.
  - Legacy `skills/plan/` is removed or replaced by `skills/plan-mode/` (no duplicate slug `plan`).
  - Every skill except `explain-like` lists `requested_capabilities` using logical keys from Phase 00 and includes at least one non-trivial Canvas or Calendar read workflow in the body.
  - `plan-mode` and `exam-prep` document optional `createCalendarEvent` behind explicit student approval.

## Beginning

### Objective

Ship markdown that is simultaneously: (1) Codex-discoverable specialist behavior, (2) explicit MCP orchestration scripts, (3) honest capability declarations for the Phase 03 policy gate.

### Current State

- Sample content exists under `skills/plan/SKILL.md` (to be relocated to `skills/plan-mode/SKILL.md` with frontmatter brought up to Phase 00 contract).

### Out Of Scope

- Build staging, manifest, reconciler (Phase 02).
- Parser fields beyond what [SkillParser.ts](../../../packages/server/src/skills/SkillParser.ts) already reads (Phase 03 adds tier, version, lists).
- Skill Editor UI (Phase 04).

### Acceptance Criteria

- All six files pass human review against the per-skill tables below.
- `bun run typecheck` and relevant server tests still pass (no broken imports from doc-only changes; if tests snapshot skill list, update them in this phase).

## Middle

### Implementation Slices

1. **Create or move** `skills/plan-mode/SKILL.md` from `skills/plan/`; delete empty `skills/plan/` if applicable.
2. **Add** the other five skill directories and `SKILL.md` files.
3. **Run** workspace tests that touch skill discovery if present (e.g. under `packages/server/src/__tests__/`).

### Per-Skill Authoring Contract

Use Phase 00 frontmatter. Below: **activation**, **requested_capabilities** (logical keys), **required MCP tool touchpoints** (concrete names), **workflow shape** (what the body must cover).

#### `plan-mode`

| Aspect | Specification |
| --- | --- |
| Activation | Suggest-then-confirm for writes; explicit activation OK for read-only planning passes. |
| `requested_capabilities` | `canvas.self.read`, `canvas.shared.read`, `calendar.events.read`, `calendar.events.write`, `memory.read` |
| Required MCP tools | `get_my_upcoming_assignments`, `list_modules`, `get_course_structure`, `getCalendarEvents`; `createCalendarEvent` only after user confirms draft plan. |
| Workflow shape | (1) Pull upcoming assignments and structure for key courses. (2) Identify exams/high-weight items. (3) Read calendar events for free blocks. (4) Propose day-by-day plan. (5) Ask approval. (6) If approved and grant exists, create calendar events for study blocks. |

#### `study-helper`

| Aspect | Specification |
| --- | --- |
| Activation | Explicit or lightweight suggest; no silent calendar writes. |
| `requested_capabilities` | `canvas.shared.read`, `canvas.self.read`, `calendar.events.read` |
| Required MCP tools | `get_page_content`, `list_pages`, `get_assignment_details`; optional same-day context via `getCalendars` + `getCalendarEvents`. |
| Workflow shape | (1) Resolve course and target page or assignment from user message. (2) Fetch assignment details and/or page content. (3) Optionally scan today's calendar density. (4) Teach or scaffold without doing writes. |

#### `essay-reviewer`

| Aspect | Specification |
| --- | --- |
| Activation | Explicit; reads may include downloads — confirm file scope with user. |
| `requested_capabilities` | `canvas.shared.read`, `canvas.files.download`, `memory.read` |
| Required MCP tools | `get_assignment_details`, `get_page_content` (rubric/instructions); `download_course_file` only when student wants local draft reference and path is allowed. |
| Workflow shape | (1) Fetch assignment expectations. (2) If rubric exists on a page, load it. (3) Optionally download a provided course file id into workspace. (4) Review against rubric; do not rewrite the essay for the student. |

#### `exam-prep`

| Aspect | Specification |
| --- | --- |
| Activation | Suggest-then-confirm for calendar writes; explicit OK for reads. |
| `requested_capabilities` | `canvas.self.read`, `canvas.shared.read`, `calendar.events.read`, `calendar.events.write`, `memory.read` |
| Required MCP tools | `list_modules`, `get_course_structure`, `get_my_upcoming_assignments` (detect exam-like items); `getCalendarEvents`; `createCalendarEvent` after approval for study sessions. |
| Workflow shape | (1) Build exam list from assignments + module titles. (2) Map prerequisites from module structure. (3) Propose study schedule. (4) Optional calendar blocks after approval. |

#### `citation-helper`

| Aspect | Specification |
| --- | --- |
| Activation | Explicit; mostly offline reasoning. |
| `requested_capabilities` | `canvas.shared.read` (optional, narrow) |
| Required MCP tools | May use `list_course_files` and/or `get_assignment_details` to infer required style (e.g. "APA only" in prompt). |
| Workflow shape | (1) Detect style requirements from assignment text if available. (2) Otherwise ask student. (3) Produce citation examples and checklist; no downloads required. |

#### `explain-like`

| Aspect | Specification |
| --- | --- |
| Activation | Always-on helper tier (small context); no MCP. |
| `requested_capabilities` | _(omit or empty list)_ |
| Required MCP tools | None. |
| Workflow shape | Short rules for adjusting explanation depth, analogies, and jargon level on demand. |

### Primary Directories

- `skills/plan-mode/`, `skills/study-helper/`, `skills/essay-reviewer/`, `skills/exam-prep/`, `skills/citation-helper/`, `skills/explain-like/`

### Verification Gates

- **Unit:** Any test that enumerates skills or parses `skills/` roots passes after renames.
- **Integration:** Start dev server + one manual chat: SkillPicker lists all six; activating `plan-mode` still receives Canvas context if `context: canvas` is set.
- **Manual smoke:** For each skill, one reviewer traces the documented MCP tool list against [student-tool-contract.ts](../../../packages/extensions/canvas-mcp/src/student-tool-contract.ts) and Apple Calendar `server.ts` to ensure names exist.
- **Failure path:** Attempt to invoke `createCalendarEvent` from `explain-like` — should be impossible because no capability request and Phase 03 gate should block when implemented; for Phase 01, verify the markdown never instructs writes for that skill.

### Evidence To Capture

- Diff of all six `SKILL.md` files.
- Screenshot or log of SkillPicker listing six skills (optional but valuable).

## End

### Done When

- Repo contains exactly six curated skill trees under `skills/` matching Phase 00 slugs, with no stale `skills/plan/` tree.

### Handoff To Next Phase

Phase 02 stages these files into `bundled-skills/` at build time and reconciles into the Codex-visible user directory at launch.

### Risks To Carry Forward

- Token length: six rich skills increase picker metadata size; Skill budget manager (spec) may need trimming in Phase 03/04.
- Overlapping triggers between `plan-mode` and `exam-prep`; keep `description` strings distinct for Codex matching.

### First Recommended Next Step

Start [Phase 02 - Build Staging And Launch Reconciler](phase-02-build-staging-and-launch-reconciler.md).
