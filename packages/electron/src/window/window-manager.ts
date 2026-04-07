import { BrowserWindow } from "electron"
import path from "node:path"

export function createWindow(serverPort?: number): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#09090b",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.once("ready-to-show", () => {
    win.show()
  })

  // In dev, load Vite dev server URL; in production, load bundled HTML
  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(__dirname, "../../packages/ui/dist/index.html"))
  }

  return win
}
