import { app, BrowserWindow } from "electron"
import { registerIpcHandlers } from "./ipc/bridge.js"
import { spawnServer, type ServerProcess } from "./server/lifecycle.js"
import { createTray } from "./tray/tray.js"
import { createWindow } from "./window/window-manager.js"

let mainWindow: BrowserWindow | null = null
let serverProcess: ServerProcess | null = null
let isQuitting = false

async function createAppWindow(): Promise<BrowserWindow> {
  if (!serverProcess) {
    serverProcess = await spawnServer()
    registerIpcHandlers(serverProcess.bootstrap)
  }

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
  serverProcess?.kill()
  serverProcess = null
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" || isQuitting) {
    app.quit()
  }
})
