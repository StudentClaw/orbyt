import { app, BrowserWindow, nativeImage } from "electron"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { IpcChannel } from "@student-claw/contracts"
import { registerIpcHandlers } from "./ipc/bridge.js"
import { createPluginGatewayService, type PluginGatewayService } from "./plugins/plugin-gateway-service.js"
import { PluginManager } from "./plugins/plugin-manager.js"
import { createPluginRuntime } from "./plugins/plugin-runtime.js"
import { spawnServer, type ServerProcess } from "./server/lifecycle.js"
import { createTray } from "./tray/tray.js"
import { createWindow } from "./window/window-manager.js"

app.setName("Student Claw")

const currentDir = path.dirname(fileURLToPath(import.meta.url))

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
let isQuitting = false

async function ensureServerProcess(): Promise<ServerProcess> {
  if (serverProcess) {
    return serverProcess
  }

  if (!serverProcessPromise) {
    const runtime = createPluginRuntime({
      currentDir,
      isPackaged: app.isPackaged,
      userDataPath: app.getPath("userData"),
      emitLifecycleEvent: (event) => {
        const windows = typeof BrowserWindow.getAllWindows === "function" ? BrowserWindow.getAllWindows() : []
        for (const window of windows) {
          window.webContents.send(IpcChannel.PLUGIN_LIFECYCLE, event)
        }

        void pluginGateway?.notifyToolInventoryChanged()
      },
    })
    pluginManager = runtime.manager

    serverProcessPromise = createPluginGatewayService({
      runtime: runtime.manager,
    })
      .then((gateway) => {
        pluginGateway = gateway
        return spawnServer(gateway.config, {
          userDataPath: app.getPath("userData"),
        })
      })
      .then((nextServerProcess) => {
        serverProcess = nextServerProcess
        pluginManager = registerIpcHandlers(
          nextServerProcess.bootstrap,
          { pluginManager: runtime.manager, pluginAuthService: runtime.authService },
        ).pluginManager
        return nextServerProcess
      })
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

app.whenReady()
  .then(async () => {
    await bootstrap()

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = await createAppWindow()
        return
      }

      mainWindow?.show()
      mainWindow?.focus()
    })
  })
  .catch((error) => {
    process.stderr.write(`Failed to start Electron app: ${String(error)}\n`)
    app.quit()
  })

app.on("before-quit", () => {
  isQuitting = true
  void pluginManager?.dispose()
  pluginManager = null
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
