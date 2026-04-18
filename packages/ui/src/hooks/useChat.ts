import { useCallback, useMemo, useState } from "react"
import type {
  ProviderApprovalDecision,
  ThreadAccessMode,
  TurnAttachmentInput,
} from "@student-claw/contracts"
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
import { buildPromptContent } from "@/lib/chatAttachments"

function buildThreadTitle(content: string, attachments: readonly TurnAttachmentInput[]): string {
  const trimmed = content.trim()
  if (trimmed.length > 0) {
    return trimmed.slice(0, 40)
  }

  return attachments[0]?.name.slice(0, 40) || "New chat"
}

export interface ChatSelectionInput {
  readonly workspaceId?: string | null
  readonly threadId?: string | null
  readonly model?: string | null
  readonly onThreadCreated?: (workspaceId: string, threadId: string) => void | Promise<void>
}

export interface ChatSendInput {
  readonly content: string
  readonly attachments: readonly TurnAttachmentInput[]
  readonly skillId?: string | null
}

export function useChat(selection?: ChatSelectionInput) {
  const snapshot = useRuntimeOrchestrationSnapshot()
  const connectionStatus = useRuntimeConnectionStatus()
  const providerToolCallsByTurnId = useRuntimeProviderToolCallsByTurnId()
  const selectedWorkspaceIdFromUi = useRuntimeSelectedWorkspaceId()
  const selectedThreadIdFromUi = useRuntimeSelectedThreadId()
  const actions = useOrchestrationActions()
  const uiActions = useChatUiActions()
  const [accessModeMutationPending, setAccessModeMutationPending] = useState(false)
  const [approvalDecisionPendingId, setApprovalDecisionPendingId] = useState<string | null>(null)

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

  const currentPendingApproval = useMemo(() => {
    if (!snapshot || !currentThread) {
      return null
    }

    return snapshot.pendingApprovals.find((approval) => approval.threadId === currentThread.id) ?? null
  }, [currentThread, snapshot])

  const inputDisabledReason = useMemo(() => {
    if (!currentWorkspace) {
      return "Select a folder to start chatting."
    }

    if (currentWorkspace.kind === "filesystem" && currentWorkspace.availability === "missing") {
      return "Relink or remove this missing folder before sending messages."
    }

    return null
  }, [currentWorkspace])

  const sendMessage = useCallback(async ({ content, attachments, skillId }: ChatSendInput) => {
    const trimmed = content.trim()
    if (
      (trimmed.length === 0 && attachments.length === 0)
      || connectionStatus.phase !== "connected"
      || !currentWorkspace
      || inputDisabledReason
    ) {
      return
    }

    const promptContent = buildPromptContent(trimmed, attachments)
    let threadId = currentThread?.id ?? selectedThreadId
    if (!threadId) {
      threadId = await actions.createThread(currentWorkspace.id, buildThreadTitle(trimmed, attachments))
      if (selection?.onThreadCreated) {
        await selection.onThreadCreated(currentWorkspace.id, threadId)
      } else {
        uiActions.selectChatTarget(currentWorkspace.id, threadId)
      }
    }

    if (skillId === undefined) {
      await actions.sendTurn(threadId, promptContent, attachments, selection?.model)
      return
    }

    await actions.sendTurn(threadId, promptContent, attachments, selection?.model, skillId)
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

  const setThreadAccessMode = useCallback(async (accessMode: ThreadAccessMode) => {
    if (!currentThread) {
      return
    }

    setAccessModeMutationPending(true)
    try {
      await actions.setThreadAccessMode(currentThread.id, accessMode)
    } finally {
      setAccessModeMutationPending(false)
    }
  }, [actions, currentThread])

  const respondToApproval = useCallback(async (decision: ProviderApprovalDecision) => {
    if (!currentPendingApproval) {
      return
    }

    setApprovalDecisionPendingId(currentPendingApproval.id)
    try {
      await actions.respondToApproval(currentPendingApproval.id, decision)
    } finally {
      setApprovalDecisionPendingId(null)
    }
  }, [actions, currentPendingApproval])

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
    setThreadAccessMode,
    respondToApproval,
    currentPendingApproval,
    accessModeMutationPending,
    approvalDecisionPending: currentPendingApproval
      ? approvalDecisionPendingId === currentPendingApproval.id
      : false,
    connectionState: connectionStatus.phase,
    inputDisabled: Boolean(inputDisabledReason),
    inputDisabledReason,
  }
}
