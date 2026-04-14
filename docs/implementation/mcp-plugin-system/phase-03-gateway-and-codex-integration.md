# Phase 03 - Gateway And Codex Integration

Last updated: 2026-04-11

## Orientation Note

- Target feature: expose installed extension tools through one Student Claw-owned MCP gateway and route one fake tool call through the full stack
- Key dependencies: Phase 02 local lifecycle, current Codex CLI runtime, Electron/Main <-> server boundary
- Constraints and boundaries:
  - do not add real service credentials yet
  - do not add install UX yet
  - use fake or template tools only
- Acceptance criteria for this increment:
  - one built-in Student Claw MCP gateway exists
  - tool inventory changes reach the server and gateway
  - one fake tool can be called end to end through the routing path

## Beginning

### Objective

Prove that Codex-facing tool routing can work through a stable local gateway instead of wiring Codex directly to each installed extension.

### Current State

- The Codex CLI bridge exists, but there is no plugin gateway or tool router yet.
- Local server and Electron Main already have a clean ownership split in architecture docs, but the bridge is not implemented.

### Out Of Scope

- Canvas API calls
- vault-backed credentials
- install and uninstall UX

### Acceptance Criteria

- Main owns a Student Claw MCP gateway surface.
- The server can read tool inventory from Main.
- Tool inventory updates are pushed after plugin start and stop.
- One fake tool call can route:
  - Codex or tool layer
  - server
  - Electron Main
  - template plugin
  - result back up the same chain

## Middle

### Implementation Slices

1. Create one system-owned gateway component.
2. Add typed Main/server bridge calls for:
   - get tool inventory
   - call tool
   - notify tools changed
3. Namespace tools consistently.
4. Add one dev or test harness path that triggers a fake routed tool call.
5. Reflect routed tool activity in the UI or logs for traceability.

### Primary Directories

- `packages/electron/src/plugins/`
- `packages/electron/src/ipc/`
- `packages/server/src/mcp/`
- `packages/server/src/orchestration/`

### Verification Gates

- Unit:
  - tool inventory mapper test
  - tool namespace formatting test
- Integration:
  - end-to-end fake tool route succeeds through the bridge
- Manual smoke:
  - one user-visible tool execution can be observed in the app
- Failure path:
  - if a plugin is stopped mid-call, the caller receives a typed failure instead of a hang

### Evidence To Capture

- successful routed call log
- successful tools-changed update log
- typed failure example for stopped plugin

## End

### Done When

- the app can surface one live extension tool through one stable gateway
- the server no longer needs to know extension process details

### Handoff To Next Phase

Phase 04 can add secrets and auth once the routing path is already known to work with fake tools.

### Risks To Carry Forward

- if the gateway starts owning business logic instead of presentation and routing, later maintenance will get muddy
- if Codex integration and server integration diverge now, every later phase will duplicate work

### First Recommended Next Step

Start [Phase 04 - Credentials And Auth UX](phase-04-credentials-and-auth-ux.md).
