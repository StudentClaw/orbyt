# Phase 04 Credentials And Auth UX Design

Date: 2026-04-11
Owner: Codex
Status: Drafted for review
Related docs:
- `docs/implementation/mcp-plugin-system/phase-04-credentials-and-auth-ux.md`
- `docs/implementation/mcp-plugin-system/GLOSSARY.md`

## Goal

Land the first real credential pipeline for the MCP plugin system without expanding into full install management or real Canvas API validation. The slice should make Canvas credentials storable, recoverable, encrypted at rest, and deliverable only to the owning plugin runtime.

## Scope

In scope:
- Render Canvas auth controls in Settings
- Save Canvas credentials through Electron Main
- Encrypt credentials at rest using an Electron-owned vault service
- Deliver saved credentials to `canvas-mcp` through a post-start scoped handshake
- Surface auth state and recoverable save/startup failures in Settings

Out of scope:
- Onboarding auth integration
- Generic auth rendering for arbitrary plugin shapes
- Real Canvas network validation or readiness probes
- Install, uninstall, enable, or disable product UX
- Hot credential rotation into an already-running plugin

## Product Decision

Phase 04 ships a Settings-first, Canvas-first auth flow.

We will not build a fully generic auth form system in this phase. Instead, we will keep the manifest auth contract narrowly structured around the needs we already know:
- Canvas base URL
- Canvas token
- Existing manual instructions text

This keeps the storage and runtime handshake real while avoiding bespoke Settings code that would be hard to reuse in Phase 06.

## Current State

- `canvas-mcp` already declares `auth.type = "manual_token"` and expects `CANVAS_TOKEN` and `CANVAS_BASE_URL` in its manifest metadata.
- `canvas-mcp` runtime already listens for a scoped `plugin.credentials` process message and stores credentials in memory.
- Settings already renders extension registry rows and lifecycle actions but has no auth UI.
- Onboarding includes a Canvas-specific validation step, but that flow is local-only and does not persist secure credentials.

## Proposed Architecture

### 1. Narrow auth contract upgrade

Extend the existing `manual_token` auth schema to describe a small set of Canvas-oriented fields instead of only `requiredKeys`.

Phase 04 field support:
- `base_url`
- `secret`
- `text`

The Canvas manifest will declare two fields:
- `baseUrl` as `base_url`
- `token` as `secret`

Each field should include enough metadata for Settings rendering:
- stable field key
- label
- optional placeholder
- required flag

We are intentionally not introducing a broad future-proof form DSL yet.

### 2. Electron-owned vault service

Add a vault service under `packages/electron/src/plugins/` that:
- accepts one credential record per plugin ID
- serializes the payload to JSON
- encrypts it with `safeStorage`
- persists the encrypted payload to disk inside Electron-owned runtime data
- can read, decrypt, update, and delete a plugin credential record

The vault is the only place where decrypted plugin credentials exist at rest outside the plugin process boundary.

### 3. Settings auth surface

Settings becomes the first product surface for plugin auth.

For available registry entries:
- if `auth.type === "none"`, show no auth controls
- if `auth.type === "manual_token"`, show an auth card beneath or within the extension row details

The Canvas auth card will render:
- instructions from the manifest
- one base URL input
- one token input with secret masking
- save action
- current auth status summary

The renderer never reads secrets back after save. If status must be shown, it should be derived from metadata returned by Main rather than by exposing stored values.

### 4. Scoped runtime handshake

`PluginManager` remains the owner of runtime startup.

After a plugin sandbox starts successfully:
1. Main checks whether the plugin has saved credentials.
2. If no credentials exist, startup succeeds without a credential message.
3. If credentials exist, Main sends one `plugin.credentials` message only to that plugin process.
4. The plugin stores those credentials in memory for tool execution.

The credential handshake is post-start and plugin-scoped. No shared environment variables, global process mutation, or shared logs should carry secret values.

## Data Flow

### Save flow

1. User opens Settings.
2. Settings reads registry entries and auth metadata.
3. User enters Canvas base URL and token.
4. Renderer submits a typed save request over IPC.
5. Electron Main validates the payload shape.
6. Vault encrypts and stores the plugin-scoped credential record.
7. Main returns auth status metadata only, such as `configured` or `error`.

### Startup flow

1. User starts `canvas-mcp` or retries it after saving credentials.
2. `PluginManager` starts the sandbox normally.
3. Main reads saved credentials for `canvas-mcp` from the vault.
4. Main sends one scoped `plugin.credentials` message to the Canvas child process.
5. `canvas-mcp` stores the payload in `CanvasCredentialStore`.
6. Subsequent tool calls use the in-memory credentials.

### Missing-auth flow

1. User starts `canvas-mcp` with no saved credentials.
2. Startup still succeeds.
3. No credential message is sent.
4. Canvas tools continue to return the current auth-required style error until credentials are saved.
5. User can save credentials in Settings and retry the plugin.

## State Model

Phase 04 should distinguish between lifecycle status and auth status.

Lifecycle remains owned by the existing registry/runtime overlay.

Auth status for Settings should be a narrow metadata shape:
- `not_configured`
- `configured`
- `error`

Optional error metadata may include:
- save failure reason
- decrypt failure reason
- validation failure reason

This state is for UI clarity only. It does not claim that the credentials are valid against the live Canvas API.

## Validation Rules

Phase 04 uses local validation only.

Canvas base URL:
- required
- must be `https://`
- should match a Canvas-hosted URL shape

Canvas token:
- required
- must be non-empty
- minimum length guard is acceptable for UX feedback

Vault records:
- must be keyed by plugin ID
- must reject malformed payloads before encryption

We will not make live network calls to Canvas in this phase.

## Error Handling And Recovery

### UI validation failure

If the user submits malformed input:
- reject in the renderer before save when possible
- surface field-level guidance
- do not mutate stored credentials

### Vault save failure

If encryption or disk persistence fails:
- return a typed save error to the renderer
- keep any prior stored record intact
- show a recoverable error message in Settings

### Missing credentials

Missing credentials must not poison plugin lifecycle:
- the plugin can still start
- tool calls fail with the plugin's existing auth-required behavior
- the user can recover by saving credentials and retrying

### Bad stored credentials

If the stored record is malformed or cannot be decrypted:
- Main reports auth status as `error`
- startup should skip credential delivery instead of crashing the app
- the user can overwrite the record from Settings

## Security Constraints

- Secrets must be encrypted at rest through Electron `safeStorage`
- Secrets must never be injected through global environment variables
- Secrets must never be included in logs, lifecycle events, or renderer-readable status payloads
- Credential delivery must be scoped to the owning plugin process only
- The renderer should know whether credentials exist, not what their values are

## Implementation Slices

1. Extend the manifest auth contract for Canvas-first field metadata.
2. Add a vault service and typed credential record schema in Electron Main.
3. Add IPC handlers for:
   - read auth status
   - save plugin credentials
   - clear or replace plugin credentials if needed
4. Add Settings auth rendering for `manual_token` plugins.
5. Wire `PluginManager` to perform post-start credential delivery for plugins with stored auth.
6. Add tests for vault round-trip, Settings rendering, and startup handshake behavior.

## Primary Files And Directories

- `packages/contracts/src/schemas/extension.ts`
- `packages/contracts/src/protocol/`
- `packages/electron/src/plugins/`
- `packages/electron/src/ipc/bridge.ts`
- `packages/ui/src/pages/SettingsPage.tsx`
- `packages/ui/src/__tests__/SettingsPage.test.tsx`
- `packages/extensions/canvas-mcp/src/manifest.ts`
- `packages/extensions/canvas-mcp/src/index.ts`

## Verification Plan

Unit:
- vault encrypt/decrypt round-trip for one Canvas credential record
- auth metadata parsing test for the Canvas manifest
- Settings auth field rendering test

Integration:
- start `canvas-mcp` with stored credentials and verify the runtime receives the scoped credential message

Manual smoke:
- save Canvas credentials in Settings
- restart the app or plugin runtime
- verify auth status persists and the plugin can consume the saved credentials after retry/start

Failure path:
- save malformed credentials and verify rejection without corrupting prior state
- simulate unreadable or invalid stored credentials and verify recoverable auth error state

## Open Questions Deferred Out Of This Phase

- Whether onboarding should reuse the same Settings auth component
- Whether plugins should support live credential refresh without restart
- How generic the auth field system should become for non-Canvas integrations
- When live Canvas validation should become part of save or readiness flows

## Done When

- Canvas auth controls render in Settings from manifest metadata
- Canvas credentials are encrypted at rest in Electron Main
- `canvas-mcp` receives credentials only through a scoped post-start handshake
- Missing or bad credentials are recoverable without breaking plugin lifecycle
- Automated tests cover vault round-trip, UI rendering, and handshake delivery
