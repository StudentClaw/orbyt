# Phase 02 - Credential Startup Boundary

Last updated: 2026-05-05

## Orientation Note

- Target feature: provide Notion's token to the official CLI before spawn.
- Key dependencies: `PluginAuthService`, `PluginManager`, `PluginRuntime`, `PluginVault`.
- Constraints and boundaries: keep Settings generic, only Notion receives pre-spawn `NOTION_TOKEN`, unconfigured manual-token plugins should not fail during boot auto-start.
- Acceptance criteria: saved Notion credentials become process env, unconfigured Notion is skipped by auto-start, manual start without credentials returns a clear error state.

## Beginning

### Objective

Bridge the official CLI's startup-token requirement without weakening Orbyt's credential boundary.

### Current State

Manual-token plugins currently receive credentials after MCP startup. That is too late for the official Notion CLI.

### Out Of Scope

- renderer-side credential handling changes
- server-side Notion credential access
- passing all plugin credentials through env by default

## Middle

### TDD Cycle

1. RED: runtime preparation test expects `NOTION_TOKEN` in env when credentials are configured.
2. GREEN: add a narrow Notion preparation helper.
3. RED: auto-start test expects unconfigured manual-token plugins to be skipped.
4. GREEN: add `shouldAutoStart` hook to `PluginManager`.
5. RED: manual start test expects missing Notion credentials to set an error readiness.
6. GREEN: return recoverable preparation failure before sandbox spawn.

### Verification Gate

- Unit: targeted Electron plugin auth/runtime tests
- Integration: plugin manager auto-start path
- Manual smoke: Settings shows Notion as not configured until token is saved
- Failure path: missing token does not crash the plugin process

## End

### Done When

Notion can be started only when the vault has a valid token, and no boot-time error is produced for an unconfigured fresh install.
