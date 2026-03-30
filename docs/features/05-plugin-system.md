# Feature 5: Plugin System (Local MCP Orchestrator)

## What It Is

The Plugin System is Student Claw's extension engine. It manages MCP (Model Context Protocol) server plugins that run in isolated processes, each providing the AI with tools to interact with external services. Canvas, Notion, Google Calendar, Apple Calendar — they're all plugins. The system follows a Hub-and-Spoke model where Electron's Main Process is the Hub (Orchestrator) and each MCP server is a Spoke.

---

## Why It Exists

Student Claw can't anticipate every service a student uses. By making integrations pluggable, the core app stays clean while the ecosystem grows. A CS student might install a GitHub MCP; a music student might install a Spotify MCP for focus playlists. The Plugin System makes this possible without touching the core codebase.

It also enforces security boundaries. Student data (Canvas grades, Notion notes) is sensitive. Each plugin runs in its own sandboxed process, can only access what the student explicitly permits, and credentials are encrypted at rest.

---

## Dependencies

```
Electron Shell ──→ Plugin System (utilityProcess, safeStorage)
IPC Bridge ────→ Plugin System (renderer ↔ main process communication)
Shared Contracts ──→ Plugin System (Extension schema, protocol types)
```

| Depends On | Why |
|---|---|
| **Electron Shell** | `utilityProcess` for sandboxed plugin processes, `safeStorage` for credential encryption |
| **IPC Bridge** | Chat UI sends tool calls through IPC → Orchestrator → Plugin |
| **Shared Contracts** | `Extension` schema, `PluginManifest` type, permission enums |

| Depended On By | Why |
|---|---|
| **Canvas Integration** | Runs as the first MCP server plugin |
| **AI Harness** | Routes tool calls to plugins via the Orchestrator |
| **Onboarding** | Extension recommendation and installation |
| **Dashboard** | Shows installed extensions and their status |
| **Calendar MCP** | Plan-mode needs a calendar plugin |

---

## Architecture: Hub-and-Spoke

```
React Chat UI
     │
     │ IPC (contextBridge)
     ▼
┌─────────────────────────────────────────┐
│          Electron Main Process          │
│              (Orchestrator)              │
│                                         │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │ Plugin      │  │ Local Vault     │  │
│  │ Manager     │  │ (safeStorage)   │  │
│  └──────┬──────┘  └────────┬────────┘  │
│         │                  │            │
└─────────┼──────────────────┼────────────┘
          │                  │
    ┌─────▼─────┐    ┌──────▼──────┐    ┌─────────────┐
    │ utility   │    │ utility     │    │ utility     │
    │ Process   │    │ Process     │    │ Process     │
    │           │    │             │    │             │
    │ canvas-   │    │ calendar-   │    │ notion-     │
    │ mcp       │    │ mcp         │    │ mcp         │
    └───────────┘    └─────────────┘    └─────────────┘
```

---

## Core Responsibilities

### 1. Plugin Discovery

Find installed plugins and validate their manifests.

- **Extension directory**: `~/.student-claw/extensions/`
- Each plugin is a folder with at least `manifest.json` and an entry file
- On app start, scan the directory and build a registry of available plugins
- Validate manifests against the `PluginManifest` schema

### 2. Plugin Lifecycle Management

Start, stop, monitor, and restart plugins as needed.

| State | Description |
|---|---|
| **Discovered** | Manifest found, not yet started |
| **Starting** | `utilityProcess.fork()` called, waiting for MCP handshake |
| **Ready** | MCP `initialize` handshake complete, tools registered |
| **Active** | Currently handling a tool call |
| **Idle** | Ready but no active calls. May be stopped after timeout to save resources. |
| **Stopped** | Process terminated (graceful or crash) |
| **Error** | Failed to start or crashed. Retry with backoff. |

**Lazy loading**: Plugins only start when their tools are first needed. If a student never asks about Notion, the Notion MCP never runs.

**Resource management**: After a period of inactivity (configurable, default: 5 minutes), idle plugins are stopped to save RAM and CPU on the student's laptop.

### 3. Credential Management (Local Vault)

Every plugin that connects to an external service needs credentials.

- Credentials encrypted using Electron's `safeStorage` API (OS keychain-backed)
- Stored in `~/.student-claw/vault/secrets.json`
- Each plugin only receives its own credentials, never another plugin's
- Credentials injected as environment variables when spawning the utilityProcess

### 4. Permission System

Students must consent before a plugin accesses their data.

- **First-use prompt**: When a plugin is activated for the first time, show a modal explaining what it will access
- **Granular permissions**: Defined in `manifest.json` (e.g., `["assignments", "grades", "announcements"]`)
- **Revocable**: Students can revoke permissions at any time via the Extension Manager UI
- **Audit log**: Record when permissions were granted/revoked

### 5. MCP Protocol Handling

Communication between the Orchestrator and plugins uses the MCP protocol over stdio.

**MCP lifecycle:**
1. Orchestrator spawns plugin → `utilityProcess.fork(pluginPath)`
2. Orchestrator sends `initialize` → plugin responds with capabilities and tool list
3. AI needs a tool → Orchestrator sends `tools/call` → plugin executes and returns result
4. Orchestrator sends `shutdown` → plugin cleans up and exits

**Message format** (JSON-RPC 2.0 over stdin/stdout):
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_assignments",
    "arguments": { "courseId": "12345" }
  },
  "id": "req-001"
}
```

### 6. Tool Registration

When a plugin starts, it declares its available tools. The Orchestrator aggregates all tools across all running plugins and provides them to the AI Harness.

- Tool names are namespaced: `canvas-mcp.get_assignments`, `calendar-mcp.create_event`
- Tool schemas (parameters, return types) are surfaced to the AI so it knows how to call them
- Tools are dynamically available — when a new plugin starts, its tools immediately become callable

---

## Plugin Manifest Standard

Every plugin requires a `manifest.json`:

```json
{
  "id": "canvas-mcp",
  "name": "Canvas Assistant",
  "description": "Connects to your Canvas LMS to track courses, assignments, and grades",
  "version": "1.0.0",
  "entry": "index.js",
  "permissions": ["assignments", "grades", "announcements", "modules"],
  "authType": "manual_token",
  "authInstructions": "Generate a Canvas access token at Settings > Approved Integrations",
  "requiredCredentials": ["CANVAS_TOKEN", "CANVAS_BASE_URL"],
  "icon": "canvas-icon.png",
  "author": "student-claw",
  "homepage": "https://github.com/student-claw/canvas-mcp"
}
```

---

## Extension Directory Structure

```
~/.student-claw/
├── extensions/
│   ├── canvas-mcp/
│   │   ├── manifest.json
│   │   ├── index.js
│   │   └── canvas-icon.png
│   ├── calendar-mcp/
│   │   ├── manifest.json
│   │   └── index.js
│   └── notion-mcp/
│       ├── manifest.json
│       └── index.js
└── vault/
    └── secrets.json          # Encrypted credentials per plugin
```

---

## MCP Ecosystem (Discovery)

With 28,000+ MCP servers available on [MCP Market](https://mcpmarket.com/) and [mcpservers.org](https://mcpservers.org/), students can potentially install any integration:

**High-priority MCP servers for students:**
- Canvas LMS (build custom — none exist that fit our needs)
- Apple Calendar / Google Calendar (several available)
- Notion (official MCP exists)
- Google Docs/Sheets (official MCPs exist)
- GitHub (for CS students)
- Todoist / Things (task management)

**Future consideration**: An in-app "Extension Store" that browses MCP Market/Servers and allows one-click installation.

---

## Security and Isolation Standards

These are non-negotiable for student data:

1. **Process isolation**: Every plugin runs in `utilityProcess`, never in the Renderer. A plugin crash doesn't kill the UI.
2. **No renderer network access**: The Chat UI cannot call Canvas/Notion/etc. directly. Only MCP servers (in background processes) make network requests.
3. **Credential isolation**: Plugin A cannot access Plugin B's credentials.
4. **Permission gating**: First use triggers a consent modal. No silent access.
5. **Code audit**: Plugins are plain JS files in a known directory. Students (or their tech-savvy friends) can inspect them.

---

## Proposed File Structure

```
packages/electron/src/plugins/
  PluginManager.ts        # Lifecycle management (start/stop/monitor)
  PluginSandbox.ts        # utilityProcess wrapper with health monitoring
  PluginRegistry.ts       # Discover and index installed plugins
  ManifestValidator.ts    # Parse and validate manifest.json against schema
  Vault.ts                # Encrypted credential storage (safeStorage)
  PermissionManager.ts    # Permission tracking, consent flow
  McpProtocol.ts          # MCP JSON-RPC encode/decode for stdio
  ToolAggregator.ts       # Collect tools across all plugins for AI Harness
```

---

## Open Questions

- **Plugin installation**: How do students install new plugins? Download a zip? Clone a repo? In-app store?
- **Plugin updates**: How are plugins updated? Auto-update from a registry? Manual replacement?
- **SSE vs. stdio**: MCP supports both stdio and SSE transports. Should we support both for flexibility, or standardize on stdio for local plugins?
- **Plugin sandboxing depth**: `utilityProcess` provides process isolation, but should we also restrict filesystem access? Network access per-plugin?
- **Community plugins**: What's the trust model for third-party plugins? Code signing? A review process? Trust-on-first-use?
- **Plugin dependencies**: Can plugins depend on each other? E.g., a "study group" plugin that depends on Calendar + Canvas.
