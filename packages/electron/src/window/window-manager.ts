import { app, BrowserWindow } from "electron"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const currentDir = path.dirname(fileURLToPath(import.meta.url))

function resolvePreloadPath(): string {
  const esmPreloadPath = path.join(currentDir, "../preload/preload.mjs")
  if (existsSync(esmPreloadPath)) {
    return esmPreloadPath
  }

  return path.join(currentDir, "../preload/preload.js")
}

export function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#09090b",
    show: false,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.once("ready-to-show", () => {
    win.show()
  })

  // In dev, load Vite dev server URL; in production, load bundled HTML
  const devUrl = process.env.ELECTRON_RENDERER_URL ?? (!app.isPackaged ? "http://localhost:5173" : undefined)
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(currentDir, "../renderer/index.html"))
  }

  return win
}
