# Phase 01 - Manifest Package And Build Staging

Last updated: 2026-05-05

## Orientation Note

- Target feature: add the `notion-mcp` extension package and build/staging integration.
- Key dependencies: `packages/extensions/template-mcp`, `packages/extensions/apple-calendar-mcp`, `scripts/stage-bundled-extensions.ts`.
- Constraints and boundaries: expose the official 22 API-prefixed tools, pin the official npm dependency, keep `local_stdio`, defer credential startup behavior.
- Acceptance criteria: Notion manifest validates, root scripts include `notion-mcp`, staged bundled resources include Notion dependencies.

## Beginning

### Objective

Create the extension package shell so the registry and staging system can discover Notion like other bundled plugins.

### Current State

No Notion package exists. Existing extension packages provide the package/manifest/tsconfig pattern.

### Out Of Scope

- credential env injection
- live Notion tool calls
- custom Settings UI

## Middle

### TDD Cycle

1. RED: manifest test expects all 22 official tool names and manual `NOTION_TOKEN` auth.
2. GREEN: add package scaffold, manifest JSON, and TypeScript manifest.
3. RED: staging/script test expects Notion dependencies in the bundled runtime package.
4. GREEN: wire root scripts and staging expectations.

### Verification Gate

- Unit: `bun --cwd packages/extensions/notion-mcp test`
- Integration: `bun test ./scripts/stage-bundled-extensions.test.ts`
- Manual smoke: registry lists `notion-mcp` from `packages/extensions`
- Failure path: manifest validation rejects if required fields drift

## End

### Done When

Notion is a buildable bundled extension package and staging includes its runtime dependency tree.
