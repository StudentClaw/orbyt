# Phase 0 Verification Checklist

## Contracts And Shared Runtime

- [x] `bun run build:shared` succeeds for `packages/contracts`, `packages/shared-runtime`, and `packages/shared`
- [x] `bun test --cwd packages/contracts` — transport/bootstrap/snapshot contract tests pass
- [x] `bun test --cwd packages/shared-runtime` — shared runtime helper tests pass
- [x] `bun test --cwd packages/shared` — compatibility shim schema/protocol/error tests pass
- [x] `bun --cwd packages/ui vitest run` includes shared runtime transport/cache replay tests
- [x] Branded IDs reject invalid values
- [x] RPC request envelopes decode correctly
- [x] Desktop bootstrap, server config, lifecycle welcome, and orchestration snapshot payloads decode correctly
- [x] All error types have unique `_tag`
- [x] `@student-claw/shared` re-exports from the new packages without breaking existing tests
- [x] Root `bun run typecheck` and `bun run test` rebuild shared package output before downstream verification

## Server

- [x] `bun run dev:server` starts the typed RPC WebSocket server on port 8787
- [x] SQLite DB file created at configured path
- [x] All 17 Phase 0 + orchestration tables exist (verify with `.tables` or programmatic check)
- [x] schema_version shows migrations 1 and 2 applied for an upgraded local DB
- [x] A WebSocket client connects successfully to `ws://localhost:8787`
- [x] Send `{"kind":"request","method":"server.getBootstrap","id":"1","params":{}}` → receive a success response with `wsUrl`, `appVersion`, and `platform`
- [x] Send `{"kind":"request","method":"server.getConfig","id":"1","params":{}}` → receive a success response with capabilities + protocol metadata
- [x] Send invalid JSON → receive an RPC error response with `code: "parse_error"`
- [x] Readiness gate, typed router, and config endpoint tests pass for bootstrap/config/invalid request handling
- [x] Lifecycle welcome is delivered through explicit subscription flow rather than unsolicited connect-time push
- [x] SIGINT shuts down cleanly
- [x] `bun test --cwd packages/server` — all tests pass (config, db, ws, integration)

## UI

- [x] `bun run dev:ui` starts Vite dev server
- [x] App shell renders with sidebar navigation
- [x] `/chat` route renders inside the app shell in Electron
- [ ] Main routes render correctly (`/`, `/chat`, `/onboarding`, `/settings`, `/activity`)
- [ ] Chat Sheet opens/closes from sidebar
- [ ] Chat page proof slice can create a thread, send a turn, stream stub output, and interrupt a turn
- [x] Shared runtime initializes once at app root and supplies connection state through cached atoms
- [x] Late subscribers receive current connection state immediately (no page-local drift)
- [ ] Connection status shows transport state and platform bootstrap info in the live app
- [ ] Renderer bootstraps from Electron `app:get-bootstrap`, then reconnects/resubscribes on disconnect in a manual smoke test
- [x] `bun --cwd packages/ui vitest run` — all tests pass

## Electron

- [x] `bun run dev:electron` launches Electron window
- [x] Electron spawns server child process
- [x] Electron can attach to an already-running local server instead of always failing on port conflict
- [x] Bootstrap RPC health check passes and returns server metadata
- [x] BrowserWindow loads React UI
- [ ] System tray appears with Show/Hide/Quit menu
- [ ] IPC bridge responds to `app:get-bootstrap`
- [x] App quits cleanly (server process killed)

## Cross-cutting

- [x] `bun run typecheck` passes all packages
- [x] No TypeScript errors
- [x] `bun install` at root succeeds cleanly
- [x] `bun run dev:electron` no longer fails on workspace package resolution for `@student-claw/contracts`
- [x] Standalone mode works: `bun run dev:server` + `bun run dev:ui` in separate terminals
- [x] `bun run test` — all tests pass across all packages
