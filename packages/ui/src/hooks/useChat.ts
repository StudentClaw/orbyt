import { useCallback, useMemo } from "react"
import {
  useChatUiActions,
  useOrchestrationActions,
  useRuntimeConnectionStatus,
  useRuntimeOrchestrationSnapshot,
  useRuntimeProviderToolCallsByTurnId,
  useRuntimeSelectedThreadId,
  useRuntimeSelectedWorkspaceId,
} from "@/hooks/useAppRuntime"
import {
  buildChatMessages,
  resolveChatState,
  resolveCurrentThread,
  resolveCurrentWorkspace,
} from "./chat-model"

function buildThreadTitle(content: string): string {
  return content.trim().slice(0, 40) || "New chat"
}

export interface ChatSelectionInput {
  readonly workspaceId?: string | null
  readonly threadId?: string | null
  readonly model?: string | null
  readonly onThreadCreated?: (workspaceId: string, threadId: string) => void | Promise<void>
}

export function useChat(selection?: ChatSelectionInput) {
  const snapshot = useRuntimeOrchestrationSnapshot()
  const connectionStatus = useRuntimeConnectionStatus()
  const providerToolCallsByTurnId = useRuntimeProviderToolCallsByTurnId()
  const selectedWorkspaceIdFromUi = useRuntimeSelectedWorkspaceId()
  const selectedThreadIdFromUi = useRuntimeSelectedThreadId()
  const actions = useOrchestrationActions()
  const uiActions = useChatUiActions()

  const selectedWorkspaceId = selection?.workspaceId ?? selectedWorkspaceIdFromUi
  const selectedThreadId = selection?.threadId ?? selectedThreadIdFromUi

  const currentThread = useMemo(() => {
    return resolveCurrentThread(snapshot, selectedThreadId)
  }, [selectedThreadId, snapshot])

  const currentWorkspace = useMemo(() => {
    return resolveCurrentWorkspace(snapshot, selectedWorkspaceId, selectedThreadId)
  }, [selectedThreadId, selectedWorkspaceId, snapshot])

  const messages = useMemo(() => {
    return buildChatMessages(snapshot, currentThread?.id ?? null, providerToolCallsByTurnId)
  }, [currentThread?.id, providerToolCallsByTurnId, snapshot])

  const chatState = useMemo(() => {
    return resolveChatState(snapshot, currentThread, connectionStatus)
  }, [connectionStatus, currentThread, snapshot])

  const inputDisabledReason = useMemo(() => {
    if (!currentWorkspace) {
      return "Select a folder to start chatting."
    }

    if (currentWorkspace.kind === "filesystem" && currentWorkspace.availability === "missing") {
      return "Relink or remove this missing folder before sending messages."
    }

    return null
  }, [currentWorkspace])

  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed || connectionStatus.phase !== "connected" || !currentWorkspace || inputDisabledReason) {
      return
    }

    let threadId = currentThread?.id ?? selectedThreadId
    if (!threadId) {
      threadId = await actions.createThread(currentWorkspace.id, buildThreadTitle(trimmed))
      if (selection?.onThreadCreated) {
        await selection.onThreadCreated(currentWorkspace.id, threadId)
      } else {
        uiActions.selectChatTarget(currentWorkspace.id, threadId)
      }
    }

    await actions.sendTurn(threadId, trimmed, selection?.model)
  }, [
    actions,
    connectionStatus.phase,
    currentThread?.id,
    currentWorkspace,
    inputDisabledReason,
    selectedThreadId,
    selection,
    uiActions,
  ])

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
    currentWorkspace,
    sendMessage,
    interrupt,
    retry,
    reauth,
    connectionState: connectionStatus.phase,
    inputDisabled: Boolean(inputDisabledReason),
    inputDisabledReason,
  }
}
