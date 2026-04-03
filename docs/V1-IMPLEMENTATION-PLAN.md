# Student Claw V1 Implementation Plan

## Current State

The harness is in place but contains near-zero feature code:

- **Monorepo:** Bun workspaces with 5 packages (`ui`, `server`, `electron`, `shared`, `extensions/template-mcp`)
- **UI (`@student-claw/ui`):** Vite 8 + React 19, full shadcn/radix component library (50+ primitives), Tailwind v4, Geist font, Hugeicons, recharts, react-resizable-panels — but only the stock Vite counter in `App.tsx`
- **Server (`@student-claw/server`):** 3-line boot log (`packages/server/src/index.ts`)
- **Electron (`@student-claw/electron`):** 1-line placeholder (`packages/electron/src/main.ts`)
- **Shared (`@student-claw/shared`):** `HealthStatus` type + version string (`packages/shared/src/index.ts`)
- **No** Effect-TS, SQLite, WebSocket, router, or feature code anywhere

Documentation is comprehensive: 10 grilled feature specs, 5 architecture docs, full SQLite DDL, dependency graph, UI screen map with 30+ surfaces.

---

## V1 Scope

**Primary use case (from `docs/PROJECT-SUMMARY.md`):**
> Connect to Canvas and show students what's due, when, and help plan their week.

### In scope for v1

- Shared contracts (Effect Schema domain types, WS protocol, typed errors)
- Electron shell (BrowserWindow, server spawn, IPC bridge, tray, native notifications)
- Effect-TS local server (WebSocket, SQLite, Layer composition, migrations)
- React UI shell (router, app frame, WebSocket hooks, stores)
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
- Deep link protocol (`studentclaw://`)

---

## Team Structure: Two Parallel Tracks

**Person A (Backend Lead):** Owns `packages/shared`, `packages/server`, `packages/extensions/canvas-mcp`. Responsible for Effect-TS services, SQLite schema, AI Harness, Canvas sync, Smart Planner engine, Memory System, Notification evaluator/composer.

**Person B (Frontend Lead):** Owns `packages/electron`, `packages/ui`. Responsible for Electron shell, React app shell, all UI screens (Chat, Dashboard, Onboarding, Activity Center), WebSocket client hooks, stores, IPC bridge.

Both developers pair on integration points (WebSocket protocol handshake, IPC contracts, end-to-end flows).

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

**Goal:** App builds, runs, and has typed communication channels between all three tiers.

### Person A: Shared Contracts + Server Infrastructure

**Install dependencies in `packages/shared`:**
- `effect`, `@effect/schema`, `@effect/platform`

**Build out `packages/shared/src/`:**
- `schemas/` — Branded IDs (`CourseId`, `CourseWorkItemId`, `SkillId`), domain types (`Course`, `CourseWorkItem`, `Grade`, `PlannedSession`, `ActivityFeedEntry`, `MemoryEntry`, `Extension`, `StudentPreference`, `OnboardingState`) per `docs/architecture/01-shared-contracts.md`
- `protocol/` — WebSocket message schemas (`client-messages.ts`, `server-events.ts`), IPC channel schemas, JSON-RPC envelope
- `errors/` — Typed error hierarchy (`CanvasAuthError`, `CodexSpawnError`, `CodexTimeoutError`, `JsonRpcParseError`, `PluginStartError`, `VaultDecryptError`, `MemoryWriteError`, `SchemaDecodeError`, `PolicyDeniedError`)
- Barrel export from `index.ts`

**Install dependencies in `packages/server`:**
- `effect`, `@effect/schema`, `@effect/platform`, `better-sqlite3` (or use `bun:sqlite`), `ws`

**Build out `packages/server/src/`:**
- `config/ConfigService.ts` — Load config from defaults + file + env
- `db/Database.ts` — Effect Service wrapping SQLite connection
- `db/migrations/001-initial.ts` — Core tables from `docs/DEPENDENCY-GRAPH.md` DDL: `canvas_accounts`, `courses`, `coursework_items`, `canvas_sync_log`, `tasks`, `planned_sessions`, `activity_feed`, `settings`, `onboarding_state`, `user_preferences`
- `ws/WebSocketServer.ts` — Effect Service: accept connections, validate messages against shared protocol
- `ws/Router.ts` — Message-to-handler dispatch
- `index.ts` — Bootstrap: compose Layers, run server, listen on configurable port

**Acceptance:** `bun run dev:server` starts a WebSocket server on a configurable port, creates the SQLite DB, runs migrations, and accepts connections.

### Person B: Electron Shell + React UI Shell

**Install dependencies in `packages/electron`:**
- `electron`, `electron-forge` toolchain (or `electron-vite`), `@student-claw/shared`

**Build out `packages/electron/src/`:**
- `main.ts` — BrowserWindow creation, load Vite dev server URL (dev) or bundled HTML (prod)
- `preload.ts` — `contextBridge` exposing typed `electronAPI` (send, on, invoke)
- `ipc/bridge.ts` — IPC handler registry with channel constants from shared contracts
- `tray/tray.ts` — System tray icon + context menu (show/hide, quit)
- Server lifecycle: spawn `packages/server` as child process, inject port, monitor health

**Build out `packages/ui/src/`:**
- Install `react-router` (or `@tanstack/react-router`), `zustand`
- `App.tsx` — App shell with persistent left `Sidebar` rail + main content region + right `Sheet` for chat slide-over (per `docs/frontend-design/ui-screen-map-v1.md`)
- `hooks/useWebSocket.ts` — WebSocket client connecting to local server, typed send/subscribe using shared protocol
- `hooks/useStreaming.ts` — Token assembly for chat streaming
- `stores/` — Zustand stores: `chatStore`, `canvasStore`, `dashboardStore`, `plannerStore`, `settingsStore`, `onboardingStore`
- Placeholder route stubs: `/` (Dashboard), `/chat`, `/onboarding`, `/settings`, `/activity`
- `lib/ws-client.ts` — Low-level WS client with reconnection logic

**Acceptance:** `bun run dev` launches Electron, which spawns the server and loads the React UI. The UI connects via WebSocket and shows the app shell with navigation. Sending a test message through WS reaches the server router.

---

## Phase 1 — AI Harness + Chat UI (Weeks 2-3)

**Goal:** Student can chat with the AI through the app. Messages flow: React --> WS --> Server --> Codex CLI --> stream back.

### Person A: AI Harness Backend (Weeks 2-3)

**Install:** `@openai/codex` (pin a known-good version)

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

**Wire into WS Router:** Handle `chat.sendMessage`, `chat.interrupt` messages.

**Create `soul/SOUL.md`** with immutable core personality per `docs/features/01-ai-harness.md` Soul section.

### Person B: Chat UI (Weeks 2-3)

**Build `packages/ui/src/components/chat/`:**
- `ChatContainer.tsx` — Full chat view with message list, auto-scroll, scroll-to-bottom
- `MessageBubble.tsx` — User/assistant message rendering with markdown support
- `PromptInput.tsx` — Input bar with send button, Stop button during streaming
- `StreamingResponse.tsx` — Live token assembly display
- `ReasoningBlock.tsx` — Collapsible "thinking" blocks
- `ToolCallIndicator.tsx` — Show when AI is calling a tool

**Build chat as right `Sheet` slide-over** (per ui-screen-map: "Keep dashboard context visible while interacting with AI").

**Wire `chatStore.ts`:** Manage conversation history, streaming state, active session. Connect to `useWebSocket` and `useStreaming` hooks.

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
| `packages/shared` | `effect`, `@effect/schema` |
| `packages/server` | `effect`, `@effect/schema`, `@effect/platform`, `ws`, `@openai/codex`, `mem0ai`, `openai` |
| `packages/electron` | `electron`, `@electron-forge/cli` (+ makers/plugins), `@student-claw/shared` |
| `packages/ui` | `react-router` (or `@tanstack/react-router`), `zustand` |
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
