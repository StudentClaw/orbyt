import { useMemo } from "react"
import { getPrimaryWsRpcClient } from "@/rpc/appRuntime"
import {
  createOrchestrationThread,
  interruptOrchestrationTurn,
  sendOrchestrationTurn,
  useOrchestrationSnapshot,
  useProviderRuntimeEvents,
} from "@/rpc/orchestrationState"
import { useServerConfig, useServerWelcome } from "@/rpc/serverState"
import { useDesktopBootstrap, useWsConnectionStatus } from "@/rpc/wsConnectionState"

export function useRuntimeConnectionStatus() {
  return useWsConnectionStatus()
}

export function useRuntimeBootstrap() {
  return useDesktopBootstrap()
}

export function useRuntimeServerConfig() {
  return useServerConfig()
}

export function useRuntimeWelcome() {
  return useServerWelcome()
}

export function useRuntimeOrchestrationSnapshot() {
  return useOrchestrationSnapshot()
}

export function useRuntimeProviderEvents() {
  return useProviderRuntimeEvents()
}

export function useOrchestrationActions() {
  return useMemo(() => {
    const client = getPrimaryWsRpcClient()
    return {
      createThread: (title?: string) => createOrchestrationThread(client, title),
      sendTurn: (threadId: string, content: string) => sendOrchestrationTurn(client, threadId, content),
      interruptTurn: (threadId: string) => interruptOrchestrationTurn(client, threadId),
      startProviderAuth: () => client.provider.startAuth(),
      retryProviderInitialize: () => client.provider.retryInitialize(),
    }
  }, [])
}
