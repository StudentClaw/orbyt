# V1 Phase Tracker

Last reviewed: 2026-04-09

## Overall Status

- [x] Phase 0 - Foundation
- [ ] Phase 1 - AI Harness + Chat UI
- [ ] Phase 2 - Canvas Integration + Memory Foundation
- [ ] Phase 3 - Smart Planner + Dashboard Completion
- [ ] Phase 4 - Notifications + Activity Center
- [ ] Phase 5 - Onboarding + Polish + Ship Readiness

## Phase 0 - Foundation

Status: **Complete** — all automated checks pass and code-level verification confirms the remaining smoke-check items are implemented correctly

### Verified complete

- [x] Shared package boundaries were reshaped into `packages/contracts`, `packages/shared-runtime`, and a temporary `packages/shared` compatibility shim
- [x] Contracts now cover transport envelopes, desktop bootstrap, server config/lifecycle streams, orchestration RPC methods, push channels, snapshots, and typed domain/runtime events
- [x] Shared package verification passes with `bun run build:shared`, `bun test --cwd packages/contracts`, `bun test --cwd packages/shared-runtime`, and `bun test --cwd packages/shared`
- [x] Server config, migrations, typed router, push bus, readiness gate, and orchestration runtime typecheck and pass `bun test --cwd packages/server`
- [x] `bun run dev:server` starts successfully, creates the SQLite DB, and serves the typed RPC WebSocket transport on port `8787`
- [x] SQLite migration coverage now includes the original foundation tables plus orchestration persistence tables, with upgraded local DBs reaching `schema_version = 2`
- [x] The server now includes an orchestration core with append-only event logging, projection tables, queue-backed worker processing, durable receipts, and a deterministic stub provider proof slice
- [x] The UI now uses a shared external-store runtime model instead of hook-local WebSocket state or Zustand-owned app truth
- [x] The renderer transport now uses one shared session, typed request/response + push envelopes, replayable shared runtime state, and resubscribe hooks on reconnect
- [x] The runtime is started once at app root and pages/components consume cached state through typed hooks/selectors
- [x] A proof chat slice exists in `/chat` that can create a thread, send a turn, stream stub output, and interrupt a turn
- [x] UI typecheck passes with `bun --cwd packages/ui typecheck`
- [x] UI tests pass with `bun --cwd packages/ui vitest run`
- [x] `bun run dev:ui` starts the Vite dev server successfully
- [x] Electron main-process bootstrap, typed IPC registration, tray wiring, and server lifecycle startup are now implemented
- [x] Electron preload now exposes typed bootstrap data through `app:get-bootstrap`
- [x] Electron startup now tolerates an already-running local server instead of unconditionally crashing on the occupied port
- [x] `bun run dev:electron` and root `bun run dev` both start Electron through the configured app entry
- [x] Electron dev no longer fails on workspace package resolution for `@student-claw/contracts`
- [x] The BrowserWindow visibly loads the React shell and `/chat` route
- [x] Root verification commands `bun install`, `bun run typecheck`, and `bun run test` all pass
- [x] Tray icon/menu implemented in `packages/electron/src/tray/tray.ts` with Show/Hide/Quit actions wired and integrated into the app lifecycle via `main.ts`
- [x] The `/chat` proof slice end-to-end flow is implemented: thread creation via `ORCHESTRATION_CREATE_THREAD` RPC, stub streaming via `provider.token` push events, and turn interrupt via `ORCHESTRATION_INTERRUPT_TURN` RPC with database state management
- [x] Standalone mode works via separate `dev:server` and `dev:ui` scripts; UI auto-connects to `ws://127.0.0.1:8787` and can be overridden via Electron bootstrap
- [x] The orchestration proof slice (stub provider, event log, projections, queue worker) is confirmed as a Phase 0 deliverable; real provider integration starts in Phase 1

### Known issues (non-blocking)

- Server integration test (`packages/server/src/__tests__/integration.test.ts`) has a port-collision flake in `getRandomPort()` that causes 2 tests to timeout intermittently — not a code regression

## Phase 1 - AI Harness + Chat UI

Status: Runtime foundations and the stub chat proof slice are in place; real provider integration and production chat UX are next

- [x] Typed transport and orchestration proof slice exist
- [x] Shared runtime cache + replay model exists for server lifecycle, config, orchestration snapshot, and provider runtime events
- [x] Stub provider turn streaming exists for architecture validation
- [ ] Backend AI harness services
- [ ] Soul document
- [ ] Real chat streaming pipeline
- [ ] Production chat UI components
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
