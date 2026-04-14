# Phase 02 - Local Spawn And Lifecycle

Last updated: 2026-04-11

## Orientation Note

- Target feature: spawn one local MCP server, initialize it, call one tool, stop it cleanly, and recover from failure
- Key dependencies: Phase 01 registry, `packages/extensions/template-mcp`, Electron Main process management
- Constraints and boundaries:
  - do not use Canvas yet
  - do not involve Codex yet
  - do not depend on secrets yet
- Acceptance criteria for this increment:
  - one local MCP can be spawned on demand
  - initialize and `tools/list` succeed
  - one simple tool call succeeds
  - idle stop and failure recovery work

## Beginning

### Objective

Prove the core runtime lifecycle in isolation before introducing routing, auth, or packaged runtime concerns.

### Current State

- `template-mcp` exists as a placeholder and should become the lifecycle canary.
- No plugin manager or spawn wrapper exists in Electron Main yet.

### Out Of Scope

- gateway aggregation
- server/Main tool routing
- credential delivery
- install and uninstall flows

### Acceptance Criteria

- `PluginManager` can start and stop `template-mcp`.
- MCP initialize succeeds.
- `tools/list` succeeds.
- One `tools/call` succeeds.
- A forced crash transitions to `error` and can be retried.

## Middle

### Implementation Slices

1. Upgrade `template-mcp` into a minimal but real MCP server with one safe deterministic tool.
2. Add `PluginManager` and `PluginSandbox` in Electron Main.
3. Use the MCP TypeScript SDK client transport to connect over stdio.
4. Track lifecycle state transitions in registry state.
5. Add a short idle timeout for stop behavior.
6. Add a retry path with bounded backoff.

### Primary Directories

- `packages/extensions/template-mcp/`
- `packages/electron/src/plugins/`
- `packages/electron/src/__tests__/`

### Verification Gates

- Unit:
  - lifecycle state machine tests for `starting -> ready -> stopping -> stopped`
- Integration:
  - spawn template server, list tools, call one tool, stop server
- Manual smoke:
  - click start in Settings or a dev action and see live status changes
- Failure path:
  - kill the child process and verify status moves to `error` with retry available

### Evidence To Capture

- logs of a successful initialize and tool call
- logs of a forced crash and retry
- one integration test exercising the full local lifecycle

## End

### Done When

- the local lifecycle works end to end for `template-mcp`
- the app can recover from a dead plugin process without restart

### Handoff To Next Phase

Phase 03 should treat the template tool as the first gateway-exposed tool and should not introduce Canvas until the routed path is proven.

### Risks To Carry Forward

- if lifecycle state updates are not atomic, UI and routing will disagree
- if stderr and protocol output are not separated cleanly, debugging later phases will be painful

### First Recommended Next Step

Start [Phase 03 - Gateway And Codex Integration](phase-03-gateway-and-codex-integration.md).
