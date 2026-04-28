import { app, BrowserWindow, dialog, nativeImage } from "electron"
import { existsSync } from "node:fs"
import os from "node:os"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { IpcChannel } from "@orbyt/contracts"
import { registerIpcHandlers } from "./ipc/bridge.js"
import { createPluginGatewayService, type PluginGatewayService } from "./plugins/plugin-gateway-service.js"
import { PluginManager } from "./plugins/plugin-manager.js"
import { createPluginRuntime } from "./plugins/plugin-runtime.js"
import { createPushManager, type PushManager } from "./push/push-manager.js"
import { spawnServer, type ServerProcess } from "./server/lifecycle.js"
import { createTray } from "./tray/tray.js"
import { registerStableAutoUpdates, stopStableAutoUpdates } from "./updater/desktop-updater.js"
import { createWindow } from "./window/window-manager.js"

app.setName("Orbyt")

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
}

function resolveIconPath(): string {
  const primaryCandidate = path.join(currentDir, "../../resources/icon.png")
  const candidates = [
    primaryCandidate,
    path.join(currentDir, "../../../resources/icon.png"),
  ]
  return candidates.find(existsSync) ?? primaryCandidate
}

let mainWindow: BrowserWindow | null = null
let serverProcess: ServerProcess | null = null
let serverProcessPromise: Promise<ServerProcess> | null = null
let pluginManager: PluginManager | null = null
let pluginGateway: PluginGatewayService | null = null
let pushManager: PushManager | null = null
let isQuitting = false

async function ensureServerProcess(): Promise<ServerProcess> {
  if (serverProcess) {
    return serverProcess
  }

  if (!serverProcessPromise) {
    serverProcessPromise = (async () => {
      const runtime = createPluginRuntime({
        currentDir,
        isPackaged: app.isPackaged,
        userDataPath: app.getPath("userData"),
        platform: process.platform,
        systemVersion: os.release(),
        emitLifecycleEvent: (event) => {
          const windows = typeof BrowserWindow.getAllWindows === "function" ? BrowserWindow.getAllWindows() : []
          for (const window of windows) {
            window.webContents.send(IpcChannel.PLUGIN_LIFECYCLE, event)
          }

          void pluginGateway?.notifyToolInventoryChanged()
        },
        emitReadinessEvent: (event) => {
          const windows = typeof BrowserWindow.getAllWindows === "function" ? BrowserWindow.getAllWindows() : []
          for (const window of windows) {
            window.webContents.send(IpcChannel.PLUGIN_READINESS, event)
          }
        },
      })
      pluginManager = runtime.manager

      await runtime.manager.autoStartEnabled().catch((error) => {
        process.stderr.write(`Failed to auto-start enabled plugins: ${String(error)}\n`)
      })

      const gateway = await createPluginGatewayService({
        runtime: runtime.manager,
      })
      pluginGateway = gateway

      // Read Canvas credentials from the encrypted plugin vault and forward
      // them to the server process. The server's CanvasApiClient hits Canvas
      // REST directly (the live MCP plugin was removed during consolidation),
      // so it needs CANVAS_BASE_URL + CANVAS_TOKEN at startup.
      const canvasCreds = (() => {
        try {
          const stored = runtime.vault.read("canvas-mcp")
          if (stored && typeof stored.baseUrl === "string" && typeof stored.token === "string") {
            return { baseUrl: stored.baseUrl, token: stored.token }
          }
          return null
        } catch {
          return null
        }
      })()

      const nextServerProcess = await spawnServer(gateway.config, {
        userDataPath: app.getPath("userData"),
      }, {
        isPackaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
      }, canvasCreds ?? undefined)
      serverProcess = nextServerProcess

      pushManager = createPushManager({
        userDataPath: app.getPath("userData"),
        bootstrap: nextServerProcess.bootstrap,
      })
      pluginManager = registerIpcHandlers(
        nextServerProcess.bootstrap,
        {
          pluginManager: runtime.manager,
          pluginAuthService: runtime.authService,
          pluginEnabledStore: runtime.enabledStore,
          pluginRuntimeLogs: runtime.runtimeLogs,
          pushManager,
        },
      ).pluginManager
      void pushManager.start()

      return nextServerProcess
    })()
      .catch(async (error) => {
        await pluginGateway?.close().catch(() => undefined)
        pluginGateway = null
        pluginManager = null
        throw error
      })
      .finally(() => {
        serverProcessPromise = null
      })
  }

  return serverProcessPromise
}

async function createAppWindow(): Promise<BrowserWindow> {
  await ensureServerProcess()

  const window = createWindow()
  createTray(window)

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null
    }
  })

  return window
}

async function bootstrap(): Promise<void> {
  // Set macOS dock icon (must be done after app is ready)
  if (process.platform === "darwin") {
    const iconPath = resolveIconPath()
    if (existsSync(iconPath)) {
      app.dock?.setIcon(nativeImage.createFromPath(iconPath))
    }
  }

  mainWindow = await createAppWindow()
}

function showStartupFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Failed to start Electron app: ${message}\n`)
  dialog.showErrorBox(
    "Orbyt failed to start",
    `Orbyt could not finish startup.\n\n${message}`,
  )
}

if (gotSingleInstanceLock) {
  app.on("second-instance", async () => {
    const existingWindow = mainWindow ?? BrowserWindow.getAllWindows()[0] ?? null
    if (existingWindow) {
      if (existingWindow.isMinimized()) {
        existingWindow.restore()
      }
      existingWindow.show()
      existingWindow.focus()
      return
    }

    if (app.isReady()) {
      try {
        mainWindow = await createAppWindow()
      } catch (error) {
        showStartupFailure(error)
        app.quit()
      }
    }
  })

  app.whenReady()
    .then(async () => {
      await bootstrap()
      registerStableAutoUpdates()

      app.on("activate", async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          try {
            mainWindow = await createAppWindow()
          } catch (error) {
            showStartupFailure(error)
            app.quit()
          }
          return
        }

        mainWindow?.show()
        mainWindow?.focus()
      })
    })
    .catch((error) => {
      showStartupFailure(error)
      app.quit()
    })
}

app.on("before-quit", () => {
  isQuitting = true
  stopStableAutoUpdates()
  void pluginManager?.dispose()
  pluginManager = null
  pushManager?.stop()
  pushManager = null
  void pluginGateway?.close()
  pluginGateway = null
  serverProcess?.kill()
  serverProcess = null
  serverProcessPromise = null
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" || isQuitting) {
    app.quit()
  }
})
