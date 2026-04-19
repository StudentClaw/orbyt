import type {
  DesktopBootstrap,
  IpcChannel,
  IpcEventPayloadMap,
  IpcInvokeArgsMap,
  IpcInvokeResultMap,
} from "@student-claw/contracts"

type InvokableChannel = keyof IpcInvokeArgsMap & keyof IpcInvokeResultMap

interface ElectronAPI {
  getBootstrap: () => Promise<DesktopBootstrap | null>
  codexAuthStart: () => Promise<{ status: "connected" | "failed"; error?: string }>
  invoke: <T extends InvokableChannel>(channel: T, ...args: IpcInvokeArgsMap[T]) => Promise<IpcInvokeResultMap[T]>
  send: (channel: IpcChannel, ...args: unknown[]) => void
  on: <T extends keyof IpcEventPayloadMap>(channel: T, callback: (payload: IpcEventPayloadMap[T]) => void) => () => void
  getPathForFile?: (file: File) => string
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
