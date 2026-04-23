# MCP Plugin System Implementation Plans

Last updated: 2026-04-11

This docs package is the implementation source of truth for the Orbyt MCP plugin system rollout.

It is intentionally separate from [docs/features/05-plugin-system.md](../../features/05-plugin-system.md), which is currently outdated and should not be used to sequence implementation work.

## How To Use These Plans

1. Start with [GLOSSARY.md](GLOSSARY.md) to see current status, shared vocabulary, and the handoff record.
2. Work phases in order unless a later phase explicitly says it can start in parallel.
3. Before coding a phase, read that phase's Orientation Note and follow the required Beginning -> Middle -> End flow from [PLAN.md](../../../PLAN.md).
4. Do not mark a phase complete until its verification gates are green and its handoff notes are recorded in [GLOSSARY.md](GLOSSARY.md).

## Phase Order

- [Phase 00 - Contracts And Scaffolding](phase-00-contracts-and-scaffolding.md)
- [Phase 01 - Discovery And Registry](phase-01-discovery-and-registry.md)
- [Phase 02 - Local Spawn And Lifecycle](phase-02-local-spawn-and-lifecycle.md)
- [Phase 03 - Gateway And Codex Integration](phase-03-gateway-and-codex-integration.md)
- [Phase 04 - Credentials And Auth UX](phase-04-credentials-and-auth-ux.md)
- [Phase 05 - Installation And Extension Management](phase-05-installation-and-extension-management.md)
- [Phase 06 - Canvas Vertical Slice](phase-06-canvas-vertical-slice.md)
- [Phase 07 - Hardening And Packaged Runtime](phase-07-hardening-and-packaged-runtime.md)

## Planning Principles For This Rollout

- Each phase must add exactly one new class of responsibility.
- Every phase must be verifiable with automated checks plus one short manual smoke test.
- `template-mcp` is the canary server until the Canvas slice is reached.
- The built-in Codex-facing gateway is treated as a system component, not a user-installable extension.
- Curated bundled extensions come first. Arbitrary custom MCP server support is deferred until the packaged runtime is stable.

## Deliverables Across The Full Rollout

- Shared extension and plugin contracts
- Electron Main plugin runtime and vault
- Server/Main bridge for MCP tool routing
- Orbyt MCP gateway for Codex
- Install and settings UX for bundled extensions
- Canvas credentials and real Canvas tool path
- Packaged Electron runtime that can spawn plugins outside dev mode
