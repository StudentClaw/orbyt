# Cross-Platform Desktop Release Glossary, Tracker, And Handoff

Last updated: 2026-05-05

This file has two jobs:

1. Track implementation progress for Windows and Linux desktop releases.
2. Capture handoff notes so each phase can continue without rediscovery.

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

## Phase Tracker

| Phase | Status | Owner | Verification State | Next Action |
| --- | --- | --- | --- | --- |
| 00 - Sync And Scaffold | complete | Codex | Verified | Phase 01 complete; maintain this tracker as release evidence grows |
| 01 - Platform-Aware MCP Packaging | complete | Codex | Verified | Phase 02 complete; platform-aware MCP packaging is available |
| 02 - Windows/Linux Artifact Builder | complete | Codex | Verified | Phase 03 complete; CI can build non-mac artifacts |
| 03 - Updates And Release Workflow | complete | Codex | Verified | Phase 04 complete; CI should prove artifacts on next release run |
| 04 - Verification And Handoff | complete | Codex | Verified | Run real Windows/Linux release builds in GitHub Actions |

## Current Recommended Next Step

Run the updated GitHub Release workflow from `main` or the next release tag, then
capture the produced Windows `.exe`, Linux `.AppImage`, updater manifests, and
manual launch smoke evidence here.

## Handoff Update Protocol

When a phase changes state, append a new entry to the relevant phase section below with:

- date
- branch
- owner
- status change
- completed work
- remaining work
- contract changes
- risks or blockers
- commands run
- evidence captured
- first recommended next step

### Handoff Entry Template

```md
- Date: YYYY-MM-DD
- Branch: main
- Owner: <name>
- Status change: not_started -> in_progress | in_progress -> complete | etc.
- Completed:
  - item
- Remaining:
  - item
- Contract changes:
  - file + symbol, or `none`
- Risks or blockers:
  - item
- Commands run:
  - `bun test ...`
- Evidence captured:
  - test output
- First recommended next step:
  - item
```

## Shared Vocabulary

### Target Build Platform

The release packaging target: `mac`, `linux`, or `win`. This is the
electron-builder/platform artifact concept, not necessarily `process.platform`.

### Runtime Host Platform

The Node/Electron runtime platform value: `darwin`, `linux`, or `win32`.
Bundled MCP availability is expressed in this vocabulary.

### Platform-Aware Bundled Extension

A bundled MCP extension whose manifest limits supported runtime platforms.
If `platforms` is omitted, the extension is treated as cross-platform.

### Staged Desktop App

The temporary production app directory copied from built Orbyt outputs and
passed to electron-builder.

### GitHub Update Feed

The release artifacts and updater manifests attached to GitHub Releases. This
is the v1 distribution and update channel for Windows and Linux.

### NSIS Artifact

The Windows installer `.exe` produced by electron-builder's `nsis` target.

### AppImage Artifact

The portable Linux desktop artifact produced by electron-builder's `AppImage`
target.

### Update Manifest

An electron-updater `.yml` file such as `latest-mac.yml`, `latest.yml`, or
`latest-linux.yml`.

### Package Manager Distribution

Distribution through winget, AUR, Homebrew, apt, or rpm repositories. Deferred
until GitHub Releases are proven.

## Phase Handoff Log

### Phase 00 - Sync And Scaffold

- Date: 2026-05-05
- Branch: main
- Owner: Codex
- Status change: not_started -> in_progress
- Completed:
  - Fast-forwarded local `main` to remote `bcbc6cc67b2391c0d01f62272fbd460a25dddc4c`.
  - Created this rollout tracker using the Orbyt glossary and handoff format.
- Remaining:
  - Complete code and workflow phases.
- Contract changes:
  - none
- Risks or blockers:
  - Direct-to-main implementation intentionally bypasses the default feature-branch rule in `docs/internal/PLAN.md`.
- Commands run:
  - `git fetch origin main`
  - `git checkout main`
  - `git pull --ff-only origin main`
- Evidence captured:
  - `git rev-parse HEAD` returned `bcbc6cc67b2391c0d01f62272fbd460a25dddc4c`.
- First recommended next step:
  - Start Phase 01 TDD cycles for manifest platform metadata and platform-aware staging.

### Phase 01 - Platform-Aware MCP Packaging

- Date: 2026-05-05
- Branch: main
- Owner: Codex
- Status change: not_started -> complete
- Completed:
  - Added optional manifest `platforms` metadata using runtime host platform values.
  - Marked `apple-calendar-mcp` as Darwin-only in both its source manifest and packaged manifest JSON.
  - Made bundled extension staging filter by target runtime platform.
  - Made registry listing honor manifest platform metadata while preserving Apple Calendar's macOS version gate.
- Remaining:
  - none
- Contract changes:
  - `packages/contracts/src/schemas/extension.ts :: ExtensionRuntimeHostPlatform`
  - `packages/contracts/src/schemas/extension.ts :: ExtensionManifest.platforms`
- Risks or blockers:
  - Existing user-installed extensions without `platforms` remain cross-platform by default.
- Commands run:
  - `bun test packages/contracts/src/extension.test.ts`
  - `bun test packages/electron/src/__tests__/plugin-registry.test.ts`
  - `bun test ./scripts/stage-bundled-extensions.test.ts`
- Evidence captured:
  - Contract, registry, and staging tests passed with Apple Calendar excluded from Linux packaged resources.
- First recommended next step:
  - Use the new `--platform` staging option in release builders.

### Phase 01 TDD Cycles

#### TDD Cycle 1
- Behavior: manifests can declare supported runtime host platforms.
- RED: `packages/contracts/src/extension.test.ts` failed because `platforms` was stripped.
- GREEN: added `ExtensionRuntimeHostPlatform` and optional `ExtensionManifest.platforms`.
- REFACTOR: none.
- Verification: `bun test packages/contracts/src/extension.test.ts` passed.
- Notes: omitted `platforms` means cross-platform.

#### TDD Cycle 2
- Behavior: Apple Calendar declares Darwin-only support in the real bundled catalog.
- RED: `packages/electron/src/__tests__/plugin-registry.test.ts` failed on missing `manifest.platforms`.
- GREEN: added `platforms: ["darwin"]` to Apple Calendar manifests.
- REFACTOR: rebuilt contracts before Electron tests so runtime schema matched source.
- Verification: `bun test packages/electron/src/__tests__/plugin-registry.test.ts` passed.
- Notes: the existing macOS-version gate remains.

#### TDD Cycle 3
- Behavior: Linux packaged resources exclude Darwin-only bundled extensions.
- RED: `scripts/stage-bundled-extensions.test.ts` still staged `apple-calendar-mcp`.
- GREEN: added `targetPlatform` filtering and CLI `--platform` support to staging.
- REFACTOR: dependency collection now uses only staged extension dirs.
- Verification: `bun test ./scripts/stage-bundled-extensions.test.ts` passed.
- Notes: Windows uses the same target-platform path with `win32`.

#### TDD Cycle 4
- Behavior: registry hides any manifest whose platform list excludes the host.
- RED: a Linux-only test extension still appeared on `win32`.
- GREEN: passed manifest platforms into the registry availability check.
- REFACTOR: kept the Apple Calendar-specific macOS version rule in the same helper.
- Verification: `bun test packages/electron/src/__tests__/plugin-registry.test.ts` passed.
- Notes: `getStatus` can still find hidden entries for migration/debug paths.

### Phase 02 - Windows/Linux Artifact Builder

- Date: 2026-05-05
- Branch: main
- Owner: Codex
- Status change: not_started -> complete
- Completed:
  - Added `scripts/build-desktop-artifact.ts` for Linux AppImage and Windows NSIS artifact builds.
  - Added `dist:electron:linux` and `dist:electron:win` package scripts.
  - Mirrored Linux and Windows targets in root `electron-builder.config.mjs`.
  - Kept the existing macOS artifact script unchanged for signed/notarized mac builds.
- Remaining:
  - Run the new builders on native CI runners.
- Contract changes:
  - none
- Risks or blockers:
  - Windows signing is intentionally disabled for v1.
  - Linux `.deb` is deferred.
- Commands run:
  - `bun test ./scripts/build-desktop-artifact.test.ts`
  - `bun test ./scripts/build-macos-desktop-artifact.test.ts`
- Evidence captured:
  - New Linux/Windows config tests passed.
  - Existing macOS packaging tests still passed.
- First recommended next step:
  - Build Linux and Windows artifacts in GitHub Actions.

### Phase 02 TDD Cycles

#### TDD Cycle 1
- Behavior: Linux artifact config produces AppImage packaging with staged resources.
- RED: `scripts/build-desktop-artifact.test.ts` could not import the new builder.
- GREEN: added `createDesktopPackagingConfig` with Linux AppImage config.
- REFACTOR: shared platform flag and target helpers inside the new script.
- Verification: `bun test ./scripts/build-desktop-artifact.test.ts` passed.
- Notes: output goes through the staged app path.

#### TDD Cycle 2
- Behavior: Windows artifact config produces unsigned NSIS packaging.
- RED: Windows config test failed before the builder existed.
- GREEN: added Windows `nsis` config with signing disabled unless explicitly requested.
- REFACTOR: none.
- Verification: `bun test ./scripts/build-desktop-artifact.test.ts` passed.
- Notes: Azure/Trusted Signing is deferred.

#### TDD Cycle 3
- Behavior: non-mac builder args invoke electron-builder for the target platform and arch.
- RED: args helper missing.
- GREEN: added `createDesktopElectronBuilderArgs`.
- REFACTOR: kept macOS args in the existing mac script.
- Verification: `bun test ./scripts/build-desktop-artifact.test.ts` passed.
- Notes: v1 supports x64 only for Windows/Linux.

#### TDD Cycle 4
- Behavior: non-mac staged package keeps runtime dependencies without mac bridge binaries.
- RED: staged package helper missing.
- GREEN: added `createDesktopStagePackageJson` and non-mac staging flow.
- REFACTOR: reused Orbyt's existing vendor dependency shape.
- Verification: `bun test ./scripts/build-desktop-artifact.test.ts` passed.
- Notes: the Swift bridge remains macOS-only.

### Phase 03 - Updates And Release Workflow

- Date: 2026-05-05
- Branch: main
- Owner: Codex
- Status change: not_started -> complete
- Completed:
  - Enabled packaged Windows/Linux auto-updates when an update feed is configured.
  - Added Linux and Windows rows to the release build matrix.
  - Added non-mac artifact collection and GitHub Release upload patterns.
  - Updated release asset verification for `latest.yml` and `latest-linux.yml`.
- Remaining:
  - GitHub Actions must prove the new platform runners and generated updater manifests.
- Contract changes:
  - none
- Risks or blockers:
  - The new release workflow verification expects Windows and Linux updater manifests once the matrix runs.
- Commands run:
  - `bun test packages/electron/src/__tests__/desktop-updater-state.test.ts`
  - `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/release.yml"); puts "release workflow yaml ok"'`
- Evidence captured:
  - Updater-state tests passed.
  - Release workflow parsed as YAML.
- First recommended next step:
  - Trigger the release workflow manually on `main` with a test version.

### Phase 03 TDD Cycles

#### TDD Cycle 1
- Behavior: packaged Windows/Linux builds with feed config have updates enabled.
- RED: updater-state test returned the old macOS-only disabled reason.
- GREEN: replaced the mac-only gate with explicit supported platforms: `darwin`, `linux`, `win32`.
- REFACTOR: none.
- Verification: `bun test packages/electron/src/__tests__/desktop-updater-state.test.ts` passed.
- Notes: dev and no-feed cases still disable updates.

#### TDD Cycle 2
- Behavior: release workflow builds and uploads Linux/Windows artifacts.
- RED: release workflow had only macOS matrix rows and asset patterns.
- GREEN: added Linux x64 AppImage and Windows x64 NSIS matrix rows plus artifact upload patterns.
- REFACTOR: build job name and artifact name now use `matrix.platform`/`matrix.arch`.
- Verification: workflow YAML parsed successfully.
- Notes: package-manager distribution remains deferred.

### Phase 04 - Verification And Handoff

- Date: 2026-05-05
- Branch: main
- Owner: Codex
- Status change: not_started -> complete
- Completed:
  - Ran typecheck and focused release/MCP/updater tests.
  - Captured one accidental broad Electron test run that still exposes known plugin integration timeouts.
  - Updated this handoff with TDD cycles and verification evidence.
- Remaining:
  - Native CI artifact builds and manual smoke on Windows/Linux.
- Contract changes:
  - none beyond Phase 01 contract changes
- Risks or blockers:
  - Broad `bun --cwd packages/electron test ...` invokes the package's full `src` test target and still times out in plugin integration tests.
- Commands run:
  - `bun run typecheck`
  - `bun run test:contracts`
  - `bun test packages/electron/src/__tests__/desktop-updater-state.test.ts packages/electron/src/__tests__/plugin-registry.test.ts`
  - `bun test ./scripts/build-desktop-artifact.test.ts ./scripts/build-macos-desktop-artifact.test.ts ./scripts/stage-bundled-extensions.test.ts`
- Evidence captured:
  - Typecheck passed.
  - Focused contract, Electron, and release-script tests passed.
- First recommended next step:
  - Run GitHub Actions release workflow and smoke-test downloaded `.exe` and `.AppImage` artifacts.
