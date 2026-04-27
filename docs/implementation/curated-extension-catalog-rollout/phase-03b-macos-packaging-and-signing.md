# Phase 03b - macOS Packaging And Signing

Last updated: 2026-04-21

## Orientation Note

- Target feature: lock the macOS packaging, codesigning, notarization, entitlement, and Swift toolchain rules required before Apple Calendar (or any future curated extension that ships a native helper binary) can run in a notarized build on a user machine
- Key dependencies: Phase 03 bundled-catalog rules, Phase 02 bridge lifecycle, Electron macOS packaging configuration, Apple developer identity in CI
- Constraints and boundaries:
  - packaged behavior is the source of truth; dev-mode behavior is not a proxy
  - this phase owns everything between "bundled assets exist on disk" and "the user's notarized app can successfully exec the helper"
  - this is the macOS specialization of Phase 03, not a replacement for it
- Acceptance criteria for this increment:
  - `Info.plist` usage strings for Calendar are explicit and owned
  - per-architecture helper build and packaging rules are explicit
  - codesigning and notarization rules for the Swift helper are explicit
  - hardened runtime entitlements are explicit
  - deployment target and minimum macOS are locked
  - Swift build toolchain integration with root scripts is explicit
  - bridge binary versioning with app version is explicit

## Beginning

### Objective

Close the gap between "a Swift helper binary exists at the right path inside
the packaged app" (Phase 03) and "macOS lets the notarized app actually exec
that helper and the helper can request Calendar access" (this phase). Shipping
a Swift helper from within a notarized Electron app has enough moving pieces
that each curated extension with a native helper would otherwise re-discover
these rules.

### Current State

- Orbyt packages desktop artifacts through a dedicated `electron-builder` script layered on top of the Electron build output and Phase 03's staged bundled catalog.
- The Apple Calendar bridge is built into `packages/extensions/apple-calendar-mcp/bridge/dist/<arch>/CalendarAPIBridge` with matching `version.json` metadata.
- Unsigned local `.app` and `.dmg` packaging works without Apple signing credentials.
- Signed and notarized release packaging is wired behind env-driven secrets and requires full Xcode on the release runner.
- The repo now includes a local preflight and verification seam:
  - `bun run check:electron:mac:signed`
  - `bun run verify:electron:mac`
- The packaging flow now emits live phase/status logs and writes a timestamped transcript to `build-logs/` for each macOS artifact run, so long packaging or notarization steps are inspectable after the fact.
- The local `arm64` signed/notarized proof is now captured:
  - `bun run check:electron:mac:signed` passes on a full-Xcode macOS machine
  - notarization submission `bedaa1eb-fcff-4448-9b4e-4743dcb5671e` completed with `Accepted`
  - `xcrun stapler staple` succeeded for `release/mac-arm64/Orbyt.app`
  - `bun run verify:electron:mac --app-path "/Users/paul/Documents/orbyt/release/mac-arm64/Orbyt.app" --verbose` succeeded
  - `bun run dist:electron:mac:signed --arch arm64` now completes end to end with post-package verification against `release/mac-arm64/Orbyt.app`

### Out Of Scope

- remote catalog distribution
- Windows or Linux helper binaries (curated extensions with native helpers on non-macOS are a future rollout)
- App Store distribution rules (the app ships via Developer ID, not Mac App Store, unless later decided otherwise)

### Acceptance Criteria

- The `Info.plist` Calendar usage strings are specified and required for packaged builds.
- Per-architecture helper expectations (`arm64` and `x64`) are locked, and the packaging flow selects the correct bridge artifact for the current macOS target.
- The Swift helper is codesigned with the same Developer ID team as the `.app` and is notarized as part of the app's notarization when signing secrets are present.
- Hardened runtime entitlements required for EventKit access are explicit.
- The minimum supported macOS version is explicit and consistent across app, bridge, and readiness gating.
- Root scripts know how to build the Swift helper and where its output lands.
- The helper binary version metadata is emitted alongside the app and cannot drift silently across updates.
- Full Xcode is required for signed/notarized release runners; Command Line Tools alone are only acceptable for local development tasks.

## Middle

### Implementation Slices

1. Lock `Info.plist` usage strings for Calendar access.
2. Lock deployment target and minimum macOS.
3. Define per-architecture build rules for the Swift helper.
4. Define codesigning and notarization rules for the Swift helper.
5. Define hardened runtime entitlements required for EventKit.
6. Integrate `swift build` into root build scripts and packaging.
7. Define bridge binary versioning with the app version.

### Info.plist Usage Strings

The packaged Electron app's `Info.plist` must declare, at a minimum:

- `NSCalendarsUsageDescription`: required on macOS < 14 and as a fallback description
- `NSCalendarsFullAccessUsageDescription`: required on macOS 14+ for write access to calendars and events

The strings must be user-facing and explain why Orbyt needs Calendar
access. The strings live in the main `Info.plist` regardless of whether the
Swift helper is a separate binary; macOS attributes the prompt to the parent
`.app` that owns the binary.

Both strings are versioned with the app, not with the bridge. Changing them is
a product copy decision.

### Deployment Target And Minimum macOS

- The Swift helper targets macOS 13.0 (matches upstream) unless a later product decision raises it.
- The Orbyt app's minimum supported macOS must be ≥ the Swift helper deployment target. If they diverge, the lower one wins for Apple Calendar availability.
- Below the minimum macOS, Apple Calendar is hidden (non-macOS-level invisibility per Phase 05). `platform_unsupported` readiness is only reachable via config migration, not normal discovery.

### Per-Architecture Helper Packaging

- The Swift helper ships as a per-architecture artifact, not as a universal binary.
- `arm64` macOS artifacts embed the `arm64` helper from `packages/extensions/apple-calendar-mcp/bridge/dist/arm64/CalendarAPIBridge`.
- `x64` macOS artifacts embed the `x64` helper from `packages/extensions/apple-calendar-mcp/bridge/dist/x64/CalendarAPIBridge`.
- Packaging must fail if the matching helper for the target artifact arch is missing.
- Local unsigned packaging can reuse an already-built helper, but signed release packaging must treat the bridge build output as a required input.

### Codesigning And Notarization

- The Swift helper must be codesigned with the same Apple Developer ID team as the `.app`.
- Codesign must be applied to the helper before or during packaging and must cover the embedded helper that lands in `Contents/Resources/extensions/apple-calendar-mcp/bridge/`.
- The helper must be included in the `.app`'s notarization ticket. Notarization of only the outer bundle while leaving an unsigned helper inside `resources/` is a shipping bug.
- Developer ID signing identity and App Store Connect API key live in CI secrets (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`).
- Local packaging must fall back to unsigned output when those secrets are absent rather than producing a half-signed artifact.
- The helper must pass `codesign --verify --deep --strict --verbose=2 <path>` and `spctl --assess --type execute <path>`.

### Hardened Runtime Entitlements

The packaged app uses the hardened runtime. The Swift helper inherits or
declares entitlements as needed:

- `com.apple.security.personal-information.calendars`: required so the hardened-runtime app can read and write Calendar data through EventKit. Declared on the main app entitlements file.
- The app's entitlements are based on Electron's hardened-runtime defaults plus Calendar access. The checked-in entitlements files are the authority and must not silently drift in release automation.
- If the Swift helper is launched as a sub-executable rather than in-process code, it must either (a) be signed with the same team identifier and inherit the parent's entitlements at exec, or (b) ship its own entitlements file that declares the Calendar entitlement.

The exact entitlements plist (`hardened.plist` or similar) lives in
`packages/electron/` packaging configuration. This phase requires that the
file is checked in and reviewed, not invented per build.

### Swift Build Toolchain Integration

- Local helper builds can use Xcode Command Line Tools.
- Signed and notarized release packaging must run on a macOS image with full Xcode available (`xcodebuild -version` must succeed).
- Root scripts gain a bridge-build step. For example:
  - `bun run build:apple-calendar-bridge:arm64` builds the `arm64` helper.
  - `bun run build:apple-calendar-bridge:x64` builds the `x64` helper.
  - The resulting binary lands under `packages/extensions/apple-calendar-mcp/bridge/dist/<arch>/CalendarAPIBridge`.
- Packaging copies the matching helper into `resources/extensions/apple-calendar-mcp/bridge/` outside `asar`.
- The `dist/` swift output is treated as a build artifact (not checked in), same as TypeScript `dist/`.

### Bridge Binary Versioning

- The bridge emits version metadata (`version.json`) matching the Orbyt app version at build time.
- Packaging verifies the version metadata before embedding the helper into the packaged app.
- The bridge manager can log or surface the packaged helper version during diagnostics. A mismatch between the expected version and the packaged helper metadata is a build-time failure for packaged artifacts.
- A cached or user-overridden bridge binary must never shadow the packaged one. Packaged builds always resolve the bridge from inside the packaged resources.

### Primary Directories

- `packages/electron/` (packaging configuration, entitlements, `Info.plist`)
- `packages/extensions/apple-calendar-mcp/bridge/`
- root build scripts
- CI configuration

### Verification Gates

- Unit:
  - entitlements file is present, valid, and contains the required Calendar entitlement
  - `Info.plist` strings are present for both `NSCalendarsUsageDescription` and `NSCalendarsFullAccessUsageDescription`
  - bridge build path resolution selects the correct per-arch helper and version metadata
- Integration:
  - packaged build pipeline produces the bridge binary in `bridge/dist/<arch>/CalendarAPIBridge`
  - packaging copies the bridge into `resources/extensions/apple-calendar-mcp/bridge/` outside `asar`
  - unsigned local macOS packaging builds a `.app` and `.dmg` with the staged bundled catalog and the matching helper
  - signed packaging only enables codesign and notarization when all required secrets are present
  - the signed-release preflight reports Command Line Tools, missing secrets, and unreadable local asset paths before packaging starts
  - packaged-artifact verification resolves the `.app` and helper path, confirms the helper is outside `asar`, and runs the full `codesign`, `spctl`, and `stapler` command set
- Manual smoke:
  - notarized `.app` boots on a clean macOS 13+ machine
  - enabling Apple Calendar triggers the macOS Calendar permission prompt attributed to Orbyt
  - granting access transitions readiness to `ready`
  - one tool call round-trips successfully
  - quitting the app leaves no orphaned bridge process
  - `arm64` packaging, signing, notarization, stapling, and static verification are already proven; this remaining manual smoke is now the last Apple Silicon check
- Failure path:
  - an unsigned bridge binary fails `codesign --verify`, and packaging rejects the build instead of shipping it
  - missing `NSCalendarsUsageDescription` prevents shipping
  - missing per-arch helper prevents packaging for that target
  - missing signing secrets falls back to unsigned local packaging instead of a half-signed artifact

### Evidence To Capture

- `codesign --verify --deep --strict --verbose=2` output for the shipped bridge
- `spctl --assess --type execute` output for the notarized `.app`
- path evidence showing `Contents/Resources/extensions/apple-calendar-mcp/bridge/CalendarAPIBridge` exists outside `asar`
- one screenshot of the macOS Calendar permission prompt triggered by the notarized Orbyt build
- preflight output from `bun run check:electron:mac:signed`
- notarization acceptance for submission `bedaa1eb-fcff-4448-9b4e-4743dcb5671e`
- successful `xcrun stapler staple` output for the notarized `arm64` app

### Operational Runbook

Use the repo runbook at [macos-signing-runbook.md](macos-signing-runbook.md) to
mirror the already-proven local `arm64` env/signing contract into CI, complete
the Apple Calendar packaged smoke on the notarized `arm64` app, and then repeat
the signed proof for `x64`.

## End

### Done When

- packaging rules for macOS curated-extension helpers are locked
- at least one signed/notarized production artifact path is proven end to end (`arm64` is now captured)
- any remaining packaged Apple Calendar smoke and `x64` proof can be tracked as deferred follow-up without blocking progression to packaged runtime hardening

### Handoff To Next Phase

Phase 04 owns the Settings UX for readiness. It can proceed in parallel with
this phase because it does not depend on a signed binary, but Phase 05's
packaged smoke path now continues from the completed 03b packaging baseline.

### Risks To Carry Forward

- if codesigning and notarization are not enforced in CI, a release can ship an unsigned helper that fails on user machines but works for developers
- if `Info.plist` usage strings drift or are removed, macOS silently fails the permission prompt and the app looks broken
- if the per-arch helper rule is not enforced, one macOS architecture can ship a broken extension while the other still works
- if the helper is versioned independently of the app, protocol drift will produce subtle bugs that only reproduce on partial updates

### First Recommended Next Step

Advance to [Phase 05 - Packaged Runtime And Hardening](phase-05-packaged-runtime-and-hardening.md). Track the packaged Apple Calendar smoke on the notarized `arm64` app and the signed/notarized `x64` proof as deferred follow-up evidence.
