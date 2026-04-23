# Orbyt V1 Implementation Plan

## Current State

The app is no longer a bare scaffold. Phase 0 foundation work is substantially implemented:

- **Monorepo:** Bun workspaces with `contracts`, `shared-runtime`, `shared` shim, `server`, `ui`, `electron`, and `extensions/template-mcp`
- **Contracts (`@orbyt/contracts`):** typed desktop bootstrap, RPC envelopes, lifecycle/config streams, orchestration RPC methods, push channels, snapshots, and domain/runtime event contracts
- **Shared runtime (`@orbyt/shared-runtime`):** small cross-package runtime helpers, with `@orbyt/shared` acting as a compatibility shim
- **Server (`@orbyt/server`):** typed RPC WebSocket transport, SQLite migrations, readiness gate, push bus, orchestration runtime, append-only event log, projection tables, durable receipts, a Codex-backed provider runtime path, and degraded/auth state persistence
- **UI (`@orbyt/ui`):** React app shell, route structure, T3code-style shared runtime cache, replayable transport state, and a `/chat` proof slice wired to the orchestration runtime with provider state visibility
- **Electron (`@orbyt/electron`):** BrowserWindow, preload bootstrap bridge, server lifecycle management, tray wiring, and startup logic that can attach to an already-running local server

Automated verification currently passes with `bun install`, `bun run typecheck`, `bun run test`, and `bun run build`. A small set of manual Electron/UI smoke checks still remain.

---

## V1 Scope

**Primary use case (from `docs/PROJECT-SUMMARY.md`):**
> Connect to Canvas and show students what's due, when, and help plan their week.

### Progress snapshot

- **Phase 0 foundation:** largely complete
- **Phase 1 chat/orchestration:** backend Codex harness slice is implemented behind the existing orchestration contracts; live end-to-end validation is still in progress
- **Phase 2+ product features:** not started on the production feature path

### In scope for v1

- Shared contracts (Effect Schema domain types, WS protocol, typed errors)
- Electron shell (BrowserWindow, server spawn, IPC bridge, tray, native notifications)
- Effect-TS local server (WebSocket, SQLite, Layer composition, migrations)
- React UI shell (router, app frame, shared runtime cache, typed state access hooks)
- AI Harness (Codex CLI subprocess, JSON-RPC, streaming, sessions, context assembly)
- Canvas Integration (MCP server + server-side sync, diff engine, change events)
- Smart Planner (task analyzer, decomposer, slot finder, schedule builder, completion handler)
- Dashboard (priority queue, weekly calendar, grade overview, deadlines, progress, completion check-ins)
- Notification Service (evaluator, composer, activity feed, native OS delivery, quiet hours)
- Onboarding (Canvas setup, AI auth, preferences, routines, first sync, first plan)
- Memory System (mem0 integration, profile compiler, adaptive context injection)
- Skill System (loader, bundled skills, plan-mode skill, context budget)

### Deferred past v1

- Skill Editor UI and custom student skills
- File System (local file storage, viewers)
- Professor pattern learning (advanced Canvas adaptation)
- Daily distillation job (end-of-day memory extraction)
- Auto-update (Electron autoUpdater)
- Calendar MCP sync (Apple/Google Calendar)
- Deep link protocol (`orbyt://`)

---

## Team Structure: Two Parallel Tracks

**Person A (Backend Lead):** Owns `packages/contracts`, `packages/shared-runtime`, `packages/shared`, `packages/server`, `packages/extensions/canvas-mcp`. Responsible for transport/domain contracts, Effect-TS services, SQLite schema, AI Harness, Canvas sync, Smart Planner engine, Memory System, Notification evaluator/composer.

**Person B (Frontend Lead):** Owns `packages/electron`, `packages/ui`. Responsible for Electron shell, React app shell, runtime state access layers, all UI screens (Chat, Dashboard, Onboarding, Activity Center), and IPC bridge.

Both developers pair on integration points (RPC transport, IPC contracts, shared runtime/state semantics, end-to-end flows).

### Ownership Map

| Area | Person A (Backend) | Person B (Frontend) |
|------|-------------------|---------------------|
| Shared Contracts | Owner | Consumer |
| Effect-TS Server | Owner | — |
| SQLite + Migrations | Owner | — |
| AI Harness | Owner | — |
| Memory System | Owner | — |
| Canvas MCP + Sync | Owner | — |
| Smart Planner Engine | Owner | — |
| Notification Backend | Owner | — |
| Skills System | Owner | — |
| Electron Shell | — | Owner |
| React UI Shell | — | Owner |
| Chat Interface | — | Owner |
| Dashboard | — | Owner |
| Onboarding Wizard | — | Owner |
| Activity Center | — | Owner |
| Notification UI | — | Owner |

---

## Critical Path

```
Foundation --> Server + WS --> AI Harness --> Canvas --> Planner --> Dashboard
```

Everything else can be parallelized around this spine.

---

## Phase 0 — Foundation (Week 1)

**Goal:** App builds, runs, and has typed communication/runtime channels between all three tiers.

**Status on 2026-04-09:** Mostly complete. The foundation landed through a deeper runtime alignment than this original plan assumed: shared contracts were split into dedicated workspace packages, the server owns a typed orchestration core, and the UI now uses a shared cached runtime model rather than page-local WebSocket hooks and Zustand stores.

### Person A: Shared Contracts + Server Infrastructure

**Implemented:**
- `packages/contracts/src/` now owns the shared schemas, transport envelopes, desktop bootstrap contract, orchestration RPC methods, stream events, and typed error exports
- `packages/shared-runtime/src/` now owns neutral runtime helpers
- `packages/shared/src/` is a compatibility shim over the new packages

**Install dependencies in `packages/server`:**
- `effect`, `@effect/schema`, `@effect/platform`, `better-sqlite3` (or use `bun:sqlite`), `ws`

**Implemented in `packages/server/src/`:**
- `config/ConfigService.ts` — config loading
- `db/Database.ts` — SQLite wrapper
- `db/migrations/001-initial.ts` and `002-orchestration-runtime.ts` — core tables plus orchestration runtime persistence
- `runtime/ServerReadiness.ts` — readiness gate
- `ws/PushBus.ts`, `ws/WebSocketServer.ts`, `ws/Router.ts` — ordered push path and typed RPC routing
- `orchestration/OrchestrationService.ts`, `RuntimeReceiptBus.ts`, `StubProvider.ts` — append-only orchestration runtime and proof provider
- `index.ts` — composed server bootstrap

**Acceptance status:** Met for automated checks. `bun run dev:server` starts the typed RPC WebSocket server, creates/upgrades the SQLite DB, runs migrations, and accepts connections. Remaining confirmation is a live manual smoke of the proof chat slice.

### Person B: Electron Shell + React UI Shell

**Implemented in `packages/electron/src/`:**
- `main.ts` — BrowserWindow creation and app bootstrap
- `preload.ts` — typed preload bridge
- `ipc/bridge.ts` — typed bootstrap IPC registration
- `tray/` — tray wiring
- `server/lifecycle.ts` — server spawn/attach logic and bootstrap health checks

**Build out `packages/ui/src/`:**
- `App.tsx` — app shell plus one-time runtime startup
- `rpc/` — shared transport, replayable atom-style cache, runtime sync modules, and typed selectors/hooks
- `hooks/useAppRuntime.ts` — thin state/action access layer over the runtime cache
- route surfaces for `/`, `/chat`, `/onboarding`, `/settings`, `/activity`
- `/chat` proof slice wired to the stub orchestration runtime
- previous `useWebSocket`, `ws-client`, and Zustand store scaffolding were removed in favor of one shared runtime model

**Acceptance status:** Mostly met. `bun run dev` launches Electron, the React shell loads, and the UI connects through the shared runtime path. Remaining manual verification is the live `/chat` thread/stream/interrupt flow plus tray/preload smoke checks.

---

## Phase 1 — AI Harness + Chat UI (Weeks 2-3)

**Goal:** Student can chat with the AI through the app. Messages flow: React --> WS --> Server --> Codex CLI --> stream back.

**Status on 2026-04-09:** Partially implemented. The orchestration transport path now includes a real Codex-backed backend slice with richer provider runtime state, auth/retry RPCs, durable queued turns, and Codex app-server lifecycle handling. The remaining work for this phase is live end-to-end stabilization, production chat UI, and the broader context/tooling surface described below.

### Person A: AI Harness Backend (Weeks 2-3)

**Current implementation landed:**
- `packages/contracts/src/protocol/orchestration.ts` now exposes richer `providerRuntime` snapshot state, detailed provider statuses (`initializing`, `auth_required`, `degraded`, `rate_limited`), and `provider.startAuth` / `provider.retryInitialize` RPCs while preserving the existing orchestration method names
- `packages/server/src/ai/CodexCli.ts` manages the Codex app-server subprocess, initialization, `account/read`, `thread/start`, `turn/start`, token delta ingestion, interrupt forwarding, and degraded/auth state transitions
- `packages/server/src/ai/ProviderRuntimeStore.ts` owns persisted provider runtime state, per-thread provider session records, and durable queued turns
- `packages/server/src/db/migrations/003-provider-runtime-state.ts` adds `provider_runtime_state`, `queued_provider_turns`, and richer provider session columns
- `packages/server/src/orchestration/OrchestrationService.ts` now delegates provider execution to the Codex service, keeps orchestration events/projections intact, queues pending turns, and surfaces provider runtime state through snapshots/events
- `packages/server/src/ws/Router.ts` and the UI runtime client now support provider auth/retry control actions without changing the top-level orchestration flow

**Automated verification landed:**
- `bun run typecheck`
- `bun run test`
- `bun run build`

**Live validation status:**
- Local Codex CLI presence and ChatGPT auth were confirmed during development
- The backend protocol path was probed directly against `codex app-server` (`initialize`, `account/read`, `thread/start`, `turn/start`, token deltas, `turn/interrupt`)
- The desktop `/chat` proof slice still requires live stabilization; current behavior can fall back to provider `degraded` on first send, so this implementation should be treated as “backend slice landed, live acceptance still in progress”

**Build `packages/server/src/ai/`:**
- `CodexCli.ts` — Effect Service: spawn Codex app-server subprocess, health monitoring, pre-warm on startup, graceful shutdown, degraded mode on failure with retry+backoff
- `AuthCoordinator.ts` — ChatGPT OAuth flow (`account/login/start` with type `chatgpt`), auth state persistence, expiry detection
- `JsonRpcProtocol.ts` — Encode/decode JSON-RPC 2.0 over stdin/stdout, typed against shared contracts
- `StreamManager.ts` — Buffer incoming tokens from Codex, push chunks via WS (`chat.streaming`), handle interruption (`chat.interrupt`), signal completion (`chat.complete`)
- `SessionManager.ts` — Thread create, turn submit, turn interrupt, thread cleanup, token usage tracking
- `ContextAssembler.ts` — Injection order: Soul identity --> active skills --> student profile --> relevant memories --> tool definitions --> conversation history --> user message
- `BudgetManager.ts` — Token budget allocation (Soul ~300, skills ~500-1000, profile ~500, memories ~500-1000, tools ~200-500, conversation history gets remainder)
- `SoulIdentity.ts` — Load `soul/SOUL.md` (v1: write a solid base personality document), cache, merge adaptive signals
- `McpRegistry.ts` — Register MCP servers with Codex, aggregate tool schemas
- `ToolCallRouter.ts` — Parse tool calls from Codex output, route through plugin gateway

**Still remaining inside Person A scope:**
- Stabilize live `dev` runtime behavior so the first real turn streams in the Electron app instead of degrading
- Finish the split-out services that are still conceptually planned but not yet extracted (`JsonRpcProtocol`, `ContextAssembler`, `BudgetManager`, `SoulIdentity`, `McpRegistry`, `ToolCallRouter`)
- Create `soul/SOUL.md`
- Expand provider/runtime tests beyond the current contract/router/store coverage into dedicated Codex lifecycle integration fixtures

**Acceptance status:** Backend contracts, persistence, server wiring, and Codex protocol integration are implemented and passing automated verification. End-to-end desktop chat acceptance is not yet complete; use `docs/checklist/PHASE1-AI-HARNESS-BACKEND-CHECKLIST.md` as the source of truth for the remaining live verification steps and known failure modes.

### Person B: Chat UI (Weeks 2-3)

**Build `packages/ui/src/components/chat/`:**
- `ChatContainer.tsx` — Full chat view with message list, auto-scroll, scroll-to-bottom
- `MessageBubble.tsx` — User/assistant message rendering with markdown support
- `PromptInput.tsx` — Input bar with send button, Stop button during streaming
- `StreamingResponse.tsx` — Live token assembly display
- `ReasoningBlock.tsx` — Collapsible "thinking" blocks
- `ToolCallIndicator.tsx` — Show when AI is calling a tool

**Build chat as right `Sheet` slide-over** (per ui-screen-map: "Keep dashboard context visible while interacting with AI").

**Wire the shared runtime chat state:** Manage conversation history, streaming state, active session, and provider runtime events through the app runtime cache plus typed orchestration actions.

**Handle states:** Connected, streaming, interrupted, offline/queued, rate-limited, auth-expired.

**Acceptance:** Type a message in the chat UI, see it stream back from Codex in real time. Stop button interrupts mid-stream. Auth flow works. Degraded mode shows clear "AI unavailable" state.

---

## Phase 2 — Canvas Integration + Memory Foundation (Weeks 3-4)

**Goal:** App knows the student's courses, assignments, and grades. Memory system stores and retrieves context.

### Person A: Canvas MCP + Sync + Memory (Weeks 3-4)

**Canvas MCP Server — build `packages/extensions/canvas-mcp/`:**
- Install `@modelcontextprotocol/sdk`
- `index.ts` — MCP server entry (stdio transport)
- `manifest.json` — Plugin metadata per `docs/PROJECT-SUMMARY.md` manifest spec
- `canvas-client.ts` — Canvas REST API wrapper with pagination, rate limit handling, request-cost header inspection
- `normalizers/` — `assignments.ts`, `modules.ts`, `pages.ts`, `announcements.ts` (all normalize to `CourseWorkItem`)
- `tools/` — `get-courses.ts`, `get-coursework.ts`, `get-coursework-detail.ts`, `get-grades.ts`, `get-announcements.ts`, `sync-now.ts`

**Server-side Canvas orchestration — build `packages/server/src/canvas/`:**
- `CanvasSyncService.ts` — Effect-TS Schedule: 15min active / 60min tray, metadata-first refresh
- `CanvasDiffEngine.ts` — Snapshot diff producing typed change events (`AssignmentAdded`, `DeadlineChanged`, `GradePosted`, `AnnouncementPosted`)
- `CourseWorkCache.ts` — SQLite persistence for courses, coursework items, announcements
- `FreshnessPolicy.ts` — Soft-stale at midnight, per-course refresh scoring

**Memory System — build `packages/server/src/memory/`:**
- Install `mem0ai` (or equivalent TS client), OpenAI SDK for embeddings
- `Mem0Service.ts` — Effect Service wrapping mem0 with entity partitioning (`user_id`, `agent_id`, `run_id`)
- `ProfileCompiler.ts` — Read across memory categories, generate ~500 token compact profile for AI injection
- `MemoryExtractor.ts` — Post-conversation ADD/UPDATE/DELETE pipeline
- Wire into `ContextAssembler` — profile + relevant memories injected per turn

**Register Canvas MCP with Codex** via `McpRegistry`.

### Person B: Canvas Data UI + Connection States (Weeks 3-4)

**Build Dashboard data components `packages/ui/src/components/dashboard/`:**
- `DashboardLayout.tsx` — Section stack layout per `docs/frontend-design/ui-screen-map-v1.md` (fixed order: priority queue, insights, deadlines, calendar, grades, progress, announcements, quick actions)
- `GradeOverview.tsx` — Per-course grade cards with trend indicators (uses recharts)
- `GradeChart.tsx` — Line chart for grade trends
- `DeadlineTimeline.tsx` — Next 14 days, expandable day popovers
- `AnnouncementsFeed.tsx` — Feed list with read state and expand

**Wire `canvasStore.ts`:** Subscribe to `canvas.syncProgress`, `dashboard.update` WS events. Cache course/assignment/grade data.

**Build connection state indicators:**
- Stale data warning banner
- Sync progress indicator
- Offline cache mode display

**Acceptance:** After Canvas token is configured, courses and assignments appear on the Dashboard. Ask the AI "what's due this week?" and get real Canvas data. Background sync runs and Dashboard updates in real time.

---

## Phase 3 — Smart Planner + Dashboard Completion (Weeks 5-6)

**Goal:** "Plan my week" produces a concrete schedule. Dashboard is a functional command center.

### Person A: Planner Engine (Weeks 5-6)

**Build `packages/server/src/planner/`:**
- `PlannerService.ts` — Effect Service orchestrating the full pipeline, emits streamed status events
- `TaskAnalyzer.ts` — Three-layer priority model (urgency gate, impact score, effort tiebreaker). Calls Codex for effort estimation.
- `TaskDecomposer.ts` — Multi-session splitting for tasks >2hrs. Calls Codex with course context.
- `SlotFinder.ts` — Deterministic: read routines from memory, compute available slots with rolling 6-week window (active weeks 1-2, placeholder weeks 3-6). 15min snap grid, 30min minimum, 3hr cap, auto-break at 90min.
- `ScheduleBuilder.ts` — Deterministic: place sessions backward from deadlines, priority order (RED/YELLOW/GREEN zones), cognitive load distribution (impact sum cap 2.0/day), buffer before due dates.
- `RescheduleEngine.ts` — Student-initiated (`rescheduleForStudent`) and event-driven (`rescheduleForEvent`). Same-task ripple only, RED-zone mini-replan fallback.
- `CompletionHandler.ts` — Yes/No/Yes-but processing: status updates, memory writes (behavioral + progress), follow-up session creation for "Yes, but..."

**Create `packages/skills/plan-mode.md`** — The plan-mode skill file that instructs Codex how to invoke planner services.

**Wire into WS Router:** Handle `planner.reschedule`, `skills.planMode.start`, `preferences.updateCoursePriority`.

### Person B: Dashboard Interactions + Calendar (Weeks 5-6)

**Complete Dashboard `packages/ui/src/components/dashboard/`:**
- `PriorityQueue.tsx` — Top work items ranked by urgency zone + impact, countdown chips, urgency badges
- `WeeklyCalendar.tsx` — Week grid with color-coded course blocks, conflict markers, click to see details or reschedule
- `CompletionCheckin.tsx` — Lightweight modal: Yes / No / Yes-but (with text input for "but")
- `WeeklyProgress.tsx` — Completed vs planned, streak tracking, week-over-week comparison
- `InsightCards.tsx` — Horizontal scroll area with AI-generated insight cards
- `QuickActions.tsx` — Compact action buttons that open chat Sheet with prefilled context

**Wire `plannerStore.ts`:** Subscribe to `planner.sessionCheckIn`, `dashboard.update`. Manage planned sessions, task state, calendar view state.

**Build streamed planning UX:** As `PlannerService` emits stage events, the calendar assembles incrementally. Cancel/abort mechanism. Student-friendly status messages ("Looking at your Problem Set 3...", "Checking your schedule...").

**Acceptance:** Say "plan my week" in chat. See the plan stream in with status updates. Dashboard shows sessions on the weekly calendar. Complete a session via the check-in prompt. Reschedule a session from the calendar.

---

## Phase 4 — Notifications + Onboarding (Weeks 7-8)

**Goal:** Proactive notifications keep students aware. New users can set up from scratch.

### Person A: Notification Backend + Skills Loader (Weeks 7-8)

**Build `packages/server/src/notifications/`:**
- `NotificationEvaluator.ts` — Subscribe to Canvas change events + planner session reminders. Decide what's worth notifying (all assignments/grades/deadline changes, keyword-filtered announcements).
- `NotificationComposer.ts` — Templates for simple events, Codex for contextual/complex ones.
- `ActivityFeedService.ts` — Write durable `activity_feed` records. Mark OS-notified, chat-surfaced, read.
- `QuietHoursEnforcer.ts` — Check preferences before OS delivery.
- `SessionReminderScheduler.ts` — Effect-TS Schedule: emit reminder N minutes before planned sessions.

**Build `packages/server/src/skills/`:**
- `SkillLoader.ts` — Read skill markdown files, parse YAML frontmatter, build registry
- `SkillActivator.ts` — auto/keyword/manual trigger logic
- `SkillPolicyGate.ts` — Capability enforcement for skills
- Author bundled skills: `plan-mode`, `study-helper`, `exam-prep`, `essay-reviewer`, `explain-like`, `citation-helper`

**Wire Notification events to WS:** Push `activity.feedUpsert`, `planner.sessionCheckIn` to UI.

### Person B: Onboarding + Notification UI (Weeks 7-8)

**Build `packages/ui/src/components/onboarding/`:**
- `OnboardingWizard.tsx` — Step-by-step wizard container with progress indicator
- `WelcomeStep.tsx` — Value prop, privacy framing, time estimate
- `CanvasCredentialStep.tsx` — Institution URL input + token paste + validation feedback (split layout: instructions + form)
- `AiAuthStep.tsx` — ChatGPT OAuth trigger + status card
- `PreferencesStep.tsx` — Study time preferences, max duration, off-limit days, notification prefs
- `RoutinesStep.tsx` — Weekly grid editor for recurring commitments (class times, work shifts)
- `FirstSyncStep.tsx` — Streaming progress of Canvas import + summary
- `DashboardWalkthrough.tsx` — Tooltip overlay tour of populated dashboard

**Wire `onboardingStore.ts`:** Track step completion, gate app entry until critical steps (Canvas + AI auth) complete.

**Build Activity Center `packages/ui/src/components/notifications/`:**
- `ActivityCenter.tsx` — Unified feed with filter tabs (Canvas, Planner, Agent, Insights), badges, deep-link actions
- `NotificationSettings.tsx` — Per-type toggles, quiet hours time controls

**Build Notification delivery in Electron:**
- `packages/electron/src/ipc/handlers/notification-handlers.ts` — Handle `notification:show` IPC, deliver via Electron `Notification` API, handle click-to-open routing

**Acceptance:** Fresh install leads through onboarding wizard. Canvas connects, AI authenticates, preferences saved, first sync runs, first plan generates. Notifications fire for new grades/assignments. Activity Center shows feed history.

---

## Phase 5 — Integration Testing + Polish (Weeks 9-10)

**Goal:** Everything works together reliably. Edge cases handled. Ship-ready.

### Both developers, shared work

**End-to-end flow testing:**
- New user --> onboarding --> first plan --> complete sessions --> memory extraction --> next day
- Canvas sync --> diff --> notification --> dashboard update
- "Plan my week" --> streamed planning --> calendar view --> reschedule --> completion check-in

**Error handling hardening:**
- Codex: rate limits (graceful "rate limited" message), auth expiry (prompt re-auth), subprocess crash (auto-restart), network failure
- Canvas: unpublished assignments, missing due dates, non-standard configs, API throttling (429 backoff), pagination edge cases
- Memory: context budget overflow, retrieval quality verification
- Offline: cached Canvas data + local memory for basic read-only, honest "AI unavailable" state, durable send queue

**Performance:**
- App startup time (Electron + server boot + Codex pre-warm)
- Canvas sync latency
- Dashboard render with full semester of data

**Polish:**
- Loading skeletons for all data-dependent components
- Error boundaries with recovery actions
- Keyboard navigation for core flows (chat, dashboard, onboarding)
- Dark mode verification (dark-first per design spec)
- Stale data warnings, connection state indicators throughout

---

## Key Dependencies to Install (by package)

| Package | Dependencies |
|---------|-------------|
| `packages/contracts` | `effect`, `@effect/schema` |
| `packages/shared-runtime` | small runtime helpers only |
| `packages/shared` | compatibility shim over `contracts` + `shared-runtime` |
| `packages/server` | `effect`, `@effect/schema`, `@effect/platform`, `ws`, `@openai/codex`, `mem0ai`, `openai` |
| `packages/electron` | `electron`, `@electron-forge/cli` (+ makers/plugins), `@orbyt/contracts` |
| `packages/ui` | `react-router` (or `@tanstack/react-router`) plus the shared runtime modules in-repo |
| `packages/extensions/canvas-mcp` | `@modelcontextprotocol/sdk` |

SQLite via `bun:sqlite` (built-in) to avoid a native dependency.

---

## Branch Strategy

Per `PLAN.md`:
- Branch from `main` for each feature: `feature/<short-description>`
- Each branch goes through Beginning/Middle/End lifecycle
- PR checklist: orientation gate, tests, TDD logs, docs updated

Suggested branch order (each merges before the next phase begins):

1. `feature/shared-contracts` + `feature/electron-shell` (Phase 0, parallel)
2. `feature/server-infrastructure` + `feature/ui-shell` (Phase 0, parallel)
3. `feature/ai-harness` + `feature/chat-ui` (Phase 1, parallel)
4. `feature/canvas-mcp` + `feature/dashboard-data` (Phase 2, parallel)
5. `feature/memory-system` (Phase 2, depends on AI Harness)
6. `feature/smart-planner` + `feature/dashboard-interactions` (Phase 3, parallel)
7. `feature/notifications` + `feature/onboarding` (Phase 4, parallel)
8. `feature/skills-system` (Phase 4, can overlap)
9. `feature/integration-polish` (Phase 5, shared)

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Codex CLI versioning | App-server protocol may change between versions | Pin a known-good version in `package.json`. Test against updates before bumping. |
| ChatGPT rate limits | Students on Plus get limited Codex usage per 5-hour window | Show remaining quota in UI, graceful "rate limited" message, queue requests. |
| Canvas API throttling | Dynamic request-cost throttling can slow or reject syncs | Cache-first reads, conservative sync intervals, inspect request-cost headers, 429 backoff. |
| Effect-TS learning curve | New framework for the team | Start with simple services (Config, Database), layer in complexity. Keep shared contracts simple initially. |
| mem0 integration complexity | TS client maturity, entity partitioning setup | Start with basic memory write/read. Profile compiler can be simple concatenation before upgrading to semantic retrieval. |
| Two-person coordination | Merge conflicts, protocol drift | Shared contracts package is the single source of truth. Both developers import from it. Weekly integration check where both tracks merge and verify WS communication works end-to-end. |
