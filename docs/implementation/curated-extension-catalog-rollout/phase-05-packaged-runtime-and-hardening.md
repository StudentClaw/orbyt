# Phase 05 - Packaged Runtime And Hardening

Last updated: 2026-04-20

## Orientation Note

- Target feature: define the packaged-runtime reliability work needed before Apple Calendar is considered shippable
- Key dependencies: earlier rollout phases, packaged plugin-system path handling, macOS Calendar bridge behavior outside dev mode
- Constraints and boundaries:
  - packaged behavior is the source of truth
  - prioritize operability over adding more curated extensions
  - macOS-only gating must be explicit
- Acceptance criteria for this increment:
  - macOS-only availability rules are fixed
  - packaged smoke path is explicit
  - restart persistence expectations are explicit
  - degraded behavior for missing bridge binaries or unsupported platforms is explicit

## Beginning

### Objective

Close the dev-versus-packaged gap for Apple Calendar and define the hardening
bar required before the extension is treated as production-ready.

### Current State

- The predecessor plugin-system docs already call out packaged path handling and `asar` behavior as where plugin systems often fail.
- Apple Calendar adds a second runtime surface, the Swift bridge, which increases packaged-runtime risk.
- Apple Calendar is inherently platform-specific because it depends on macOS EventKit.
- The repo now has shared packaged bridge path resolution, host-gated Apple Calendar discovery, enriched readiness events, and an IPC-readable runtime diagnostics buffer in Electron main.
- Restart-style readiness recomputation for enabled Apple Calendar runtimes is covered in tests, but packaged signed-smoke evidence is still pending behind Phase 03b.

### Out Of Scope

- adding more curated extensions in this phase
- remote catalog or downloader work
- major redesigns to the extension runtime

### Acceptance Criteria

- Apple Calendar is visible only on macOS-capable builds.
- Packaged macOS smoke behavior is defined end to end.
- Restart persistence expectations are explicit.
- Non-macOS or missing-bridge behavior degrades cleanly.
- Crash-loop handling expectations are explicit for the bridge.

## Middle

### Implementation Slices

1. Define macOS-only gating behavior.
2. Define packaged build smoke path.
3. Define restart persistence expectations.
4. Define degraded behavior for unsupported platforms and missing bridge assets.
5. Define crash-loop handling and observability for the bridge.

### Platform Gating

Default platform rule:

- Apple Calendar is visible only on macOS-capable builds at or above the minimum macOS locked in Phase 03b.
- On non-macOS builds and on macOS versions below the minimum, Apple Calendar is hidden entirely from the extension catalog. It is not shown in a disabled, unsupported, or greyed-out state.
- `platform_unsupported` readiness is reached only through config migration (for example a settings file imported from a macOS machine onto a Linux machine). It is not a normal discovery state.
- The `Install` word is not used for Apple Calendar; the verb on enabled platforms is `Enable` per Phase 04.

The docs treat this as a product rule, not just an implementation detail.

### Packaged Smoke Path

The packaged macOS smoke should prove:

1. the app locates bundled Apple Calendar assets
2. the app locates bridge runtime assets outside `asar`
3. the bridge starts successfully
4. Calendar permission bootstrap can complete
5. the plugin starts
6. one Apple Calendar tool call succeeds

The automation boundary for this phase is intentionally hybrid:

- keep artifact layout and signing verification scripted
- keep runtime degradation and restart semantics covered by Electron tests
- keep the final packaged app flow explicit as a manual smoke checklist until a future rollout adds full packaged GUI automation

### Restart Persistence

Restart expectations should include:

- enabled state persists across app restart
- readiness state is recomputed correctly after restart
- prior permission grant does not require unnecessary re-bootstrap
- bridge and plugin processes shut down cleanly and do not orphan

### Degraded Behavior

Explicit degraded scenarios and the readiness state each maps to:

- non-macOS build: extension hidden; no readiness state displayed
- macOS below minimum: extension hidden; readiness `platform_unsupported` only on config migration
- missing bridge binary in packaged resources: readiness `bridge_unavailable`, recovery is a reinstall of the app (user-visible copy says so)
- corrupted bridge path (permissions, partial download, etc.): readiness `bridge_unavailable`
- bridge repeatedly crashes within the rolling window: readiness `bridge_crash_loop`
- Calendar permission denied or revoked in System Settings: readiness `permission_required`

The rest of the extension catalog and app runtime must continue to function even
when Apple Calendar is degraded.

### Observability Surface

The bridge and the MCP child are two cooperating processes. Without a shared
observability surface, failures present as "the extension is broken" with no
clue which process failed.

Locked minimums:

- Both processes stream stderr into the existing plugin lifecycle event bus, tagged with a `source` discriminator (`bridge` or `mcp`) and `pluginId`.
- Every `ExtensionRuntimeReadiness` transition emits a readiness event on the same bus, with the previous state, the new state, and the retry class if triggered by retry.
- Dev-mode exposes the raw event stream through the existing plugin dev console; packaged builds expose a rolling in-memory buffer retrievable via `PLUGIN_GET_RUNTIME_LOGS` for bug reports.
- Structured log fields at minimum: `pluginId`, `source`, `readiness`, `lifecycleStatus`, `retryClass` (nullable), `correlationId` (for retries and tool calls).
- No telemetry leaves the machine by default. This phase does not define a remote telemetry sink.

Anti-requirements (explicitly out of scope for this phase):

- sending logs to a remote service
- per-user analytics on readiness transitions
- user-visible debug console in the packaged app (beyond the bug-report buffer)

### Primary Directories

- `packages/electron/`
- `packages/electron/src/main.ts`
- `packages/electron/src/plugins/`
- `packages/extensions/apple-calendar-mcp/`

### Verification Gates

- Unit:
  - platform-gating helpers (Apple Calendar not present in the registry on non-macOS builds)
  - packaged path resolution helpers
  - crash-loop detection helpers
  - observability event shape tests (structured log fields present, `source` discriminator populated)
  - runtime log buffer filter and limit behavior
- Integration:
  - packaged-path smoke for bundled Apple Calendar
  - readiness transitions emit events on the lifecycle event bus during a controlled bridge crash
  - enabled Apple Calendar readiness is recomputed when the runtime is recreated from persisted plugin prefs
- Manual smoke:
  - build the app on macOS
  - Enable Apple Calendar
  - grant permission
  - call one tool
  - restart the app
  - call one tool again
  - on a Linux or Windows build, confirm Apple Calendar is not visible at all
- Failure path:
  - missing or corrupted bridge path degrades cleanly to `bridge_unavailable` without destabilizing the rest of the app
  - revoking Calendar permission in System Settings while the app is running transitions readiness to `permission_required` within the readiness subscription

### Evidence To Capture

- packaged build spawn log
- one successful restart persistence example
- one clean degraded-state example on missing bridge runtime

## End

### Done When

- packaged macOS behavior for Apple Calendar is clearly specified and stable enough to ship
- the hardening bar for bridge-dependent curated extensions is documented for reuse

### Handoff To Next Phase

Phase 06 should extract the reusable curated-extension template and decision
checklist from the Apple Calendar canary work.

### Risks To Carry Forward

- if macOS-only gating is left implicit, unsupported builds will present broken install choices
- if bridge crash-loop handling is weak, Apple Calendar instability will look like general app instability

### First Recommended Next Step

Start [Phase 06 - Curated Extension Template And Next Plugins](phase-06-curated-extension-template-and-next-plugins.md).
