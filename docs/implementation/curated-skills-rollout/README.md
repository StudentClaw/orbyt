# Curated Skills Rollout

Last updated: 2026-04-22

This docs package is the implementation source of truth for shipping **first-party curated skills** with Orbyt: markdown-first `SKILL.md` files that Codex CLI discovers under the isolated user home, that the local server indexes for chat activation, and that are **bundled** into the desktop artifact with safe upgrade and fork semantics.

It is intentionally separate from [docs/features/03-skill-system.md](../../features/03-skill-system.md), which remains the product spec for the two-tier skill model, policy gate, and editor UX. This rollout does not rewrite that spec; it sequences engineering work against it.

The AI harness context for Codex CLI is documented in [docs/features/01-ai-harness.md](../../features/01-ai-harness.md).

## How To Use These Plans

1. Start with [GLOSSARY.md](GLOSSARY.md) for status, shared vocabulary, and the handoff record.
2. Work phases in order unless a later phase explicitly says it can start in parallel.
3. Before coding a phase, read that phase's Orientation Note and follow the required Beginning → Middle → End flow from [PLAN.md](../../internal/PLAN.md).
4. Do not mark a phase complete until its verification gates are green and its handoff notes are recorded in [GLOSSARY.md](GLOSSARY.md).

## Phase Order

- [Phase 00 - Skill Inventory And Frontmatter Contract](phase-00-skill-inventory-and-frontmatter-contract.md)
- [Phase 01 - Author Curated Skills With MCP Workflows](phase-01-author-curated-skills-with-mcp-workflows.md)
- [Phase 02 - Build Staging And Launch Reconciler](phase-02-build-staging-and-launch-reconciler.md)
- [Phase 03 - Resolver Tier Metadata And Policy Gate](phase-03-resolver-tier-metadata-and-policy-gate.md)
- [Phase 04 - Skill Editor Fork And Promotion UX](phase-04-skill-editor-fork-and-promotion-ux.md)

## Planning Principles For This Rollout

- **Skill files are advisory; the MCP gateway is authoritative.** `requested_capabilities` in frontmatter expresses intent; grants and enforcement live server-side.
- **Every curated skill except `explain-like` must use Canvas and/or Apple Calendar MCP tools in a non-trivial way** when executed (see Phase 01 for the frozen tool touchpoints per skill).
- **Fork copies behavior, not trust.** A forked skill keeps `tier: custom` and default custom power until promoted through the Phase 04 flow.
- **User edits to installed curated files are sacred.** The launch reconciler must never overwrite a file whose content hash has diverged from the last known bundled hash (fork or local edit).
- **Suggest-then-confirm** for any workflow that requests write capabilities (e.g. calendar event creation).
- **One format:** stay on `gray-matter` frontmatter + markdown body; extend [packages/server/src/skills/SkillParser.ts](../../../packages/server/src/skills/SkillParser.ts) rather than inventing a parallel skill format.
- **`skills-lock.json` and third-party skill repos** are dev-time only for this rollout; shipping curated skills does not depend on them. A follow-on doc can formalize external skill installs if needed.

## Deliverables Across The Full Rollout

- Frozen inventory of six curated slugs and an expanded frontmatter contract (Phase 00).
- Six authored `skills/<slug>/SKILL.md` files with Canvas/Calendar MCP workflow requirements (Phase 01).
- Build-time staging of bundled skills + manifest; launch-time reconciler into Codex-visible `.agents/skills/` with hash-based upgrade and fork protection (Phase 02).
- Parser/resolver extensions for tier, version, requested capabilities, fork provenance; MCP policy gate keyed on active skill grants (Phase 03).
- Skill picker tier affordances; editor; fork and per-capability promotion dialogs wired to the grant store (Phase 04).

## Relationship To Existing Code

- Skill discovery today: [packages/server/src/skills/SkillResolver.ts](../../../packages/server/src/skills/SkillResolver.ts) walks `skills/`, `.agents/skills/`, and related roots.
- Isolated Codex home already creates `.agents/skills` under the process home: [packages/electron/src/codex/runtime.ts](../../../packages/electron/src/codex/runtime.ts).
- Canvas MCP tool names (canonical list): [packages/extensions/canvas-mcp/src/student-tool-contract.ts](../../../packages/extensions/canvas-mcp/src/student-tool-contract.ts).
- Apple Calendar MCP tools: [packages/extensions/apple-calendar-mcp/src/server.ts](../../../packages/extensions/apple-calendar-mcp/src/server.ts).
