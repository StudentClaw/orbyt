# Notion MCP Rollout Glossary, Tracker, And Handoff

Last updated: 2026-05-05

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

Phase `Status` tracks delivery progress. A phase should not be marked `complete` unless its verification state is `Verified`.

## Phase Tracker

| Phase | Status | Owner | Verification State | Next Action |
| --- | --- | --- | --- | --- |
| 00 - Rollout Scaffold And Contract | complete | Codex | Verified | Phase 01 can consume the locked official-wrapper contract |
| 01 - Manifest Package And Build Staging | complete | Codex | Verified | Phase 02 can rely on `notion-mcp` package and staging script wiring |
| 02 - Credential Startup Boundary | complete | Codex | Verified | Phase 03 can rely on Notion pre-spawn env preparation |
| 03 - Stdio Wrapper Runtime | complete | Codex | Verified | Phase 04 can rely on live gateway inventory exposing `notion.API-post-search` |
| 04 - Settings UX Verification And Handoff | complete | Codex | Verified | Manual real-token smoke remains the only external verification gap |

## Current Recommended Next Step

Automated rollout verification is complete. The remaining recommended next step is a manual real-token smoke against a throwaway Notion page.

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
- Remaining:
  - item
- Risks or blockers:
  - item
- Commands run:
  - `bun run typecheck`
- Evidence captured:
  - test output
- First recommended next step:
  - item
```

## Shared Vocabulary

### Official Wrapper

The Orbyt-owned `notion-mcp` extension package that launches Notion's official local MCP server package over stdio instead of reimplementing Notion API tools.

### Official Local Notion MCP

The npm package `@notionhq/notion-mcp-server`. It exposes 22 OpenAPI-derived, `API-` prefixed tools and supports stdio by default. Notion documents that active support is focused on its hosted remote MCP, so Orbyt treats this as a pinned local dependency.

### Notion Integration Token

A secret generated from a Notion internal integration. In Orbyt it is stored as `NOTION_TOKEN` in the plugin vault and injected only into the Notion plugin process at spawn time.

### Connected Content

The pages or data sources a user grants to their Notion internal integration. The token does not grant blanket workspace access unless the integration is configured that way in Notion.

### Pre-Spawn Credential Env

A narrow exception to Orbyt's normal post-start credential message. The official Notion CLI reads `NOTION_TOKEN` during startup, so Electron Main prepares a scoped env map before spawning only the Notion plugin.

### Static Tool Inventory

The 22 official local `API-` prefixed tool names copied into `manifest.json`. Orbyt's gateway inventory is manifest-driven, so this list is a contract and must be updated when the pinned official package changes.

### Remote Notion MCP

Notion's hosted OAuth MCP endpoint. It is deferred until Orbyt supports remote MCP transports.

### TDD Cycle

One RED behavior test, one minimal GREEN implementation, and optional REFACTOR after green. Cycle logs are recorded in phase handoff entries.

## Phase Handoff Log

### Phase 00 - Rollout Scaffold And Contract

- Date: 2026-05-05
- Branch: feature/notion-mcp-wrapper
- Owner: Codex
- Status change: not_started -> complete
- Completed:
  - Created rollout README, glossary/tracker, and phase docs.
  - Locked the official-wrapper contract, local stdio transport, manual token auth, static 22-tool API-prefixed inventory, and remote MCP deferral.
- Remaining:
  - None for Phase 00.
- Risks or blockers:
  - The official local Notion MCP is not Notion's actively prioritized path; dependency pinning and future remote transport follow-up are required.
- Commands run:
  - Documentation scaffold reviewed against `docs/internal/PLAN.md`.
- Evidence captured:
  - This glossary and phase docs exist under `docs/implementation/notion-mcp-rollout/`.
- First recommended next step:
  - Complete Phase 01 build/staging wiring.

### Phase 01 - Manifest Package And Build Staging

- Date: 2026-05-05
- Branch: feature/notion-mcp-wrapper
- Owner: Codex
- Status change: not_started -> complete
- Completed:
  - Added `packages/extensions/notion-mcp` with package, manifest, TypeScript manifest, and pinned `@notionhq/notion-mcp-server@2.2.1`.
  - Wired root `build:extensions`, `typecheck`, and `test` scripts to include `notion-mcp`.
  - Updated bundled extension staging test coverage for Notion's official dependency.
- Remaining:
  - None for Phase 01.
- Risks or blockers:
  - The live official package exposes `API-` prefixed tool names, so the manifest intentionally differs from the bare operation ids in the original plan.
- Commands run:
  - `bun --cwd packages/extensions/notion-mcp test`
  - `bun --cwd packages/extensions/notion-mcp typecheck`
  - `bun test ./scripts/stage-bundled-extensions.test.ts`
  - `bun run build:extensions`
- Evidence captured:
  - Notion manifest tests pass and lock all 22 tool names.
  - Staging tests pass with `@notionhq/notion-mcp-server` included in the bundled runtime package manifest.
- First recommended next step:
  - Phase 02 credential startup boundary.

### Phase 02 - Credential Startup Boundary

- Date: 2026-05-05
- Branch: feature/notion-mcp-wrapper
- Owner: Codex
- Status change: not_started -> complete
- Completed:
  - Added `PluginAuthService.getCredentialEnvironment()` so Main can read validated plugin-scoped credentials for pre-spawn use.
  - Added `prepareNotionMcpRuntime()` to inject only `NOTION_TOKEN` into the Notion child process env.
  - Added `PluginManager.shouldAutoStart` so unconfigured manual-token plugins are skipped during boot auto-start.
- Remaining:
  - None for Phase 02.
- Risks or blockers:
  - `NOTION_TOKEN` env injection is a narrow exception for the official Notion CLI; do not generalize it without a separate credential-boundary review.
- Commands run:
  - `bun test packages/electron/src/__tests__/plugin-auth-service.test.ts packages/electron/src/__tests__/plugin-manager.test.ts packages/electron/src/__tests__/plugin-runtime.test.ts`
  - `bun --cwd packages/electron typecheck`
- Evidence captured:
  - 22 targeted Electron tests pass, including configured env, missing-token failure, and auto-start skip behavior.
- First recommended next step:
  - Phase 03 stdio wrapper runtime.

### Phase 03 - Stdio Wrapper Runtime

- Date: 2026-05-05
- Branch: feature/notion-mcp-wrapper
- Owner: Codex
- Status change: not_started -> complete
- Completed:
  - Implemented a thin wrapper that launches the official Notion CLI with `--transport stdio`.
  - Verified the built wrapper starts under Orbyt `PluginManager` with a fake token and exposes `notion.API-post-search` through the gateway.
- Remaining:
  - None for automated runtime verification.
- Risks or blockers:
  - Live tool inventory depends on the pinned official package; update manifest tests before bumping the dependency.
- Commands run:
  - `bun run build:extensions`
  - `bun --eval '<PluginManager notion-mcp startup smoke>'`
- Evidence captured:
  - Startup smoke returned `{"ok":true,"pluginId":"notion-mcp","status":"active"}`.
  - Gateway smoke returned `["notion.API-post-search"]`.
- First recommended next step:
  - Phase 04 Settings UX verification.

### Phase 04 - Settings UX Verification And Handoff

- Date: 2026-05-05
- Branch: feature/notion-mcp-wrapper
- Owner: Codex
- Status change: not_started -> complete
- Completed:
  - Added a Settings test proving the generic manual-token UI renders the Notion `NOTION_TOKEN` field and `API-post-search` tool.
  - Updated this glossary with phase evidence and the API-prefixed tool-name discovery.
- Remaining:
  - Manual real-token smoke against connected Notion content and a throwaway page.
- Risks or blockers:
  - No real Notion token was available in this implementation session, so external Notion API behavior was not manually exercised.
- Commands run:
  - `bun --cwd packages/ui vitest run src/__tests__/SettingsPage.test.tsx --testNamePattern "Notion manual-token"`
- Evidence captured:
  - Targeted Settings test passes.
- First recommended next step:
  - Run manual Notion smoke with a real internal integration token.
