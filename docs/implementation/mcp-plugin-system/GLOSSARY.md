# MCP Plugin System Glossary, Tracker, And Handoff

Last updated: 2026-04-11

This file has two jobs:

1. Track where implementation currently stands for each phase.
2. Capture handoff notes so the next implementation step starts with real context instead of rediscovery.

## Status Legend

- `not_started`: no implementation work has begun
- `in_progress`: active implementation is underway
- `blocked`: implementation paused by a dependency or failure
- `complete`: acceptance criteria and verification gates are satisfied

## Phase Tracker

| Phase | Status | Owner | Verification State | Next Action |
| --- | --- | --- | --- | --- |
| 00 - Contracts And Scaffolding | in_progress | Codex | Contracts/tests green; smoke pending | Run app smoke with plugin flag off, then start Phase 01 discovery work |
| 01 - Discovery And Registry | not_started | Unassigned | Not run | Build extension discovery and render discovered state in Settings |
| 02 - Local Spawn And Lifecycle | not_started | Unassigned | Not run | Spawn `template-mcp`, initialize MCP, and call one tool |
| 03 - Gateway And Codex Integration | not_started | Unassigned | Not run | Expose one Student Claw MCP gateway and route one fake tool end to end |
| 04 - Credentials And Auth UX | not_started | Unassigned | Not run | Add vault-backed auth schema rendering and secure credential handshake |
| 05 - Installation And Extension Management | not_started | Unassigned | Not run | Add bundled install, enable/disable, uninstall, and live inventory refresh |
| 06 - Canvas Vertical Slice | not_started | Unassigned | Not run | Drive one real Canvas tool through the full routed path |
| 07 - Hardening And Packaged Runtime | not_started | Unassigned | Not run | Verify packaged Electron app can spawn, recover, and shut down plugins |

## Current Recommended Next Step

Finish the remaining Phase 00 verification follow-through, then begin [Phase 01 - Discovery And Registry](phase-01-discovery-and-registry.md).

Do not start process spawning before the extension registry contract, status model, and IPC shapes exist in shared packages.

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

### Extension

The installable Student Claw unit. An extension may package one local MCP server, one remote MCP definition, or a small bundle of plugin metadata plus auth UI.

### Plugin Runtime

The Electron Main subsystem that discovers, validates, spawns, stops, and monitors installed extensions.

### Registry

The canonical list of installed and discoverable extensions plus their current lifecycle and auth state.

### Gateway

The built-in Student Claw MCP surface that Codex connects to. It aggregates tools from installed extensions and hides the internal multi-process routing from Codex.

### System Extension

A built-in extension-like component that is always present and not shown as a normal installable item. The Codex-facing gateway belongs in this category.

### Bundled Catalog

The set of curated extensions shipped with the Electron app and available for one-click install. `packages/extensions/*` should build into this catalog.

### User Extension Store

The writable on-disk directory where installed extension bundles live at runtime.

### Vault

The Electron Main credential store backed by `safeStorage`. Plugin credentials are encrypted at rest and delivered only to the owning runtime.

### Credential Handshake

The post-start scoped message that delivers decrypted credentials to a plugin runtime after it has started successfully.

### Tool Inventory

The cached view of all tools surfaced by active extensions. Tool inventory changes must be pushed to both the local server and the Student Claw gateway.

### Verification Gate

The set of checks that must be green before a phase can be marked complete:

- unit coverage for the phase's core contract
- one integration check
- one manual smoke test
- one failure-path check

## Phase Handoff Log

### Phase 00 - Contracts And Scaffolding

- Date: 2026-04-11
- Branch: `codex/plugin-bridge-reset`
- Owner: Codex
- Status change: `not_started -> in_progress`
- Completed:
  - Promoted `@student-claw/contracts` to the canonical owner of extension manifest, registry, lifecycle, auth, transport, IPC, and plugin error contracts.
  - Added dark-default `featureFlags.pluginSystem` to `DesktopBootstrap` and `ServerConfig`.
  - Migrated the Canvas checked-in manifest to the shared `ExtensionManifest` shape and added schema/error coverage.
  - Reworked `@student-claw/shared` plugin surfaces to re-export the canonical contracts and updated shared tests to assert that alignment.
  - Added Electron preload/main-process stub handlers for plugin IPC channels that stay inert while the flag is off.
- Remaining:
  - Run the manual app smoke with `pluginSystem` disabled and record the result.
  - Decide whether to mark Phase 00 complete after smoke evidence is captured.
- Risks or blockers:
  - Package-wide `packages/server` and `packages/ui` typechecks currently fail for broader pre-existing issues outside the Phase 00 diff, so they cannot be used as a clean verification gate yet.
  - No real plugin lifecycle wiring exists yet; Phase 01 must keep targeting the new contracts without assuming runtime behavior is present.
- Commands run:
  - `bun run build:shared`
  - `bun run test:contracts`
  - `bun run test:shared`
  - `bun --cwd packages/extensions/canvas-mcp test`
  - `bun --cwd packages/electron typecheck`
  - `bun --cwd packages/server typecheck`
  - `bun --cwd packages/ui typecheck`
- Evidence captured:
  - `packages/contracts`: 12 passing tests including manifest validation and typed-error coverage.
  - `packages/shared`: 59 passing tests including canonical plugin re-export checks.
  - `packages/extensions/canvas-mcp`: 7 passing tests with the migrated manifest fixture.
  - `packages/electron`: typecheck passes after preload/main stub wiring.
  - `packages/server` and `packages/ui`: package-wide typechecks still fail on unrelated existing issues.
- First recommended next step:
  - Run one smoke boot with `featureFlags.pluginSystem = false`; if startup is unchanged, move to Phase 01 using the new canonical manifest and lifecycle contracts.

### Phase 01 - Discovery And Registry

- Pending first implementation pass.

### Phase 02 - Local Spawn And Lifecycle

- Pending first implementation pass.

### Phase 03 - Gateway And Codex Integration

- Pending first implementation pass.

### Phase 04 - Credentials And Auth UX

- Pending first implementation pass.

### Phase 05 - Installation And Extension Management

- Pending first implementation pass.

### Phase 06 - Canvas Vertical Slice

- Pending first implementation pass.

### Phase 07 - Hardening And Packaged Runtime

- Pending first implementation pass.
