import { app, BrowserWindow, nativeImage } from "electron"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_WINDOW_WIDTH = 1280
const DEFAULT_WINDOW_HEIGHT = 800

function debugWindow(message: string, win: BrowserWindow): void {
  if (process.env.STUDENT_CLAW_DEBUG_WINDOW !== "1") {
    return
  }

  const bounds = win.getBounds()
  process.stderr.write(`[window-debug] ${message} bounds=${JSON.stringify(bounds)} visible=${win.isVisible()}\n`)
}

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
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#09090b",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
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
  debugWindow("created", win)

  let hasBeenShown = false
  const showWindow = () => {
    if (hasBeenShown || win.isDestroyed()) {
      return
    }

    const [width, height] = win.getSize()
    if (width < 600 || height < 400) {
      win.setSize(DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT)
      win.center()
      debugWindow("resized-before-show", win)
    }

    hasBeenShown = true
    win.show()
    win.focus()
    debugWindow("shown", win)
  }

  const showTimeout = globalThis.setTimeout(() => {
    showWindow()
  }, 3000)

  win.once("ready-to-show", () => {
    debugWindow("ready-to-show", win)
    showWindow()
  })
  win.webContents.once("did-finish-load", () => {
    debugWindow("did-finish-load", win)
    showWindow()
  })
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    process.stderr.write(
      `[window] Failed to load renderer (${errorCode}) ${errorDescription} at ${validatedURL}\n`,
    )
    debugWindow("did-fail-load", win)
    showWindow()
  })
  win.on("closed", () => {
    globalThis.clearTimeout(showTimeout)
    debugWindow("closed", win)
  })

  win.setSize(DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT)
  win.center()
  debugWindow("sized-and-centered", win)

  // In dev, load Vite dev server URL; in production, load bundled HTML
  const devUrl = process.env.ELECTRON_RENDERER_URL ?? (!app.isPackaged ? "http://localhost:5173" : undefined)
  if (devUrl) {
    void win.loadURL(devUrl).catch((error) => {
      process.stderr.write(`[window] Failed to load renderer URL: ${String(error)}\n`)
      debugWindow("load-url-catch", win)
      showWindow()
    })
  } else {
    void win.loadFile(path.join(currentDir, "../renderer/index.html")).catch((error) => {
      process.stderr.write(`[window] Failed to load renderer file: ${String(error)}\n`)
      debugWindow("load-file-catch", win)
      showWindow()
    })
  }

  return win
}
