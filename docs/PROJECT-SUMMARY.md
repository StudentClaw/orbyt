# Student Claw — Project Summary

## What It Is

A desktop application (Electron) that acts as an AI-powered student assistant. It connects to Canvas LMS, shows students what's due and when, and helps them plan their week — all powered by their existing ChatGPT subscription.

## Primary Use Case (v1)

**Connect to Canvas and show students what's due, when, and help plan their week.**

---

## Architecture

Three-tier design inspired by T3 Code (pingdotgg):

1. **Electron Shell** — Thin desktop wrapper, handles native OS features (file dialogs, notifications, tray icon)
2. **Local Server** — Core logic layer running alongside the app. Manages the AI harness, WebSocket communication with the UI, and coordinates extensions
3. **External Services** — Canvas LMS, calendar providers, and other integrations via MCP servers

Communication: `React UI ↔ WebSocket (JSON-RPC) ↔ Local Server ↔ Codex CLI (stdin/stdout)`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Frontend | React + Vite |
| Backend | Effect-TS (type-safe, structured concurrency/error handling) |
| Database | SQLite (local persistence) |
| AI | Codex CLI subprocess with JSON-RPC protocol |
| Desktop | Electron |
| Shared Contracts | Effect Schema for type-safe frontend ↔ backend communication |

---

## Ten Core Feature Branches

### 1. AI Harness

Codex CLI subprocess, JSON-RPC protocol, ChatGPT subscription or API key auth, streaming responses, session lifecycle management, context window budget manager, Soul/Personality system (immutable core + adaptive layer), MCP server registry.

### 2. Canvas Integration

Implemented as an MCP server (not baked into the core). Course discovery, assignment tracking, grade retrieval, announcement scraping. Adaptive background sync (15min active / 1hr tray) with typed change events (`AssignmentAdded`, `GradePosted`, etc.) that feed into the Notification Service.

### 3. Skill System

Two-tier skill system: curated first-party skills and student-authored custom skills. Markdown-based skill files (Cursor-style) with YAML frontmatter, plus a server-side policy gate that enforces capabilities. Six pre-installed skills (plan-mode, study-helper, essay-reviewer, exam-prep, citation-helper, explain-like). In-app Skill Editor UI with fork-and-promote flow. Context budget management for competing skills. Custom skills start in read-suggest mode with planner-scope access and can be promoted capability-by-capability.

### 4. Memory System

mem0 with entity partitioning as the single source of truth. Memory categories scoped via `user_id`, `agent_id`, `run_id` tags. Real-time extraction after each conversation (ADD/UPDATE/DELETE pipeline). Profile compiler generates compact context for AI injection. Two markdown files: `soul.md` (personality) and `MEMORY.md` (read-only human-readable projection).

### 5. Plugin System (Local MCP Orchestrator)

See [Plugin Architecture](#plugin-architecture-local-mcp-orchestrator) below.

### 6. Dashboard

Priority queue with scoring, grade charts per course, upcoming deadline timeline, weekly calendar view (from Smart Planner), completion check-ins (Yes/No/Yes-but), proactive AI insight cards, announcements feed, quick actions.

### 7. File System

Local file storage for downloaded assignments and research. Markdown and PDF viewers. Export to extensions.

### 8. Onboarding

Institution selector for Canvas URL, step-by-step token guide, Codex CLI auth flow, preference + routines setup (stored in mem0), extension recommendations, first sync with memory population, plan-mode live demo walkthrough.

### 9. Smart Planner

The flagship intelligence feature. Hybrid AI + deterministic scheduling: task analyzer (importance scoring, time estimation), task decomposer (multi-session splitting), deterministic slot finder and schedule builder, reschedule engine (student-initiated + event-driven), completion handler (Yes/No/Yes-but). Persistent in SQLite (`tasks`, `planned_sessions` tables).

### 10. Notification Service

Event-driven notifications bridging background intelligence to the student. Listens to Canvas change events and planner reminders. Evaluates, composes (templates + AI for complex events), and delivers via native OS notifications. Quiet hours enforcement. Weekly insight generator surfaces AI-powered cards on the Dashboard.

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
| **IPC Bridge** | Communication layer between the React Chat UI and the Orchestrator |

### Plugin Structure & Discovery

Plugins are stored in a dedicated directory within the user's Application Support folder.

#### Directory Hierarchy

```text
/UserData/StudentClaw/
├── extensions/
│   ├── canvas-mcp/
│   │   ├── index.js       # The MCP Server entry point
│   │   └── manifest.json  # Metadata (name, version, required permissions)
│   └── notion-mcp/
│       ├── index.js
│       └── manifest.json
└── vault/
    └── secrets.json       # Encrypted credentials
```

#### The `manifest.json` Standard

Every plugin must include a manifest so the Orchestrator knows how to handle it.

```json
{
  "id": "canvas-mcp",
  "name": "Canvas Assistant",
  "version": "1.0.0",
  "entry": "index.js",
  "permissions": ["assignments", "grades", "announcements"],
  "authType": "manual_token"
}
```

### Execution Flow (The "Handshake")

When the user sends a message in the Chat UI, the following sequence occurs:

1. **Intent Recognition** — The AI (via the Codex harness) determines if a tool is needed (e.g., "What assignments are due?").
2. **Plugin Activation** — The Orchestrator checks if `canvas-mcp` is running. If not, it spawns the process.
3. **Credential Injection** — The Orchestrator retrieves the encrypted Canvas token from the Vault and passes it to the Plugin via a secure message.
4. **Tool Call** — The Orchestrator sends a JSON-RPC request to the Plugin: `callTool("get_assignments")`.
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
      stdio: 'pipe',
      env: { CANVAS_TOKEN: credentials }
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

1. **Scans Canvas** for upcoming assignments (via MCP tools)
2. **Analyzes tasks** — importance scoring, time estimation, dependency detection (AI-driven)
3. **Decomposes large tasks** into multi-session blocks (AI-driven)
4. **Finds available slots** in the student's schedule (deterministic)
5. **Builds the schedule** — places sessions optimally, respects constraints (deterministic)
6. **Handles rescheduling** — student-initiated ("can't do this tonight") and event-driven (Canvas deadline moved)
7. **Tracks completion** — Yes/No/Yes-but three-way check-in with memory updates
8. Works with any installed calendar MCP extension (Apple Calendar, Google Calendar)

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
| Electron Notification API | Native OS notifications, works in tray mode |
| Build from scratch, borrow patterns | Not a fork; adopts the best architectural ideas from T3 Code and OpenClaw |
| Local-first plugin isolation | Student data never leaves their machine unless the plugin explicitly sends it |
