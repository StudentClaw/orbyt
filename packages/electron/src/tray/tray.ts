import { Tray, Menu, app, type BrowserWindow } from "electron"
import { createTrayIcon } from "./tray-icon.js"

let tray: Tray | null = null

export function createTray(mainWindow: BrowserWindow): void {
  const icon = createTrayIcon()

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
