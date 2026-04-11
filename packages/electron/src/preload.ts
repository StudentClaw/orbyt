import { contextBridge, ipcRenderer } from "electron"
import type { DesktopBootstrap } from "@student-claw/contracts"

const ALLOWED_CHANNELS = [
  "app:get-path",
  "app:get-bootstrap",
  "notification:show",
  "tray:update-badge",
  "file:open-dialog",
  "file:save-dialog",
  "codex:auth-start",
  "codex:auth-status",
]

contextBridge.exposeInMainWorld("electronAPI", {
  getBootstrap: async (): Promise<DesktopBootstrap | null> => {
    const bootstrap = await ipcRenderer.invoke("app:get-bootstrap")
    return typeof bootstrap === "object" && bootstrap !== null
      ? bootstrap as DesktopBootstrap
      : null
  },
  codexAuthStart: (): Promise<{ status: "connected" | "failed"; error?: string }> => {
    return ipcRenderer.invoke("codex:auth-start")
  },
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
