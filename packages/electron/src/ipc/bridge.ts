import { ipcMain, app, Notification } from "electron"
import { IPC_CHANNELS } from "./channels.js"

export function registerIpcHandlers(serverPort: number): void {
  ipcMain.handle(IPC_CHANNELS.APP_GET_PATH, (_event, name: string) => {
    return app.getPath(name as Parameters<typeof app.getPath>[0])
  })

  ipcMain.handle(IPC_CHANNELS.APP_GET_SERVER_PORT, () => {
    return serverPort
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
