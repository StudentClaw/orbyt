# Phase 04 - Runtime Readiness And Settings UX

Last updated: 2026-04-20

## Orientation Note

- Target feature: define the app-facing management surface for Apple Calendar and other curated extensions that depend on local readiness rather than vault-backed auth
- Key dependencies: Phase 02 bridge lifecycle decisions, Phase 03 bundled-catalog packaging seam, current Settings and Connections surfaces, existing plugin IPC and lifecycle surfaces
- Constraints and boundaries:
  - do not overload credential-auth UX to represent local OS readiness
  - keep Apple Calendar within the current plugin management surface
  - add readiness information without obscuring plugin lifecycle state
- Acceptance criteria for this increment:
  - Apple Calendar readiness is a first-class UI surface distinct from lifecycle and auth
  - readiness-specific IPC and retry behavior are implemented and documented
  - enable or disable behavior with bridge ownership is defined and verified
  - Apple Calendar is implemented as no-auth by default without regressing manual-token extensions

## Beginning

### Objective

Define how the app should present and control a bundled curated extension that
does not need secrets but does need local helper runtime and OS permission
readiness.

### Current State

- Settings already lists extensions and supports start, stop, retry, enable, disable, and auth-form rendering for credentialed plugins.
- Phase 02 added readiness-aware registry state and Electron-owned bridge lifecycle for Apple Calendar.
- Phase 03 established the packaged runtime shape so readiness UX can stay consistent between dev and packaged paths.
- Apple Calendar still needs a first-class app-facing readiness model based on bridge health and Calendar permission state rather than vault-backed auth.

### Out Of Scope

- packaged-runtime hardening
- generic install flow redesign
- remote catalog UX

### Acceptance Criteria

- Apple Calendar Settings states and copy are implemented and documented clearly, keyed to the locked `ExtensionRuntimeReadiness` values.
- The Settings auth-form suppression contract is explicit and covered for `auth.type === "none"` while `manual_token` credential forms remain unchanged.
- The plugin IPC surface exposes readiness as a dedicated event stream plus a permission-settings action.
- Apple Calendar is explicitly modeled as no credential auth by default.
- Enable and disable behavior is explicit when the bridge is running.
- The UI verb is `Enable` / `Disable`. Bundled extensions have no separate install step; `Install` is reserved for user-installed third-party MCPs handled by the predecessor rollout.

## Middle

### Implementation Slices

1. Define user-visible Apple Calendar states and copy.
2. Implement readiness-aware management behavior in Settings.
3. Implement the concrete status and IPC additions needed to support those states.
4. Implement enable or disable and retry interactions with bridge ownership.

### Default UX Model

Apple Calendar has `manifest.auth.type === "none"`. The Settings UI must not
render the credential form for extensions whose auth type is `none`. Instead
it renders a readiness panel driven by `ExtensionRuntimeReadiness`.

State is derived from:

- `enabled` (`PluginEnabledStore`)
- `ExtensionLifecycleStatus`
- `ExtensionRuntimeReadiness`
- underlying bridge health and Calendar permission status (source data for readiness, not displayed raw)

### Settings Auth-Form Suppression Contract

- When `manifest.auth.type === "none"`, the Settings UI must not render `ExtensionAuthManualTokenSchema` fields.
- The space that would have held the credential form renders the readiness panel.
- The readiness panel surfaces the current `ExtensionRuntimeReadiness` value, an explanation, lifecycle context, and a recovery action when applicable.
- This contract is generic. Any future curated extension with `auth.type === "none"` and a bridge gets the same treatment without per-extension UI code.

### User-Facing Status Model

UI copy is keyed to the locked `ExtensionRuntimeReadiness` vocabulary. The
mapping for Apple Calendar is:

| Readiness | enabled | UI label | Body copy gist | Recovery action |
| --- | --- | --- | --- | --- |
| n/a | false | `Disabled` | Apple Calendar is off. Enable it to use Calendar tools. | `Enable` |
| `bridge_starting` | true | `Starting` | Orbyt is starting the Calendar bridge. | none (progress) |
| `bridge_unavailable` | true | `Bridge unavailable` | The Calendar bridge didn't start. You can retry. | `Retry bridge` |
| `permission_required` | true | `Permission required` | Grant Calendar access in macOS System Settings so Orbyt can use Apple Calendar. | `Grant Calendar access` |
| `bridge_crash_loop` | true | `Bridge keeps crashing` | The Calendar bridge has repeatedly failed to start. Retry is rate-limited. | `Retry bridge` (backoff) |
| `ready` | true | `Ready` | Apple Calendar tools are available. | `Disable` |
| `error` | true | `Error` | Typed error message plus `Retry`. | `Retry` |
| `platform_unsupported` | n/a | (hidden) | Apple Calendar is hidden on non-macOS builds and below minimum macOS. Only reachable via config migration. | none |

Copy themes across all labels:

- Apple Calendar is a local macOS integration
- Orbyt manages the bridge automatically
- the user may need to grant Calendar access in macOS

The verb for making a bundled extension usable is `Enable`. The word `Install`
does not appear in Settings for bundled extensions.

### IPC Additions

Concrete additions, as implemented:

- existing `PLUGIN_LIST` and `PLUGIN_GET_STATUS` remain the read model for current `ExtensionRuntimeReadiness`
- `PLUGIN_READINESS` is a dedicated event stream emitted whenever readiness transitions, keyed by `pluginId`
- `PLUGIN_RETRY` now accepts a typed retry class from the Phase 04 taxonomy:
  - `retry_bridge_start`
  - `retry_permission`
  - `retry_plugin_start`
- invalid retry classes fail with `invalid_retry_class`
- `PLUGIN_REVEAL_PERMISSION_SETTINGS` deep-links to the macOS Calendar permission pane for Apple Calendar and returns typed failure reasons when unsupported

IPC extends the existing plugin IPC surface in `packages/electron/src/ipc/`.
It does not introduce a second plugin system or a redundant readiness-read API.

### Settings Surface

The default detail surface for any bundled extension with `auth.type === "none"`
is now the readiness card, not the credential form. The implementation keeps:

- the row-level lifecycle badge visible
- Apple Calendar readiness copy derived from a shared mapping function keyed by `ExtensionRuntimeReadiness`
- live row and card updates driven by `PLUGIN_READINESS` without requiring a full `PLUGIN_GET_STATUS` refresh
- Canvas and other `manual_token` extensions on the existing credential-form path

### Enable And Disable Behavior

- `Enable` triggers:
  - ask `AppleCalendarBridgeManager` to start or attach to the bridge
  - wait on readiness
  - when readiness is `ready`, `PluginManager` spawns the MCP child with the env passthrough contract from Phase 02
- `Disable` triggers:
  - stop the MCP child
  - stop the bridge if no other enabled extension depends on it
- `Retry bridge`:
  - routes through `PLUGIN_RETRY` with `retry_bridge_start`
  - forces runtime cleanup, then re-runs bridge-first preparation before plugin spawn
- `Grant Calendar access`:
  - routes through `PLUGIN_REVEAL_PERMISSION_SETTINGS` or `PLUGIN_RETRY` with `retry_permission`
  - opens System Settings instead of blindly restarting the plugin
- `Retry`:
  - routes through `PLUGIN_RETRY` with `retry_plugin_start`
  - retries the MCP child only after readiness is already in a startable state

There is no `Install` or `Uninstall` affordance for Apple Calendar. The
extension is always present in the registry on macOS builds; the user
controls whether it is enabled.

### Primary Directories

- `packages/ui/src/components/settings/ConnectionsSection.tsx`
- `packages/electron/src/plugins/`
- `packages/electron/src/ipc/`
- `packages/electron/src/main.ts`
- `packages/contracts/src/protocol/ipc-channels.ts`

### Verification Gates

- Unit:
  - readiness-state mapping tests covering the shipped `ExtensionRuntimeReadiness` values
  - Settings status-label derivation tests for `auth.type === "none"` and for `auth.type === "manual_token"` (ensures the suppression contract is implemented generically)
  - auth-form suppression test: when `auth.type === "none"` the credential form does not mount
- Integration:
  - Apple Calendar readiness changes propagate into the management surface through `PLUGIN_READINESS`
  - a retry request with an invalid retry class fails cleanly rather than invoking a default code path
  - permission retry routes through the System Settings reveal path instead of blindly restarting the plugin
- Manual smoke:
  - user can Enable Apple Calendar, grant permission, and see the status change to `Ready`
  - the word `Install` does not appear for Apple Calendar anywhere in Settings
- Failure path:
  - denied permission or bridge-unavailable state surfaces the typed recovery action in the table above, not generic plugin failure copy
  - an extension with `auth.type === "manual_token"` still renders the credential form (regression guard for the suppression contract)

### Evidence To Capture

- Settings test evidence for readiness states and live updates
- one lifecycle-plus-readiness status example
- one recovery-path example

## End

### Done When

- Apple Calendar’s runtime-readiness model is explicit in the management UX and the implementation
- current plugin surfaces support no-auth curated extensions without inventing ad hoc local-permission UX later

### Handoff To Next Phase

Phase 03b still owns signed and notarized packaging verification. Phase 05
should verify the packaged macOS runtime behavior and hardening work required
to make Apple Calendar shippable after the signed build path is proven.

### Risks To Carry Forward

- if Apple Calendar is forced into the credential-auth UX, the resulting product model will be misleading and hard to generalize
- if readiness and lifecycle are collapsed together, recovery actions will be confusing to users

### First Recommended Next Step

Continue [Phase 03b - macOS Packaging And Signing](phase-03b-macos-packaging-and-signing.md) until signed/notarized verification is captured, then start [Phase 05 - Packaged Runtime And Hardening](phase-05-packaged-runtime-and-hardening.md).
