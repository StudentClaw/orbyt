# Architecture Layer: Electron Shell (Tier 1)

## What It Is

The Electron Shell is the thinnest possible desktop wrapper around native desktop concerns. It does not own product-domain reasoning, but it **does** own process hosting and native integration boundaries: show the React UI in a BrowserWindow, spawn the Local Server as a child process, host the MCP Plugin Orchestrator in Main, and provide native OS capabilities (file dialogs, notifications, system tray, auto-update) via IPC.

---

## Why Electron

- **Cross-platform**: macOS, Windows, Linux from one codebase. Students use all three.
- **Web UI**: The React frontend runs in Chromium — full access to the modern web platform.
- **Native APIs**: System tray, notifications, file dialogs, auto-update, safe credential storage.
- **utilityProcess**: Sandboxed child processes for MCP plugins — critical for the Plugin System.
- **Ecosystem**: Proven by VS Code, Discord, Notion, Obsidian, Slack. Electron Forge for build tooling.
- **Student laptops**: Electron apps run fine on mid-range laptops. Memory footprint is manageable with lazy plugin loading.

---

## Responsibilities

### 1. BrowserWindow

Create the main app window, load the React UI (from Vite dev server in development, bundled HTML in production).

- Window size, position, and state persistence
- Title bar customization (frameless or custom)
- Dark mode support (follow OS preference)
- Deep link handling (`studentclaw://` protocol)

### 2. Preload Script

The preload script bridges the Renderer (React UI) and Main Process using `contextBridge`.

Exposes a limited, typed API surface to the renderer:
- `window.electronAPI.send(channel, data)` — Send to main
- `window.electronAPI.on(channel, callback)` — Listen from main
- `window.electronAPI.invoke(channel, data)` — Request/response to main

Channels are strictly defined in Shared Contracts. The renderer cannot access Node.js APIs directly.

### 3. Server Lifecycle

The Electron Main Process spawns the Local Server (Effect-TS backend) as a child process.

- Spawn on app start, kill on app quit
- Health monitoring: restart if the server crashes
- Port allocation: find an open port for the WebSocket server
- Environment injection: pass config, data paths, port number

### 4. IPC Bridge

All communication between the React UI and native capabilities goes through IPC. The Local Server also uses a typed Main bridge for plugin orchestration calls.

| Channel | Direction | Purpose |
|---|---|---|
| `file:open-dialog` | Renderer → Main | Open native file picker |
| `file:save-dialog` | Renderer → Main | Native save dialog |
| `notification:show` | Renderer → Main | Show OS notification |
| `tray:update-badge` | Renderer → Main | Update tray icon badge |
| `app:get-path` | Renderer → Main | Get app data directory path |
| `plugin:tool-call` | Server/Main bridge | Execute MCP tool through Main-owned orchestrator |
| `plugin:tools-changed` | Main → Server | Notify server of plugin tool inventory changes |
| `vault:get-credential` | Main → Plugin | Decrypt and pass plugin-scoped credential |
| `plugin:lifecycle` | Main → Renderer | Plugin state changes |

### 5. System Tray

Tray icon with context menu for quick access without opening the main window.

- Show/hide app window
- Quick status: "3 assignments due this week"
- Notification count badge
- Quit app

### 6. Auto-Update

Automatic app updates using Electron's autoUpdater (Squirrel-based).

- Check for updates on app start and periodically
- Download in background
- Prompt student to restart: "A new version is available. Restart to update?"
- Support for macOS (.dmg) and Windows (.exe/.msi)

### 7. Native Notifications

OS-level notifications for time-sensitive events.

- New grade posted
- Assignment due tomorrow
- Canvas sync found new content
- Click notification → open relevant section in the app
- Delivery rules (quiet hours, per-type toggles, batching) are evaluated by Notification Service; Main performs final OS delivery only

---

## Plugin Hosting (utilityProcess)

The Electron Shell hosts MCP plugins via `utilityProcess` (detailed in [Plugin System](../features/05-plugin-system.md)).

Key points at this layer:
- `utilityProcess.fork()` spawns an isolated Node.js process
- No access to the Renderer — plugins can't touch the UI
- Crashed plugins don't crash the app
- The Main Process manages plugin lifecycle and credential injection
- The Local Server requests tool execution through a typed Main bridge, keeping feature policy in server code and plugin process control in Main

---

## Proposed File Structure

```
packages/electron/
  package.json
  forge.config.ts               # Electron Forge build config
  tsconfig.json
  src/
    main.ts                     # App entry: BrowserWindow, server spawn, tray
    preload.ts                  # contextBridge API surface
    ipc/
      bridge.ts                 # IPC handler registry
      channels.ts               # Channel name constants (from Shared Contracts)
      handlers/
        file-handlers.ts        # File dialog IPC handlers
        notification-handlers.ts
        server-bridge-handlers.ts # Server ↔ Main bridge for plugin tool calls
        vault-handlers.ts
        plugin-handlers.ts
    tray/
      tray.ts                   # System tray setup and menu
      badge.ts                  # Badge/count management
    updater/
      auto-update.ts            # Squirrel auto-update logic
    window/
      window-manager.ts         # Window creation, state persistence
      deep-links.ts             # Protocol handler (studentclaw://)
    plugins/
      PluginManager.ts          # utilityProcess lifecycle (see Plugin System)
      PluginSandbox.ts
      Vault.ts
```

---

## Build Tooling

**Electron Forge** is the recommended build system (endorsed by the Electron team):

- Dev: `electron-forge start` — runs Vite dev server + Electron in parallel
- Build: `electron-forge package` — bundles for distribution
- Publish: `electron-forge publish` — uploads to GitHub Releases or other targets
- Makers: DMG (macOS), MSI/Squirrel (Windows), deb/rpm (Linux)

---

## Open Questions

- **Electron Forge vs. electron-builder**: Forge is the Electron team's recommendation, but electron-builder has broader community adoption. Which fits better?
- **Frameless window**: Should the app use a custom title bar for a more branded feel, or the native title bar for familiarity?
- **Startup time**: Electron apps can be slow to start. Should we show a splash screen while the server boots?
- **Memory footprint**: With Chromium + Node.js + server + plugins, how do we keep memory usage reasonable on student laptops?
- **App signing**: macOS requires code signing and notarization. Windows SmartScreen needs signing too. Budget for certificates.
