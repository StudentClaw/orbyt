# V1 Phase Tracker

Last reviewed: 2026-04-07

## Overall Status

- [ ] Phase 0 - Foundation
- [ ] Phase 1 - AI Harness + Chat UI
- [ ] Phase 2 - Canvas Integration + Memory Foundation
- [ ] Phase 3 - Smart Planner + Dashboard Completion
- [ ] Phase 4 - Notifications + Activity Center
- [ ] Phase 5 - Onboarding + Polish + Ship Readiness

## Phase 0 - Foundation

Status: Automated checks complete, manual Electron/UI smoke checks remain

### Verified complete

- [x] Shared schemas, protocol definitions, typed errors, and workspace package resolution are working from `packages/shared`
- [x] Shared contract tests pass with `bun test --cwd packages/shared`
- [x] Shared package build passes with `bun run build:shared`
- [x] Server config, migrations, router, and WebSocket services now typecheck and pass `bun test --cwd packages/server`
- [x] `bun run dev:server` starts successfully, creates the SQLite DB, and responds to `health.ping`
- [x] SQLite migration coverage exists for the 11 Phase 0 tables and `schema_version = 1`
- [x] UI shell, sidebar, placeholder routes, chat sheet, WebSocket client, and Zustand stores exist in `packages/ui/src/`
- [x] UI typecheck passes with `bun --cwd packages/ui typecheck`
- [x] UI tests pass with `bun --cwd packages/ui vitest run`
- [x] `bun run dev:ui` starts the Vite dev server successfully
- [x] Electron main-process bootstrap, IPC registration, tray wiring, and server lifecycle startup are now implemented
- [x] `bun run dev:electron` and root `bun run dev` both start Electron through the configured app entry
- [x] Root verification commands `bun install`, `bun run typecheck`, and `bun run test` all pass

### Pending manual verification

- [ ] Confirm the Electron `BrowserWindow` visibly loads the React UI
- [ ] Confirm the tray icon/menu is visible and the Show/Hide/Quit actions work on the target machine
- [ ] Confirm `app:get-server-port` responds through the running Electron preload bridge
- [ ] Confirm standalone mode using separate `bun run dev:server` and `bun run dev:ui` terminals in a manual smoke test

### Remaining blockers before Phase 0 can be marked complete

- [ ] Finish the manual smoke checks above and check off the remaining UI/Electron verification items

## Phase 1 - AI Harness + Chat UI

Status: Not started

- [ ] Backend AI harness services
- [ ] Soul document
- [ ] Chat streaming pipeline
- [ ] Chat UI components
- [ ] Auth and degraded mode handling

## Phase 2 - Canvas Integration + Memory Foundation

Status: Not started

- [ ] Canvas MCP server
- [ ] Canvas sync orchestration
- [ ] Diff engine and cache
- [ ] Memory services and profile compiler
- [ ] Dashboard data components

## Phase 3 - Smart Planner + Dashboard Completion

Status: Not started

- [ ] Planner pipeline services
- [ ] Plan-mode skill
- [ ] Dashboard priority queue and weekly calendar
- [ ] Planner interactions and rescheduling

## Phase 4 - Notifications + Activity Center

Status: Not started

- [ ] Notification evaluator and composer
- [ ] Native notification delivery
- [ ] Activity center backend
- [ ] Activity center UI

## Phase 5 - Onboarding + Polish + Ship Readiness

Status: Not started

- [ ] Onboarding flow
- [ ] Settings completion
- [ ] End-to-end flows
- [ ] Packaging and release readiness
