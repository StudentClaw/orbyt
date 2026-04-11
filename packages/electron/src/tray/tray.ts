import { Tray, Menu, app, nativeImage, type BrowserWindow } from "electron"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const currentDir = path.dirname(fileURLToPath(import.meta.url))

function resolveTrayIcon(): Electron.NativeImage {
  const candidates = [
    path.join(currentDir, "../../resources/icon.png"),
    path.join(currentDir, "../../../resources/icon.png"),
  ]
  const iconPath = candidates.find(existsSync)
  if (!iconPath) {
    return nativeImage.createEmpty()
  }
  // Tray icons on macOS should be 16x16 or 32x32 (template images work best)
  return nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
}

let tray: Tray | null = null

export function createTray(mainWindow: BrowserWindow): void {
  const icon = resolveTrayIcon()

  tray = new Tray(icon)
  tray.setToolTip("Student Claw")

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show",
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      },
    },
    {
      label: "Hide",
      click: () => {
        mainWindow.hide()
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        tray?.destroy()
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)
}
