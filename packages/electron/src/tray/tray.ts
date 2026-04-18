import { Tray, Menu, app, nativeImage, type BrowserWindow } from "electron"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const currentDir = path.dirname(fileURLToPath(import.meta.url))

function resolveResourcePath(fileName: string): string | null {
  const candidates = [
    path.join(currentDir, `../../resources/${fileName}`),
    path.join(currentDir, `../../../resources/${fileName}`),
  ]

  return candidates.find(existsSync) ?? null
}

function resolveTrayIcon(): Electron.NativeImage {
  const iconPath = resolveResourcePath("tray-icon.png") ?? resolveResourcePath("icon.png")
  if (!iconPath) {
    return nativeImage.createEmpty()
  }

  const icon = nativeImage.createFromPath(iconPath)
  const retinaPath = resolveResourcePath("tray-icon@2x.png")

  if (retinaPath) {
    icon.addRepresentation({
      scaleFactor: 2,
      width: 32,
      height: 32,
      buffer: readFileSync(retinaPath),
    })
  }

  if (process.platform === "darwin") {
    icon.setTemplateImage(true)
  }

  return icon
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
