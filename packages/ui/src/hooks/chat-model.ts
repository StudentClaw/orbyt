import type {
  OrchestrationSnapshot,
  OrchestrationThread,
  OrchestrationTurn,
  ProviderRuntimeEvent,
} from "@student-claw/contracts"
import type { WsConnectionStatus } from "@/rpc/wsConnectionState"

export type ChatStatus =
  | "idle"
  | "streaming"
  | "interrupted"
  | "offline"
  | "rate-limited"
  | "auth-expired"
  | "error"

export interface ToolCallInfo {
  readonly toolName: string
  readonly args: string
  readonly status: "pending" | "complete" | "error"
}

export interface ChatMessage {
  readonly id: string
  readonly role: "user" | "assistant"
  readonly content: string
  readonly timestamp: number
  readonly isStreaming?: boolean
  readonly toolCalls?: readonly ToolCallInfo[]
  readonly reasoning?: string
}

export interface ProviderGuidance {
  readonly title: string
  readonly detail: string | null
  readonly showRetry: boolean
  readonly showAuth: boolean
}

export function resolveCurrentThread(
  snapshot: OrchestrationSnapshot | null,
  selectedThreadId: string | null,
): OrchestrationThread | null {
  if (!snapshot) {
    return null
  }

  return snapshot.threads.find((entry) => entry.id === selectedThreadId) ?? snapshot.threads.at(-1) ?? null
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
): ReadonlyArray<ChatMessage> {
  return getThreadTurns(snapshot, threadId).flatMap((turn) => {
    const timestamp = Date.parse(turn.startedAt)
    return [
      {
        id: `${turn.id}:user`,
        role: "user",
        content: turn.input,
        timestamp,
      },
      {
        id: `${turn.id}:assistant`,
        role: "assistant",
        content: turn.output,
        timestamp: Date.parse(turn.completedAt ?? turn.startedAt),
        isStreaming: turn.status === "pending" || turn.status === "streaming",
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
    case "provider.turnStarted":
      return `Turn started: ${event.turnId}`
    case "provider.token":
      return `Token ${event.index + 1}: ${event.token}`
    case "provider.turnCompleted":
      return `Turn completed: ${event.turnId}`
    case "provider.turnInterrupted":
      return `Turn interrupted: ${event.turnId}`
  }
}

export function resolveChatState(
  snapshot: OrchestrationSnapshot | null,
  thread: OrchestrationThread | null,
  connectionStatus: WsConnectionStatus,
): { status: ChatStatus; error: string | null } {
  if (connectionStatus.phase !== "connected") {
    return {
      status: "offline",
      error: connectionStatus.lastError,
    }
  }

  if (!snapshot) {
    return {
      status: "idle",
      error: null,
    }
  }

  const guidance = resolveProviderGuidance(snapshot)

  if (
    snapshot.providerRuntime.authState === "auth_required"
    || snapshot.providerRuntime.authState === "expired"
    || snapshot.providerRuntime.status === "auth_required"
  ) {
    return {
      status: "auth-expired",
      error: guidance?.detail ?? "Finish the Codex login flow, then retry the runtime.",
    }
  }

  if (snapshot.providerRuntime.status === "rate_limited") {
    return {
      status: "rate-limited",
      error: guidance?.detail,
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
    }
  }

  const currentTurn = getCurrentTurn(snapshot, thread)
  if (thread?.status === "interrupted" || currentTurn?.status === "interrupted") {
    return {
      status: "interrupted",
      error: null,
    }
  }

  if (
    thread?.status === "streaming"
    || currentTurn?.status === "pending"
    || currentTurn?.status === "streaming"
    || snapshot.providerStatus === "streaming"
  ) {
    return {
      status: "streaming",
      error: null,
    }
  }

  return {
    status: "idle",
    error: null,
  }
}
