<!-- Generated: 2026-04-27 | Files scanned: 8 | Token estimate: ~350 -->

# Dependencies & Integrations Codemap

## Core Runtime Dependencies

### Server (packages/server)

**Effect.js Ecosystem**:
- `effect` (^2.0) — Dependency injection, error handling, async composition
- `@effect/schema` (^0.60+) — Schema validation & encoding/decoding
- `@effect/platform` (^0.x) — Platform abstractions

**Server Framework**:
- `express` — HTTP + WebSocket server
- `ws` — WebSocket implementation (RFC 6455)
- `better-sqlite3` — Synchronous SQLite client

**AI/Provider**:
- CodexCli — Local binary (spawned as subprocess)
- MCP (Model Context Protocol) — Plugin interface

**Canvas Integration**:
- Canvas REST API (via HTTP client, credentials from env)

**Data Processing**:
- `@types/node` — TypeScript definitions
- `uuid` — Generate IDs
- `dotenv` — Environment variable loading

### UI (packages/ui)

**React Ecosystem**:
- `react` (^18.x) — UI framework
- `react-dom` (^18.x) — DOM rendering
- `@tanstack/react-router` (^1.x) — Client-side routing
- `@tanstack/react-query` (^5.x) — Server state management

**State Management**:
- `zustand` (^4.x) — Lightweight store

**Styling**:
- `tailwindcss` (^3.x) — Utility CSS
- `shadcn/ui` — Headless component library
- `class-variance-authority` — Class composition
- `clsx` — Conditional classnames

**Notifications**:
- `sonner` (^1.x) — Toast notifications

**Charts**:
- `recharts` (^2.x) — React chart library

**Utilities**:
- `@effect/schema` (shared with server for type safety)
- `zod` (optional) — Runtime validation
- `date-fns` — Date manipulation

### Electron (packages/electron)

**Electron Framework**:
- `electron` (^latest) — Desktop app framework
- `electron-builder` (^26.x) — App packaging
- `@electron/notarize` (^3.x) — macOS notarization

**Process Management**:
- `child_process` (Node.js built-in) — Spawn server subprocess
- `better-sqlite3` — Local database

**IPC**:
- Electron IPC channels (process.ipc) — Main ↔ Renderer communication

**Plugin System**:
- Custom plugin loader (src/plugins/plugin-manager.ts)
- Node.js module system for MCP servers

### Shared Types (packages/contracts)

**No external runtime deps** — Pure TypeScript/Effect schema definitions

### Build Tools

**Root package.json**:
- `bun` (^1.3.5) — Package manager + runtime
- `@electron/notarize` — App signing
- `electron-builder` — Desktop builds

## External Service Integrations

### Canvas API

**Location**: `/packages/server/src/canvas/`

**Endpoints Used**:
```
GET  /api/v1/courses                    → List courses
GET  /api/v1/courses/:id                → Course details
GET  /api/v1/courses/:id/assignments    → Course assignments
GET  /api/v1/users/self/grades_summary  → Grade summary
GET  /api/v1/courses/:id/students/me/submissions → Submission status
GET  /api/v1/courses/:id/pages/:pageId  → Course content
```

**Authentication**: Bearer token (Canvas API token in env)

**Rate Limiting**: Canvas imposes rate limits; implemented exponential backoff

**Data Cached**: In SQLite (courses, assignments, submission_status tables)

**Sync Strategy**:
- Initial sync on app start
- Manual trigger via `canvas.sync` RPC
- Cache invalidation per course

### Codex CLI (Local Provider)

**Location**: `/packages/server/src/ai/CodexCli.ts`

**Invocation**:
```bash
codex --interactive --format=json
```

**Input Protocol** (stdin):
```json
{
  "threadId": "...",
  "turnId": "...",
  "input": "user message",
  "model": "gpt-5.4",
  "attachments": []
}
```

**Output Protocol** (stdout, streaming):
```json
{ "type": "token", "value": "The..." }
{ "type": "reasoning", "value": "I..." }
{ "type": "toolCall", "tool": "name", "args": {} }
{ "type": "complete", "output": "full response" }
```

**Sandbox**: Isolated subprocess in Electron (separate node context)

**Error Handling**:
- Timeout detection
- Process restart on crash
- User-facing interruption API

### Model Context Protocol (MCP)

**Location**: `/packages/server/src/mcp/` + `/packages/electron/src/plugins/`

**Plugins Supported**:
- Canvas (course data)
- Apple Calendar (calendar integration)
- Custom template MCPs

**Plugin Interface**:
- Discover tools via `/mcp_server list_tools`
- Execute tools via `/mcp_server call_tool`
- Subscribe to resource updates

**Lifecycle** (Electron managed):
- Install: Download plugin from registry
- Start: Spawn subprocess
- Stop: Graceful shutdown
- Enabled/Disabled: Store toggle state

### OAuth / External Auth

**Providers**:
- Codex (via CodexCli) — Local provider, no remote auth
- Canvas — Token-based (long-lived API token)
- Optional: Apple Calendar → OAuth (future)

**Auth State Persistence**:
```
ai_auth_state         → Codex provider status
canvas_credentials    → Token storage (env)
calendar_integration  → OAuth token (if enabled)
```

### Environment Variables

**Server**:
```bash
PORT                      # Server port (default 3000)
DATABASE_PATH             # SQLite file location
CODEX_BIN_PATH            # Path to codex binary
CANVAS_API_URL            # Canvas instance URL
CANVAS_API_TOKEN          # Canvas auth token
MEMORY_GRAPH_DIR          # Memory output directory
NODE_ENV                  # "development" | "production"
LOG_LEVEL                 # "debug" | "info" | "warn"
```

**Electron**:
```bash
ELECTRON_SKIP_ASAR        # For dev
VITE_DEV_SERVER_URL       # UI dev server
NOTARIZE_PASSWORD         # macOS signing
```

**UI**:
```bash
VITE_SERVER_WS_URL        # WebSocket server URL
VITE_API_BASE_URL         # API base (for HTTP calls, if any)
```

## Development Dependencies

**Testing**:
- `bun:test` — Server tests
- `vitest` — UI component tests
- `@testing-library/react` — React testing utils
- `@testing-library/user-event` — User simulation

**Type Checking**:
- `typescript` (^5.x) — Type compiler
- `@types/node` — Node types
- `@types/express` — Express types
- `@types/ws` — WebSocket types

**Linting**:
- `eslint` — Code linting
- `prettier` — Code formatting

**Build**:
- `vite` — Frontend bundler
- `electron-vite` — Electron build tool
- `esbuild` — Fast JS bundler

**Task Running**:
- `bun` run (package.json scripts)

## Architecture: Dependency Layers

```
┌─ UI (packages/ui) ────────────────────┐
│  Depends: React, TanStack, Zustand   │
└──────────────┬───────────────────────┘
               │ WebSocket
               ▼
┌─ Server (packages/server) ────────────┐
│  Layer 1 (Core):                     │
│  ├─ ConfigService (env + config)     │
│  ├─ Database (SQLite)                │
│  ├─ PushBus (pub/sub)                │
│  ├─ ServerReadiness (startup checks) │
│  └─ SkillResolver (skill loading)    │
│                                      │
│  Layer 2 (Provider):                 │
│  ├─ CodexCli (subprocess)            │
│  ├─ ProviderRuntimeStore (state)     │
│  └─ PluginGateway (MCP bridge)       │
│                                      │
│  Layer 3 (Services):                 │
│  ├─ OrchestrationService             │
│  ├─ CanvasSyncService                │
│  ├─ MemorizeService                  │
│  ├─ OnboardingService (Router)       │
│  └─ ActivityFeedService              │
│                                      │
│  Layer 4 (HTTP):                     │
│  └─ WebSocketServer                  │
│       └─ Router (RPC dispatcher)     │
└──────────────┬───────────────────────┘
               │
┌──────────────┴────────────────────────┐
│  External Services (Layer 5):         │
│  ├─ Canvas API                       │
│  ├─ Codex Binary                     │
│  ├─ MCP Plugins                      │
│  └─ File System                      │
└──────────────────────────────────────┘

┌─ Electron (packages/electron) ────────┐
│  Manages server subprocess             │
│  IPC bridge to UI                      │
│  Plugin lifecycle                      │
│  File dialogs, notifications           │
└──────────────────────────────────────┘

┌─ Contracts (packages/contracts) ──────┐
│  Shared type definitions (all layers) │
└──────────────────────────────────────┘
```

## Dependency Graph (Key Imports)

**Router.ts** depends on:
- contracts (RPC types, schemas)
- Database (param persistence)
- OrchestrationService (chat logic)
- CanvasSyncService (course data)
- MemorizeService (memory distillation)
- PushBus (publish updates)

**OrchestrationService** depends on:
- CodexCli (provider)
- ThreadRuntimeManager (concurrency)
- ProviderRuntimeStore (provider state)
- Database (persistence)
- PushBus (broadcast events)

**CodexCli** depends on:
- PluginGateway (MCP tools)
- TurnEventBus (event streaming)
- Database (token tracking)

## Version Constraints

All packages pinned to monorepo versions via workspace refs:

```json
{
  "dependencies": {
    "@orbyt/contracts": "workspace:*",
    "@orbyt/shared": "workspace:*",
    "@orbyt/shared-runtime": "workspace:*"
  }
}
```

This ensures type safety across packages; breaking changes coordinated in single commit.

## Security Considerations

1. **No secrets in code** — All auth via env variables
2. **Subprocess isolation** — CodexCli runs in separate process
3. **IPC validation** — Electron bridge validates all messages
4. **Schema validation** — All RPC params decoded via Effect/Schema
5. **SQLite prepared statements** — Prevents SQL injection
6. **HTTPS only** — Canvas API calls use HTTPS
7. **Token rotation** — Long-lived tokens cached; refresh on demand
