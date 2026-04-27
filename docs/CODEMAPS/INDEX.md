<!-- Generated: 2026-04-27 | Files scanned: 40+ | Token estimate: ~150 -->

# Student Claw Codemaps Index

**Last Updated**: 2026-04-27  
**Monorepo**: TypeScript + Bun + Effect.js  
**Main Tech Stack**: React 18, Express, Electron, SQLite

## Codemap Files

### [architecture.md](./architecture.md)
High-level system diagram, service boundaries, and data flow between UI ↔ Server ↔ External services.

**Key Sections**:
- System diagram (Electron → Server → React UI → Canvas/Codex)
- Service boundary table (10 core services)
- 3 major data flows: chat turns, Canvas sync, DNA classification
- RPC protocol (WebSocket, orbyt.v1)
- Architecture decisions

### [backend.md](./backend.md)
API routes, WebSocket handlers, service implementations, database schema.

**Key Sections**:
- RPC method routing table (50+ methods across 8 domains)
- Service implementations (OrchestrationService, CanvasSyncService, CodexCli, MemorizeService)
- Database schema (workspaces, threads, turns, Canvas data, user state)
- Dependency injection layers (Effect.js)
- Error handling patterns

### [frontend.md](./frontend.md)
Page tree, component hierarchy, state management, custom hooks.

**Key Sections**:
- TanStack Router page structure (dashboard, chat, onboarding, settings)
- Component tables by feature (Dashboard, Onboarding, Chat, Settings)
- Zustand stores + TanStack Query integration
- Custom hook reference (12 hooks)
- RPC subscription channels
- Component hierarchy diagram

### [data.md](./data.md)
Shared type contracts, schemas, protocol definitions, external service interfaces.

**Key Sections**:
- RPC method constants + push channels
- Core schema definitions (Workspace, Thread, Turn, Provider, Canvas, DNA)
- Request/response param shapes
- Domain event types
- External service contracts (Canvas API, CodexCli, MCP)
- Environment variables

### [dependencies.md](./dependencies.md)
External services, third-party integrations, dependency graph, security.

**Key Sections**:
- Core dependencies by package
- External service integrations (Canvas, Codex CLI, MCP, OAuth)
- Dependency layers (Effect.js DI)
- Architecture diagram
- Security considerations

---

## Quick Navigation

### Finding Code

**I need to...**

- **Understand the system architecture** → Read [architecture.md](./architecture.md)
- **Add a new RPC method** → See method patterns in [backend.md](./backend.md)
- **Add a new UI page** → Check page tree in [frontend.md](./frontend.md)
- **Understand data types** → Reference [data.md](./data.md)
- **Integrate a new service** → See external services in [dependencies.md](./dependencies.md)

---

### Package Structure

```
packages/
├── contracts/src/
│   ├── protocol/orchestration.ts     ← RPC method constants + push channels
│   ├── schemas/                       ← All type definitions
│   └── index.ts                       ← Type exports
├── server/src/
│   ├── ws/Router.ts                   ← RPC dispatcher (see backend.md)
│   ├── orchestration/                 ← Chat service
│   ├── canvas/                        ← Canvas sync
│   ├── ai/CodexCli.ts                 ← Provider wrapper
│   ├── memory/                        ← Distillation service
│   ├── onboarding/                    ← DNA classification
│   └── index.ts                       ← Effect layer setup
├── ui/src/
│   ├── pages/                         ← Page components
│   ├── components/                    ← Component tree
│   ├── hooks/                         ← Custom hooks
│   ├── rpc/wsRpcClient.ts             ← RPC client
│   └── router.tsx                     ← Route definitions
├── electron/src/
│   ├── main.ts                        ← App entry
│   ├── ipc/bridge.ts                  ← IPC handler
│   ├── plugins/                       ← Plugin system
│   └── codex/                         ← Codex sandbox
└── shared*/src/
    └── Shared utilities + types
```

---

## Common Tasks

### Adding a New Feature

1. **Define types** in `packages/contracts/src/schemas/` (Effect/Schema)
2. **Add RPC method** to `packages/contracts/src/protocol/orchestration.ts`
3. **Implement server handler** in `packages/server/src/ws/Router.ts`
4. **Add service logic** in `packages/server/src/[domain]/`
5. **Create UI component** in `packages/ui/src/components/[domain]/`
6. **Add page** or integrate into existing page in `packages/ui/src/pages/`
7. **Export from wsRpcClient** in `packages/ui/src/rpc/wsRpcClient.ts`

### Testing

- Server: `bun test --cwd packages/server`
- UI: `bun --cwd packages/ui vitest run`

### Building

- `bun run build` — Full monorepo build
- `bun run dev` — Electron app dev mode
- `bun run dev:ui` — React dev server only
- `bun run dev:server` — Server dev mode

---

## Service Ownership

| Service | Maintainer | Code |
|---------|------------|------|
| **Orchestration** (chat) | Backend | `packages/server/src/orchestration/` |
| **Canvas Sync** | Backend | `packages/server/src/canvas/` |
| **Provider (Codex)** | Backend | `packages/server/src/ai/` |
| **Memory Distillation** | Backend | `packages/server/src/memory/` |
| **Onboarding** | Shared | `packages/server/src/onboarding/` + UI components |
| **Dashboard** | Frontend | `packages/ui/src/components/dashboard/` |
| **Chat UI** | Frontend | `packages/ui/src/components/chat/` |
| **Plugin System** | Electron | `packages/electron/src/plugins/` |
| **IPC Bridge** | Electron | `packages/electron/src/ipc/bridge.ts` |

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `/packages/contracts/src/protocol/orchestration.ts` | RPC constants, push channels, core schemas |
| `/packages/server/src/ws/Router.ts` | RPC dispatcher, request validation, encoding |
| `/packages/server/src/orchestration/OrchestrationService.ts` | Chat logic, provider orchestration |
| `/packages/ui/src/pages/DashboardPage.tsx` | Dashboard page, filters, layout |
| `/packages/ui/src/rpc/wsRpcClient.ts` | RPC client, subscriptions, state decode |
| `/packages/electron/src/main.ts` | Electron app lifecycle |
| `/packages/server/src/index.ts` | Effect.js dependency injection setup |

---

## How to Update These Codemaps

1. **Read the code** — Focus on entry points and key files
2. **Identify changes** — New services, API routes, component structure
3. **Update relevant codemap** — One file per concern (architecture, backend, frontend, data, dependencies)
4. **Keep under 1000 tokens** — Use file paths + function signatures; avoid full code blocks
5. **Add freshness header** — Update timestamp + file count

Command: Update in `docs/CODEMAPS/*.md` after major changes.

---

**Generated by**: Documentation specialist  
**Regenerate with**: Manual scan of `/packages/*/src/` directories  
**Next review**: When major features are added or architecture changes
