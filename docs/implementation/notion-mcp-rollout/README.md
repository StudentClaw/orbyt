# Notion MCP Rollout

Last updated: 2026-05-05

This docs package is the implementation source of truth for bundling the official local Notion MCP server as an Orbyt extension.

## How To Use These Plans

1. Start with [GLOSSARY.md](GLOSSARY.md) for status, vocabulary, and handoff notes.
2. Work phases in order.
3. Before coding a phase, read its Orientation Note and follow [PLAN.md](../../internal/PLAN.md).
4. Use vertical TDD cycles from [TEST.md](../../internal/TEST.md).
5. Do not mark a phase complete until its verification gate is green and the handoff log is updated.

## Phase Order

- [Phase 00 - Rollout Scaffold And Contract](phase-00-rollout-scaffold-and-contract.md)
- [Phase 01 - Manifest Package And Build Staging](phase-01-manifest-package-and-build-staging.md)
- [Phase 02 - Credential Startup Boundary](phase-02-credential-startup-boundary.md)
- [Phase 03 - Stdio Wrapper Runtime](phase-03-stdio-wrapper-runtime.md)
- [Phase 04 - Settings UX Verification And Handoff](phase-04-settings-ux-verification-and-handoff.md)

## Locked V1 Decisions

- Use the official `@notionhq/notion-mcp-server` local package.
- Keep Orbyt transport local stdio only.
- Store a Notion internal integration token through Orbyt's plugin vault.
- Expose the official local server's 22 API-prefixed tools statically in the Orbyt manifest.
- Defer Notion's hosted remote OAuth MCP until Orbyt has remote transport support.
