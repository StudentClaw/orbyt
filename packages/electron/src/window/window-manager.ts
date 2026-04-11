import { app, BrowserWindow, nativeImage } from "electron"
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

function resolveIconPath(): string {
  // In production, resources are next to the app; in dev, relative to project root
  const primaryCandidate = path.join(currentDir, "../../resources/icon.png")
  const candidates = [
    primaryCandidate,
    path.join(currentDir, "../../../resources/icon.png"),
  ]
  return candidates.find(existsSync) ?? primaryCandidate
}

export function createWindow(): BrowserWindow {
  const icon = nativeImage.createFromPath(resolveIconPath())

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#09090b",
    show: false,
    icon,
    title: "Student Claw",
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
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
