import { Tray, Menu, app, nativeImage, type BrowserWindow } from "electron"

let tray: Tray | null = null

export function createTray(mainWindow: BrowserWindow): void {
  // Create a simple 16x16 placeholder icon
  const icon = nativeImage.createEmpty()

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
