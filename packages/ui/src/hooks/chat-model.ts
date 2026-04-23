import type {
  OrchestrationSnapshot,
  OrchestrationThread,
  OrchestrationTurnAttachment,
  OrchestrationTurn,
  OrchestrationWorkspace,
  ProviderRuntimeEvent,
} from "@orbyt/contracts"
import { extractDisplayContent } from "@/lib/chatAttachments"
import { parseArtifacts } from "@/lib/artifacts/parseArtifacts"
import type { ChatArtifact, PendingArtifact } from "@/lib/artifacts/types"

export type ProviderGuidance = {
  title: string
  detail: string
  showRetry: boolean
  showAuth: boolean
}

import type { WsConnectionStatus } from "@/rpc/wsConnectionState"

export type ChatStatus =
  | "preparing"
  | "idle"
  | "queued"
  | "streaming"
  | "interrupting"
  | "interrupted"
  | "offline"
  | "rate-limited"
  | "auth-expired"
  | "error"

export interface ChatState {
  readonly status: ChatStatus
  readonly error: string | null
  readonly preparingLabel: string | null
  readonly preparingDetail: string | null
}

export interface ToolCallInfo {
  readonly toolName: string
  readonly args: string
  readonly status: "pending" | "complete" | "error"
  readonly message?: string
  readonly error?: string
}

export interface ChatMessage {
  readonly id: string
  readonly role: "user" | "assistant"
  readonly content: string
  readonly timestamp: number
  readonly attachments?: readonly OrchestrationTurnAttachment[]
  readonly isStreaming?: boolean
  readonly isQueued?: boolean
  readonly toolCalls?: readonly ToolCallInfo[]
  readonly reasoning?: string
  readonly artifacts?: readonly ChatArtifact[]
  readonly pendingArtifact?: PendingArtifact | null
}

export function getChatStatusPresentation(status: ChatStatus): {
  label: string
  dotClassName: string
  pulse: boolean
} | undefined {
  switch (status) {
    case "preparing":
      return {
        label: "Preparing",
        dotClassName: "bg-sky-500",
        pulse: true,
      }
    case "idle":
      return {
        label: "Ready",
        dotClassName: "bg-emerald-500",
        pulse: false,
      }
    case "queued":
      return {
        label: "Queued",
        dotClassName: "bg-sky-500",
        pulse: false,
      }
    case "streaming":
      return {
        label: "Streaming",
        dotClassName: "bg-sky-500",
        pulse: true,
      }
    case "interrupted":
      return {
        label: "Interrupted",
        dotClassName: "bg-amber-500",
        pulse: false,
      }
    case "offline":
      return {
        label: "Offline",
        dotClassName: "bg-red-500",
        pulse: false,
      }
    case "rate-limited":
      return {
        label: "Rate limited",
        dotClassName: "bg-amber-500",
        pulse: false,
      }
    case "auth-expired":
      return {
        label: "Auth required",
        dotClassName: "bg-amber-500",
        pulse: false,
      }
    case "error":
      return {
        label: "Error",
        dotClassName: "bg-red-500",
        pulse: false,
      }
  }
}

export function resolveCurrentWorkspace(
  snapshot: OrchestrationSnapshot | null,
  selectedWorkspaceId: string | null,
  selectedThreadId: string | null,
): OrchestrationWorkspace | null {
  if (!snapshot) {
    return null
  }

  if (selectedThreadId) {
    const threadWorkspaceId = snapshot.threads.find((entry) => entry.id === selectedThreadId)?.workspaceId ?? null
    if (threadWorkspaceId) {
      return snapshot.workspaces.find((entry) => entry.id === threadWorkspaceId) ?? null
    }
  }

  if (!selectedWorkspaceId) {
    return null
  }

  return snapshot.workspaces.find((entry) => entry.id === selectedWorkspaceId) ?? null
}

export function resolveCurrentThread(
  snapshot: OrchestrationSnapshot | null,
  selectedThreadId: string | null,
): OrchestrationThread | null {
  if (!snapshot) {
    return null
  }

  if (!selectedThreadId) {
    return null
  }

  return snapshot.threads.find((entry) => entry.id === selectedThreadId) ?? null
}

export function sortThreadsByRecency(
  threads: ReadonlyArray<OrchestrationThread>,
): ReadonlyArray<OrchestrationThread> {
  return [...threads].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
}

export function getCurrentTurn(
  snapshot: OrchestrationSnapshot | null,
  thread: OrchestrationThread | null,
): OrchestrationTurn | null {
  if (!snapshot || !thread?.currentTurnId) {
    return null
  }

  return snapshot.turns.find((entry) => entry.id === thread.currentTurnId) ?? null
}

function getThreadTurns(
  snapshot: OrchestrationSnapshot | null,
  threadId: string | null,
): ReadonlyArray<OrchestrationTurn> {
  if (!snapshot || !threadId) {
    return []
  }

  return snapshot.turns
    .filter((entry) => entry.threadId === threadId)
    .sort((left, right) => {
      return Date.parse(left.startedAt) - Date.parse(right.startedAt)
    })
}

export function buildChatMessages(
  snapshot: OrchestrationSnapshot | null,
  threadId: string | null,
  toolCallsByTurnId: Readonly<Record<string, ReadonlyArray<ToolCallInfo>>> = {},
): ReadonlyArray<ChatMessage> {
  return getThreadTurns(snapshot, threadId).flatMap((turn) => {
    const timestamp = Date.parse(turn.startedAt)
    const assistantId = `${turn.id}:assistant`
    const parsed = parseArtifacts(turn.output, assistantId)
    return [
      {
        id: `${turn.id}:user`,
        role: "user",
        content: extractDisplayContent(turn.input, turn.attachments),
        timestamp,
        attachments: turn.attachments,
      },
      {
        id: assistantId,
        role: "assistant",
        content: parsed.cleanedContent,
        reasoning: turn.reasoning || undefined,
        timestamp: Date.parse(turn.completedAt ?? turn.startedAt),
        isStreaming: turn.status === "streaming",
        isQueued: turn.status === "queued",
        toolCalls: toolCallsByTurnId[turn.id] ?? [],
        artifacts: parsed.artifacts,
        pendingArtifact: parsed.pendingArtifact,
      },
    ] satisfies ReadonlyArray<ChatMessage>
  })
}

function formatProviderStatus(status: OrchestrationSnapshot["providerStatus"]): string {
  return status.replace(/_/g, " ")
}

export function resolveProviderGuidance(snapshot: OrchestrationSnapshot | null): ProviderGuidance | null {
  if (!snapshot) {
    return null
  }

  const { providerRuntime } = snapshot
  const errorMessage = providerRuntime.lastError?.message ?? null

  if (
    providerRuntime.authState === "auth_required"
    || providerRuntime.authState === "expired"
    || providerRuntime.status === "auth_required"
  ) {
    return {
      title: "Codex login required",
      detail: errorMessage ?? "Finish the Codex login flow, then retry the runtime.",
      showRetry: false,
      showAuth: true,
    }
  }

  if (providerRuntime.status === "degraded") {
    return {
      title: "Codex runtime degraded",
      detail: errorMessage ?? "The runtime hit an internal error. Retry initialization to reconnect it.",
      showRetry: true,
      showAuth: false,
    }
  }

  if (providerRuntime.status === "offline") {
    return {
      title: "Codex runtime offline",
      detail: errorMessage ?? "The runtime is not connected yet. Retry initialization to start it again.",
      showRetry: true,
      showAuth: false,
    }
  }

  if (providerRuntime.status === "rate_limited") {
    return {
      title: "Codex rate limited",
      detail: errorMessage ?? "Codex reported a rate limit. Retrying may help after a short wait.",
      showRetry: true,
      showAuth: false,
    }
  }

  return null
}

export function formatProviderEventLabel(event: ProviderRuntimeEvent): string {
  switch (event.type) {
    case "provider.stateChanged":
      return event.state.lastError
        ? `State changed to ${formatProviderStatus(event.state.status)}: ${event.state.lastError.code}`
        : `State changed to ${formatProviderStatus(event.state.status)}`
    case "provider.readinessChanged":
      return event.chatSendReady
        ? "Chat send is ready"
        : "Chat send is waiting for Codex startup"
    case "provider.turnStarted":
      return `Turn started: ${event.turnId}`
    case "provider.token":
      return `Token ${event.index + 1}: ${event.token}`
    case "provider.turnCompleted":
      return `Turn completed: ${event.turnId}`
    case "provider.interruptionRequested":
      return `Interruption requested: ${event.turnId}`
    case "provider.turnInterrupted":
      return `Turn interrupted: ${event.turnId}`
    case "provider.mcpToolCall":
      return `${event.status} tool call: ${event.toolName}`
    case "provider.approvalRequested":
      return `Approval requested: ${event.approval.kind}`
    case "provider.approvalResolved":
      return `Approval ${event.decision}: ${event.approvalRequestId}`
    default:
      return ""
  }
}

export function resolveChatState(
  snapshot: OrchestrationSnapshot | null,
  thread: OrchestrationThread | null,
  connectionStatus: WsConnectionStatus,
  interruptRequested: boolean = false,
): ChatState {
  if (connectionStatus.phase !== "connected") {
    return {
      status: "offline",
      error: connectionStatus.lastError,
      preparingLabel: null,
      preparingDetail: null,
    }
  }

  if (!snapshot) {
    return {
      status: "idle",
      error: null,
      preparingLabel: null,
      preparingDetail: null,
    }
  }

  const guidance = resolveProviderGuidance(snapshot)
  const currentTurn = getCurrentTurn(snapshot, thread)
  const turnInFlight =
    thread?.status === "streaming"
    || currentTurn?.status === "streaming"
    || thread?.status === "queued"
    || currentTurn?.status === "queued"

  if (
    snapshot.providerRuntime.authState === "auth_required"
    || snapshot.providerRuntime.authState === "expired"
    || snapshot.providerRuntime.status === "auth_required"
  ) {
    return {
      status: "auth-expired",
      error: guidance?.detail ?? "Finish the Codex login flow, then retry the runtime.",
      preparingLabel: null,
      preparingDetail: null,
    }
  }

  if (thread?.status === "interrupted" || currentTurn?.status === "interrupted") {
    return {
      status: "interrupted",
      error: null,
      preparingLabel: null,
      preparingDetail: null,
    }
  }

  if (thread?.status === "interrupting" || currentTurn?.status === "interrupting") {
    return {
      status: "interrupting",
      error: null,
      preparingLabel: null,
      preparingDetail: null,
    }
  }

  if (interruptRequested && turnInFlight) {
    return {
      status: "interrupting",
      error: null,
      preparingLabel: null,
      preparingDetail: null,
    }
  }

  if (thread?.status === "queued" || currentTurn?.status === "queued") {
    return {
      status: "queued",
      error: null,
      preparingLabel: null,
      preparingDetail: null,
    }
  }

  if (
    thread?.status === "streaming"
    || currentTurn?.status === "streaming"
  ) {
    return {
      status: "streaming",
      error: null,
      preparingLabel: null,
      preparingDetail: null,
    }
  }

  const providerIsPreparing =
    !snapshot.chatSendReady
    && (
      snapshot.providerRuntime.status === "initializing"
    || (
      snapshot.providerRuntime.authState === "unknown"
      && (
        snapshot.providerRuntime.adapter === "stub"
        || snapshot.providerRuntime.status === "idle"
        || !snapshot.ready
        || snapshot.providerStatus === "offline"
        || snapshot.providerRuntime.status === "offline"
      )
    ))

  if (providerIsPreparing) {
    return {
      status: "preparing",
      error: null,
      preparingLabel: "Preparing Codex",
      preparingDetail: snapshot.providerRuntime.status === "initializing"
        ? "Warming the local Codex runtime for chat."
        : "Finalizing the local chat runtime before opening the conversation.",
    }
  }

  if (!snapshot.chatSendReady) {
    return {
      status: "preparing",
      error: null,
      preparingLabel: "Preparing Codex",
      preparingDetail: "Finishing Codex startup before chat can send messages.",
    }
  }

  if (
    !snapshot.ready
    || snapshot.providerStatus === "offline"
    || snapshot.providerRuntime.status === "degraded"
    || snapshot.providerRuntime.status === "offline"
  ) {
    return {
      status: "error",
      error: guidance?.detail ?? connectionStatus.lastError ?? "AI unavailable right now. The local runtime is not ready.",
      preparingLabel: null,
      preparingDetail: null,
    }
  }

  if (snapshot.providerRuntime.status === "rate_limited") {
    return {
      status: "rate-limited",
      error: guidance?.detail ?? null,
      preparingLabel: null,
      preparingDetail: null,
    }
  }

  return {
    status: "idle",
    error: null,
    preparingLabel: null,
    preparingDetail: null,
  }
}
