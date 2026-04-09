import {
  type ServerConfig,
  type ServerConfigStreamEvent,
  type ServerLifecycleEvent,
  type ServerLifecycleWelcomePayload,
} from "@student-claw/contracts"
import type { WsRpcClient } from "./wsRpcClient"
import { appAtomRegistry, createAtom, useAtomValue, type Atom } from "./atomRegistry"
import { setDesktopBootstrap } from "./wsConnectionState"

const serverWelcomeAtom = createAtom<ServerLifecycleWelcomePayload | null>("server-welcome", null)
const serverConfigAtom = createAtom<ServerConfig | null>("server-config", null)

export function getServerWelcome(): ServerLifecycleWelcomePayload | null {
  return appAtomRegistry.get(serverWelcomeAtom)
}

export function getServerConfig(): ServerConfig | null {
  return appAtomRegistry.get(serverConfigAtom)
}

export function applyServerLifecycleEvent(event: ServerLifecycleEvent): void {
  if (event.type !== "welcome") {
    return
  }

  setDesktopBootstrap(event.payload.bootstrap)
  appAtomRegistry.set(serverWelcomeAtom, event.payload)
}

export function applyServerConfigEvent(event: ServerConfigStreamEvent): void {
  if (event.type !== "snapshot") {
    return
  }

  appAtomRegistry.set(serverConfigAtom, event.config)
}

function subscribeLatest<Value>(
  atom: Atom<Value | null>,
  listener: (value: Value) => void,
): () => void {
  return appAtomRegistry.subscribe(
    atom,
    (value) => {
      if (value !== null) {
        listener(value)
      }
    },
    { immediate: true },
  )
}

export function onServerWelcome(listener: (payload: ServerLifecycleWelcomePayload) => void): () => void {
  return subscribeLatest(serverWelcomeAtom, listener)
}

export function onServerConfig(listener: (config: ServerConfig) => void): () => void {
  return subscribeLatest(serverConfigAtom, listener)
}

export function startServerStateSync(client: WsRpcClient): () => void {
  let disposed = false

  const cleanups = [
    client.server.subscribeLifecycle((event) => {
      applyServerLifecycleEvent(event)
    }),
    client.server.subscribeConfig((event) => {
      applyServerConfigEvent(event)
    }),
  ]

  if (getServerConfig() === null) {
    void client.server.getConfig().then((config) => {
      if (!disposed && getServerConfig() === null) {
        appAtomRegistry.set(serverConfigAtom, config)
      }
    }).catch(() => undefined)
  }

  return () => {
    disposed = true
    for (const cleanup of cleanups) {
      cleanup()
    }
  }
}

export function useServerWelcome(): ServerLifecycleWelcomePayload | null {
  return useAtomValue(serverWelcomeAtom)
}

export function useServerConfig(): ServerConfig | null {
  return useAtomValue(serverConfigAtom)
}

export function resetServerStateForTests(): void {
  appAtomRegistry.set(serverWelcomeAtom, null)
  appAtomRegistry.set(serverConfigAtom, null)
}
