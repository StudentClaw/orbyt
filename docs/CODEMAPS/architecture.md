<!-- Generated: 2026-04-27 | Files scanned: 12 | Token estimate: ~450 -->

# System Architecture Codemap

## High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    ELECTRON DESKTOP APP                         │
│  (packages/electron)                                            │
│  ├─ Main: Spawns Node.js server, manages window/tray          │
│  ├─ Preload: IPC bridge to UI (AttachmentMetadata, Auth)       │
│  └─ Codex Runtime: Isolated environment for provider CLI       │
└────────────┬────────────────────────────────────────────────────┘
             │ WebSocket (ws://)
             │ RPC Protocol: orbyt.v1
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXPRESS/NODE SERVER                          │
│  (packages/server)                                              │
│  ├─ WebSocket Router (packages/server/src/ws/Router.ts)        │
│  ├─ Orchestration Service (chat threads, workspaces)           │
│  ├─ Canvas Sync Service (course/assignment sync)               │
│  ├─ Provider Runtime (CodexCli wrapper)                        │
│  ├─ Onboarding Service (DNA classification, preferences)       │
│  ├─ Memory Service (daily distillation, weekly recap)          │
│  ├─ Skills Manager (skill fork, grant/revoke capabilities)     │
│  ├─ Activity Feed (completion tracking, weekly insights)       │
│  └─ SQLite Database                                            │
└────────────┬────────────────────────────────────────────────────┘
             │ WebSocket subscriptions
             │ Push channels (see PUSH_CHANNELS)
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                 REACT WEB UI (packages/ui)                      │
│  ├─ Pages: Dashboard, Chat, Settings, Onboarding              │
│  ├─ Components: Dashboard (assignments, grades, insights)      │
│  ├─ Hooks: useAppRuntime, useDashboard, useOrchestration      │
│  ├─ RPC Client: wsRpcClient (request/response + streams)       │
│  └─ State: TanStack Query, Zustand stores                      │
└─────────────────────────────────────────────────────────────────┘

External Services:
├─ Canvas API (via CanvasSyncService)
├─ CodexCli (local provider AI)
└─ MCP Servers (Model Context Protocol plugins)
```

## Service Boundaries

| Service | Location | Purpose | Key Methods |
|---------|----------|---------|------------|
| **OrchestrationService** | `packages/server/src/orchestration/` | Manages chat workspaces, threads, turns; routes to provider | `createWorkspace`, `sendTurn`, `getSnapshot`, `interruptTurn` |
| **WebSocketRouter** | `packages/server/src/ws/Router.ts` | RPC dispatcher; validates params; encodes responses | `routeMessage()` |
| **CanvasSyncService** | `packages/server/src/canvas/` | Fetches courses, assignments, grades from Canvas | `sync()`, `listCourses()`, `getMyUpcomingAssignments()` |
| **CodexCli** | `packages/server/src/ai/CodexCli.ts` | Wraps Codex provider; streams tokens, handles reasoning | `sendTurn()`, `interrupt()` |
| **MemorizeService** | `packages/server/src/memory/service.ts` | Daily/weekly distillation; writes to memory graph | `runIfNeeded()` |
| **MemorizeManager** | `packages/electron/src/memorize/` | Schedules memorize jobs in Electron | `schedule()` |
| **PushBus** | `packages/server/src/ws/PushBus.ts` | Pub/sub for server → client notifications | `subscribe()`, `publish()` |
| **PluginManager** | `packages/electron/src/plugins/` | Lifecycle: install, start, stop MCP plugins | `install()`, `start()`, `stop()` |
| **DnaClassifier** | `packages/server/src/onboarding/` | Classifies student onboarding answers → archetype | `classify()` |

## Data Flow

### Chat Turn Flow (User sends message)
```
UI Form → wsRpcClient.orchestration.sendTurn()
  ↓ WS Frame (RPC envelope)
Router.handleOrchestrationMethod()
  ↓ Param validation (SendTurnParams)
OrchestrationService.sendTurn()
  ↓
ThreadRuntimeManager (thread busy check)
  ↓
CodexCli.sendTurn() → streams tokens via ProviderRuntimeEvent
  ↓ Each token published to PUSH_CHANNELS.PROVIDER_RUNTIME
Electron + UI subscribe → receive tokens in real-time
```

### Canvas Sync Flow
```
canvasSync.sync() [triggered on app init or manual refresh]
  ↓ Fetches: /courses, /assignments, /submissions
Canvas API
  ↓ Cache in DB (courses, assignments, submission_status)
CanvasSyncService.listCourses() → returns cached data
  ↓ Published to PUSH_CHANNELS.CANVAS_SYNC_PROGRESS
UI receives sync status, auto-refreshes dashboard
```

### Onboarding DNA Classification Flow
```
UI: SetAnswers → websocket.onboarding.setAnswers()
  ↓ Stores in DB (onboarding_answers)
UI: ClassifyDna → websocket.onboarding.classifyDna()
  ↓ Param validation (ClassifyDnaParams)
DnaClassifier.classify(answers)
  ↓ Generates StudentDna archetype + CardWeights
Persist to student_dna table
  ↓ Memory graph write (paths created from env)
Return dna + cardWeights to UI
```

## RPC Protocol

**Subprotocol**: `orbyt.v1`

**Request Envelope**:
```typescript
{ kind: "request", id: string, method: string, params?: unknown }
```

**Response Envelope**:
```typescript
{ kind: "response", id: string, ok: true, result: unknown } |
{ kind: "response", id: string, ok: false, error: {code, message} }
```

**Push Channels** (server → client):
- `server.lifecycle` — welcome + bootstrap data
- `orchestration.domain` — thread/turn events
- `provider.runtime` — token streaming, approval requests
- `canvas.syncProgress` — course sync status
- `dashboard.update` — grade/assignment changes
- `activity.feed` — completion tracking
- `memory.updated` — memorize job results

## Key Architecture Decisions

1. **Monorepo with 4 packages**: contracts (shared types) + server, ui, electron. Workspace isolation.
2. **Effect.js for DI**: Core layers manage service dependencies; composable Layer API.
3. **WebSocket + RPC**: No HTTP; persistent connection for subscriptions + streaming.
4. **Local provider**: CodexCli wraps Codex binary; runs in isolated Electron sandbox.
5. **SQLite**: Single-user local database; migrations via schema.
6. **Memory graph**: External directory structure (JSON files); separate from app DB.
7. **MCP plugins**: Extensible via Model Context Protocol; managed by Electron.

## File Entry Points

- Server: `/packages/server/src/index.ts` (Effect layers)
- UI: `/packages/ui/src/main.tsx` (React entry)
- Electron: `/packages/electron/src/main.ts` (BrowserWindow + server spawn)
- Contracts: `/packages/contracts/src/index.ts` (type exports)
