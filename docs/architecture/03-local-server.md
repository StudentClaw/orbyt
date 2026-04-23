# Architecture Layer: Local Server (Tier 2b)

## What It Is

The Local Server is the brain of Orbyt. It's an Effect-TS application running as a child process spawned by Electron. It hosts the WebSocket server for real-time UI communication, manages SQLite and feature services, coordinates the AI harness, and orchestrates backend behavior. Every feature's policy and domain logic lives here, while Electron Main owns desktop process hosting and plugin process control.

---

## Why Effect-TS

Effect-TS was chosen as the runtime for the server because it solves problems that are especially painful in a local-first AI application:

| Problem | Effect-TS Solution |
|---|---|
| Multiple concurrent operations (sync, AI, plugins) | Structured concurrency with Fibers |
| AI calls that timeout or fail | Type-safe error handling, retry with backoff |
| Complex dependency wiring (DB, AI, plugins, memory) | Layer-based dependency injection |
| Streaming tokens while handling tool calls | Composable async pipelines with interruption |
| Resource cleanup (DB connections, child processes) | Scope-based resource management |
| Schema validation at every boundary | Effect Schema (shared with the frontend) |

Effect replaces what would otherwise be a sprawl of try/catch, Promise.all, manual dependency wiring, and one-off error handling.

---

## Core Infrastructure Services

These are the foundational Effect Services that all features build on.

### 1. WebSocket Server

Real-time bidirectional communication with the React UI.

- Accepts connections from the Electron BrowserWindow
- Routes incoming messages to the appropriate feature handler
- Pushes events to the UI (streaming tokens, sync progress, alerts)
- Uses Effect Schema to validate every message against the Shared Contracts protocol

### 2. SQLite Database

Local persistence layer for all structured data.

- Connection pool managed as an Effect Service
- Migrations run on server start
- Repositories pattern: `AssignmentRepo`, `CourseRepo`, `GradeRepo`, `MemoryRepo`
- All queries wrapped in Effect for typed error handling

### 3. Configuration Service

Loads app configuration from multiple sources.

- Default values (hardcoded sensible defaults)
- Config file (`~/.orbyt/config.json`)
- Environment variables (from Electron Main Process)
- Student preferences (from SQLite, set during Onboarding)

---

## Feature Service Composition

Each feature is an Effect Service (or set of services) that declares its dependencies via Layers.

```
Server Bootstrap
  ├── ConfigService (no deps)
  ├── DatabaseService (depends on: Config)
  ├── WebSocketService (depends on: Config)
  ├── FileService (depends on: Config, Database)
  ├── MemoryService (depends on: Database, Mem0Integration)
  ├── SkillEngine (depends on: FileService, MemoryService)
  ├── SkillPolicyGate (depends on: Config, Database)
  ├── CodexCliManager (depends on: Config, WebSocket)
  ├── PluginGateway (depends on: IPCBridgeToMain)
  ├── ContextAssembler (depends on: MemoryService, SkillEngine, PluginGateway, CodexCli)
  ├── CanvasSyncService (depends on: Config, Database, PluginGateway)
  ├── CanvasDiffEngine (depends on: Database)
  ├── PlannerService (depends on: CodexCli, MemoryService, CanvasSyncService, Database, SkillPolicyGate)
  ├── NotificationService (depends on: CanvasDiffEngine, PlannerService, MemoryService, CodexCli)
  ├── DashboardService (depends on: CanvasSyncService, MemoryService, PlannerService, NotificationService)
  └── OnboardingService (depends on: Config, Database, CanvasSyncService, MemoryService, PlannerService, CodexCliManager)
```

At startup, Effect composes all Layers into a single dependency graph, validates that all requirements are met at compile time, and runs the server. If any layer fails to initialize, the error is typed and reported.

---

## Data Flow: Request Lifecycle

A typical request flows through the server like this:

```
1. React UI sends WebSocket message: { method: "chat.sendMessage", params: { text: "What's due?" } }
2. WebSocket Router decodes the message using Effect Schema
3. Router dispatches to ChatHandler
4. ChatHandler asks ContextAssembler to build the prompt:
   a. Load Soul.md identity
   b. Check active skills, inject their prompts
   c. Query MemoryService for relevant memories
   d. Get available tools from PluginGateway (served by Main-owned Plugin Orchestrator)
   e. Include recent conversation history
5. ChatHandler sends assembled prompt to CodexCliManager via JSON-RPC
6. CodexCliManager streams tokens back
7. ChatHandler pushes each token chunk to UI via WebSocket: { event: "chat.streaming", data: { chunk, sequence } }
8. If Codex emits a tool call (e.g., "get_assignments"):
   a. ChatHandler pauses streaming
   b. Routes tool call to PluginGateway → Electron Main Plugin Orchestrator → Canvas plugin
   c. Main Orchestrator returns normalized tool result (or typed policy/error outcome)
   d. ChatHandler feeds data back to Codex CLI
   e. Streaming resumes
9. On completion, ChatHandler sends { event: "chat.complete" }
10. Post-conversation, MemoryService triggers mem0 real-time extraction (ADD/UPDATE/DELETE facts)
```

---

## Error Handling Strategy

Effect-TS errors are values tracked in the type system. The server never throws.

**Error propagation:**
```
Feature Service returns Effect<Result, FeatureError, Dependencies>
  → Router catches FeatureError
  → Maps to user-friendly WebSocket error event
  → UI displays appropriate message
```

**Recovery strategies by error type:**
| Error Category | Strategy |
|---|---|
| Transient (network, timeout) | Retry with exponential backoff (Effect.retry) |
| Auth (expired token) | Prompt re-auth via UI |
| Data (parse failure) | Log, skip corrupted record, continue |
| Fatal (DB corruption) | Graceful shutdown, prompt user to contact support |
| Policy denied (capability/risk) | Return actionable denial event; require explicit user approval or settings change |

---

## Proposed File Structure

```
packages/server/
  package.json
  tsconfig.json
  src/
    index.ts                    # Server bootstrap: compose Layers, run
    config/
      ConfigService.ts          # Load and merge configuration
      defaults.ts               # Default values
    ws/
      WebSocketServer.ts        # Effect service: accept, route, broadcast
      Router.ts                 # Message → handler dispatch
      Handlers.ts               # Handler registry
    db/
      Database.ts               # Effect service: SQLite connection pool
      migrations/
        001-initial.ts          # Schema: courses, assignments, grades, sync_log
        002-planner.ts          # Schema: tasks, planned_sessions
        003-notifications.ts    # Schema: activity_feed, queued_os_notifications
        004-onboarding.ts       # Schema: onboarding state, settings
      repositories/
        CourseRepo.ts
        AssignmentRepo.ts
        GradeRepo.ts
        TaskRepo.ts             # Smart Planner tasks
        SessionRepo.ts          # Planned sessions
        ActivityFeedRepo.ts     # Unified activity feed + notification delivery state
        PreferenceRepo.ts
    ai/                         # → see 01-ai-harness.md
    canvas/                     # → see 02-canvas-integration.md
      CanvasSyncService.ts      # Server-owned scheduling + metadata refresh orchestration
      CanvasDiffEngine.ts       # Typed change events (AssignmentAdded, DeadlineChanged, etc.)
    skills/                     # → see 03-skill-system.md
    memory/                     # → see 04-memory-system.md
    planner/                    # → see 09-smart-planner.md
    notifications/              # → see 10-notification-service.md
    files/                      # → see 07-file-system.md
    dashboard/                  # → see 06-dashboard.md
    onboarding/                 # → see 08-onboarding.md
    mcp/
      PluginGateway.ts          # Server interface to Main-owned orchestrator
      ToolInventory.ts          # Cached tool schemas from active plugins
      ToolRouter.ts             # Routes AI tool calls through gateway
```

---

## Open Questions

- **Bun vs. Node**: The project summary says Bun runtime. Effect-TS supports both. Should we commit to Bun for speed, or stay on Node for broader Electron compatibility?
- **Server as separate process vs. in-process**: The server runs as a child process of Electron. Could it run in the Main Process instead (simpler, but blocks the event loop)?
- **Port allocation**: How do we ensure the WebSocket port doesn't conflict with other apps on the student's machine?
- **Hot reload in dev**: Can the server hot-reload during development, or does it require a restart?
