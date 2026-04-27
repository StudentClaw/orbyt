import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type {
  ProviderApprovalDecision,
  ThreadAccessMode,
  TurnAttachmentInput,
  TurnReferenceInput,
} from "@orbyt/contracts"
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
  readonly references?: readonly TurnReferenceInput[]
  readonly skillId?: string | null
}

function resolveInputDisabledReason(args: {
  readonly currentWorkspace: ReturnType<typeof resolveCurrentWorkspace>
  readonly chatState: ReturnType<typeof resolveChatState>
}): string | null {
  const { currentWorkspace, chatState } = args

  if (!currentWorkspace) {
    return "Select a folder to start chatting."
  }

  if (currentWorkspace.kind === "filesystem" && currentWorkspace.availability === "missing") {
    return "Relink or remove this missing folder before sending messages."
  }

  switch (chatState.status) {
    case "preparing":
      return chatState.preparingDetail ?? "Preparing Codex before opening the composer."
    case "auth-expired":
      return chatState.error ?? "Finish the Codex sign-in flow before sending messages."
    case "error":
      return chatState.error ?? "Chat is still starting up."
    case "rate-limited":
      return chatState.error ?? "Codex is rate limited right now."
    default:
      return null
  }
}

function canSendWithStatus(status: ReturnType<typeof resolveChatState>["status"]): boolean {
  return status === "idle" || status === "interrupted"
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
  const [isSending, setIsSending] = useState(false)
  const [interruptPendingThreadId, setInterruptPendingThreadId] = useState<string | null>(null)
  const [interruptError, setInterruptError] = useState<string | null>(null)
  const interruptRpcInFlightRef = useRef(false)

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

  const interruptRequested =
    interruptPendingThreadId !== null
    && currentThread?.id === interruptPendingThreadId

  const chatState = useMemo(() => {
    return resolveChatState(snapshot, currentThread, connectionStatus, interruptRequested)
  }, [connectionStatus, currentThread, interruptRequested, snapshot])

  useEffect(() => {
    if (!interruptPendingThreadId) {
      return
    }

    const pendingThread = snapshot?.threads.find((thread) => thread.id === interruptPendingThreadId) ?? null
    if (!pendingThread) {
      setInterruptPendingThreadId(null)
      return
    }

    if (
      pendingThread.status === "interrupted"
      || pendingThread.status === "completed"
      || pendingThread.status === "idle"
    ) {
      setInterruptPendingThreadId(null)
    }
  }, [interruptPendingThreadId, snapshot])

  const currentPendingApproval = useMemo(() => {
    if (!snapshot || !currentThread) {
      return null
    }

    return snapshot.pendingApprovals.find((approval) => approval.threadId === currentThread.id) ?? null
  }, [currentThread, snapshot])

  const inputDisabledReason = useMemo(() => {
    return resolveInputDisabledReason({
      currentWorkspace,
      chatState,
    })
  }, [chatState, currentWorkspace])

  const sendMessage = useCallback(async ({ content, attachments, references, skillId }: ChatSendInput) => {
    const trimmed = content.trim()
    if (
      (trimmed.length === 0 && attachments.length === 0)
      || connectionStatus.phase !== "connected"
      || !canSendWithStatus(chatState.status)
      || !currentWorkspace
      || inputDisabledReason
    ) {
      return
    }

    const refs = references ?? []
    const promptContent = buildPromptContent(trimmed, attachments, refs)
    setIsSending(true)
    try {
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
        await actions.sendTurn(threadId, promptContent, attachments, selection?.model, undefined, refs)
        return
      }

      await actions.sendTurn(threadId, promptContent, attachments, selection?.model, skillId, refs)
    } finally {
      setIsSending(false)
    }
  }, [
    actions,
    chatState.status,
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

    if (interruptRpcInFlightRef.current || interruptPendingThreadId === activeThreadId) {
      return
    }

    const threadStatus = currentThread?.status ?? null
    if (
      threadStatus !== "streaming"
      && threadStatus !== "queued"
      && threadStatus !== "interrupting"
    ) {
      return
    }

    interruptRpcInFlightRef.current = true
    setInterruptPendingThreadId(activeThreadId)
    setInterruptError(null)

    try {
      const interrupted = await actions.interruptTurn(activeThreadId)
      if (!interrupted) {
        setInterruptPendingThreadId(null)
      }
    } catch (error: unknown) {
      setInterruptPendingThreadId(null)
      setInterruptError(error instanceof Error ? error.message : "Failed to stop the turn.")
    } finally {
      interruptRpcInFlightRef.current = false
    }
  }, [actions, currentThread?.id, currentThread?.status, interruptPendingThreadId, selectedThreadId])

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
    preparingLabel: chatState.preparingLabel,
    preparingDetail: chatState.preparingDetail,
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
    isSending,
    interruptPending: interruptRequested,
    interruptError,
  }
}
