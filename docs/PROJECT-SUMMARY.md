# Orbyt — Project Summary

## What It Is

A desktop application (Electron) that acts as a local-first AI-powered student assistant. It connects to Canvas LMS, builds a normalized local view of coursework and grades, helps students plan their week, and surfaces autonomous agent activity through a unified feed — powered by a local Codex CLI harness and optimized around the student's existing ChatGPT subscription.

## Primary Use Case (v1)

**Connect to Canvas and show students what's due, when, and help plan their week.**

---

## Architecture

Three-tier design inspired by T3 Code (pingdotgg):

1. **Electron Shell** — Thin desktop wrapper, handles native OS features (file dialogs, notifications, tray icon)
2. **Local Server** — Core logic layer running alongside the app. Manages the AI harness, sync orchestration, policy enforcement, autonomous workflows, WebSocket domain streams to the UI, and extension coordination via Electron Main
3. **External Services** — Canvas LMS, calendar providers, and other integrations via MCP servers

Communication: `React UI ↔ (WebSocket domain streams + typed IPC) ↔ Local Server ↔ Codex CLI (stdin/stdout)` and `Local Server ↔ Electron Main (plugin gateway IPC) ↔ MCP plugins`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Frontend | React + Vite |
| Backend | Effect-TS (type-safe, structured concurrency/error handling) |
| Database | SQLite (local persistence) |
| AI | Codex CLI subprocess with JSON-RPC protocol; OpenAI model APIs for mem0 extraction/embeddings (via shared auth broker) |
| Desktop | Electron |
| Shared Contracts | Effect Schema for type-safe frontend ↔ backend communication |

---

## Ten Core Feature Branches

### 1. AI Harness

Codex CLI subprocess, JSON-RPC protocol, streaming responses, session lifecycle management, context window budget manager, Soul/Personality system (immutable core + adaptive layer), context compaction, and MCP server registry.

### 2. Canvas Integration

Implemented as a Orbyt-owned TypeScript MCP plugin plus server-side sync orchestration. Course discovery, normalized `CourseWorkItem` tracking, grade retrieval, announcement scraping, and professor-pattern learning. Adaptive background sync (15min active / 1hr tray) with cache-first reads, freshness policy, and typed change events (`AssignmentAdded`, `GradePosted`, etc.) that feed the planner, notifications, and autonomous workflows.

### 3. Skill System

Two-tier skill system: curated first-party skills and student-authored custom skills. Markdown-based skill files (Cursor-style) with YAML frontmatter, plus a server-side policy gate that enforces capabilities. Six pre-installed skills (plan-mode, study-helper, essay-reviewer, exam-prep, citation-helper, explain-like). In-app Skill Editor UI with fork-and-promote flow. Context budget management for competing skills. Custom skills start in read-suggest mode with planner-scope access and can be promoted capability-by-capability.

### 4. Memory System

mem0 with entity partitioning as the single source of truth. Memory categories scoped via `user_id`, `agent_id`, and `run_id` tags. Real-time extraction after each conversation (ADD/UPDATE/DELETE pipeline). Profile compiler generates compact context for AI injection. `MEMORY.md` is the read-only human-readable projection; `SOUL.md` remains a separate personality artifact loaded by the AI Harness.

### 5. Plugin System (Local MCP Orchestrator)

Local-first MCP orchestrator in Electron's main process. Discovers extensions, validates manifests, lazy-loads plugins into isolated `utilityProcess` sandboxes, manages safeStorage-backed credentials and per-plugin permissions, and aggregates tools for the AI harness. See [Plugin Architecture](#plugin-architecture-local-mcp-orchestrator) below.

### 6. Dashboard

Desktop-first command center with a priority queue, insight cards, upcoming deadline timeline, weekly planner calendar, completion check-ins (Yes/No/Yes-but), grade overview, weekly progress, announcements, and quick actions that open chat with prefilled context.

### 7. File System

Local copy-based storage for imported and downloaded coursework, research, and generated artifacts. Built-in markdown/PDF viewers, additional document/image/code viewers, a SQLite-backed metadata index, and AI context extraction for asking the assistant about files.

### 8. Onboarding

Guided first-run setup: Canvas institution selector and token wizard, Codex auth, preference and routines capture (stored in mem0), first sync with memory population, extension recommendations, and a live dashboard walkthrough using the student's real data and first plan.

### 9. Smart Planner

The flagship intelligence feature. Hybrid AI + deterministic scheduling with streamed planning UX: task analyzer (three-layer priority model, time estimation), task decomposer (multi-session splitting), deterministic slot finder and schedule builder, rolling 6-week planning window, reschedule engine (student-initiated + event-driven), and completion handler (Yes/No/Yes-but). Persistent in SQLite (`tasks`, `planned_sessions`, `user_preferences` tables). Calendar sync is optional through installed calendar MCPs.

### 10. Notification Service

Feed-first notification and awareness system. Listens to Canvas change events, planner reminders, and autonomous workflow runs; writes durable `activity_feed` records; delivers optional native OS notifications; enforces quiet hours and per-type preferences; and generates weekly AI-powered insight cards for the Dashboard.

---

## Plugin Architecture: Local MCP Orchestrator

The plugin system follows a **local-first** design to ensure maximum user privacy — critical for sensitive student data like Canvas grades and Notion notes.

### System Overview

The application uses a **Hub-and-Spoke** model. The Electron **Main Process** acts as the central Hub (Orchestrator), while individual **MCP Servers** act as the Spokes (Plugins).

#### Key Components

| Component | Role |
|-----------|------|
| **Orchestrator (Main Process)** | Manages the lifecycle (start/stop/monitor) of plugins |
| **Plugin Sandbox (UtilityProcess)** | Each plugin runs in its own isolated Node.js environment via Electron's `utilityProcess` |
| **Local Vault** | Encrypted storage layer using Electron `safeStorage` to hold API tokens per plugin |
| **IPC Bridge** | Typed bridge used by React UI for native shell calls and by Local Server for plugin gateway calls into Main |

### Plugin Structure & Discovery

Plugins are stored in a dedicated directory under the student's local app data.

#### Directory Hierarchy

```text
~/.student-claw/
├── extensions/
│   ├── canvas-mcp/
│   │   ├── manifest.json
│   │   ├── index.js
│   │   └── canvas-icon.png
│   └── notion-mcp/
│       ├── manifest.json
│       └── index.js
└── vault/
    └── secrets.json
```

#### The `manifest.json` Standard

Every plugin must include a manifest so the Orchestrator knows how to handle it.

```json
{
  "id": "canvas-mcp",
  "name": "Canvas Assistant",
  "description": "Connects to Canvas coursework, grades, and announcements",
  "version": "1.0.0",
  "entry": "index.js",
  "permissions": ["assignments", "grades", "announcements", "modules"],
  "authType": "manual_token",
  "requiredCredentials": ["CANVAS_TOKEN", "CANVAS_BASE_URL"]
}
```

### Execution Flow (The "Handshake")

When the user sends a message in the Chat UI, the following sequence occurs:

1. **Intent Recognition** — The AI (via the Codex harness) determines if a tool is needed (e.g., "What assignments are due?").
2. **Plugin Activation** — The Orchestrator checks if `canvas-mcp` is running. If not, it spawns the process.
3. **Credential Handshake** — The Orchestrator retrieves encrypted credentials from the Vault and sends a one-time secure runtime payload to the plugin after startup.
4. **Tool Call** — The Orchestrator sends a JSON-RPC request to the Plugin, for example `callTool("list_courses")`.
5. **Result Routing** — The Plugin returns the data; the Orchestrator passes it to the AI to format a natural response for the student.

### Security & Isolation Standards

Since these plugins handle sensitive student data, the following guardrails are mandatory:

- **Process Isolation** — Never run plugins in the Renderer process. Use `utilityProcess` to ensure a crash in a plugin doesn't kill the entire UI.
- **No Network Access for UI** — The Chat UI should never have the `fetch` capability to hit Canvas directly. Only the MCP Server (running in the background) handles network requests.
- **Permission Prompting** — The first time a plugin is used, the Orchestrator must trigger a UI modal asking the student for permission to access that specific service.

### Plugin Manager Implementation

The Electron Main Process uses a dedicated manager class to control plugin lifecycles.

```javascript
import { utilityProcess } from 'electron';

class PluginManager {
  constructor(extensionDir) {
    this.extensionDir = extensionDir;
    this.instances = new Map();
  }

  async loadPlugin(pluginId, credentials) {
    const pluginPath = path.join(this.extensionDir, pluginId, 'index.js');

    const child = utilityProcess.fork(pluginPath, [], {
      stdio: 'pipe'
    });

    // One-time secure credential handshake after spawn (not env vars)
    child.postMessage({
      type: 'plugin.credentials',
      pluginId,
      payload: encryptForPlugin(credentials)
    });

    this.instances.set(pluginId, child);
    child.on('spawn', () => console.log(`${pluginId} activated.`));
  }

  async stopPlugin(pluginId) {
    const instance = this.instances.get(pluginId);
    if (instance) instance.kill();
    this.instances.delete(pluginId);
  }
}
```

### Benefits

- **Scalability** — Add 100+ integrations without bloating the main app's code.
- **User Trust** — Students can audit the `extensions` folder to see exactly what code is running.
- **Performance** — Plugins only run when needed, saving RAM and CPU on the student's laptop.

---

## Plan-Mode + Smart Planner (Flagship Feature)

Plan-mode is a skill file that instructs the AI how to approach weekly planning. The Smart Planner is the backend that executes the plan:

1. **Scans Canvas** for upcoming coursework (via MCP tools)
2. **Analyzes tasks** — importance scoring, time estimation, dependency detection (AI-driven)
3. **Decomposes large tasks** into multi-session blocks (AI-driven)
4. **Finds available slots** in the student's schedule (deterministic)
5. **Builds a draft schedule** — places sessions optimally and respects constraints (deterministic)
6. **Handles rescheduling** — student-initiated ("can't do this tonight") and event-driven (Canvas deadline moved)
7. **Tracks completion** — Yes/No/Yes-but three-way check-in with memory updates
8. **Optionally syncs to calendars** via installed calendar MCP extensions (Apple Calendar, Google Calendar) after approval

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Canvas as MCP plugin (not built into core) | Keeps server architecture clean; sets the pattern for all integrations |
| Two-tier markdown skills + server policy gate | Students can create their own workflows without turning prompt files into a privilege-escalation path |
| mem0 with entity partitioning (not discrete files) | Scoped retrieval, automatic contradiction resolution, simpler than maintaining 15+ markdown files |
| Hybrid planner (AI reasoning + deterministic scheduling) | AI estimates and decomposes; code enforces constraints and prevents hallucinated schedules |
| Effect-TS | Type safety and structured error handling works well with LLM-driven code |
| ChatGPT subscription support | Removes friction — students likely already have a subscription |
| Adaptive Canvas sync (15min active / 1hr tray) | Resource-conscious on student laptops |
| OpenAI text-embedding-3-small for memory | Quality retrieval, student already has auth, ~$0.02/1M tokens |
| Electron safeStorage for credentials | OS-level encryption (Keychain on macOS, etc.) |
| Feed-first activity model + native notifications | Students need a durable in-app audit trail plus optional OS-level alerts |
| Build from scratch, borrow patterns | Not a fork; adopts the best architectural ideas from T3 Code and OpenClaw |
| Local-first plugin isolation | Student data never leaves their machine unless the plugin explicitly sends it |
