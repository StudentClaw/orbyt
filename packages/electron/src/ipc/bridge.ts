import { ipcMain, app, Notification } from "electron"
import type { DesktopBootstrap } from "@student-claw/contracts"
import { IPC_CHANNELS } from "./channels.js"

/**
 * Registers the Electron main-process IPC handlers needed by the renderer runtime.
 */
export function registerIpcHandlers(bootstrap: DesktopBootstrap): void {
  ipcMain.handle(IPC_CHANNELS.APP_GET_PATH, (_event, name: string) => {
    return app.getPath(name as Parameters<typeof app.getPath>[0])
  })

  ipcMain.handle(IPC_CHANNELS.APP_GET_BOOTSTRAP, () => {
    return bootstrap
  })

  ipcMain.handle(IPC_CHANNELS.NOTIFICATION_SHOW, (_event, options: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: options.title,
        body: options.body,
      })
      notification.show()
    }
  })
}
