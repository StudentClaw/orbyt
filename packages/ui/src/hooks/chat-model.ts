import type {
  OrchestrationSnapshot,
  OrchestrationThread,
  OrchestrationTurn,
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

  if (!snapshot.ready || snapshot.providerStatus === "offline") {
    return {
      status: "error",
      error: connectionStatus.lastError ?? "AI unavailable right now. The local runtime is not ready.",
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
