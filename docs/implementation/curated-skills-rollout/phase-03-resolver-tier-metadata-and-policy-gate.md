# Phase 03 - Resolver Tier Metadata And Policy Gate

Last updated: 2026-04-22

## Orientation Note

- **Target feature:** extend server-side skill parsing and discovery so the harness and gateway understand **tier**, **version**, **requested capabilities**, and **fork provenance**; enforce **declared vs granted** separation at the MCP boundary.
- **Key dependencies:** [Phase 02 - Build Staging And Launch Reconciler](phase-02-build-staging-and-launch-reconciler.md), [packages/server/src/skills/SkillParser.ts](../../../packages/server/src/skills/SkillParser.ts), [packages/server/src/skills/SkillResolver.ts](../../../packages/server/src/skills/SkillResolver.ts), [packages/electron/src/codex/runtime.ts](../../../packages/electron/src/codex/runtime.ts) (gateway / MCP launch config), Phase 00 capability mapping tables.
- **Constraints and boundaries:**
  - Markdown `requested_capabilities` never grants rights by itself.
  - Default custom tier behavior remains as in [docs/features/03-skill-system.md](../../features/03-skill-system.md) (read-suggest, planner-scope); this phase implements the **mechanism**, Phase 04 the **UX** to widen grants.
  - Policy gate must be deterministic and unit-testable per tool name.
- **Acceptance criteria for this increment:**
  - `ResolvedSkill` includes `tier`, `version`, `requestedCapabilities`, `forkedFrom` (nullable) with validated shapes.
  - `SkillResolver` merge order prefers **user skills dir** over repo `skills/` when both define the same slug (user wins).
  - A gateway or server module intercepts outbound Canvas and Apple Calendar MCP calls and denies or defers when the active skill lacks grant.
  - Grant store is persisted (location TBD: SQLite / JSON under userData — implementation detail; must survive restart).

## Beginning

### Objective

Make the system internally consistent: the same `SKILL.md` file informs UX and Codex, while **only** persisted grants authorize side effects.

### Current State

- Parser exposes `id`, `name`, `description`, `path`, `instructions`, `contextKey`.
- Resolver merges multiple roots with first-wins today; Phase 00 requires user-dir precedence for conflicts.
- MCP config is built in Electron for isolated Codex; tool calls flow through gateway architecture (see feature docs).

### Out Of Scope

- Full Skill Editor (Phase 04).
- Changing Codex CLI protocol.

### Acceptance Criteria

- Typecheck + new unit tests for parser and gate mapping.
- Documented mapping from Phase 00 logical capability keys → tool name sets used by gate.

## Middle

### Implementation Slices

1. **Extend `parseSkillFile`** in [SkillParser.ts](../../../packages/server/src/skills/SkillParser.ts):

   - `tier`: validate `curated` | `custom`; default `custom` when missing (safe default for unknown files).
   - `version`: semver string optional for backward compat; if missing, treat as `0.0.0` internally.
   - `requested_capabilities`: string array; validate entries against allowlist enum derived from Phase 00 keys.
   - `forkedFrom`: optional string matching `<slug>@<semver>` pattern or allow opaque string v1.

2. **Extend `ResolvedSkill` type** accordingly; ensure websocket / RPC payloads that expose skills to UI include new fields (contracts package if needed).

3. **Update `SkillResolver` merge policy** in [SkillResolver.ts](../../../packages/server/src/skills/SkillResolver.ts):

   - Build registry by iterating roots in **priority order**: `<userData>/.../.agents/skills` (highest), then repo `skills/`, then other dev paths.
   - Alternatively keep iteration order but **replace** on collision when the new source is higher priority — document chosen approach in code comments.

4. **Introduce `CapabilityCatalog` module** (new file under `packages/server/src/skills/` or `packages/server/src/mcp/`):

   - Export function `logicalKeysForTool(mcpServerId: string, toolName: string): readonly LogicalCapabilityKey[]`.
   - Encode tables from Phase 00 (Canvas self vs shared vs download vs student write; Apple Calendar read vs write).

5. **Introduce `SkillPolicyGate` service:**

   - Inputs: `activeSkillId`, `resolvedSkill`, `grantStore`, `toolCall` descriptor `{ server, toolName, paramsPreview? }`.
   - Logic:
     - If tool maps to no capability keys → allow or deny based on global default (document: likely **deny** for unknown tools in v1 student mode, or **allow read-only** if tool is classified read — product call).
     - If tool requires keys **subset of** `resolvedSkill.requestedCapabilities` **and** subset of `grantStore[skillId]` → allow.
     - If requested by skill but not granted → return structured error to harness → UI prompt (Phase 04) or inline approval placeholder.
   - **Curated shortcut (optional v1):** auto-grant read classes for `tier: curated` only; never auto-grant `calendar.events.write` or `canvas.student.write`.

6. **Persist grant store:**

   - Minimal schema: `{ skillId: { grantedKeys: string[] } }`.
   - Mutations only through server IPC used by Phase 04.

### Primary Directories

- `packages/server/src/skills/SkillParser.ts`
- `packages/server/src/skills/SkillRegistry.ts` (if merge logic lives here instead)
- `packages/server/src/skills/SkillResolver.ts`
- `packages/server/src/mcp/` or orchestration layer where tool calls are proxied
- `packages/contracts/` if skill DTOs are shared

### Verification Gates

- **Unit:** parser tests for valid/invalid frontmatter; gate tests for representative tools (`get_page_content` allowed under `canvas.shared.read` grant; `createCalendarEvent` blocked without `calendar.events.write`).
- **Integration:** one harness test simulating active `plan-mode` with partial grants.
- **Manual smoke:** activate skill in UI, attempt calendar write without grant → blocked with clear error.
- **Failure path:** malformed `requested_capabilities` YAML → parse error skips skill with stderr log (existing registry behavior).

### Evidence To Capture

- Test file listing for new modules.
- Example grant JSON shape in handoff log.

## End

### Done When

- No outbound high-risk MCP call can succeed solely because the skill markdown asked for it.

### Handoff To Next Phase

Phase 04 exposes grants in UI, implements fork and per-capability promotion writing into the grant store.

### Risks To Carry Forward

- Classifying tools as read vs write must stay aligned when MCP servers add tools — add contract test against manifest tool lists if feasible.
- Dual discovery (Codex native skills vs server resolver) could drift; reconciler in Phase 02 mitigates file drift, not grant drift.

### First Recommended Next Step

Start [Phase 04 - Skill Editor Fork And Promotion UX](phase-04-skill-editor-fork-and-promotion-ux.md).
