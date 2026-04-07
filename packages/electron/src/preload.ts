import { contextBridge, ipcRenderer } from "electron"

const ALLOWED_CHANNELS = [
  "app:get-path",
  "app:get-server-port",
  "notification:show",
  "tray:update-badge",
  "file:open-dialog",
  "file:save-dialog",
]

contextBridge.exposeInMainWorld("electronAPI", {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    if (!ALLOWED_CHANNELS.includes(channel)) {
      return Promise.reject(new Error(`Channel not allowed: ${channel}`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },
  send: (channel: string, ...args: unknown[]): void => {
    if (ALLOWED_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, ...args)
    }
  },
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    if (!ALLOWED_CHANNELS.includes(channel)) {
      return () => {}
    }
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
})
