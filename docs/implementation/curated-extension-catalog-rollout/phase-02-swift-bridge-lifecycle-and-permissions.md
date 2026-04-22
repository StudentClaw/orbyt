# Phase 02 - Swift Bridge Lifecycle And Permissions

Last updated: 2026-04-18

## Orientation Note

- Target feature: define how Electron Main owns the Apple Calendar Swift bridge end to end
- Key dependencies: Phase 01 vendored package shape, existing Electron Main plugin lifecycle ownership, macOS EventKit permission model
- Constraints and boundaries:
  - the MCP plugin must not spawn the bridge itself
  - bridge ownership should feel first-party and seamless to the user
  - readiness must cover more than plugin start and stop state
- Acceptance criteria for this increment:
  - a dedicated bridge-manager ownership model is fixed
  - the bridge bind, port allocation, and auth contract are explicit
  - the env passthrough contract between bridge manager and MCP child is explicit
  - health check, retry, and failure behavior are explicit across a typed retry taxonomy
  - permission bootstrap is described clearly
  - user-facing readiness states are named, locked to the shared contract, and stable

## Beginning

### Objective

Define a first-party bridge lifecycle model so Apple Calendar can rely on local
OS access without asking users to install or run a separate bridge manually.

### Current State

- The external Apple Calendar package expects a Swift bridge on localhost.
- Student Claw’s plugin runtime currently owns MCP extension lifecycles, but not separate helper runtimes.
- The existing Settings UI understands lifecycle and auth states, but not bridge-readiness states.

### Out Of Scope

- packaged build configuration details
- broader Settings UI implementation details
- remote credential or OAuth behavior

### Acceptance Criteria

- Electron Main owns a dedicated `AppleCalendarBridgeManager`.
- The MCP plugin does not spawn or supervise the bridge directly.
- Bridge bind behavior and port allocation are explicit (loopback-only, ephemeral).
- Bridge auth is explicit (per-session shared secret).
- Env passthrough between bridge manager and MCP child is explicit and backed by a contract extension.
- Bridge health check behavior is explicit.
- Retry and failure behavior are explicit and typed per retry class.
- Permission bootstrap behavior is explicit and distinguishes "bridge up" from "bridge permitted."
- User-facing readiness states match the locked `ExtensionRuntimeReadiness` contract.

## Middle

### Implementation Slices

1. Extend `packages/contracts/src/schemas/extension.ts` with:
   - `ExtensionRuntimeReadiness` union matching the locked vocabulary in the GLOSSARY
   - optional `env: Record<string, string>` on `ExtensionTransport` for runtime-injected values (not manifest-declared)
2. Define a bridge-manager ownership model in Electron Main.
3. Define the bridge build and runtime output locations for dev and packaged app.
4. Define the bridge bind, port allocation, and auth contract.
5. Define the env passthrough contract between bridge manager and MCP child.
6. Define startup ordering between bridge and MCP plugin using three distinct readiness predicates.
7. Define typed retries and degraded behavior per retry class.
8. Define macOS Calendar permission bootstrap and recovery actions.

### Bridge Ownership Model

Electron Main should own a dedicated `AppleCalendarBridgeManager` responsible for:

- locating the bridge executable or dev build target
- starting the bridge process
- polling or checking bridge health
- stopping the bridge on plugin disable, app shutdown, or fatal runtime failure
- reporting bridge status into Apple Calendar readiness state

The MCP plugin should assume the bridge exists and is reachable. It may report
bridge call failures, but it should not launch or manage the bridge itself.

### Bridge Bind, Port, And Auth Contract

Locked defaults (inherited from the GLOSSARY `Bridge Transport Policy`):

- the bridge binds to `127.0.0.1` only; binding on `0.0.0.0` or any non-loopback interface is a bug
- the bridge binds to an ephemeral port (bind to `127.0.0.1:0`, read back the OS-assigned port); a hard-coded port like `8080` is not acceptable
- at start time the bridge manager generates a per-session shared secret (cryptographically random, ≥128 bits) and passes it to the bridge process
- the bridge requires the shared secret on every inbound request (for example an `Authorization: Bearer <secret>` header) and rejects unauthenticated requests
- a UNIX domain socket in the user's app-support directory is an acceptable alternative to HTTP + token and satisfies both the loopback-only and auth requirements

The `MAC_API_BRIDGE_PORT`-style env name is retained upstream but the value is
chosen at runtime by the bridge manager, not hard-coded.

### Env Passthrough Contract

The MCP child and the bridge are two cooperating processes owned by two
different things: the MCP plugin is owned by `PluginManager`, the bridge is
owned by `AppleCalendarBridgeManager`. They discover each other through env.

Contract:

- `ExtensionTransport` gains an optional `env: Record<string, string>` in `packages/contracts/src/schemas/extension.ts`.
- The manifest never declares `env`. It is populated at spawn time only.
- Before `PluginManager` spawns a curated MCP that depends on a bridge, the extension's bridge manager is asked to produce a `Record<string, string>` of runtime env values. Those values are merged into the spawn env on top of the existing inherited `process.env`.
- For Apple Calendar the injected values are:
  - `MAC_API_BRIDGE_URL` (for example `http://127.0.0.1:53412` or a `unix:///path/to/socket.sock` form)
  - `MAC_API_BRIDGE_TOKEN` (per-session shared secret)
- The bridge manager is the single source of truth for these values. The MCP plugin reads them from `process.env` only.

### Startup Ordering

Startup uses three distinct readiness predicates that must not be collapsed
into a single `/health` check:

- `bridge_process_up`: the bridge child process has been spawned and has not exited
- `bridge_reachable`: an authenticated request to the bridge returns within timeout
- `bridge_permitted`: the bridge can actually access Calendar data (EventKit returned an authorized status for at least one probe)

Default startup order:

1. User enables Apple Calendar.
2. Electron Main asks `AppleCalendarBridgeManager` to ensure the bridge is running.
3. The bridge manager performs in order: start process, allocate port, generate token, wait on `bridge_reachable`, probe `bridge_permitted`.
4. Readiness is computed from the three predicates:
   - all three true: `ready`
   - process up but reachability failing: `bridge_unavailable`
   - reachable but permission probe fails: `permission_required`
   - process repeatedly exits: `bridge_crash_loop`
5. Only when readiness is `ready` does `PluginManager` spawn the MCP child with the env contract above.
6. The plugin lifecycle event bus emits both `status` transitions (unchanged) and a separate readiness event keyed by `ExtensionRuntimeReadiness`.

If the bridge cannot be started or is unhealthy, Apple Calendar remains
enabled but not `ready`, and its readiness state is surfaced to Settings.

### Health Check Contract

The health source of truth is an authenticated `GET /health` on the bridge, or
the equivalent probe over a UNIX domain socket. The bridge manager treats
health as failed when:

- the process cannot start
- the endpoint does not respond within timeout
- the endpoint responds but returns an unhealthy body
- the authenticated probe is rejected (this means the shared secret is wrong and is a bug in the bridge manager, not a user-facing failure)
- the bridge exits unexpectedly

Permission state is probed separately from health. Successful `/health` does
not imply `bridge_permitted`.

### Retry Taxonomy

Retries are typed. The UI displays different copy and different recovery verbs
per class, and telemetry records the class for debugging.

- `retry_bridge_start`: the bridge process never came up or exited during startup; bounded attempts with backoff, then `bridge_unavailable` or `bridge_crash_loop`
- `retry_bridge_reachable`: the bridge is up but not yet answering; short bounded polling, then `bridge_unavailable`
- `retry_permission`: the user previously denied Calendar access; manual retry only, requires a user action, surfaces `permission_required`
- `retry_mcp_spawn`: the bridge is ready but the MCP child failed to start; bounded retries through `PluginManager`, then `error`
- `retry_tool_call`: a specific tool call failed transiently; the caller decides whether to retry; the extension does not enter `bridge_unavailable` for a single call failure

Crash-loop handling:

- track process exits within a rolling window
- if exits exceed a threshold, stop auto-restarting and transition to `bridge_crash_loop`
- recovery from `bridge_crash_loop` requires an explicit user retry or app restart

### Permission Bootstrap

Student Claw should own the first-run Calendar permission flow. The bridge
manager is responsible for invoking a permission bootstrap path before treating
the bridge as ready.

The docs should assume:

- permission can be requested on first enable or first start
- denial is recoverable and surfaced to the user
- Settings should explain how to reopen or recover Calendar permission if macOS denies access

### User-Facing States

User-facing states are derived from the locked `ExtensionRuntimeReadiness`
contract plus `enabled` and `ExtensionLifecycleStatus`. The UI mapping for
Apple Calendar is:

- `Not available on this platform`: non-macOS build. In practice Apple Calendar is hidden entirely on non-macOS (see Phase 05); `platform_unsupported` is only reached via config migration.
- `Disabled`: registry shows the extension, `enabled === false`.
- `Starting bridge`: `enabled === true`, readiness `bridge_starting`.
- `Bridge unavailable`: readiness `bridge_unavailable`; recovery verb `Retry bridge`.
- `Permission required`: readiness `permission_required`; recovery verb `Grant Calendar access` with guidance that points at macOS System Settings.
- `Bridge keeps crashing`: readiness `bridge_crash_loop`; recovery verb `Retry bridge` but rate-limited.
- `Ready`: readiness `ready` and `status` is `ready` or `active`.
- `Error`: readiness `error`; recovery verb `Retry` plus a typed error message.

Readiness is additive to plugin lifecycle. It must not be flattened into
simple start or stop status.

### Primary Directories

- `packages/contracts/src/schemas/extension.ts` (for `ExtensionRuntimeReadiness` and optional `ExtensionTransport.env`)
- `packages/electron/src/plugins/`
- `packages/electron/src/main.ts`
- `packages/extensions/apple-calendar-mcp/bridge/`

### Verification Gates

- Unit:
  - bridge-health helper tests (process-up, reachable, permitted as three distinct predicates)
  - readiness derivation tests covering every `ExtensionRuntimeReadiness` value
  - retry-policy tests per retry class
  - env passthrough tests that assert the MCP child sees `MAC_API_BRIDGE_URL` and `MAC_API_BRIDGE_TOKEN` and that the manifest never declares them
  - unauthenticated request to the bridge is rejected
- Integration:
  - plugin spawn succeeds when the bridge is healthy and the env contract is populated
  - plugin spawn is withheld when readiness is not `ready`
- Manual smoke:
  - first-run permission prompt on macOS is triggered from the Student Claw-owned flow
  - denying permission produces `permission_required` in Settings, not a generic plugin error
- Failure path:
  - denied permission or bridge crash results in a typed degraded readiness state instead of a hang
  - port collision is impossible because the bridge uses ephemeral ports; a test verifies two bridges can run without configuration

### Evidence To Capture

- bridge startup log
- health-check success and failure examples
- one permission-required UI state example

## End

### Done When

- the Apple Calendar bridge lifecycle is fully owned by Electron Main in the design
- readiness and permission behavior are explicit enough for implementation without ad hoc runtime decisions

### Handoff To Next Phase

Phase 03 should translate bridge ownership and vendored package shape into the
repo build and packaging rules needed to ship Apple Calendar in the bundled
catalog.

### Risks To Carry Forward

- if the plugin is allowed to own bridge process management, Student Claw will lose central lifecycle and observability control
- if readiness is not modeled separately from lifecycle, Apple Calendar failures will look like random plugin crashes

### First Recommended Next Step

Start [Phase 03 - Bundled Catalog And Build Integration](phase-03-bundled-catalog-and-build-integration.md).
