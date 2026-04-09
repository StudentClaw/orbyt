import type { DesktopBootstrap } from "@student-claw/contracts"

interface ElectronAPI {
  getBootstrap: () => Promise<DesktopBootstrap | null>
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  send: (channel: string, ...args: unknown[]) => void
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
