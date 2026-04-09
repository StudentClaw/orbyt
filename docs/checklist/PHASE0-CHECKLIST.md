# Phase 0 Verification Checklist

## Shared Contracts
- [x] `bun run --cwd packages/shared build` succeeds, `dist/` has `.d.ts` files
- [x] `bun test --cwd packages/shared` — all schema/protocol/error tests pass
- [x] Branded IDs reject invalid values
- [x] ClientMessage/ServerEvent unions decode by discriminator
- [x] All error types have unique `_tag`

## Server
- [x] `bun run dev:server` starts WS server on port 8787
- [x] SQLite DB file created at configured path
- [x] All 11 tables exist (verify with `.tables` or programmatic check)
- [x] schema_version shows migration 1 applied
- [x] `wscat -c ws://localhost:8787` connects successfully
- [x] Send `{"method":"health.ping","id":"1","params":{}}` → receive `health.pong`
- [x] Send invalid JSON → receive ErrorEvent
- [x] SIGINT shuts down cleanly
- [x] `bun test --cwd packages/server` — all tests pass (config, db, ws, integration)

## UI
- [x] `bun run dev:ui` starts Vite dev server
- [ ] App shell renders with sidebar navigation
- [ ] All 5 routes render placeholder pages (/, /chat, /onboarding, /settings, /activity)
- [ ] Chat Sheet opens/closes from sidebar
- [ ] Connection status shows "disconnected" (no server) or "connected" (with server)
- [ ] WS connects when server is running, reconnects on disconnect
- [x] `bun --cwd packages/ui vitest run` — all tests pass

## Electron
- [x] `bun run dev:electron` launches Electron window
- [x] Electron spawns server child process
- [x] Health check passes (server is reachable)
- [ ] BrowserWindow loads React UI
- [ ] System tray appears with Show/Hide/Quit menu
- [ ] IPC bridge responds to `app:get-server-port`
- [ ] App quits cleanly (server process killed)

## Cross-cutting
- [x] `bun run typecheck` passes all packages
- [x] No TypeScript errors
- [x] `bun install` at root succeeds cleanly
- [ ] Standalone mode works: `bun run dev:server` + `bun run dev:ui` in separate terminals
- [x] `bun run test` — all tests pass across all packages
