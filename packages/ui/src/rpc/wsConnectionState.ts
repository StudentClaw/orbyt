import type { DesktopBootstrap } from "@orbyt/contracts"
import { appAtomRegistry, createAtom, useAtomValue } from "./atomRegistry"

export type WsConnectionPhase = "connecting" | "connected" | "disconnected" | "reconnecting"

export interface WsConnectionStatus {
  readonly phase: WsConnectionPhase
  readonly wsUrl: string | null
  readonly lastSequence: number
  readonly lastError: string | null
}

const INITIAL_WS_CONNECTION_STATUS: WsConnectionStatus = {
  phase: "disconnected",
  wsUrl: null,
  lastSequence: 0,
  lastError: null,
}

export const wsConnectionStatusAtom = createAtom<WsConnectionStatus>(
  "ws-connection-status",
  INITIAL_WS_CONNECTION_STATUS,
)

export const desktopBootstrapAtom = createAtom<DesktopBootstrap | null>(
  "desktop-bootstrap",
  null,
)

export function getWsConnectionStatus(): WsConnectionStatus {
  return appAtomRegistry.get(wsConnectionStatusAtom)
}

export function setWsConnectionStatus(nextStatus: WsConnectionStatus): void {
  appAtomRegistry.set(wsConnectionStatusAtom, nextStatus)
}

export function updateWsConnectionStatus(
  updater: (current: WsConnectionStatus) => WsConnectionStatus,
): void {
  appAtomRegistry.set(wsConnectionStatusAtom, updater(getWsConnectionStatus()))
}

export function setDesktopBootstrap(bootstrap: DesktopBootstrap | null): void {
  appAtomRegistry.set(desktopBootstrapAtom, bootstrap)
  if (bootstrap) {
    updateWsConnectionStatus((current) => ({
      ...current,
      wsUrl: bootstrap.wsUrl,
    }))
  }
}

export function useWsConnectionStatus(): WsConnectionStatus {
  return useAtomValue(wsConnectionStatusAtom)
}

export function useDesktopBootstrap(): DesktopBootstrap | null {
  return useAtomValue(desktopBootstrapAtom)
}

export function resetWsConnectionStateForTests(): void {
  appAtomRegistry.set(wsConnectionStatusAtom, INITIAL_WS_CONNECTION_STATUS)
  appAtomRegistry.set(desktopBootstrapAtom, null)
}
