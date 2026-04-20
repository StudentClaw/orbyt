# Phase 04 - Integration With Threads, Canvas Context, And Scheduling (Spec)

Last updated: 2026-04-19

## 1. Scope

- Wire `LiveMemorizeTurnRunner` with real `CodexCli` in the Effect layer graph.
- Inject active Canvas courses into the daily distillation prompt.
- Expose a `memorize.run` RPC method on the WebSocket server.
- Start `MemorizeScheduler` from Electron `main.ts`; `onRun` triggers the server via WebSocket RPC.
- Add server-side `memorizeRunNeeded` guard so duplicate triggers are no-ops.

Out of scope: process-level Codex isolation (Phase 05), memory read endpoints for UI (not needed — batteries included).

## 2. Canvas Course Injection

`readCourseContext(db: DatabaseService): string` queries the `courses` table and
returns a newline-separated bullet list of `- {code}: {name}`. Returns `_none yet_`
when no courses exist.

The daily distillation prompt now includes an `## Active Courses` section before
`## Conversation Turns`. This gives the AI model concrete course names and codes so
it can emit well-formed branch slugs in promotion candidates (e.g.
`school/courses/cs-201` instead of generic `school/courses/data-structures`).

Template slot added: `{{courses}}`.

## 3. Memorize RPC Method

`MEMORIZE_RUN: "memorize.run"` was added to `RPC_METHODS` in contracts.

The handler in `Router.ts` calls `dependencies.memorize.runIfNeeded(new Date())` and
returns `{ ran: boolean; result: MemorizeRunResult | null }`.

The method is idempotent — calling it twice within the same scheduled slot returns
`{ ran: false, result: null }` the second time.

## 4. MemorizeService Effect Layer

`MemorizeService` (Effect Context Tag) is a new server-side service that owns:

- `MemoryPaths` resolved from `STUDENT_CLAW_HOME` env
- `MemorizeStateStore` (atomic state read/write)
- `CodexMemorizeDistiller` wrapping the shared `CodexCli` instance
- `LiveMemorizeTurnRunner` with all dependencies wired

Depends on: `ConfigService`, `Database`, `CodexCli` (shared pool — process
isolation is Phase 05).

`runIfNeeded(now: Date)` — checks `memorizeRunNeeded(state.lastRunAt, now)` before
invoking the runner. Safe to call redundantly.

## 5. Server Startup Catch-Up

In `index.ts`, after `readiness.markReady()`, the server calls:

```ts
void memorize.runIfNeeded(new Date()).catch(...)
```

This fires a catch-up run if the server was down when a scheduled slot passed.
Since `runIfNeeded` is guarded by `memorizeRunNeeded`, a fresh server will catch up
exactly once per missed slot.

## 6. Electron Scheduling

### MemorizeManager (new, `packages/electron/src/memorize/`)

Wraps `MemorizeScheduler` with a WebSocket-based trigger:

```
onRun → triggerMemorizeRun(port, authToken)
      → opens ws://127.0.0.1:{port} with auth protocols
      → sends { kind: "request", method: "memorize.run", id: ..., params: {} }
      → waits for matching response
      → closes
```

`getLastRunAt` always returns `null` on the Electron side — the server is the
authoritative source of last-run state. The server's `memorizeRunNeeded` guard
ensures double-triggers are no-ops.

### main.ts wiring

After `spawnServer()` succeeds:
1. Create `MemorizeManager({ port, authToken, getLastRunAt, onError })`
2. Call `memorizeManager.start()` — schedules next slot timer
3. Call `memorizeManager.runCatchUpIfNeeded()` — triggers immediately if a slot was missed
4. On `before-quit`: call `memorizeManager.stop()`

## 7. Timer Utilities

`packages/server/src/memory/timer.ts` exports:

- `memorizeRunNeeded(lastRunAt: string | null, now: Date): boolean`
- `computeNextMemorizeRun(now: Date): Date`
- `computeMostRecentPassedSlot(now: Date): Date`

These mirror the pure functions in `packages/electron/src/memorize/memorize-scheduler.ts`
without a cross-package dependency.

## 8. Acceptance Criteria

- [x] `readCourseContext` returns formatted bullet list or `_none yet_`
- [x] Daily prompt includes `## Active Courses` section with `{{courses}}` slot
- [x] `MEMORIZE_RUN` RPC method exists in contracts
- [x] `MemorizeService.runIfNeeded` is a no-op when no slot was missed
- [x] `MemorizeService` wired into WebSocket server layer and `index.ts`
- [x] Server calls `runIfNeeded` at startup for catch-up
- [x] `MemorizeManager` in Electron starts scheduler and triggers server via WS RPC
- [x] Electron `main.ts` starts and stops `MemorizeManager` on lifecycle events
- [x] 13 new tests pass (3 course-reader + 10 timer); 84 total memorize tests green

## 9. Files Modified Or Created

| File | Change |
| --- | --- |
| `packages/contracts/src/protocol/orchestration.ts` | Added `MEMORIZE_RUN` to `RPC_METHODS` |
| `packages/server/src/memory/course-reader.ts` | NEW — reads enrolled courses from DB |
| `packages/server/src/memory/timer.ts` | NEW — `memorizeRunNeeded`, slot computation |
| `packages/server/src/memory/service.ts` | NEW — `MemorizeService` Effect layer |
| `packages/server/src/memory/live-runner.ts` | Injects `{{courses}}` into daily prompt |
| `packages/server/src/memory/prompts/daily-distillation.md` | Added `## Active Courses` section |
| `packages/server/src/memory/prompts/index.ts` | Updated TS export with `{{courses}}` slot |
| `packages/server/src/ws/Router.ts` | Added `memorize.run` handler + `MemorizeService` dep |
| `packages/server/src/ws/WebSocketServer.ts` | Injected `MemorizeService` into server layer |
| `packages/server/src/index.ts` | Added `MemorizeLive` layer + startup catch-up |
| `packages/electron/src/memorize/memorize-manager.ts` | NEW — WS-based trigger + scheduler lifecycle |
| `packages/electron/src/main.ts` | Start/stop `MemorizeManager` on app lifecycle |
| `packages/server/src/__tests__/memorize-course-reader.test.ts` | NEW — 3 tests |
| `packages/server/src/__tests__/memorize-timer.test.ts` | NEW — 10 tests |
