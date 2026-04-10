import { useCallback, useMemo } from "react"
import {
  useChatUiActions,
  useOrchestrationActions,
  useRuntimeConnectionStatus,
  useRuntimeOrchestrationSnapshot,
  useRuntimeSelectedThreadId,
} from "@/hooks/useAppRuntime"
import {
  buildChatMessages,
  resolveChatState,
  resolveCurrentThread,
} from "./chat-model"

function buildThreadTitle(content: string): string {
  return content.trim().slice(0, 40) || "New chat"
}

export function useChat() {
  const snapshot = useRuntimeOrchestrationSnapshot()
  const connectionStatus = useRuntimeConnectionStatus()
  const selectedThreadId = useRuntimeSelectedThreadId()
  const actions = useOrchestrationActions()
  const uiActions = useChatUiActions()

  const currentThread = useMemo(() => {
    return resolveCurrentThread(snapshot, selectedThreadId)
  }, [selectedThreadId, snapshot])

  const messages = useMemo(() => {
    return buildChatMessages(snapshot, currentThread?.id ?? null)
  }, [currentThread?.id, snapshot])

  const chatState = useMemo(() => {
    return resolveChatState(snapshot, currentThread, connectionStatus)
  }, [connectionStatus, currentThread, snapshot])

  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim()
    if (
      !trimmed
      || connectionStatus.phase !== "connected"
      || chatState.status === "auth-expired"
      || chatState.status === "rate-limited"
      || chatState.status === "error"
    ) {
      return
    }

    let threadId = currentThread?.id ?? selectedThreadId
    if (!threadId) {
      threadId = await actions.createThread(buildThreadTitle(trimmed))
      uiActions.selectThread(threadId)
    }

    await actions.sendTurn(threadId, trimmed)
  }, [actions, chatState.status, connectionStatus.phase, currentThread?.id, selectedThreadId, uiActions])

  const interrupt = useCallback(async () => {
    const activeThreadId = currentThread?.id ?? selectedThreadId
    if (!activeThreadId) {
      return
    }

    await actions.interruptTurn(activeThreadId)
  }, [actions, currentThread?.id, selectedThreadId])

  const retry = useCallback(async () => {
    await actions.retryProviderInitialize()
  }, [actions])

  const reauth = useCallback(async () => {
    await actions.startProviderAuth()
  }, [actions])

  return {
    messages,
    status: chatState.status,
    error: chatState.error,
    currentThread,
    sendMessage,
    interrupt,
    retry,
    reauth,
    connectionState: connectionStatus.phase,
  }
}
