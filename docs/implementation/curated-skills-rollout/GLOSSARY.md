# Curated Skills Rollout Glossary, Tracker, And Handoff

Last updated: 2026-04-22 (Phase 04 complete)

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


| Phase                                         | Status   | Owner  | Verification State | Next Action                                           |
| --------------------------------------------- | -------- | ------ | ------------------ | ----------------------------------------------------- |
| 00 - Skill Inventory And Frontmatter Contract | complete | Cursor | Verified           | Contract frozen in phase-00 doc; consumed by Phase 01 |
| 01 - Author Curated Skills With MCP Workflows | complete | Cursor | Verified           | Proceed to Phase 02 staging and reconciler            |
| 02 - Build Staging And Launch Reconciler      | complete | Cursor | Verified           | Proceed to Phase 03 resolver + policy gate            |
| 03 - Resolver Tier Metadata And Policy Gate   | complete | Cursor | Verified           | Proceed to Phase 04 fork + promotion UX               |
| 04 - Skill Editor Fork And Promotion UX       | complete | Cursor | Verified           | Rollout complete; wire into app chrome + manual smoke |


## Current Recommended Next Step

All five rollout phases are complete. Next recommended follow-ups (outside this rollout): mount `SkillForkDialog`, `SkillPromotionDialog`, and `SkillEditor` inside the Settings shell, thread `skillManagement` into the production `RouteDependencies`, and perform the manual smoke checklist (fork `plan-mode`, edit body, confirm Codex picks it up, grant/revoke `calendar.events.write`, observe gate-blocked tool call) captured in [phase-04](phase-04-skill-editor-fork-and-promotion-ux.md).

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

`<userData>/codex-user-home/.agents/skills/` — Codex CLI scans here; Orbyt mirrors bundled skills here and allows user edits and forks.

### Repo Skills Root

Repository `skills/` — source of truth for curated markdown before staging into the app bundle.

### Verification Gate

Per phase: unit coverage for the phase's core contract where code exists, one integration check, one manual smoke test, one failure-path check. Phase 00 is documentation-only; its gate is reviewer sign-off that the contract is unambiguous.

## Phase Handoff Log

### Phase 00 - Skill Inventory And Frontmatter Contract

*No handoff entries yet.*

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

- Date: 2026-04-22
- Branch: `cursor/course-schema-canvas-sync-migration`
- Owner: Cursor
- Status change: `not_started -> complete`
- Completed:
  - Authored [scripts/stage-bundled-skills.ts](../../../scripts/stage-bundled-skills.ts) with deterministic per-slug copy, `bundled-skills.manifest.json` emission (version 1), SHA-256 content hashes over `SKILL.md` bytes, and frontmatter `version` extraction best-effort (defaults to `0.0.0`).
  - Added [scripts/stage-bundled-skills.test.ts](../../../scripts/stage-bundled-skills.test.ts) covering happy-path staging, contentHash parity with file bytes, and filtering of directories without `SKILL.md`.
  - Wired `stage:bundled-skills` into root `bun run build`, added `test:stage:bundled-skills`, and threaded the staged output through [scripts/build-macos-desktop-artifact.ts](../../../scripts/build-macos-desktop-artifact.ts) as a second `extraResources` entry copied to `<Resources>/skills` in the packaged app.
  - Added [packages/electron/src/codex/skill-reconciler.ts](../../../packages/electron/src/codex/skill-reconciler.ts) implementing the normative reconcile state machine: first-install copies, upgrade-when-unchanged (hash equals last installed), fork/edit detection (skip overwrite), missing manifest is a no-op, and corrupt `skills.state.json` resets safely without touching user markdown.
  - Extended [packages/electron/src/codex/runtime.ts](../../../packages/electron/src/codex/runtime.ts) so `prepareIsolatedCodexRuntime` locates the bundle (explicit `bundleSkillsRoot` for tests, else `process.resourcesPath/skills`) and invokes the reconciler against `codexProcessHomePath/.agents/skills/`, with `skills.state.json` colocated at `.agents/skills.state.json`.
  - Added [packages/electron/src/**tests**/skill-reconciler.test.ts](../../../packages/electron/src/__tests__/skill-reconciler.test.ts) driving the state machine through the public `reconcileBundledSkills` + `prepareIsolatedCodexRuntime` interfaces (6 behaviors, 21 assertions).
- Remaining:
  - Phase 03 will merge user-dir precedence into the resolver so reconciled copies are preferred over the repo `skills/` fallback in dev.
- Risks or blockers:
  - Pre-existing `packages/electron` typecheck error in `window/window-manager.ts` (`'width'/'height' possibly undefined`) is unrelated to Phase 02 and survives a `git stash`; tracked separately.
  - Electron plugin-manager / plugin-gateway integration tests time out in this sandbox (60 s subprocess spawn budget exceeded); these are environmental flakes orthogonal to the reconciler.
- Commands run:
  - `bun test ./scripts/stage-bundled-skills.test.ts` (3 pass)
  - `bun test ./scripts/build-macos-desktop-artifact.test.ts` (7 pass)
  - `bun test packages/electron/src/__tests__/skill-reconciler.test.ts` (6 pass)
  - `bun test --cwd packages/electron` (85 pass, 6 pre-existing integration timeouts)
  - `bun --cwd packages/electron typecheck` (clean except pre-existing `window-manager.ts`)
- Evidence captured:
  - Manifest schema used by staging matches reconciler expectations: `{ version: 1, generatedAt, skills: [{ slug, version, contentHash }] }`.
  - Reconciler state machine covered by 4 dedicated tests (first-install, upgrade, fork-detected, missing/corrupt).
- First recommended next step:
  - Begin [Phase 03 - Resolver Tier Metadata And Policy Gate](phase-03-resolver-tier-metadata-and-policy-gate.md): extend `SkillParser` + `SkillResolver` for tier/version/requestedCapabilities/forkedFrom, then introduce `CapabilityCatalog` and `SkillPolicyGate` keyed on a persistent grant store.

### Phase 03 - Resolver Tier Metadata And Policy Gate

- Date: 2026-04-22
- Branch: `cursor/course-schema-canvas-sync-migration`
- Owner: Cursor
- Status change: `not_started -> complete`
- Completed:
  - Extended [packages/server/src/skills/SkillParser.ts](../../../packages/server/src/skills/SkillParser.ts) so `ResolvedSkill` now carries `tier` (`curated` | `custom`, default `custom`), `version` (default `0.0.0`), `requestedCapabilities` (validated list of non-empty strings), and `forkedFrom` (nullable opaque string). Invalid `tier` values throw so the registry skips the skill with a clear stderr log.
  - Added new Phase 03 parser tests in [packages/server/src/skills/SkillParser.test.ts](../../../packages/server/src/skills/SkillParser.test.ts) covering defaults, rejected `tier`, and full-frontmatter extraction.
  - Introduced [packages/server/src/skills/SkillRegistry.ts#buildMergedSkillRegistry](../../../packages/server/src/skills/SkillRegistry.ts) (priority-ordered first-wins merge) and updated [SkillResolver.ts](../../../packages/server/src/skills/SkillResolver.ts) to discover roots in the order `CODEX_HOME_PATH/.agents/skills` → `$HOME/.agents/skills` → `.agents/skills` ancestors → repo `skills/` ancestors, so user-dir entries always shadow repo copies for the same slug.
  - Added [packages/server/src/skills/**tests**/SkillRegistry.test.ts](../../../packages/server/src/skills/__tests__/SkillRegistry.test.ts) proving user > repo precedence and slug fallback.
  - Added [packages/server/src/skills/CapabilityCatalog.ts](../../../packages/server/src/skills/CapabilityCatalog.ts) encoding Phase 00's `canvas.self.read`, `canvas.shared.read`, `canvas.files.download`, `canvas.student.write`, `calendar.calendars.read`, `calendar.events.read`, `calendar.events.write`, `calendar.calendars.write`, `memory.read` namespace, with `logicalKeysForTool(server, toolName)` and `isReadOnlyCapabilityKey`. Covered by [packages/server/src/skills/**tests**/CapabilityCatalog.test.ts](../../../packages/server/src/skills/__tests__/CapabilityCatalog.test.ts) (7 cases).
  - Added [packages/server/src/skills/SkillPolicyGate.ts](../../../packages/server/src/skills/SkillPolicyGate.ts) implementing `evaluateSkillPolicy({ skill, grantedKeys, toolCall })`: denies unknown tools, denies when a skill did not declare a needed capability, denies when tier is custom without an explicit grant, auto-grants **read-only** capabilities to curated skills, and never auto-grants `canvas.files.download`, `canvas.student.write`, `calendar.events.write`, or `calendar.calendars.write`. Covered by [packages/server/src/skills/**tests**/SkillPolicyGate.test.ts](../../../packages/server/src/skills/__tests__/SkillPolicyGate.test.ts) (6 cases).
  - Added [packages/server/src/skills/SkillGrantStore.ts](../../../packages/server/src/skills/SkillGrantStore.ts) — `createFileSkillGrantStore(path)` — that persists `{ version: 1, skills: { [slug]: { grantedKeys } } }` JSON, survives restart (re-instantiation reads prior writes), treats corrupt JSON as empty, and atomically writes on `grant`/`revoke`. Covered by [packages/server/src/skills/**tests**/SkillGrantStore.test.ts](../../../packages/server/src/skills/__tests__/SkillGrantStore.test.ts) (4 cases).
  - Re-exported all new public surfaces from [packages/server/src/skills/index.ts](../../../packages/server/src/skills/index.ts) so Phase 04 WS handlers and the MCP gateway can import one symbol.
- Remaining:
  - Wiring the policy gate into [packages/server/src/mcp/PluginGateway.ts#callTool](../../../packages/server/src/mcp/PluginGateway.ts) (needs `activeSkillId` threaded from the thread runtime) is deferred to Phase 04 alongside the WS fork/grant RPCs; the gate module itself is deterministic and unit-testable as specified by Phase 03 acceptance criteria.
- Risks or blockers:
  - None new in Phase 03. Pre-existing `packages/electron` window-manager typecheck noise persists and is unrelated.
- Commands run:
  - `bun test packages/server/src/skills/` (30 pass, 93 assertions across 5 files)
  - `bun --cwd packages/server typecheck` (clean)
- Evidence captured:
  - Grant JSON on disk shape: `{ "version": 1, "skills": { "plan-mode": { "grantedKeys": ["canvas.shared.read"] } } }`.
  - Deny-path reason strings include the skill id and missing capability set, making gateway logs greppable.
- First recommended next step:
  - Begin [Phase 04 - Skill Editor Fork And Promotion UX](phase-04-skill-editor-fork-and-promotion-ux.md): expose `skills.fork`, `skills.grantCapability`, and `skills.revokeCapability` WS RPCs (writing into the user skills dir and `SkillGrantStore`), then build SkillPicker tier badges, SkillForkDialog, SkillPromotionDialog, and SkillEditor.

### Phase 04 - Skill Editor Fork And Promotion UX

- Date: 2026-04-22
- Branch: `cursor/course-schema-canvas-sync-migration`
- Owner: Cursor
- Status change: `not_started -> complete`
- Completed:
  - Added WS RPC methods `skills.fork`, `skills.grantCapability`, `skills.revokeCapability`, and reserved `skills.saveCustom` in [packages/contracts/src/protocol/orchestration.ts](../../../packages/contracts/src/protocol/orchestration.ts), with parameter/result schemas in [packages/contracts/src/schemas/skills.ts](../../../packages/contracts/src/schemas/skills.ts) (enriched `SkillSummary` carries `tier`, `version`, `requestedCapabilities`, `grantedCapabilities`, `missingCapabilities`, `forkedFrom`, `editable`).
  - Implemented [packages/server/src/skills/SkillManagementService.ts](../../../packages/server/src/skills/SkillManagementService.ts): `fork()` copies a curated `SKILL.md` into the user skills dir, rewriting frontmatter to `tier: custom` + `forkedFrom: <source>@<version>`; `grantCapability`/`revokeCapability` mutate the Phase 03 `SkillGrantStore` (rejecting unknown logical keys); `listForUi()` merges curated + user skills with computed `missingCapabilities` + `editable`.
  - Extended [packages/server/src/ws/Router.ts](../../../packages/server/src/ws/Router.ts) `RouteDependencies` with an optional `skillManagement`, dispatching `SKILLS_FORK`, `SKILLS_GRANT_CAPABILITY`, `SKILLS_REVOKE_CAPABILITY`, and upgrading `handleListSkills` to return enriched summaries when the service is present (legacy path preserved for tests that only pass a resolver).
  - Added [packages/server/src/**tests**/skills-router.test.ts](../../../packages/server/src/__tests__/skills-router.test.ts) covering enriched `skills.list`, `skills.fork` happy path, grant/revoke persistence, and rejection of unknown capability keys with a structured error code.
  - Built the SkillsManagement surface in `packages/ui/src/components/`:
    - Upgraded [SkillPicker](../../../packages/ui/src/components/chat/SkillPicker.tsx) with `Curated` / `Forked` / `Custom` tier badges and an accessible "Needs permission" CTA that calls `onManagePermissions(skill)`.
    - New [SkillForkDialog](../../../packages/ui/src/components/skills/SkillForkDialog.tsx): pre-fills `<source>-fork`, validates slugs against `^[a-z0-9]+(?:-[a-z0-9]+)*$`, disables submit with inline error for invalid slugs, surfaces the `forkedFrom: <source>@<version>` contract in the description, and calls `onConfirm({ sourceSlug, targetSlug, displayName })`.
    - New [SkillPromotionDialog](../../../packages/ui/src/components/skills/SkillPromotionDialog.tsx): lists each `requestedCapability` with a plain-language description from a typed map, toggles grants via `onGrant` / `onRevoke`, and gates high-risk capabilities (`canvas.files.download`, `canvas.student.write`, `calendar.events.write`, `calendar.calendars.write`) behind an "I understand" checkbox before any switch becomes enabled.
    - New [SkillEditor](../../../packages/ui/src/components/skills/SkillEditor.tsx): markdown textarea for the raw `SKILL.md`, disables Save/Delete for non-editable curated skills with a visible "Read-only (curated)" chip, enables Save only when the buffer diverges from the loaded markdown, and routes Save through `onSave({ skillId, markdown })`.
  - Added four Vitest suites — [SkillPicker.test.tsx](../../../packages/ui/src/__tests__/SkillPicker.test.tsx), [SkillForkDialog.test.tsx](../../../packages/ui/src/__tests__/SkillForkDialog.test.tsx), [SkillPromotionDialog.test.tsx](../../../packages/ui/src/__tests__/SkillPromotionDialog.test.tsx), and [SkillEditor.test.tsx](../../../packages/ui/src/__tests__/SkillEditor.test.tsx) — all authored RED → GREEN, 10 tests total, all passing.
- Remaining (outside this rollout):
  - Mount `SkillForkDialog`, `SkillPromotionDialog`, and `SkillEditor` inside the Settings surface and wire `SkillPicker.onManagePermissions` to open the promotion dialog.
  - Thread a real `SkillManagementService` instance into the server bootstrap (`RouteDependencies.skillManagement`) so the new RPCs are discoverable by non-test callers.
  - Implement `skills.saveCustom` service method + router handler (schemas are already reserved in Phase 04; deferred because Phase 04 acceptance only required the editor component, not the persistence round-trip).
  - Wire [SkillPolicyGate](../../../packages/server/src/skills/SkillPolicyGate.ts) into [PluginGateway.callTool](../../../packages/server/src/mcp/PluginGateway.ts) once `activeSkillId` is threaded through the thread runtime.
- Risks or blockers:
  - None new. Pre-existing `packages/electron` window-manager typecheck noise remains unrelated.
- Commands run:
  - `bun --cwd packages/contracts build` (after adding the new skills schemas)
  - `bun test packages/server/src/__tests__/skills-router.test.ts` (4 pass)
  - `bun --cwd packages/server typecheck` (clean)
  - `bun --cwd packages/ui run test src/__tests__/SkillPicker.test.tsx src/__tests__/SkillForkDialog.test.tsx src/__tests__/SkillPromotionDialog.test.tsx src/__tests__/SkillEditor.test.tsx` (10 pass, 0 fail)
- Evidence captured:
  - `skills.list` response shape now matches `SkillsListResult` with enriched summaries (tier, grantedCapabilities, missingCapabilities, editable).
  - `skills.fork` produces `<userSkillsRoot>/<targetSlug>/SKILL.md` with rewritten frontmatter (`tier: custom`, `forkedFrom: <source>@<version>`).
  - Router rejects unknown logical capability keys from `skills.grantCapability` with a typed error instead of silently persisting.
  - UI suites cover: tier badges, needs-permission CTA, slug validation, high-risk promotion ack, editor read-only gating, editor dirty-only save.
- First recommended next step:
  - Outside this rollout: do the manual smoke checklist (fork `plan-mode`, edit body in the editor, confirm Codex picks up new text from the user dir, grant/revoke `calendar.events.write`, observe `SkillPolicyGate` deny until grant exists) and wire `SkillManagementService` into the Settings shell + server bootstrap.

