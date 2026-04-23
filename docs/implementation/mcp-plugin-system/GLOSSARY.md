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

## Verification State Legend

- `Not run`: the phase verification gate has not been exercised yet
- `In progress`: some verification work has started, but the full gate is not yet green
- `Failed`: at least one required verification check is currently failing
- `Verified`: the full verification gate is green for the current phase state

Verification state tracks the health of the evidence for a phase. Phase `Status`
tracks delivery progress. A phase should not be marked `complete` unless its
verification state is `Verified`.

## Phase Tracker

| Phase | Status | Owner | Verification State | Next Action |
| --- | --- | --- | --- | --- |
| 00 - Contracts And Scaffolding | complete | Codex | Verified | Begin Phase 02 local spawn work using the canonical contracts and IPC shapes |
| 01 - Discovery And Registry | complete | Codex | Verified | Begin Phase 02 local spawn and lifecycle implementation |
| 02 - Local Spawn And Lifecycle | complete | Codex | Verified | Start Phase 03 gateway wiring using the live `template-mcp` lifecycle path as the routed canary |
| 03 - Gateway And Codex Integration | not_started | Unassigned | Not run | Expose one Orbyt MCP gateway and route one fake tool end to end |
| 04 - Credentials And Auth UX | not_started | Unassigned | Not run | Add vault-backed auth schema rendering and secure credential handshake |
| 05 - Installation And Extension Management | not_started | Unassigned | Not run | Add bundled install, enable/disable, uninstall, and live inventory refresh |
| 06 - Canvas Vertical Slice | not_started | Unassigned | Not run | Drive one real Canvas tool through the full routed path |
| 07 - Hardening And Packaged Runtime | not_started | Unassigned | Not run | Verify packaged Electron app can spawn, recover, and shut down plugins |

## Current Recommended Next Step

Start [Phase 03 - Gateway And Codex Integration](phase-03-gateway-and-codex-integration.md).

Phase 02 is complete. Use the live `template-mcp` lifecycle path as the Phase 03 canary: lifecycle IPC already exists, `plugin:list` / `plugin:get-status` / `plugin:lifecycle` are live, and Electron Main already has `PluginManager.callTool()` for routed canary calls. The missing work in this phase is the Main/server bridge plus the Orbyt-owned gateway that propagates tool inventory and routes one fake tool end to end.

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

The installable Orbyt unit described by the shared extension manifest. In the current rollout, an extension is a `local_stdio` MCP server bundle with declared tools, permissions, and auth requirements. Broader extension forms remain future work and are out of scope for Phase 03.

### Plugin Runtime

The Electron Main subsystem that discovers, validates, spawns, stops, and monitors installed extensions.

### Registry

The canonical list of discovered and installed extensions plus their current lifecycle and validation state. It is the source of truth for what is available to run now; live credential and auth flows are added later and are not yet part of the routed Phase 03 path.

### Gateway

The built-in, Main-owned Orbyt MCP surface that Codex connects to. It exposes extension tools through one stable Codex-facing entrypoint and hides the internal server-to-Main-to-plugin routing path. In this phase it should stay routing-only and avoid owning plugin business logic.

### System Extension

A built-in extension-like component that is always present and not shown as a normal installable item. The Codex-facing gateway belongs in this category and should be treated as platform-owned infrastructure, not as a bundled user extension.

### Bundled Catalog

The set of curated extensions shipped with the Electron app and available for one-click install. `packages/extensions/*` should build into this catalog.

### User Extension Store

The writable on-disk directory where installed extension bundles live at runtime.

### Vault

The Electron Main credential store backed by `safeStorage`. Plugin credentials are encrypted at rest and delivered only to the owning runtime.

### Credential Handshake

The post-start scoped message that delivers decrypted credentials to a plugin runtime after it has started successfully.

### Tool Inventory

The active-tool view sourced from running extensions after startup. Tool inventory changes must be propagated to both the local server and the Orbyt gateway so Codex sees one consistent routed surface as plugins start and stop.

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
  - Promoted `@orbyt/contracts` to the canonical owner of extension manifest, registry, lifecycle, auth, transport, IPC, and plugin error contracts.
  - Added dark-default `featureFlags.pluginSystem` to `DesktopBootstrap` and `ServerConfig`.
  - Migrated the Canvas checked-in manifest to the shared `ExtensionManifest` shape and added schema/error coverage.
  - Reworked `@orbyt/shared` plugin surfaces to re-export the canonical contracts and updated shared tests to assert that alignment.
  - Added Electron preload/main-process stub handlers for plugin IPC channels that stay inert while the flag is off.
- Remaining:
  - No open Phase 00 implementation work.
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
  - Move to [Phase 01 - Discovery And Registry](phase-01-discovery-and-registry.md).

### Phase 01 - Discovery And Registry

- Date: 2026-04-11
- Branch: `codex/plugin-bridge-reset`
- Owner: Codex
- Status change: `not_started -> in_progress`
- Completed:
  - Expanded the shared registry contract to represent both healthy discovered extensions and invalid manifest rows, and added `system` provenance ahead of gateway work.
  - Added an Electron `PluginRegistry` that scans bundled manifests and the user extension store, validates each manifest, and returns deterministic registry output.
  - Replaced the plugin read IPC stubs with registry-backed `plugin:list` and `plugin:get-status` handlers while leaving install and lifecycle mutators stubbed.
  - Added a checked-in `manifest.json` for `template-mcp` so Canvas and template both appear as healthy bundled extensions in discovery.
  - Replaced the placeholder Settings page content with a read-only extension registry view that shows provenance, status, version, and validation errors, and stays dark when `featureFlags.pluginSystem` is off.
- Remaining:
  - No open Phase 01 implementation work.
- Risks or blockers:
  - Package-wide `packages/ui` typecheck still has broader pre-existing failures outside the plugin registry slice, so the Phase 01 UI verification currently relies on targeted tests instead of a clean package typecheck gate.
  - Packaged build path assumptions for bundled extensions still need a real packaged-app smoke in Phase 07, even though the dev and packaged path helpers are now covered in tests.
- Commands run:
  - `bun run build:shared`
  - `bun --cwd packages/shared test -- src/__tests__/schemas.test.ts`
  - `bun --cwd packages/electron test -- src/__tests__/plugin-registry.test.ts src/__tests__/bridge-plugin-ipc.test.ts`
  - `bun --cwd packages/ui test -- SettingsPage.test.tsx`
  - `bun --cwd packages/electron typecheck`
- Evidence captured:
  - `packages/shared`: 27 passing schema tests including available and invalid registry entry coverage.
  - `packages/electron`: 5 passing tests covering bundled discovery, user-store discovery, broken manifest handling, and IPC handler integration for `plugin:list` and `plugin:get-status`.
  - `packages/ui`: 2 passing Settings tests covering the feature-flag-disabled state and registry rendering for healthy plus invalid extensions.
  - `packages/electron`: typecheck passes after registry wiring and strictness cleanup.
- First recommended next step:
  - Start [Phase 02 - Local Spawn And Lifecycle](phase-02-local-spawn-and-lifecycle.md).

### Phase 02 - Local Spawn And Lifecycle

- Date: 2026-04-11
- Branch: `codex/plugin-bridge-reset`
- Owner: Codex
- Status change: `not_started -> in_progress`
- Completed:
  - Upgraded `template-mcp` from a placeholder script into a real MCP stdio server with the deterministic `template_ping` canary tool and package-level server tests.
  - Added explicit lifecycle IPC contracts for `plugin:start`, `plugin:stop`, and `plugin:retry` plus lifecycle action result typing.
  - Added Electron `PluginSandbox` and `PluginManager` runtime ownership so bundled plugins can spawn, initialize, list tools, call the canary tool, stop cleanly, idle-stop, and recover from unexpected exits.
  - Switched plugin registry reads in Electron Main to overlay live runtime status on top of discovery output and emit `plugin:lifecycle` events to renderer subscribers.
  - Added dev-only lifecycle controls in Settings so bundled plugins can be started, stopped, retried, and refreshed from live lifecycle events.
  - Updated workspace scripts so `template-mcp` participates in extension builds and test runs.
- Remaining:
  - Run the manual dev smoke in Settings and capture the requested logs/screenshots for the phase evidence set.
  - Decide whether Phase 02 should be marked `complete` after the manual smoke passes and the handoff entry is amended with that evidence.
- Risks or blockers:
  - Manual smoke is still outstanding, so Phase 02 should not be marked `complete` yet even though automated verification is green.
  - The lifecycle event payload stays intentionally minimal in this phase, so row-level refresh remains dependent on follow-up `plugin:get-status` reads.
- Commands run:
  - `bun install`
  - `bun --cwd packages/extensions/template-mcp build`
  - `bun --cwd packages/extensions/template-mcp test`
  - `bun --cwd packages/electron test`
  - `bun --cwd packages/contracts typecheck`
  - `bun --cwd packages/electron typecheck`
  - `bun --cwd packages/extensions/template-mcp typecheck`
  - `bun --cwd packages/ui vitest run src/__tests__/SettingsPage.test.tsx`
  - `bun run test:shared`
- Evidence captured:
  - `packages/extensions/template-mcp`: 2 passing server tests covering `listTools()` and `template_ping`.
  - `packages/electron`: 14 passing source tests covering registry overlay, lifecycle state handling, explicit IPC reads, real `template-mcp` spawn, crash-to-error, retry, and stop.
  - `packages/ui`: 5 passing Settings tests covering lifecycle controls, start action wiring, lifecycle-event row refresh, and retry visibility.
  - `packages/contracts` / `packages/electron` / `packages/extensions/template-mcp`: targeted typechecks pass after the lifecycle implementation.
- First recommended next step:
  - Run the dev Settings manual smoke, capture the successful lifecycle and crash-retry evidence, then move to [Phase 03 - Gateway And Codex Integration](phase-03-gateway-and-codex-integration.md).

- Date: 2026-04-11
- Branch: `codex/plugin-bridge-reset`
- Owner: Codex
- Status change: `in_progress -> complete`
- Completed:
  - Verified the full Phase 02 checklist, including automated coverage and the dev Settings smoke for start, stop, idle timeout, crash-to-error, and retry recovery.
  - Confirmed `template-mcp` can spawn on demand, initialize, list tools, serve the `template_ping` canary, stop cleanly, and recover from a killed child process without restarting the app.
  - Confirmed the Settings lifecycle controls and `plugin:lifecycle` refresh path are sufficient for manual verification in dev.
- Remaining:
  - No open Phase 02 implementation work.
- Risks or blockers:
  - No blocking issues remain for Phase 02.
  - Phase 03 should avoid expanding lifecycle responsibilities in Main beyond routing and gateway concerns.
- Commands run:
  - `bun --cwd packages/extensions/template-mcp build`
  - `bun --cwd packages/extensions/template-mcp test`
  - `bun --cwd packages/electron test`
  - `bun --cwd packages/contracts typecheck`
  - `bun --cwd packages/electron typecheck`
  - `bun --cwd packages/extensions/template-mcp typecheck`
  - `bun --cwd packages/ui vitest run src/__tests__/SettingsPage.test.tsx`
  - `bun run test:shared`
- Evidence captured:
  - Automated checks from the Phase 02 verification checklist passed.
  - Manual dev smoke passed for start, stop, idle timeout, forced crash to `error`, and successful retry recovery from Settings.
- First recommended next step:
  - Start [Phase 03 - Gateway And Codex Integration](phase-03-gateway-and-codex-integration.md).

### Phase 03 - Gateway And Codex Integration

- Date: 2026-04-11
- Branch: `codex/plugin-bridge-reset`
- Owner: Unassigned
- Status change: none yet (`not_started`, kickoff context only)
- Completed:
  - Phase 02 prerequisites are in place: `template-mcp` is a live bundled canary server and Electron Main can spawn it, list tools, and call `template_ping`.
  - Lifecycle IPC is already live for `plugin:list`, `plugin:get-status`, and `plugin:lifecycle`, and Settings can observe lifecycle changes in dev.
  - Electron Main already has the local runtime ownership needed for routed calls via `PluginManager.callTool()`.
- Remaining:
  - Add the typed Main/server bridge for tool inventory reads, routed tool calls, and tools-changed notifications.
  - Introduce the Orbyt-owned gateway surface that publishes extension tools through one Codex-facing entrypoint.
  - Propagate active tool inventory updates after plugin start and stop and prove one fake routed tool call works end to end.
- Risks or blockers:
  - Scope can drift if Phase 03 starts pulling in credentials, install UX, or real Canvas service calls before the fake routing path is proven.
  - The gateway should stay a thin routing surface; if it starts duplicating lifecycle or plugin business logic, later phases will have a muddier ownership split.
- Commands run:
  - None for Phase 03 yet; use the Phase 02 evidence as the starting point.
- Evidence captured:
  - Phase 02 already proved the live canary path in Main: spawn, `listTools()`, `template_ping`, stop, crash-to-error, and retry recovery.
  - Current live concepts to build on are `template-mcp`, lifecycle IPC, `plugin:list`, `plugin:get-status`, `plugin:lifecycle`, and Main-side `callTool()`.
- First recommended next step:
  - Implement the Main/server bridge and gateway wiring from [Phase 03 - Gateway And Codex Integration](phase-03-gateway-and-codex-integration.md), then capture one successful routed fake tool call plus one typed failure-path example.

### Phase 04 - Credentials And Auth UX

- Pending first implementation pass.

### Phase 05 - Installation And Extension Management

- Pending first implementation pass.

### Phase 06 - Canvas Vertical Slice

- Pending first implementation pass.

### Phase 07 - Hardening And Packaged Runtime

- Pending first implementation pass.
