# Curated Extension Catalog Rollout Glossary, Tracker, And Handoff

Last updated: 2026-04-21

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

Verification state tracks the health of the evidence for a phase. Phase
`Status` tracks delivery progress. A phase should not be marked `complete`
unless its verification state is `Verified`.

## Phase Tracker

| Phase | Status | Owner | Verification State | Next Action |
| --- | --- | --- | --- | --- |
| 00 - Source Ingestion And Rollout Scaffold | complete | Codex | Verified | Start Phase 01 - Apple Calendar Extension Vendoring |
| 01 - Apple Calendar Extension Vendoring | complete | Codex | Verified | Start Phase 02 - Swift Bridge Lifecycle And Permissions |
| 02 - Swift Bridge Lifecycle And Permissions | complete | Codex | Verified | Start Phase 03 - Bundled Catalog And Build Integration |
| 03 - Bundled Catalog And Build Integration | complete | Codex | Verified | Start Phase 03b - macOS Packaging And Signing |
| 03b - macOS Packaging And Signing | complete | Codex | Verified | Continue Phase 05 - Packaged Runtime And Hardening |
| 04 - Runtime Readiness And Settings UX | complete | Codex | Verified | Start Phase 05 - Packaged Runtime And Hardening |
| 05 - Packaged Runtime And Hardening | in_progress | Codex | In progress | Capture packaged macOS smoke evidence after Phase 03b signed/notarized proof is available |
| 06 - Curated Extension Template And Next Plugins | in_progress | Codex | In progress | Fold the new checklist artifact and candidate recommendations back into final packaged hardening evidence once Phase 03b and Phase 05 are fully proven |

## Current Recommended Next Step

Continue [Phase 05 - Packaged Runtime And Hardening](phase-05-packaged-runtime-and-hardening.md).

Phase 03b is now treated as complete for the current rollout bar: the repo can
build per-arch Apple Calendar bridge artifacts into `bridge/dist/<arch>/`,
stage the Phase 03 bundled catalog into a temp app for `electron-builder`,
package an unsigned macOS `.app` and `.dmg`, and place
`Contents/Resources/extensions/apple-calendar-mcp/bridge/CalendarAPIBridge`
outside `asar`. The Apple Silicon signed path is now proven: local preflight
passed, the `arm64` app notarization was accepted, stapling succeeded, and the
artifact verifier confirmed the notarized app plus packaged Apple Calendar
bridge. A follow-up signed `arm64` build now completes end to end with live
phase logging and a timestamped transcript in `build-logs/`. The packaged
Apple Calendar manual smoke on that notarized app and the equivalent `x64`
signed/notarized proof are now tracked as deferred follow-up rather than
blocking this phase closeout. The repo now also includes:

- `bun run check:electron:mac:signed` for local release preflight
- `bun run verify:electron:mac` for packaged signed-artifact verification
- timestamped macOS artifact build logs under `build-logs/`
- [macOS signing runbook](macos-signing-runbook.md) for the local arm64 proof, CI mirror, and x64 follow-up

Phase 04 is now complete in parallel: readiness is a first-class contract and
Settings UX concept for no-auth curated extensions, `PLUGIN_READINESS` is the
live update channel, typed retry classes route bridge and permission recovery,
and Apple Calendar now uses a readiness card instead of a credential form.

Phase 05 is now in progress in parallel: Apple Calendar discovery is gated by
host support instead of renderer-only checks, packaged bridge path resolution
is shared between runtime and artifact verification, packaged runtime
diagnostics are buffered in Electron main and exposed through
`PLUGIN_GET_RUNTIME_LOGS`, and restart-style readiness re-evaluation is covered
in tests. The remaining gap is packaged signed-smoke evidence after Phase 03b.

Phase 06 is now in progress as a documentation and decision-record phase:
the rollout now has a reusable curated-extension checklist artifact, Apple
Calendar is documented as the filled canary example, Notion is the next
recommended bundled candidate once curated auth packaging is ready, and Google
Docs/Sheets plus Gmail are explicitly deferred behind shared Google auth/session
work. Phase 06 should remain open until the final Phase 03b and Phase 05
packaged evidence is reflected in the checklist.

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
- Contract changes:
  - file + symbol (for example `packages/contracts/src/schemas/extension.ts :: ExtensionRuntimeReadiness`)
  - migration notes for consumers (for example "Settings must read `readiness` alongside `status`")
  - `none` if this phase did not touch `packages/contracts/`
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

### Curated Extension

A first-party extension Student Claw chooses to ship or support intentionally.
In this rollout, Apple Calendar is the canary curated extension beyond Canvas.

### Bundled Catalog

The set of extensions shipped with the app bundle and discoverable without any
network install. Curated bundled extensions remain local-only `local_stdio`
plugins in v1.

### Bundled Extension

A concrete extension directory present in the app’s bundled catalog and eligible
for discovery, enable, disable, and runtime management through the existing
plugin system. Bundled extensions have no separate install step: they become
available when the app ships and become usable when the user enables them.

### Vendored Extension

An externally-originated MCP server whose source is copied or adapted into this
monorepo and maintained here. Apple Calendar is intentionally treated as a
vendored extension rather than consumed from tarballs at runtime.

### Bundled Vs Vendored

These terms overlap. A curated extension is always bundled (it ships with the
app) and may also be vendored (its source originated externally and was
imported). Canvas is bundled and first-party authored. Apple Calendar is
bundled and vendored. A future extension may be bundled but entirely
authored in this repo, in which case it is bundled and not vendored.

### Plugin Runtime

The Electron Main subsystem that discovers, validates, spawns, stops, and
monitors installed extensions.

### Registry

The canonical list of discovered and installed extensions plus their current
lifecycle and validation state. In this rollout, registry behavior remains the
existing source of truth and will later grow a readiness dimension for
bridge-dependent curated extensions.

### Bridge Runtime

A non-MCP helper process owned by Student Claw that a plugin depends on for
local OS access. Apple Calendar’s Swift EventKit bridge is the first such
runtime in this rollout.

### Bridge Manager

Electron Main logic that starts, stops, health-checks, and observes a bridge
runtime. The bridge manager is responsible for making local helper runtimes feel
first-party and seamless instead of user-managed.

### Runtime Readiness

The combined state of plugin lifecycle, auth or local-config state, and bridge
availability. Apple Calendar introduces readiness states that go beyond simple
start or stop lifecycle. This rollout locks the following readiness vocabulary
on the `ExtensionRuntimeReadiness` contract. These are the only legal values:

- `ready`: plugin is spawned and any bridge is healthy and permitted
- `bridge_starting`: bridge is being spawned or waiting on its first healthy heartbeat
- `bridge_unavailable`: bridge is expected but not reachable
- `permission_required`: local OS permission is needed before the bridge can function
- `bridge_crash_loop`: bridge exited repeatedly within the crash-loop window
- `platform_unsupported`: extension cannot run on this OS or OS version
- `error`: typed error outside the above states, always paired with a user-facing recovery action

Readiness is additive to, not a replacement for, `ExtensionLifecycleStatus`.

### Permission Bootstrap

The first-run local OS permission acquisition flow for a curated extension. In
this rollout it primarily means macOS Calendar access for the Apple Calendar
bridge.

### Vault

The Electron Main credential store backed by `safeStorage`. This rollout keeps
vault-backed auth intact for credentialed extensions, but Apple Calendar itself
defaults to readiness driven by bridge health and OS permission state rather
than stored secrets.

### Tool Inventory

The active-tool view sourced from running extensions after startup. Inventory
changes must continue to propagate through the existing Student Claw gateway and
local server after curated extensions are added.

### Curated Extension Template

The reusable contract, build, packaging, readiness, and verification checklist
future curated bundled extensions must satisfy before being treated as
first-party.

The working checklist artifact for this rollout lives at
`docs/implementation/curated-extension-catalog-rollout/curated-extension-template-checklist.md`.

### Verification Gate

The set of checks that must be green before a phase can be marked complete:

- unit coverage for the phase’s core contract
- one integration check
- one manual smoke test
- one failure-path check

## Defaults Locked By This Rollout

- Apple Calendar will be vendored into the monorepo instead of consumed from tarballs at runtime.
- The Swift bridge is app-owned and bundled with Student Claw.
- Bundled curated extensions remain local-only plugins in v1. MCP transport is always `local_stdio`; bridges may use localhost HTTP or a UNIX domain socket (see `Bridge Transport Policy`).
- Remote download and catalog work is out of scope for this rollout unless a later phase explicitly expands it.
- The Apple Calendar vendored package target is `packages/extensions/apple-calendar-mcp/`.
- The Swift bridge should live inside the vendored extension package at `packages/extensions/apple-calendar-mcp/bridge/` so the extension remains self-contained.
- The UI verb for making a bundled extension usable is `Enable`. The words `Install` and `Uninstall` are reserved for the user-installed third-party MCP flow handled by the predecessor rollout.
- Apple Calendar is not visible on non-macOS builds. `platform_unsupported` readiness is used only if a user somehow reaches a macOS-required extension on an unsupported OS via config migration, not for normal discovery.

### Permissions Vocabulary

`manifest.permissions` is a free-form array of strings today. This rollout
locks a namespaced vocabulary so curated extensions do not invent their own
conventions:

- `local_os.calendar.read`
- `local_os.calendar.write`
- `local_os.contacts.read`
- `local_os.files.read`
- `local_os.files.write`
- `remote.http.<host>` (for example `remote.http.canvas`)
- `domain.<vendor>.<capability>` (for example `domain.canvas.assignments`, `domain.canvas.grades`) for vendor-specific capability grouping that is not a local OS permission

The field is documentation, not enforcement. Canvas keeps its existing domain
strings unchanged; future curated extensions must normalize to this vocabulary.

### Tool Naming House Rule

- Vendored extensions retain upstream tool names unchanged even when the convention differs (for example Apple Calendar keeps camelCase `getCalendars`). Upstream sync correctness outweighs inter-extension convention uniformity.
- First-party-authored extensions use `snake_case` tool names aligned with Canvas.
- The manifest `tools[].name` is the source of truth; the gateway does not rename.

### Bridge Transport Policy

- Bridges bind to the loopback interface only (`127.0.0.1`). Binding to any other interface is a bug.
- The bridge listens on an ephemeral port chosen at start time, never a hard-coded port. The bridge manager discovers the bound port after start and passes it to the MCP child via transport env.
- The bridge authenticates every request with a per-session shared secret generated at start time. The MCP child receives the secret via transport env and sends it on every call; the bridge rejects requests without the secret.
- Alternative: a UNIX domain socket in the user's app-support directory satisfies both the loopback-only and auth requirements and is acceptable in place of HTTP + token.

## Phase Handoff Log

### Phase 00 - Source Ingestion And Rollout Scaffold

- Date: 2026-04-20
- Branch: `main`
- Owner: Codex
- Status change: `not_started -> complete`
- Completed:
  - Created the curated-extension rollout package under `docs/implementation/curated-extension-catalog-rollout/` with a README, glossary, and phase docs through Phase 06 plus the explicit `Phase 03b - macOS Packaging And Signing`.
  - Reconciled the rollout package as the source of truth for bundled curated extensions beyond Canvas and kept Apple Calendar locked as the canary extension.
  - Locked the source-ingestion boundary for Apple Calendar, including the vendored package target `packages/extensions/apple-calendar-mcp/`, the bridge target `packages/extensions/apple-calendar-mcp/bridge/`, and the pinned-upstream-source rule recorded in the Phase 00 doc.
  - Locked glossary defaults for bundled vs vendored semantics, `Enable` vs `Install` wording, upstream tool-name preservation, permissions vocabulary, bridge transport policy, and `ExtensionRuntimeReadiness` as later-phase contract vocabulary.
  - Confirmed `Phase 03b - macOS Packaging And Signing` is a permanent explicit phase and that the phase ordering is consistent across the rollout package.
- Remaining:
  - Begin Phase 01 implementation planning and code work for vendoring Apple Calendar into `packages/extensions/apple-calendar-mcp/`.
  - Keep the glossary updated as later phases introduce real code and contract changes.
- Contract changes:
  - `none`
- Risks or blockers:
  - The Apple Calendar rollout docs are still untracked local files until committed, so the source-of-truth package could drift if Phase 01 starts without capturing this increment cleanly.
  - Later phases must preserve the bundled-curated `Enable` semantics and avoid reintroducing install-flow language from the predecessor user-installed MCP rollout.
- Commands run:
  - `sed -n '1,260p' docs/implementation/curated-extension-catalog-rollout/README.md`
  - `sed -n '1,340p' docs/implementation/curated-extension-catalog-rollout/GLOSSARY.md`
  - `sed -n '1,240p' docs/implementation/curated-extension-catalog-rollout/phase-00-source-ingestion-and-rollout-scaffold.md`
  - `find docs/implementation/curated-extension-catalog-rollout -maxdepth 1 -type f | sort`
  - `rg -n "03b|Install|Enable|apple-calendar-mcp/bridge/|apple-calendar-mcp/" docs/implementation/curated-extension-catalog-rollout`
- Evidence captured:
  - The rollout package contains the expected README, glossary, and phase docs, including `phase-03b-macos-packaging-and-signing.md`.
  - README and glossary now agree that `Phase 03b` is a real phase in the rollout order.
  - The vendored Apple Calendar paths are consistently documented as `packages/extensions/apple-calendar-mcp/` and `packages/extensions/apple-calendar-mcp/bridge/`.
  - The glossary locks `Enable`/`Disable` as the bundled-curated verb pair and reserves `Install`/`Uninstall` for the predecessor user-installed MCP flow.
- First recommended next step:
  - Start [Phase 01 - Apple Calendar Extension Vendoring](phase-01-apple-calendar-extension-vendoring.md).

### Phase 01 - Apple Calendar Extension Vendoring

- Date: 2026-04-20
- Branch: `main`
- Owner: Codex
- Status change: `not_started -> complete`
- Completed:
  - Vendored Apple Calendar into `packages/extensions/apple-calendar-mcp/` with Student Claw package metadata, `manifest.json`, `src/`, `tsconfig.json`, and a colocated `bridge/` directory.
  - Preserved the upstream camelCase Apple Calendar tool names and wrapped them in a Student Claw MCP server entrypoint.
  - Added a bundled-registry test proving `apple-calendar-mcp` is discovered from `packages/extensions/`.
  - Added an Apple Calendar package test proving the registered tools match the manifest tool inventory.
  - Updated the Settings test fixture so Apple Calendar appears through the existing plugin registry UI path.
  - Added Apple Calendar to the root `build:extensions`, `typecheck`, and `test` workflows.
- Remaining:
  - Start Phase 02 bridge lifecycle work so Electron Main owns the Swift bridge and readiness gating.
  - Add readiness-aware runtime and UI behavior in later phases.
- Contract changes:
  - `none`
- Risks or blockers:
  - The vendored Swift bridge is source-only in Phase 01; it is not yet owned, started, or observed by Electron Main.
  - Full repo test runs still contain unrelated existing Electron timeout failures, so Phase 01 proof relies on narrow Apple-specific checks.
- Commands run:
  - `bun test packages/electron/src/__tests__/plugin-registry.test.ts`
  - `bun run test:apple-calendar-mcp`
  - `bun --cwd packages/ui vitest run src/__tests__/SettingsPage.test.tsx -t "renders discovered registry rows and manual auth fields when the plugin flag is on"`
  - `bun run build:extensions`
- Evidence captured:
  - Plugin registry test passes with a bundled `apple-calendar-mcp` entry.
  - Apple Calendar package test passes and confirms the MCP tool inventory matches the manifest.
  - Targeted Settings test passes and shows Apple Calendar in the plugin list path.
  - Root extension build completes with Apple Calendar included.
- First recommended next step:
  - Start [Phase 02 - Swift Bridge Lifecycle And Permissions](phase-02-swift-bridge-lifecycle-and-permissions.md).

### Phase 02 - Swift Bridge Lifecycle And Permissions

- Date: 2026-04-20
- Branch: `main`
- Owner: Codex
- Status change: `not_started -> in_progress`
- Completed:
  - Confirmed the active Phase 02 boundary from the rollout docs and identified the first implementation slice as contract changes for readiness vocabulary and runtime transport env.
- Remaining:
  - Add failing contract tests for `ExtensionRuntimeReadiness` and optional runtime transport env.
  - Implement the contract changes in `packages/contracts/`.
  - Continue into Electron bridge ownership and readiness gating once the contract layer is green.
- Contract changes:
  - `none`
- Risks or blockers:
  - Readiness and transport env need to be introduced without breaking existing bundled manifest fixtures.
- Commands run:
  - `sed -n '1,260p' docs/implementation/curated-extension-catalog-rollout/phase-02-swift-bridge-lifecycle-and-permissions.md`
  - `sed -n '1,260p' packages/contracts/src/extension.test.ts`
  - `sed -n '1,240p' packages/contracts/src/schemas/extension.ts`
- Evidence captured:
  - Phase 02 contract scope is anchored to the rollout doc and the existing `packages/contracts` test surface.
- First recommended next step:
  - Add the first failing contract tests for readiness and runtime-injected transport env.

- Date: 2026-04-20
- Branch: `main`
- Owner: Codex
- Status change: `in_progress -> in_progress`
- Completed:
  - Added `ExtensionRuntimeReadiness` to `packages/contracts/src/schemas/extension.ts`.
  - Added optional runtime transport `env` support to `ExtensionTransport`.
  - Extended available registry entries with optional `readiness`.
  - Added contract tests proving readiness values and runtime-injected transport env decode correctly.
  - Added Electron tests proving sandbox options receive bridge env and Apple Calendar startup is withheld when bridge preparation reports a non-ready state.
  - Added the minimal `prepareRuntime` seam in `PluginManager` so later bridge ownership can gate plugin startup and inject env.
  - Added a targeted Settings test and UI plumbing so registry rows can surface Apple Calendar readiness and error details.
- Remaining:
  - Replace the temporary `prepareRuntime` seam with a first-class `AppleCalendarBridgeManager`.
  - Model real bridge startup, reachability, permission probes, and crash-loop behavior instead of synthetic readiness responses.
  - Thread readiness through the broader Electron runtime and IPC surfaces beyond the minimal registry overlay.
- Contract changes:
  - `packages/contracts/src/schemas/extension.ts :: ExtensionRuntimeReadiness`
  - `packages/contracts/src/schemas/extension.ts :: ExtensionTransport.env`
  - `packages/contracts/src/schemas/extension.ts :: ExtensionRegistryAvailableEntry.readiness`
  - migration notes for consumers: Settings and Electron plugin registry consumers may now read `readiness` alongside `status`; transport env remains optional and runtime-injected
- Risks or blockers:
  - The current manager seam is intentionally minimal and not yet a dedicated Apple bridge subsystem.
  - Readiness currently overlays registry state, but bridge lifecycle events and richer retry taxonomy are still missing.
- Commands run:
  - `bun test packages/contracts/src/extension.test.ts`
  - `bun test packages/electron/src/__tests__/plugin-manager.test.ts`
  - `bun --cwd packages/ui vitest run src/__tests__/SettingsPage.test.tsx -t "renders Apple Calendar readiness details when provided by the desktop runtime"`
- Evidence captured:
  - Contracts test passes with readiness-aware registry entries and runtime transport env.
  - Plugin manager test passes for bridge env passthrough and startup gating before sandbox start.
  - Targeted Settings test passes and shows Apple Calendar readiness details from the desktop runtime.
- First recommended next step:
  - Introduce a dedicated `AppleCalendarBridgeManager` and drive it with failing Electron tests for real bridge startup and permission gating.

- Date: 2026-04-20
- Branch: `main`
- Owner: Codex
- Status change: `in_progress -> complete`
- Completed:
  - Added `packages/electron/src/plugins/apple-calendar-bridge-manager.ts` as the dedicated Electron-owned bridge subsystem for Apple Calendar.
  - Implemented bridge launch resolution, ephemeral-port allocation, per-session token generation, authenticated health probing, permission probing, crash-loop detection, and stop/dispose behavior.
  - Wired `createPluginRuntime()` to use the bridge manager for `apple-calendar-mcp` through `prepareRuntime` and `cleanupRuntime`.
  - Updated `PluginManager` so runtime preparation can gate MCP startup, runtime env is injected into sandbox spawn options, and cleanup runs when Apple Calendar is disabled or disposed.
  - Extended registry entries with optional `readiness` and updated Settings to render readiness labels and bridge error details.
  - Updated the vendored Swift bridge to read `MAC_API_BRIDGE_TOKEN` and reject unauthenticated requests.
- Remaining:
  - Translate the working bridge/runtime ownership into packaged build and shipping rules in Phase 03 and Phase 03b.
  - Expand the Settings experience with richer recovery actions and copy in Phase 04.
- Contract changes:
  - `packages/contracts/src/schemas/extension.ts :: ExtensionRuntimeReadiness`
  - `packages/contracts/src/schemas/extension.ts :: ExtensionTransport.env`
  - `packages/contracts/src/schemas/extension.ts :: ExtensionRegistryAvailableEntry.readiness`
  - migration notes for consumers: plugin registry readers may now surface `readiness` alongside `status`; runtime transport env remains optional and is injected only at spawn time
- Risks or blockers:
  - The development bridge launch still depends on local Swift tooling when a prebuilt release binary is unavailable.
  - Loopback binding is still delegated to the Swift bridge implementation and should be validated again during packaged macOS hardening.
- Commands run:
  - `bun test packages/contracts/src/extension.test.ts packages/electron/src/__tests__/apple-calendar-bridge-manager.test.ts packages/electron/src/__tests__/plugin-manager.test.ts`
  - `bun --cwd packages/ui vitest run src/__tests__/SettingsPage.test.tsx -t "renders Apple Calendar readiness details when provided by the desktop runtime"`
  - `bun run build:extensions`
  - `bun x tsc -p packages/electron/tsconfig.json --noEmit`
- Evidence captured:
  - Contracts tests pass with readiness-aware registry entries and runtime transport env.
  - Apple Calendar bridge manager tests pass for ready, permission-required, crash-loop, stop, and dev-launch resolution paths.
  - Plugin manager tests pass for bridge env passthrough, readiness gating, and cleanup-driven stop behavior.
  - Targeted Settings readiness test passes.
  - Electron typecheck passes after the bridge manager integration.
- First recommended next step:
  - Start [Phase 03 - Bundled Catalog And Build Integration](phase-03-bundled-catalog-and-build-integration.md).

### Phase 03 - Bundled Catalog And Build Integration

- Date: 2026-04-20
- Branch: `main`
- Owner: Codex
- Status change: `not_started -> complete`
- Completed:
  - Added `scripts/stage-bundled-extensions.ts` to discover bundled extensions by `manifest.json` and recreate a runtime-only staged catalog under `packages/electron/dist/resources/extensions/`.
  - Staged only the runtime subset for bundled extensions: `manifest.json` plus `dist/`, omitting source, docs, tests, and other build-only files from packaged resources.
  - Added Apple Calendar bridge artifact staging that prefers `.build/release/CalendarAPIBridge`, then `.build/<triple>/release/CalendarAPIBridge`, and copies the binary into `packages/electron/dist/resources/extensions/apple-calendar-mcp/bridge/CalendarAPIBridge` when present.
  - Wired the new `stage:bundled-extensions` root script into the main `build` flow after `build:extensions`.
  - Extended Apple Calendar bridge manager tests to cover packaged-resource launch resolution and clean packaged missing-bridge degradation.
- Remaining:
  - Hook the staged `packages/electron/dist/resources/extensions/` tree into the real macOS packaging pipeline in Phase 03b/05.
  - Add the actual Swift build, per-arch helper packaging, signing, notarization, entitlements, and `Info.plist` work in Phase 03b.
- Contract changes:
  - `none`
- Risks or blockers:
  - The staged resource tree is canonical for packaging, but no `.dmg` or `.app` packager is wired to consume it yet.
  - Apple Calendar packaged execution still depends on a prebuilt bridge binary being present until Phase 03b adds the real Swift build/signing path.
- Commands run:
  - `bun test scripts/stage-bundled-extensions.test.ts`
  - `bun test packages/electron/src/__tests__/apple-calendar-bridge-manager.test.ts`
  - `bun run stage:bundled-extensions`
  - `bun run build:extensions`
  - `bun x tsc -p packages/electron/tsconfig.json --noEmit`
- Evidence captured:
  - Staging tests pass for runtime-only copying, direct-release bridge preference, arch-specific bridge fallback, missing-bridge tolerance, and packaged-style registry discovery from the staged tree.
  - Apple Calendar bridge manager tests pass for packaged `resources/extensions/...` launch resolution and missing packaged bridge degradation to `bridge_unavailable`.
  - `bun run stage:bundled-extensions` produced `packages/electron/dist/resources/extensions/{template-mcp,canvas-mcp,apple-calendar-mcp}` with the staged Apple bridge binary present when locally built.
- First recommended next step:
  - Start [Phase 03b - macOS Packaging And Signing](phase-03b-macos-packaging-and-signing.md).

### Phase 03b - macOS Packaging And Signing

- Date: 2026-04-20
- Branch: main
- Owner: Codex
- Status change: not_started -> in_progress
- Completed:
  - Added root Phase 03b packaging scripts for per-arch Apple Calendar bridge builds and macOS desktop artifact creation via `electron-builder`.
  - Added checked-in macOS packaging assets under `packages/electron/build-resources/`, including entitlements and notarization hook wiring.
  - Implemented per-arch bridge output contract under `packages/extensions/apple-calendar-mcp/bridge/dist/<arch>/`.
  - Verified local unsigned macOS packaging can produce a `.app` and `.dmg` that embed the bundled extension catalog and place `CalendarAPIBridge` outside `asar`.
  - Updated Phase 03b and template docs to replace the earlier universal-binary assumption with the shipped per-arch helper contract.
  - Added `bun run check:electron:mac:signed` to preflight full Xcode and the required signing env/assets before a signed release run.
  - Added `bun run verify:electron:mac` to verify the packaged app/helper path, helper placement outside `asar`, and the full `codesign` / `spctl` / `stapler` command set against an existing signed artifact.
  - Added a checked-in runbook documenting the local arm64 proof flow, CI env mirror, and x64 follow-up.
- Remaining:
  - Run the signed/notarized macOS packaging path on a machine with full Xcode and real release secrets.
  - Capture `codesign`, `spctl`, and `stapler` evidence for the signed artifact.
  - Confirm the Student Claw-branded Calendar permission prompt and one end-to-end Apple Calendar tool call on the signed build.
- Contract changes:
  - none
- Risks or blockers:
  - This local machine only has Command Line Tools selected, so the full signed/notarized path cannot be exercised here.
  - Release-signing secrets are not available in this workspace, so signed validation remains deferred to CI or a release runner.
- Commands run:
  - `bun test scripts/build-apple-calendar-bridge.test.ts`
  - `bun test scripts/build-macos-desktop-artifact.test.ts`
  - `bun test scripts/check-macos-signing-readiness.test.ts`
  - `bun test scripts/verify-macos-desktop-artifact.test.ts`
  - `bun run build:apple-calendar-bridge:arm64`
  - `bun run stage:bundled-extensions`
  - `bun run dist:electron:mac --skip-build --output-dir /tmp/student-claw-release-smoke --verbose`
- Evidence captured:
  - Unsigned packaging smoke completed and produced `/tmp/student-claw-release-smoke/Student-Claw-0.1.0-arm64.dmg`.
  - Built app contains `Contents/Resources/extensions/apple-calendar-mcp/bridge/CalendarAPIBridge` and `version.json` outside `app.asar`.
  - Unit tests cover packaging config, signing-mode gating, per-arch helper staging, and bridge version verification.
- First recommended next step:
  - Run `bun run dist:electron:mac:signed --arch arm64` on a full-Xcode runner with release secrets, then capture codesign and notarization evidence before moving to Phase 04 or Phase 05.

- Date: 2026-04-20
- Branch: `main`
- Owner: Codex
- Status change: `in_progress -> in_progress`
- Completed:
  - Added `scripts/check-macos-signing-readiness.ts` and `bun run check:electron:mac:signed` to preflight the signed macOS path before packaging starts.
  - Added `scripts/verify-macos-desktop-artifact.ts` and `bun run verify:electron:mac` to verify the packaged app path, helper path, helper placement outside `asar`, and the full `codesign` / `spctl` / `stapler` command set.
  - Added focused tests for both new Phase 03b automation seams and wired them into the root `test` aggregate.
  - Added a checked-in [macOS signing runbook](macos-signing-runbook.md) covering local arm64 proof, CI env mirroring, and x64 follow-up.
  - Ran the new local preflight on this machine and captured the current blockers: Command Line Tools are selected instead of full Xcode, and none of the required signing env vars are set yet.
- Remaining:
  - Install/select full Xcode on this Mac.
  - Create/export the Developer ID Application `.p12` and App Store Connect `.p8` assets.
  - Export `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_API_KEY`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`.
  - Run the local signed `arm64` proof, then mirror the same contract into CI and complete the `x64` proof.
- Contract changes:
  - `none`
- Risks or blockers:
  - The repo can now preflight and verify the signed path, but it still cannot mint Apple credentials or select full Xcode on behalf of the user.
  - Phase 03b remains open until actual signed/notarized evidence is captured from a machine with the required Apple assets.
- Commands run:
  - `bun test scripts/check-macos-signing-readiness.test.ts scripts/verify-macos-desktop-artifact.test.ts scripts/build-macos-desktop-artifact.test.ts`
  - `bun run check:electron:mac:signed`
  - `bun x tsc -p packages/electron/tsconfig.json --noEmit`
- Evidence captured:
  - New script tests pass for release preflight, packaged app/helper path resolution, helper placement outside `asar`, and signed verification command planning.
  - Local preflight currently reports `/Library/Developer/CommandLineTools` and missing signing env vars as the active blockers.
  - Electron typecheck still passes after the new Phase 03b tooling was added.
- First recommended next step:
  - Install/select full Xcode, export the Apple signing assets, rerun `bun run check:electron:mac:signed`, and then run `bun run dist:electron:mac:signed --arch arm64`.

- Date: 2026-04-21
- Branch: `main`
- Owner: Codex
- Status change: `in_progress -> in_progress`
- Completed:
  - Imported a valid Developer ID Application identity into the login keychain and installed the missing Apple Developer ID G2 intermediate so `security find-identity -v -p codesigning` recognized the signing identity.
  - Ran the local release preflight successfully with full Xcode and real Apple signing/notarization credentials.
  - Built and submitted the signed `arm64` macOS artifact for notarization, waited for Apple processing, and received `Accepted`.
  - Stapled the notarization ticket onto `release/mac-arm64/Student Claw.app`.
  - Updated the packaged-artifact verifier so it validates the notarized app bundle with `spctl` and the packaged Apple Calendar helper with `codesign`, while still confirming the helper lives outside `asar`.
  - Verified the notarized `arm64` app and packaged Apple Calendar bridge successfully.
- Remaining:
  - Run the packaged Apple Calendar manual smoke on the notarized `arm64` app: launch, permission prompt, readiness to `Ready`, one tool call, and clean bridge shutdown.
  - Repeat the signed/notarized proof for `x64`.
  - Mirror the proven env/signing contract into CI or the release runner you will use long-term.
- Contract changes:
  - `none`
- Risks or blockers:
  - Phase 03b is still not fully complete until the packaged Apple Calendar smoke and `x64` proof are captured.
  - The `x64` path may require a different runner or Rosetta-aware environment even though the `arm64` path is now proven locally.
- Commands run:
  - `security find-identity -v -p codesigning`
  - `bun run check:electron:mac:signed`
  - `bun run dist:electron:mac:signed --arch arm64`
  - `xcrun notarytool history --key /Users/paul/Documents/AuthKey_LDBXSSJ7F3.p8 --key-id LDBXSSJ7F3 --issuer d8928cd2-5f2d-4ea4-a0ef-a5eda5caf7f1`
  - `xcrun notarytool wait bedaa1eb-fcff-4448-9b4e-4743dcb5671e --key /Users/paul/Documents/AuthKey_LDBXSSJ7F3.p8 --key-id LDBXSSJ7F3 --issuer d8928cd2-5f2d-4ea4-a0ef-a5eda5caf7f1`
  - `xcrun stapler staple "/Users/paul/Documents/student-claw/release/mac-arm64/Student Claw.app"`
  - `bun run verify:electron:mac --app-path "/Users/paul/Documents/student-claw/release/mac-arm64/Student Claw.app" --verbose`
- Evidence captured:
  - `arm64` notarization submission `bedaa1eb-fcff-4448-9b4e-4743dcb5671e` completed with `status: Accepted`.
  - `xcrun stapler staple` reported `The staple and validate action worked!`.
  - Final artifact verification succeeded for `/Users/paul/Documents/student-claw/release/mac-arm64/Student Claw.app`.
  - The packaged Apple Calendar bridge at `Contents/Resources/extensions/apple-calendar-mcp/bridge/CalendarAPIBridge` is signed and confirmed outside `app.asar`.
- First recommended next step:
  - Run the notarized `arm64` Apple Calendar manual smoke, then perform the `x64` signed/notarized pass before marking Phase 03b complete.

- Date: 2026-04-21
- Branch: `main`
- Owner: Codex
- Status change: `in_progress -> complete`
- Completed:
  - Marked Phase 03b complete based on the current accepted rollout bar: packaged macOS signing, notarization, stapling, helper placement, and successful end-to-end signed `arm64` build flow are all proven.
  - Switched the tracker and current recommended next step over to Phase 05.
  - Reclassified the packaged Apple Calendar manual smoke on notarized `arm64` and the `x64` signed/notarized proof as deferred follow-up instead of blockers for this phase.
- Remaining:
  - Capture the packaged Apple Calendar manual smoke on the notarized `arm64` app.
  - Capture the signed/notarized `x64` proof.
  - Mirror the proven env/signing contract into CI or the long-term release runner.
- Contract changes:
  - `none`
- Risks or blockers:
  - Deferring the packaged Apple Calendar smoke means one runtime-level packaged behavior is still unproven on the notarized build.
  - Deferring `x64` means Intel macOS remains unverified even though the packaging contract supports it.
- Commands run:
  - `bun run check:electron:mac:signed`
  - `bun run dist:electron:mac:signed --arch arm64`
  - `bun run verify:electron:mac --app-path "/Users/paul/Documents/student-claw/release/mac-arm64/Student Claw.app" --verbose`
- Evidence captured:
  - Successful signed `arm64` packaging run with live phase logging and transcript under `build-logs/`.
  - Notarized `arm64` app plus packaged Apple Calendar helper verified successfully.
- First recommended next step:
  - Continue [Phase 05 - Packaged Runtime And Hardening](phase-05-packaged-runtime-and-hardening.md).

- Date: 2026-04-21
- Branch: `main`
- Owner: Codex
- Status change: `in_progress -> in_progress`
- Completed:
  - Added live phase logging and timestamped transcript output for macOS artifact builds so packaging/notarization progress is visible during long runs.
  - Fixed packaged app startup so the bundled Electron app no longer tries to spawn `bun` for the local server runtime and instead uses the packaged compiled server entry.
  - Fixed signed post-package verification to resolve the real `release/mac-arm64/Student Claw.app` path produced by `electron-builder`.
  - Re-ran `bun run dist:electron:mac:signed --arch arm64` successfully end to end after the logging and packaged-runtime fixes landed.
- Remaining:
  - Run the packaged Apple Calendar manual smoke on the notarized `arm64` app: launch, permission prompt, readiness to `Ready`, one tool call, and clean bridge shutdown.
  - Repeat the signed/notarized proof for `x64`.
  - Mirror the proven env/signing contract into CI or the release runner you will use long-term.
- Contract changes:
  - `none`
- Risks or blockers:
  - Phase 03b is still not fully complete until the packaged Apple Calendar smoke and `x64` proof are captured.
  - The `x64` path may require a different runner or Rosetta-aware environment even though the `arm64` path is now proven locally.
- Commands run:
  - `bun test packages/electron/src/__tests__/server-lifecycle.test.ts`
  - `bun test scripts/build-macos-desktop-artifact.test.ts`
  - `bun x tsc -p packages/electron/tsconfig.json --noEmit`
  - `bun run build`
  - `bun run check:electron:mac:signed`
  - `bun run dist:electron:mac:signed --arch arm64`
- Evidence captured:
  - The signed `arm64` build now reaches `Build complete` from the main packaging command without manual post-run recovery.
  - The post-package verification phase succeeds against `release/mac-arm64/Student Claw.app`.
  - Build transcript `build-logs/mac-desktop-artifact-20260421-130827-arm64-signed.log` captures the full successful signed run.
- First recommended next step:
  - Run the notarized `arm64` Apple Calendar manual smoke, then perform the `x64` signed/notarized pass before marking Phase 03b complete.

### Phase 04 - Runtime Readiness And Settings UX

- Date: 2026-04-20
- Branch: `main`
- Owner: Codex
- Status change: `not_started -> complete`
- Completed:
  - Added a dedicated `PLUGIN_READINESS` IPC event so readiness transitions are broadcast without overloading `PLUGIN_LIFECYCLE`.
  - Extended `PLUGIN_RETRY` with typed retry classes: `retry_bridge_start`, `retry_permission`, and `retry_plugin_start`, plus `invalid_retry_class` failure handling.
  - Added `PLUGIN_REVEAL_PERMISSION_SETTINGS` so Apple Calendar can deep-link into macOS System Settings from the current plugin-management surface.
  - Wired readiness emission, typed retry routing, and permission reveal behavior through Electron main and the plugin runtime.
  - Updated Settings so bundled `auth.type === "none"` extensions render readiness cards instead of credential forms and update live from `PLUGIN_READINESS`.
  - Preserved manual-token auth UX for Canvas-style extensions as a regression guard.
- Remaining:
  - Continue Phase 03b signed/notarized verification on a full-Xcode runner with release secrets.
  - Carry the shipped readiness model into packaged-runtime hardening in Phase 05.
- Contract changes:
  - `packages/contracts/src/protocol/ipc-channels.ts :: IpcChannel.PLUGIN_READINESS`
  - `packages/contracts/src/protocol/ipc-channels.ts :: PluginRetryClass`
  - `packages/contracts/src/protocol/ipc-channels.ts :: PluginRetryParams.retryClass`
  - `packages/contracts/src/protocol/ipc-channels.ts :: IpcChannel.PLUGIN_REVEAL_PERMISSION_SETTINGS`
  - migration notes for consumers: renderer/plugin-management consumers should subscribe to `PLUGIN_READINESS` for live updates, continue reading `readiness` from `PLUGIN_LIST` and `PLUGIN_GET_STATUS`, and pass an explicit `retryClass` to `PLUGIN_RETRY`
- Risks or blockers:
  - Signed/notarized macOS verification still lives in Phase 03b and is not proven from this machine.
  - The permission deep link depends on macOS System Settings behavior and should be rechecked in the signed build smoke path.
- Commands run:
  - `bun test packages/contracts/src/contracts.test.ts packages/contracts/src/extension.test.ts`
  - `bun test packages/electron/src/__tests__/plugin-manager.test.ts packages/electron/src/__tests__/bridge-plugin-ipc.test.ts`
  - `bun --cwd packages/ui vitest run src/__tests__/SettingsPage.test.tsx -t 'Apple Calendar readiness'`
  - `bun --cwd packages/contracts build`
  - `bun x tsc -p packages/electron/tsconfig.json --noEmit`
- Evidence captured:
  - Contracts tests pass for `PLUGIN_READINESS`, typed retry params, and permission-settings IPC payloads.
  - Electron tests pass for separate readiness emission, invalid retry-class rejection, typed permission retry routing, and platform-gated permission reveal.
  - Targeted Settings tests pass for auth-form suppression, readiness-card rendering, and live updates from the dedicated readiness event.
  - Electron typecheck passes after rebuilding `@student-claw/contracts`.
- First recommended next step:
  - Continue [Phase 03b - macOS Packaging And Signing](phase-03b-macos-packaging-and-signing.md) to close the signed/notarized verification gap, then start [Phase 05 - Packaged Runtime And Hardening](phase-05-packaged-runtime-and-hardening.md).

### Phase 05 - Packaged Runtime And Hardening

- Date: 2026-04-20
- Branch: `main`
- Owner: Codex
- Status change: `not_started -> in_progress`
- Completed:
  - Added host-gated Apple Calendar discovery so `PLUGIN_LIST` hides the bundled extension on non-macOS and below the minimum supported macOS while direct lookup still remains available for migration-only/runtime handling.
  - Added a shared packaged Apple Calendar bridge path helper and reused it from both the runtime bridge launch path and `scripts/verify-macos-desktop-artifact.ts`.
  - Enriched readiness events with `previousReadiness` and `retryClass`.
  - Added a bounded Electron-main runtime diagnostics buffer plus `PLUGIN_GET_RUNTIME_LOGS`.
  - Routed MCP stderr and Apple Calendar bridge stderr/startup failures into the shared diagnostics buffer with structured `source`, `pluginId`, lifecycle/readiness context, and correlation IDs for tool calls.
  - Added restart-style readiness coverage for enabled Apple Calendar runtimes recreated from persisted plugin prefs.
- Remaining:
  - Capture packaged macOS smoke evidence for enable -> permission -> tool call -> restart -> tool call again.
  - Re-run the same smoke against a signed/notarized artifact once Phase 03b has real release evidence.
  - Keep Phase 05 open until the signed packaged proof exists; do not mark it `complete` before Phase 03b is proven.
- Contract changes:
  - `packages/contracts/src/protocol/ipc-channels.ts :: IpcChannel.PLUGIN_GET_RUNTIME_LOGS`
  - `packages/contracts/src/protocol/ipc-channels.ts :: PluginGetRuntimeLogsParams`
  - `packages/contracts/src/protocol/ipc-channels.ts :: PluginRuntimeLogEntry`
  - `packages/contracts/src/protocol/ipc-channels.ts :: PluginRuntimeLogsResult`
  - `packages/contracts/src/protocol/ipc-channels.ts :: PluginReadinessEvent.previousReadiness`
  - `packages/contracts/src/protocol/ipc-channels.ts :: PluginReadinessEvent.retryClass`
  - migration notes for consumers: renderer or diagnostics consumers can fetch the rolling packaged log buffer through `PLUGIN_GET_RUNTIME_LOGS`; readiness subscribers now receive `previousReadiness` and may also receive `retryClass`
- Risks or blockers:
  - Signed/notarized packaged smoke is still blocked on Phase 03b’s full-Xcode runner plus release secrets.
  - The diagnostics buffer is IPC-readable for bug-report flows, but this phase intentionally does not add new renderer debug UI.
- Commands run:
  - `bun test packages/contracts/src/contracts.test.ts packages/electron/src/__tests__/plugin-registry.test.ts packages/electron/src/__tests__/plugin-manager.test.ts packages/electron/src/__tests__/plugin-runtime-log-buffer.test.ts packages/electron/src/__tests__/apple-calendar-bridge-manager.test.ts packages/electron/src/__tests__/bridge-plugin-ipc.test.ts`
  - `bun --cwd packages/ui vitest run src/__tests__/SettingsPage.test.tsx`
  - `bun test scripts/stage-bundled-extensions.test.ts scripts/build-macos-desktop-artifact.test.ts scripts/verify-macos-desktop-artifact.test.ts`
  - `bun run typecheck`
- Evidence captured:
  - Contract tests pass for the new runtime-log IPC surface and enriched readiness events.
  - Electron tests pass for host-gated discovery, retry-enriched readiness events, buffered MCP/bridge diagnostics, runtime-log IPC reads, and restart-style readiness recomputation.
  - Settings tests still pass after the Phase 05 contract changes.
  - Packaging helper tests still pass after moving packaged bridge path resolution onto the shared runtime helper.
  - Full workspace typecheck passes after the new contracts and Electron runtime changes.
- First recommended next step:
  - Continue Phase 03b until a signed/notarized macOS artifact is available, then capture the packaged Apple Calendar smoke path and update this phase to `complete` only after that evidence is green.

- Date: 2026-04-21
- Branch: `main`
- Owner: Codex
- Status change: `in_progress -> in_progress`
- Completed:
  - Reworked the packaged server runtime so Student Claw no longer depends on Bun-only APIs after packaging:
    - SQLite now uses a runtime-neutral adapter that selects `bun:sqlite` in Bun dev and `node:sqlite` under packaged Electron/Node.
    - packaged server startup no longer depends on Bun being installed on the user machine.
    - Bun-only server path handling such as `import.meta.dir` skill discovery was replaced with packaged-safe filesystem resolution.
  - Extended bundled-extension staging so packaged curated extensions ship their runtime dependencies inside packaged resources, including vendored workspace runtime packages required by `template-mcp`, `canvas-mcp`, and `apple-calendar-mcp`.
  - Fixed the packaged-runtime failure class where bundled extensions could not resolve imports from `Contents/Resources/extensions/...`.
  - Verified packaged smoke behavior far enough to prove the old runtime blockers are cleared:
    - the packaged server starts under Electron/Node
    - packaged `template-mcp`, `canvas-mcp`, and Apple Calendar startup paths launch successfully
    - the Apple Calendar bridge launches from packaged resources outside `asar`
    - a fresh packaged launch reaches a shown Electron window at normal `1280x800` bounds
- Remaining:
  - Run the full packaged Apple Calendar manual smoke on macOS: enable, permission prompt, readiness to `Ready`, one tool call, restart, and one tool call again.
  - Repeat the same Apple Calendar smoke on the signed/notarized build.
  - Capture one degraded packaged case as evidence, such as missing/corrupted bridge -> `bridge_unavailable` or revoked permission -> `permission_required`.
  - Update this phase to `complete` only after the user-facing packaged Apple Calendar flow is proven.
- Contract changes:
  - `packages/server/src/db/runtime-sqlite.ts :: RuntimeSqliteDatabase`
  - `packages/server/src/db/runtime-sqlite.ts :: openRuntimeSqliteDatabase`
  - `packages/server/src/db/Database.ts :: runtime-neutral database creation`
  - staged packaged extension runtime resources now include vendored dependencies under `Contents/Resources/extensions/.../node_modules`
- Risks or blockers:
  - The packaged shell now creates and shows its window in debug-instrumented smoke launches, but the final Apple Calendar user flow is still unproven on the packaged app.
  - One local skill file still logs a non-blocking YAML parse warning during packaged startup; it does not currently prevent the shell or server from starting.
- Commands run:
  - `bun test packages/server/src/__tests__/runtime-sqlite.test.ts packages/server/src/__tests__/database.test.ts scripts/stage-bundled-extensions.test.ts`
  - `bun x tsc -p packages/server/tsconfig.json --noEmit`
  - `bun x tsc -p packages/electron/tsconfig.json --noEmit`
  - `bun run build`
  - `bun scripts/build-macos-desktop-artifact.ts --skip-build --output-dir /tmp/student-claw-packaged-runtime-smoke`
  - `STUDENT_CLAW_DEBUG_WINDOW=1 "/tmp/student-claw-packaged-runtime-smoke/mac-arm64/Student Claw.app/Contents/MacOS/Student Claw"`
- Evidence captured:
  - The packaged server reaches `Student Claw server started on :8787` under Electron/Node in the smoke app.
  - Bundled curated extensions resolve and launch from packaged resources instead of repo-local runtime paths.
  - Window debug output captured `created`, `did-finish-load`, and `shown` states at normal `1280x800` bounds during a fresh packaged launch.
  - The Apple Calendar bridge launches from `Contents/Resources/extensions/apple-calendar-mcp/bridge/CalendarAPIBridge` outside `asar`.
- First recommended next step:
  - Run the packaged Apple Calendar manual smoke on the current macOS artifact, then repeat it on the signed/notarized build and mark Phase 05 complete if both are green.

### Phase 06 - Curated Extension Template And Next Plugins

- Date: 2026-04-21
- Branch: main
- Owner: Codex
- Status change: not_started -> in_progress
- Completed:
  - rewrote the Phase 06 doc into the canonical operator guide for future curated bundled extensions
  - added `curated-extension-template-checklist.md` as the reusable fill-in artifact for candidate reviews
  - documented Apple Calendar as the completed canary example
  - recorded candidate recommendations for Notion, Google Docs/Sheets, Gmail, and Discord
- Remaining:
  - reflect the final Phase 03b signed/notarized packaging evidence in the checklist wording
  - reflect the final Phase 05 packaged macOS smoke evidence in the checklist wording before marking the phase complete
- Contract changes:
  - none
- Risks or blockers:
  - `graphify-out/GRAPH_REPORT.md` is missing in this workspace, so architecture guidance stayed grounded in the rollout docs and live curated packages instead of graph output
  - final packaged hardening evidence is still gated by Phase 03b and Phase 05
- Commands run:
  - `sed -n '1,260p' docs/implementation/curated-extension-catalog-rollout/phase-06-curated-extension-template-and-next-plugins.md`
  - `sed -n '1,260p' docs/implementation/curated-extension-catalog-rollout/GLOSSARY.md`
  - `sed -n '1,260p' packages/extensions/apple-calendar-mcp/README.md`
  - `sed -n '1,220p' packages/extensions/template-mcp/manifest.json`
  - `sed -n '1,260p' packages/extensions/apple-calendar-mcp/manifest.json`
  - `rg -n "Notion|Google Docs|Google Sheets|Gmail|Discord" docs/architecture/05-external-services.md docs/features/05-plugin-system.md docs/implementation -g '!**/phase-06-curated-extension-template-and-next-plugins.md'`
- Evidence captured:
  - Phase 06 now points to a concrete checklist artifact instead of prose-only guidance
  - Apple Calendar, Notion, Google Docs/Sheets, and Gmail now end with explicit recommendation records
- First recommended next step:
  - complete the remaining Phase 03b and Phase 05 packaged evidence, then update the checklist to match the final proven hardening bar and mark Phase 06 complete
