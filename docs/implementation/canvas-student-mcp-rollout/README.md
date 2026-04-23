# Canvas Student MCP Rollout Plans

Last updated: 2026-04-17

This docs package is the implementation source of truth for the Canvas student-surface redesign in Orbyt.

It is intentionally separate from [docs/features/02-canvas-integration.md](../../features/02-canvas-integration.md), which still describes the current Canvas integration and should not be rewritten as part of creating this rollout package.

## How To Use These Plans

1. Start with [GLOSSARY.md](GLOSSARY.md) to see current status, shared vocabulary, and the handoff record.
2. Work phases in order unless a later phase explicitly says it can start in parallel.
3. Before coding a phase, read that phase's Orientation Note and follow the required Beginning -> Middle -> End flow from [PLAN.md](../../../PLAN.md).
4. Do not mark a phase complete until its verification gates are green and its handoff notes are recorded in [GLOSSARY.md](GLOSSARY.md).

## Phase Order

- [Phase 00 - Student Contract And Manifest Reset](phase-00-student-contract-and-manifest-reset.md)
- [Phase 01 - Student-Safe Client And Self Tools](phase-01-student-safe-client-and-self-tools.md)
- [Phase 02 - Shared Student Read Surface](phase-02-shared-student-read-surface.md)
- [Phase 03 - Student Actions And Local Downloads](phase-03-student-actions-and-local-downloads.md)
- [Phase 04 - Consumer Migration And Hardening](phase-04-consumer-migration-and-hardening.md)

## Planning Principles For This Rollout

- Keep the existing Orbyt plugin, gateway, and vault architecture.
- Replace the Canvas student-facing MCP surface deliberately instead of widening the current legacy 6-tool contract.
- Prefer student-safe Canvas endpoint patterns over instructor-oriented or gradebook-style reads.
- Treat student capability differences across courses as a normal part of the product, not as plugin failure.
- Keep all local file writes scoped to the active Codex workspace and writable roots.

## Deliverables Across The Full Rollout

- New Canvas student-role tool inventory and manifest plan
- Student-safe Canvas client and permission-handling strategy
- Shared student read surface for courses, content, files, discussions, and messages
- Student-side action plan for discussions, conversation state, and local file downloads
- Consumer migration, verification, and hardening plan for replacing the old Canvas surface
