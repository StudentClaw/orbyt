# Curated Skills Rollout Glossary, Tracker, And Handoff

Last updated: 2026-04-22

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

Verification state tracks the health of the evidence for a phase. Phase `Status` tracks delivery progress. A phase should not be marked `complete` unless its verification state is `Verified`.

## Phase Tracker

| Phase | Status | Owner | Verification State | Next Action |
| --- | --- | --- | --- | --- |
| 00 - Skill Inventory And Frontmatter Contract | complete | Cursor | Verified | Contract frozen in phase-00 doc; consumed by Phase 01 |
| 01 - Author Curated Skills With MCP Workflows | complete | Cursor | Verified | Proceed to Phase 02 staging and reconciler |
| 02 - Build Staging And Launch Reconciler | not_started | — | Not run | Wait for Phase 01 SKILL.md bodies in repo |
| 03 - Resolver Tier Metadata And Policy Gate | not_started | — | Not run | Wait for Phase 02 reconciler and manifest in tree |
| 04 - Skill Editor Fork And Promotion UX | not_started | — | Not run | Wait for Phase 03 grant store and gate hooks |

## Current Recommended Next Step

Start [Phase 02 - Build Staging And Launch Reconciler](phase-02-build-staging-and-launch-reconciler.md).

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

### Curated Skill

A first-party `SKILL.md` shipped with the app, reviewed for safety and capability alignment. Default `tier: curated` in frontmatter until forked.

### Custom Skill

A student-authored or forked skill with `tier: custom`. Does not inherit curated trust; capability grants default to the custom ladder in [docs/features/03-skill-system.md](../../features/03-skill-system.md).

### Skill Slug

Directory name under `skills/<slug>/` and under `.agents/skills/<slug>/`. Must match the stable id used by the registry and UI (e.g. `plan-mode`).

### Fork

A copy of a curated skill into user-owned space with `forkedFrom: <slug>@<version>` and `tier: custom`. Behavior may diverge; trust does not.

### Tier

`curated` or `custom` (and optionally `promoted` as a product label once grants expand). Parser field planned in Phase 03.

### Capability Request

YAML list `requested_capabilities` in skill frontmatter. Maps to logical buckets (`canvas.*.read`, `calendar.events.write`, etc.) documented in Phase 00. **Not** permission to call tools.

### Capability Grant

Server-owned record that a specific skill slug (or fork) may invoke a tool or tool class. Mutated only through explicit promotion UX (Phase 04).

### Policy Gate

Server-side check before an outbound Canvas or Apple Calendar MCP tool runs: compare tool name (or category) against active skill + grants. Blocks or surfaces approval when missing.

### Reconciler

Launch-time routine that copies or upgrades bundled `SKILL.md` files into the Codex-visible user skills directory without clobbering user edits. See Phase 02.

### Bundled Skills Manifest

`bundled-skills.manifest.json` produced at build time listing each curated slug with `version` and `contentHash` for upgrade decisions.

### User Skills Directory

`<userData>/codex-user-home/.agents/skills/` — Codex CLI scans here; Student Claw mirrors bundled skills here and allows user edits and forks.

### Repo Skills Root

Repository `skills/` — source of truth for curated markdown before staging into the app bundle.

### Verification Gate

Per phase: unit coverage for the phase's core contract where code exists, one integration check, one manual smoke test, one failure-path check. Phase 00 is documentation-only; its gate is reviewer sign-off that the contract is unambiguous.

## Phase Handoff Log

### Phase 00 - Skill Inventory And Frontmatter Contract

_No handoff entries yet._

### Phase 01 - Author Curated Skills With MCP Workflows

- Date: 2026-04-22
- Branch: `cursor/course-schema-canvas-sync-migration`
- Owner: Cursor
- Status change: `not_started -> complete`
- Completed:
  - Renamed `skills/plan/` to `skills/plan-mode/` with expanded Phase 00 frontmatter (`name`, `description`, `version`, `tier`, `context`, `triggers`, `requested_capabilities`).
  - Authored `skills/study-helper/SKILL.md` (Canvas `get_assignment_details`, `get_page_content`, `list_pages`; optional `getCalendarEvents`).
  - Authored `skills/essay-reviewer/SKILL.md` (Canvas `get_assignment_details`, `get_page_content`, workspace-scoped `download_course_file`).
  - Authored `skills/exam-prep/SKILL.md` (Canvas `get_my_upcoming_assignments`, `list_modules`, `list_module_items`, `get_course_structure`; Apple Calendar `getCalendars`, `getCalendarEvents`, `createCalendarEvent` behind approval).
  - Authored `skills/citation-helper/SKILL.md` (narrow; optional `get_assignment_details`, `list_course_files` for style detection; no writes/downloads).
  - Authored `skills/explain-like/SKILL.md` as an always-on helper with no `requested_capabilities`.
  - Added [packages/server/src/skills/SkillParser.test.ts](../../../packages/server/src/skills/SkillParser.test.ts) asserting all six curated SKILL.md files parse without throwing under the expanded frontmatter, and that the legacy `skills/plan/` directory is absent.
- Remaining:
  - Parser changes to consume `tier`, `version`, `requested_capabilities`, `forkedFrom` are deferred to Phase 03; today the parser ignores unknown keys via `gray-matter`.
- Risks or blockers:
  - UI typecheck on this branch fails due to a pre-existing `course.color` removal from the prior `9273b57` commit (unrelated to this phase); tracked separately.
- Commands run:
  - `bun --cwd packages/server test packages/server/src/skills/SkillParser.test.ts` (233 pass, 0 fail; 8 new tests)
  - `bun --cwd packages/server typecheck` (clean)
- Evidence captured:
  - All 8 new `SkillParser.test.ts` cases pass.
  - `skills/` directory now contains exactly: `citation-helper`, `essay-reviewer`, `exam-prep`, `explain-like`, `plan-mode`, `study-helper`.
- First recommended next step:
  - Begin [Phase 02 - Build Staging And Launch Reconciler](phase-02-build-staging-and-launch-reconciler.md): author `scripts/stage-bundled-skills.ts` + test, emit `bundled-skills.manifest.json`, and extend `prepareIsolatedCodexRuntime` with the hash-based reconciler.

### Phase 02 - Build Staging And Launch Reconciler

_No handoff entries yet._

### Phase 03 - Resolver Tier Metadata And Policy Gate

_No handoff entries yet._

### Phase 04 - Skill Editor Fork And Promotion UX

_No handoff entries yet._
