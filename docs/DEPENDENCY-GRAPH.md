# Student Claw — Feature Dependency Graph

This document maps every feature and architecture layer in Student Claw, showing what depends on what and the order things need to be built. Each node points to its detailed write-up.

---

## How to Read This

- **Arrows mean "depends on"** — if Feature A points to Feature B, then B must exist (at least as an interface) before A can work.
- **Layers** are grouped by architectural tier (Foundation, Infrastructure, Features, UI).
- **File links** point to the detailed write-up for each piece.

---

## Dependency Map

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    FOUNDATION                           │
                    │                                                         │
                    │   Shared Contracts          Electron Shell              │
                    │   (Effect Schema)           (Desktop Wrapper)           │
                    │   01-shared-contracts.md     02-electron-shell.md       │
                    └──────────┬──────────────────────────┬───────────────────┘
                               │                          │
                    ┌──────────▼──────────────────────────▼───────────────────┐
                    │                 CORE INFRASTRUCTURE                      │
                    │                                                          │
                    │   WebSocket Server    SQLite DB    IPC Bridge   Vault    │
                    │   (Effect-TS)         (Effect-TS)  (Electron)   (safe-   │
                    │                                                 Storage) │
                    │   → covered in 03-local-server.md                        │
                    └──┬──────────┬───────────┬──────────────┬────────────────┘
                       │          │           │              │
          ┌────────────▼──┐  ┌───▼────────┐  │   ┌──────────▼──────────┐
          │ 1. AI Harness │  │ 7. File    │  │   │ 5. Plugin System    │
          │               │  │    System  │  │   │    (MCP Orchestrator)│
          │ 01-ai-harness │  │ 07-file-   │  │   │ 05-plugin-system.md │
          │ .md           │  │ system.md  │  │   │                     │
          └──────┬────────┘  └─────┬──────┘  │   └──────────┬──────────┘
                 │                 │         │              │
                 │           ┌─────▼─────────▼┐  ┌─────────▼──────────┐
                 │           │ 4. Memory      │  │ 2. Canvas           │
                 │           │    System      │  │    Integration      │
                 │           │ (mem0 +        │  │    (MCP Server)     │
                 │           │  entity tags)  │  │ 02-canvas-          │
                 │           │ 04-memory-     │  │ integration.md      │
                 │           │ system.md      │  │                     │
                 │           └──┬──────┬──────┘  └────┬──────────┬────┘
                 │              │      │              │          │
          ┌──────▼──────────────▼──┐   │    ┌─────────▼────┐     │
          │ 3. Skill System        │   │    │ 9. Smart     │     │
          │ 03-skill-system.md     │   │    │    Planner   │     │
          └──────────┬─────────────┘   │    │ 09-smart-    │     │
                     │                 │    │ planner.md   │     │
                     │                 │    └──────┬───────┘     │
                     │                 │           │             │
                     │    ┌────────────▼───────────▼─────┐      │
                     │    │ 10. Notification Service      │      │
                     │    │ 10-notification-service.md    │      │
                     │    └────────────┬─────────────────┘      │
                     │                 │                         │
                     │    ┌────────────▼─────────────────────────▼────┐
                     │    │ 6. Dashboard                              │
                     │    │ 06-dashboard.md                           │
                     │    └────────────┬─────────────────────────────┘
                     │                 │
          ┌──────────▼─────────────────▼─────────────────────────────┐
          │                     8. Onboarding                        │
          │  08-onboarding.md                                        │
          │  (depends on Canvas, AI Harness, Plugin System,          │
          │   Memory, Smart Planner)                                 │
          └──────────────────────────────────────────────────────────┘
```

**Critical path:** Foundation → Infrastructure → AI Harness → Memory System → Canvas → Smart Planner → Dashboard

Everything else can be parallelized around this spine.

---

## Build Order (Phases)

Each phase can begin once its dependencies from the previous phase are at least stubbed.

### Phase 0 — Foundation (Week 1)

| Piece | Write-up | What it establishes |
|-------|----------|---------------------|
| Shared Contracts | [01-shared-contracts.md](architecture/01-shared-contracts.md) | Effect Schema domain types, transport contracts (WebSocket + IPC), typed errors |
| Electron Shell | [02-electron-shell.md](architecture/02-electron-shell.md) | BrowserWindow, preload, IPC bridge, utilityProcess API |
| Monorepo structure | — | `packages/electron`, `packages/server`, `packages/ui`, `packages/shared`, `packages/skills` |
| SQLite initialization | — | Database file creation, migration system |

### Phase 1 — Core Infrastructure (Week 1-2)

| Piece | Write-up | What it establishes |
|-------|----------|---------------------|
| Local Server | [03-local-server.md](architecture/03-local-server.md) | Effect-TS server, WebSocket, SQLite, Layer composition |
| React UI Shell | [04-react-ui.md](architecture/04-react-ui.md) | Vite + React skeleton, typed WebSocket + IPC hooks, router, shadcn base |

### Phase 2 — Parallel Feature Tracks (Weeks 2-3)

| Piece | Write-up | Dependencies | Week |
|-------|----------|--------------|------|
| AI Harness: process management | [01-ai-harness.md](features/01-ai-harness.md) | WebSocket Server, Shared Contracts | 2 |
| AI Harness: JSON-RPC + streaming | [01-ai-harness.md](features/01-ai-harness.md) | Process management | 2 |
| AI Harness: ChatGPT OAuth | [01-ai-harness.md](features/01-ai-harness.md) | Process management | 2 |
| Plugin System | [05-plugin-system.md](features/05-plugin-system.md) | Electron Shell, IPC Bridge, Vault | 2 |
| File System | [07-file-system.md](features/07-file-system.md) | Electron Shell, SQLite | 2 |
| Memory System: mem0 integration | [04-memory-system.md](features/04-memory-system.md) | SQLite, AI Harness (for LLM) | 3 |
| Memory System: profile compiler | [04-memory-system.md](features/04-memory-system.md) | mem0 integration | 3 |
| Soul.md + context assembler | [01-ai-harness.md](features/01-ai-harness.md) | Memory System, Skill System | 3 |

### Phase 3 — Data Features (Weeks 4-5)

| Piece | Write-up | Dependencies | Week |
|-------|----------|--------------|------|
| Canvas MCP server scaffold | [02-canvas-integration.md](features/02-canvas-integration.md) | Plugin System | 4 |
| Canvas REST API client | [02-canvas-integration.md](features/02-canvas-integration.md) | Canvas MCP scaffold | 4 |
| Canvas background sync + change events | [02-canvas-integration.md](features/02-canvas-integration.md) | Canvas client, SQLite | 4 |
| Smart Planner: task analyzer + decomposer | [09-smart-planner.md](features/09-smart-planner.md) | AI Harness, Canvas, Memory | 5 |
| Smart Planner: slot finder + schedule builder | [09-smart-planner.md](features/09-smart-planner.md) | Memory (routines), SQLite | 5 |
| Plan-mode skill | [03-skill-system.md](features/03-skill-system.md) | Skill System, Smart Planner | 5 |

### Phase 4 — Intelligence Layer (Weeks 6-7)

| Piece | Write-up | Dependencies | Week |
|-------|----------|--------------|------|
| Dashboard: layout + priority queue + grades | [06-dashboard.md](features/06-dashboard.md) | Canvas, Memory | 6 |
| Dashboard: weekly calendar + completion check-ins | [06-dashboard.md](features/06-dashboard.md) | Smart Planner | 6 |
| Dashboard: real-time updates (WS + IPC push) | [06-dashboard.md](features/06-dashboard.md) | Canvas sync events | 6 |
| Notification evaluator + composer | [10-notification-service.md](features/10-notification-service.md) | Canvas change events, Memory (preferences) | 7 |
| Notification delivery + quiet hours | [10-notification-service.md](features/10-notification-service.md) | Electron Notification API | 7 |
| Reschedule engine (event-driven) | [09-smart-planner.md](features/09-smart-planner.md) | Canvas change events, Notification Service | 7 |

### Phase 5 — Personality + Skills + Onboarding (Weeks 8-9)

| Piece | Write-up | Dependencies | Week |
|-------|----------|--------------|------|
| Soul.md v1 (craft personality) | [01-ai-harness.md](features/01-ai-harness.md) | Design task | 8 |
| Adaptive layer updates via mem0 | [04-memory-system.md](features/04-memory-system.md) | mem0, Soul.md | 8 |
| Skills loader + bundled skills authoring | [03-skill-system.md](features/03-skill-system.md) | File System | 8 |
| Skill editor UI | [03-skill-system.md](features/03-skill-system.md) | React UI | 8 |
| Insight generator (weekly analysis) | [10-notification-service.md](features/10-notification-service.md) | AI Harness, Dashboard data | 8 |
| Onboarding wizard UI | [08-onboarding.md](features/08-onboarding.md) | All features | 9 |
| Initial plan generation after onboarding | [08-onboarding.md](features/08-onboarding.md) | Smart Planner, Onboarding | 9 |
| App walkthrough / first-run tour | [08-onboarding.md](features/08-onboarding.md) | Dashboard, Onboarding | 9 |

### Phase 6 — Integration Testing + Polish (Week 10)

| Task | Details |
|------|---------|
| End-to-end flow testing | New user → onboarding → first plan → complete sessions → memory extraction → next day |
| Codex error handling | Rate limits, auth expiry, subprocess crashes, network failures |
| Canvas edge cases | Unpublished assignments, missing due dates, non-standard Canvas configs |
| Memory testing | Simulate a full semester of data, verify retrieval quality + context budget |
| Notification reliability | Verify notifications fire correctly, quiet hours work, queue drains |
| Performance | App startup time, Codex cold start, Canvas sync latency |
| Offline graceful degradation | Cached Canvas data + local memory should still work for basic chat |

---

## SQLite Schema (Core Tables)

```sql
-- Canvas sync snapshot
CREATE TABLE canvas_accounts (
    id INTEGER PRIMARY KEY,
    base_url TEXT NOT NULL,
    last_validated_at DATETIME
);

CREATE TABLE courses (
    id INTEGER PRIMARY KEY,
    canvas_account_id INTEGER REFERENCES canvas_accounts(id),
    canvas_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    professor TEXT,
    term TEXT,
    last_sync_at DATETIME
);

CREATE TABLE coursework_items (
    id INTEGER PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    source_type TEXT NOT NULL,        -- 'assignment' | 'module' | 'page' | 'announcement'
    source_id TEXT NOT NULL,
    canonical_canvas_assignment_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    effective_due_at DATETIME,
    source_due_date_kind TEXT,        -- 'base' | 'override' | 'inferred'
    points_possible REAL,
    submission_status TEXT,
    grade REAL,
    grade_posted_at DATETIME,
    cached_at DATETIME,
    last_verified_at DATETIME,
    source_updated_at DATETIME,
    freshness_status TEXT,
    raw_source_snapshot TEXT,
    deleted_by_user INTEGER DEFAULT 0,
    last_sync_at DATETIME
);

CREATE TABLE canvas_sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,        -- 'coursework_item', 'grade', 'announcement'
    entity_id INTEGER,
    change_type TEXT NOT NULL,        -- 'added', 'updated', 'removed'
    old_value TEXT,                   -- JSON of previous state
    new_value TEXT,                   -- JSON of new state
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notified INTEGER DEFAULT 0
);

-- Smart Planner
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_work_item_id INTEGER REFERENCES coursework_items(id),
    course_id INTEGER REFERENCES courses(id),
    title TEXT NOT NULL,
    urgency_zone TEXT,                -- 'red', 'yellow', 'green'
    impact_score REAL,
    effort_confidence REAL,
    estimated_minutes INTEGER,
    needs_splitting INTEGER DEFAULT 0,
    deadline DATETIME,
    status TEXT DEFAULT 'pending',    -- 'pending', 'planned', 'completed', 'skipped', 'cancelled'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE planned_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    session_label TEXT,               -- "Research phase", "Writing session 2/3"
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status TEXT DEFAULT 'scheduled',  -- 'scheduled', 'completed', 'skipped', 'partial', 'unresolved', 'cancelled'
    completion_note TEXT,             -- student's "yes, but..." note
    completed_at DATETIME
);

-- Notification Service (feed-first model)
CREATE TABLE activity_feed (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,           -- 'canvas', 'planner', 'workflow', 'insight'
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    priority TEXT DEFAULT 'normal',
    workflow_run_id TEXT,
    source_event TEXT,
    scheduled_for DATETIME,
    os_notified INTEGER DEFAULT 0,
    os_notified_at DATETIME,
    chat_surfaced INTEGER DEFAULT 0,
    read_at DATETIME,
    deep_link TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings and onboarding
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL                -- JSON encoded
);

CREATE TABLE onboarding_state (
    step TEXT PRIMARY KEY,
    status TEXT NOT NULL,              -- 'pending', 'completed', 'skipped'
    completed_at DATETIME
);
```

Memory is stored in mem0's own SQLite databases (`vectors.db` and `history.db`), not in the main app database.

---

## Technology Slot-In Map

| Technology | Architecture Layer | Features It Powers | Detailed In |
|---|---|---|---|
| **Effect-TS** | Server (Tier 2b), Shared Contracts | All backend services, schema validation, concurrency | [03-local-server.md](architecture/03-local-server.md), [01-shared-contracts.md](architecture/01-shared-contracts.md) |
| **T3 Code pattern** | Overall monorepo | Three-tier separation | [PROJECT-SUMMARY.md](PROJECT-SUMMARY.md) |
| **Electron** | Shell (Tier 1) | Desktop wrapper, plugin sandboxing, vault, native OS notifications | [02-electron-shell.md](architecture/02-electron-shell.md) |
| **shadcn AI Chatbot** | React UI (Tier 2a) | Chat interface components | [04-react-ui.md](architecture/04-react-ui.md) |
| **Soul.md** | AI Harness | Assistant personality/identity (immutable core + adaptive layer) | [01-ai-harness.md](features/01-ai-harness.md) |
| **mem0** | Memory System | Adaptive memory extraction, entity-partitioned vector search, profile compilation | [04-memory-system.md](features/04-memory-system.md) |
| **MCP Market / Servers** | Plugin System (Tier 3) | Discoverable plugin ecosystem | [05-plugin-system.md](features/05-plugin-system.md) |
| **Codex CLI** | AI Harness (subprocess) | ChatGPT subscription auth, native MCP support | [01-ai-harness.md](features/01-ai-harness.md) |
| **SQLite** | Local Server | Local-first persistence, single file, no server dependency | [03-local-server.md](architecture/03-local-server.md) |
| **Recharts** | React UI | Grade charts, progress visualization | [06-dashboard.md](features/06-dashboard.md) |

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| AI backbone | Codex app-server (subprocess) | ChatGPT subscription auth, native MCP support |
| Runtime | Bun | Fast startup, native SQLite, TS-first |
| Backend framework | Effect-TS | Structured concurrency, typed errors, composable services |
| Database | SQLite | Local-first, single file, no server dependency |
| Memory engine | mem0 with entity partitioning | Scoped retrieval, automatic contradiction resolution, real-time extraction |
| Embeddings | OpenAI text-embedding-3-small | Quality + student already has auth. ~$0.02/1M tokens |
| MCP SDK | @modelcontextprotocol/sdk | Official TypeScript SDK, stable |
| Planner strategy | Hybrid (AI reasoning + deterministic scheduling) | AI estimates and decomposes; code enforces constraints |
| Skills format | Markdown with YAML frontmatter | Simple, authorable, shareable |
| Token encryption | Electron safeStorage | OS-level encryption (Keychain on macOS, etc.) |
| Background sync | Effect-TS Schedule (adaptive: 15min active / 1hr tray) | Lightweight, no AI cost for polling |
| Notifications | Electron Notification API | Native OS integration, works in tray mode |

---

## File Index

### Architecture Layers
- [01-shared-contracts.md](architecture/01-shared-contracts.md) — Effect Schema types, protocol, errors
- [02-electron-shell.md](architecture/02-electron-shell.md) — Tier 1 desktop wrapper
- [03-local-server.md](architecture/03-local-server.md) — Tier 2b Effect-TS backend
- [04-react-ui.md](architecture/04-react-ui.md) — Tier 2a React frontend
- [05-external-services.md](architecture/05-external-services.md) — Tier 3 Codex CLI, Canvas API, MCP servers

### Feature Branches
- [01-ai-harness.md](features/01-ai-harness.md) — Codex CLI, Soul.md (personality), streaming, sessions, context budget
- [02-canvas-integration.md](features/02-canvas-integration.md) — MCP server, background sync, typed change events, grade tracking
- [03-skill-system.md](features/03-skill-system.md) — Markdown skills, skill editor, context budget, plan-mode skill file
- [04-memory-system.md](features/04-memory-system.md) — mem0 entity partitioning, profile compiler, MEMORY.md projection
- [05-plugin-system.md](features/05-plugin-system.md) — MCP Orchestrator, sandboxing, vault
- [06-dashboard.md](features/06-dashboard.md) — Grades, deadlines, weekly calendar, completion check-ins, insight cards
- [07-file-system.md](features/07-file-system.md) — Local storage, MD/PDF viewers
- [08-onboarding.md](features/08-onboarding.md) — Setup wizard, routines input, first sync, plan-mode demo
- [09-smart-planner.md](features/09-smart-planner.md) — Task analysis, scheduling, rescheduling, completion handling
- [10-notification-service.md](features/10-notification-service.md) — Event-driven notifications, insight generation, quiet hours
