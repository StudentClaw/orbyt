# Phase 03 - Bundled Catalog And Build Integration

Last updated: 2026-04-18

## Orientation Note

- Target feature: define the repo, build, and packaging changes needed so Apple Calendar ships in the main bundled catalog
- Key dependencies: Phases 01 and 02, current `packages/extensions/*` build participation, current packaged-path expectations in the plugin runtime
- Constraints and boundaries:
  - preserve current registry semantics for bundled extensions
  - treat bridge packaging as additive, not as a separate extension type
  - keep packaged-runtime behavior consistent with dev behavior
- Acceptance criteria for this increment:
  - Apple Calendar is included in the bundled extension build path
  - packaged Electron can locate bundled extension assets
  - bridge executable placement outside `asar` is accounted for
  - no special registry semantics are introduced for Apple Calendar

## Beginning

### Objective

Specify how Apple Calendar becomes part of the main app bundle and bundled
catalog without diverging from the current extension discovery model.

### Current State

- The current bundled catalog expects extensions under `packages/extensions/*` in dev and `resources/extensions` in packaged builds.
- Root scripts explicitly build known bundled extensions.
- The current docs already identify packaged path handling and `asar` behavior as critical plugin-system hardening areas.

### Out Of Scope

- bridge readiness UX
- install or uninstall product copy
- runtime status schema details

### Acceptance Criteria

- Apple Calendar is included in root extension build participation.
- Apple Calendar is treated as a normal bundled extension by the registry.
- Packaged Electron path rules cover both:
  - bundled extension assets
  - bridge executable placement outside `asar`
- Build and packaging expectations are concrete enough for Phase 05 hardening work.

## Middle

### Implementation Slices

1. Add Apple Calendar to root extension build, typecheck, and test participation.
2. Preserve the existing bundled-catalog discovery convention:
   - dev from `packages/extensions/*`
   - packaged from `resources/extensions`
3. Define bridge packaging and copy rules.
4. Define how packaged Electron locates bridge runtime assets outside `asar`.

### Build Participation

The rollout should assume:

- Apple Calendar joins `packages/extensions/*` like any other bundled extension
- root scripts should include Apple Calendar in:
  - extension build
  - extension typecheck
  - extension tests

### Bundled Catalog Rules

Apple Calendar should be treated exactly like other bundled extensions at the
registry level:

- it is discovered from the bundled catalog
- it uses the same shared manifest contract
- it does not get a custom registry source or extension type

The only additive packaging rule is the bridge executable and its supporting
assets.

### Bridge Packaging Rules

The packaged app should:

- include Apple Calendar’s extension assets in `resources/extensions/apple-calendar-mcp/`
- place any required bridge executable or runtime assets in an unpacked or copied location that remains executable outside `asar`
- avoid runtime assumptions that compiled bridge artifacts can execute from inside packed archives

### Primary Directories

- `packages/extensions/apple-calendar-mcp/`
- `packages/electron/`
- `packages/electron/src/plugins/`
- packaging configuration files

### Verification Gates

- Unit:
  - bundled path resolution helpers
  - bridge executable path resolution helpers
- Integration:
  - Apple Calendar appears in bundled discovery and can be targeted for startup in dev-mode integration
  - this gate does not require a signed or notarized bridge; those requirements live in Phase 03b. This gate only verifies that the bridge asset path is resolvable and that missing assets degrade cleanly.
- Manual smoke:
  - packaged build contains Apple Calendar assets in the expected bundled catalog location (codesign and notarization are verified in Phase 03b, not here)
- Failure path:
  - missing bridge executable degrades cleanly without breaking the rest of the bundled catalog

### Evidence To Capture

- root script participation diff
- packaged resource tree sample
- one successful bundled path resolution example

## End

### Done When

- build and packaging expectations are locked for Apple Calendar as a bundled curated extension
- the registry model remains unchanged while bridge packaging is fully accounted for

### Handoff To Next Phase

Phase 03b locks the macOS packaging specifics — `Info.plist` usage strings,
codesigning and notarization of the Swift helper, per-arch helper packaging,
hardened runtime entitlements, and the Swift build toolchain integration — that turn
the generic path and asar rules in this phase into an installable macOS build.
Phase 03b blocks anything that would ship to a user; Phase 04 can begin in
parallel because it is UX-only.

### Risks To Carry Forward

- if Apple Calendar is treated as a registry special case instead of a normal bundled extension, future curated extensions will become inconsistent
- if bridge artifacts are not explicitly packaged outside `asar`, packaged macOS behavior will drift from dev behavior
- if Phase 03b is skipped, the bridge binary will fail to exec on a notarized build even though dev-mode works

### First Recommended Next Step

Start [Phase 03b - macOS Packaging And Signing](phase-03b-macos-packaging-and-signing.md). Phase 04 can be worked in parallel.
