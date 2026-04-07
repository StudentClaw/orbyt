# Phase 0 Verification Checklist

## Shared Contracts
- [ ] `bun run --cwd packages/shared build` succeeds, `dist/` has `.d.ts` files
- [ ] `bun test --cwd packages/shared` — all schema/protocol/error tests pass
- [ ] Branded IDs reject invalid values
- [ ] ClientMessage/ServerEvent unions decode by discriminator
- [ ] All error types have unique `_tag`

## Server
- [ ] `bun run dev:server` starts WS server on port 8787
- [ ] SQLite DB file created at configured path
- [ ] All 11 tables exist (verify with `.tables` or programmatic check)
- [ ] schema_version shows migration 1 applied
- [ ] `wscat -c ws://localhost:8787` connects successfully
- [ ] Send `{"method":"health.ping","id":"1","params":{}}` → receive `health.pong`
- [ ] Send invalid JSON → receive ErrorEvent
- [ ] SIGINT shuts down cleanly
- [ ] `bun test --cwd packages/server` — all tests pass (config, db, ws, integration)

## UI
- [ ] `bun run dev:ui` starts Vite dev server
- [ ] App shell renders with sidebar navigation
- [ ] All 5 routes render placeholder pages (/, /chat, /onboarding, /settings, /activity)
- [ ] Chat Sheet opens/closes from sidebar
- [ ] Connection status shows "disconnected" (no server) or "connected" (with server)
- [ ] WS connects when server is running, reconnects on disconnect
- [ ] `bun --cwd packages/ui vitest run` — all tests pass

## Electron
- [ ] `bun run dev:electron` launches Electron window
- [ ] Electron spawns server child process
- [ ] Health check passes (server is reachable)
- [ ] BrowserWindow loads React UI
- [ ] System tray appears with Show/Hide/Quit menu
- [ ] IPC bridge responds to `app:get-server-port`
- [ ] App quits cleanly (server process killed)

## Cross-cutting
- [ ] `bun run typecheck` passes all packages
- [ ] No TypeScript errors
- [ ] `bun install` at root succeeds cleanly
- [ ] Standalone mode works: `bun run dev:server` + `bun run dev:ui` in separate terminals
- [ ] `bun run test` — all tests pass across all packages
