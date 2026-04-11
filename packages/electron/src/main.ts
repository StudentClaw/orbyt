import { app, BrowserWindow, nativeImage } from "electron"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { registerIpcHandlers } from "./ipc/bridge.js"
import { PluginManager } from "./plugins/plugin-manager.js"
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
let isQuitting = false

async function ensureServerProcess(): Promise<ServerProcess> {
  if (serverProcess) {
    return serverProcess
  }

  if (!serverProcessPromise) {
    serverProcessPromise = spawnServer()
      .then((nextServerProcess) => {
        serverProcess = nextServerProcess
        pluginManager = registerIpcHandlers(nextServerProcess.bootstrap).pluginManager
        return nextServerProcess
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
  serverProcess?.kill()
  serverProcess = null
  serverProcessPromise = null
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" || isQuitting) {
    app.quit()
  }
})
