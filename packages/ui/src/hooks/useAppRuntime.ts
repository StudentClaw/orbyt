import { useMemo } from "react"
import { getPrimaryWsRpcClient } from "@/rpc/appRuntime"
import {
  closeChatPanel,
  createOrchestrationThread,
  interruptOrchestrationTurn,
  openChatPanel,
  setChatPanelWidth,
  setSelectedChatThread,
  useChatPanelOpen,
  useChatPanelWidth,
  sendOrchestrationTurn,
  useChatUiState,
  useOrchestrationSnapshot,
  useSelectedChatThreadId,
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

export function useRuntimeChatUiState() {
  return useChatUiState()
}

export function useRuntimeSelectedThreadId() {
  return useSelectedChatThreadId()
}

export function useRuntimeChatPanelOpen() {
  return useChatPanelOpen()
}

export function useRuntimeChatPanelWidth() {
  return useChatPanelWidth()
}

export function useOrchestrationActions() {
  return useMemo(() => {
    const client = getPrimaryWsRpcClient()
    return {
      createThread: (title?: string) => createOrchestrationThread(client, title),
      sendTurn: (threadId: string, content: string) => sendOrchestrationTurn(client, threadId, content),
      interruptTurn: (threadId: string) => interruptOrchestrationTurn(client, threadId),
    }
  }, [])
}

export function useChatUiActions() {
  return useMemo(() => {
    return {
      selectThread: (threadId: string | null) => setSelectedChatThread(threadId),
      openPanel: () => openChatPanel(),
      closePanel: () => closeChatPanel(),
      setPanelWidth: (width: number) => setChatPanelWidth(width),
    }
  }, [])
}
