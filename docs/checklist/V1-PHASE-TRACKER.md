# V1 Phase Tracker

Last reviewed: 2026-04-10

## Overall Status

- [ ] Phase 0 - Foundation
- [ ] Phase 1 - AI Harness + Chat UI
- [ ] Phase 2 - Canvas Integration + Memory Foundation
- [ ] Phase 3 - Smart Planner + Dashboard Completion
- [ ] Phase 4 - Notifications + Activity Center
- [ ] Phase 5 - Onboarding + Polish + Ship Readiness

## Verification Run on 2026-04-10

- [x] `bun test --cwd packages/contracts`
- [x] `bun test --cwd packages/shared-runtime`
- [x] `bun test --cwd packages/shared`
- [x] `bun test --cwd packages/server`
- [x] `bun test --cwd packages/electron`
- [x] `bun --cwd packages/ui vitest run` (`28` files, `200` tests)
- [ ] Root `bun run test`, `bun run typecheck`, and live `dev:*` smoke commands were not rerun in this documentation-only pass because the root scripts rebuild shared packages and would touch additional tracked files outside this tracker

## Phase 0 - Foundation

Status: Still the closest phase to complete. The typed monorepo/runtime/electron/chat proof foundation is in place and package-level automated tests are green; live Electron/UI smoke checks still block completion.

### Verified complete

- [x] Shared package boundaries are split into `packages/contracts`, `packages/shared-runtime`, and the temporary `packages/shared` compatibility shim
- [x] Contracts cover desktop bootstrap, RPC envelopes, lifecycle/config streams, orchestration RPC methods, push channels, snapshots, and typed domain/runtime events
- [x] Server config, migrations, typed router, push bus, readiness gate, and orchestration runtime exist and `bun test --cwd packages/server` passes
- [x] SQLite migrations cover both the initial foundation tables and orchestration persistence tables, including `schema_version = 2` upgrade coverage
- [x] The server includes the orchestration proof runtime: append-only event log, projection tables, queue-backed worker processing, durable receipts, and deterministic stub streaming
- [x] The UI uses the shared external-store runtime model, one shared WebSocket transport, replayable runtime state, and typed hooks/selectors
- [x] A proof chat slice exists in `/chat` and source review still shows create-thread, send-turn, stream, and interrupt wiring
- [x] Electron main-process bootstrap, preload bridge, tray wiring, and server lifecycle management are implemented in source and `bun test --cwd packages/electron` passes
- [x] Package-level automated verification passed again on 2026-04-10 for `contracts`, `shared-runtime`, `shared`, `server`, `electron`, and the full UI suite

### Pending manual verification

- [ ] Confirm the tray icon/menu is visible and the Show/Hide/Quit actions work on the target machine
- [ ] Confirm the `/chat` proof slice can create a thread, stream stub output, and interrupt successfully in the live app
- [ ] Confirm standalone mode using separate `bun run dev:server` and `bun run dev:ui` terminals in a manual smoke test

### Remaining blockers before Phase 0 can be marked complete

- [ ] Finish the manual Electron/UI smoke checks above
- [ ] Re-run root `bun run typecheck` and `bun run test` after the current in-flight workspace changes settle, since they were not rerun in this pass

## Phase 1 - AI Harness + Chat UI

Status: Partially started. The chat transport/state/UI is now real enough to count as product-layer work, but the backend still terminates at the stub provider and the real AI harness path is not implemented.

### Verified complete

- [x] Typed chat transport and orchestration snapshot/event flow exist across contracts, server, and UI
- [x] Shared runtime cache/replay covers server lifecycle, config, orchestration snapshot, provider runtime events, and chat panel UI state
- [x] The server can create threads, stream stub tokens, complete turns, and interrupt active turns through the orchestration proof runtime
- [x] Production-style chat UI components exist: `ChatContainer`, `MessageBubble`, `PromptInput`, `StreamingResponse`, `ReasoningBlock`, `ToolCallIndicator`, markdown rendering, page `/chat`, and slide-over panel support
- [x] Chat UI/state tests pass inside `bun --cwd packages/ui vitest run`

### Still missing

- [ ] Backend AI harness services (`CodexCli`, auth flow, JSON-RPC bridge, session/context/budget management)
- [ ] `soul/SOUL.md` and Soul/context assembly pipeline
- [ ] Real Codex-backed streaming pipeline
- [ ] Auth, rate-limit, and degraded-state handling backed by real server signals instead of UI-only states

## Phase 2 - Canvas Integration + Memory Foundation

Status: Partially started on the contracts/UI side. The repo now has Phase 2 contracts, runtime state modules, and several dashboard components, but the backend Canvas and memory systems are still not built.

### Verified complete

- [x] Contracts now include the Canvas/dashboard/planner RPC method names, push channels, and extended `PlannedSession` fields
- [x] `canvasState.ts` and `dashboardState.ts` exist with passing tests
- [x] `appRuntime.ts` starts canvas/dashboard sync modules, `wsRpcClient.ts` exposes canvas/dashboard namespaces, and `useDashboard.ts` aggregates this runtime data
- [x] Dashboard UI components exist with passing tests for layout, grades, deadline timeline, announcements feed, stale banner, and sync progress indicator
- [x] `DashboardPage.tsx` now renders `DashboardLayout` instead of a pure placeholder page

### Still missing

- [ ] Canvas MCP server
- [ ] Server-side Canvas sync orchestration, diff engine, and cached course/coursework/grade hydration
- [ ] Memory services and profile compiler
- [ ] Real dashboard data loading from the server; several sections still receive placeholder empty arrays on `DashboardPage.tsx`
- [ ] Server router handlers for Canvas/dashboard RPCs beyond the new client-side method definitions

## Phase 3 - Smart Planner + Dashboard Completion

Status: Partially started in the frontend/component layer. Planner state, models, and dashboard widgets exist, but the planner backend and full dashboard integration are not there yet.

### Verified complete

- [x] `plannerState.ts` exists with passing tests and is started from `appRuntime.ts`
- [x] Planner RPC client plumbing exists in `wsRpcClient.ts`
- [x] Priority queue, weekly calendar, weekly progress, completion check-in, insight cards, quick actions, and planner stream overlay components/models all exist with passing tests
- [x] The dashboard layout includes the Phase 3 section order and surfaces the planner overlay shell

### Still missing

- [ ] Planner pipeline services / plan-mode skill / rescheduling backend
- [ ] Real planner session hydration and streamed planning events from the server
- [ ] Full dashboard wiring for planner-driven sections; `DashboardPage.tsx` still passes empty arrays to priority queue, calendar, progress, insights, and announcements
- [ ] Reschedule / quick-action flows that open chat with planner context
- [ ] Rich planner streaming state from the checklist (`status`, `currentStage`, `sessionsPlaced`, `totalExpected`); current state only tracks `stage` and `label`

## Phase 4 - Notifications + Activity Center

Status: Frontend implementation complete. Backend notification evaluator/composer not started.

### Frontend verified complete

- [x] `activityState.ts` with atoms (entries, unreadCount, filter), event applier, sync starter, hooks, test reset — all tests passing
- [x] `onboardingState.ts` with 7-step wizard atom, step progression, skip logic, localStorage persistence, hydration — all tests passing
- [x] `WsRpcClient` extended with `activity.onFeedUpdate` subscription wired to `PUSH_CHANNELS.ACTIVITY_FEED`
- [x] `appRuntime.ts` starts `startActivityStateSync(client)` at boot
- [x] `useAppRuntime.ts` exports activity hooks (`useRuntimeActivityEntries`, `useRuntimeActivityUnreadCount`, `useRuntimeActivityFilter`) and `useIsOnboardingComplete`
- [x] Onboarding guard in `AppShell.tsx` redirects to `/onboarding` when incomplete
- [x] Activity badge on `AppSidebar.tsx` shows unread count (99+ cap)
- [x] `OnboardingWizard.tsx` with progress bar, step label, Back/Next/Skip, Finish
- [x] `WelcomeStep.tsx` — value prop, privacy framing, ~5 min estimate, Get Started CTA
- [x] `CanvasCredentialStep.tsx` — split layout, URL + token validation, feedback
- [x] `AiAuthStep.tsx` — connect button, status card, skip-with-warning
- [x] `PreferencesStep.tsx` — study time, duration, off-days, notification toggles, quiet hours
- [x] `RoutinesStep.tsx` — 7-day weekly grid with clickable cells
- [x] `FirstSyncStep.tsx` — triggers canvas sync, progress bar, completion summary
- [x] `DashboardWalkthrough.tsx` + `WalkthroughOverlay.tsx` — 5-step tour overlay
- [x] `ActivityCenter.tsx` — filter tabs, feed list, mark-all-read, empty state
- [x] `ActivityFeedItem.tsx` — color-coded category, title/body, deep link support
- [x] `NotificationSettings.tsx` — master toggle, per-category toggles, quiet hours
- [x] `useNativeNotification.ts` — fires IPC notification for high-priority entries, wired in AppShell
- [x] `OnboardingPage.tsx` renders `OnboardingWizard`, `ActivityPage.tsx` renders `ActivityCenter`
- [x] All Phase 4 tests passing alongside Phase 0-3 tests (325 total)

### Still missing (backend)

- [ ] Notification evaluator and composer services on the server
- [ ] Server-side activity feed persistence and real `activity.feed` push events
- [ ] Server-side onboarding state coordination (currently localStorage only)
- [ ] Native notification click-to-open routing (IPC handler exists but no deep-link dispatch)
- [ ] Skills system (loader, activator, bundled skills)

## Phase 5 - Onboarding + Polish + Ship Readiness

Status: Frontend onboarding flow implemented in Phase 4. Settings and E2E flows not started.

- [x] Onboarding wizard flow (implemented as part of Phase 4 frontend)
- [ ] Settings page completion
- [ ] End-to-end flow testing
- [ ] Packaging and release readiness
