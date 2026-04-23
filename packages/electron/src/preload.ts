import { contextBridge, ipcRenderer, webUtils } from "electron"
import {
  IpcChannel,
  type DesktopBootstrap,
  type IpcChannel as IpcChannelName,
  type IpcEventPayloadMap,
  type IpcInvokeArgsMap,
  type IpcInvokeResultMap,
} from "@orbyt/contracts"

type InvokableChannel = keyof IpcInvokeArgsMap & keyof IpcInvokeResultMap

const ALLOWED_CHANNELS = new Set<string>(Object.values(IpcChannel))

function isAllowedChannel(channel: string): channel is IpcChannelName {
  return ALLOWED_CHANNELS.has(channel)
}

contextBridge.exposeInMainWorld("electronAPI", {
  getBootstrap: async (): Promise<DesktopBootstrap | null> => {
    const bootstrap = await ipcRenderer.invoke(IpcChannel.APP_GET_BOOTSTRAP)
    return typeof bootstrap === "object" && bootstrap !== null
      ? bootstrap as DesktopBootstrap
      : null
  },
  codexAuthStart: (): Promise<{ status: "connected" | "failed"; error?: string }> => {
    return ipcRenderer.invoke(IpcChannel.CODEX_AUTH_START)
  },
  invoke: <T extends InvokableChannel>(channel: T, ...args: IpcInvokeArgsMap[T]): Promise<IpcInvokeResultMap[T]> => {
    if (!isAllowedChannel(channel)) {
      return Promise.reject(new Error(`Channel not allowed: ${channel}`))
    }
    return ipcRenderer.invoke(channel, ...args) as Promise<IpcInvokeResultMap[T]>
  },
  send: (channel: IpcChannelName, ...args: unknown[]): void => {
    if (isAllowedChannel(channel)) {
      ipcRenderer.send(channel, ...args)
    }
  },
  on: <T extends keyof IpcEventPayloadMap>(
    channel: T,
    callback: (payload: IpcEventPayloadMap[T]) => void,
  ): (() => void) => {
    if (!isAllowedChannel(channel)) {
      return () => {}
    }
    const handler = (_event: Electron.IpcRendererEvent, payload: IpcEventPayloadMap[T]) => callback(payload)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
})
