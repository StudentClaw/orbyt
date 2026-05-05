# Phase 03 - Stdio Wrapper Runtime

Last updated: 2026-05-05

## Orientation Note

- Target feature: launch the official Notion MCP CLI through Orbyt's local stdio extension entry.
- Key dependencies: `@notionhq/notion-mcp-server`, `PluginSandbox`, `PluginManager`.
- Constraints and boundaries: wrapper stays thin, official package owns MCP behavior, no custom Notion API client, use stdio/default transport.
- Acceptance criteria: wrapper launches official CLI with `--transport stdio`, `listTools()` exposes the manifest inventory, child-process failures are logged cleanly.

## Beginning

### Objective

Prove the Orbyt package can host the official Notion server through the same process boundary as other MCP extensions.

### Current State

The package and manifest exist after Phase 01. The credential env exists after Phase 02.

### Out Of Scope

- modifying the official package
- changing the Orbyt MCP gateway protocol
- live writes against real user content

## Middle

### TDD Cycle

1. RED: wrapper launch test expects the official CLI path and stdio args.
2. GREEN: implement the thin process wrapper.
3. RED: plugin manager/runtime test expects live listed tools to match the manifest.
4. GREEN: align launch env and manifest inventory.
5. RED: failure test expects child error/exit to be logged and propagated.
6. GREEN: normalize child-process error handling.

### Verification Gate

- Unit: `bun --cwd packages/extensions/notion-mcp test`
- Integration: built Notion extension starts under `PluginSandbox` and lists tools
- Manual smoke: configured Notion plugin starts from Settings
- Failure path: invalid token surfaces as a Notion MCP tool error, not an Orbyt crash

## End

### Done When

The local Notion wrapper can be spawned by Orbyt and exposes the official server's tools.
