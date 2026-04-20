import { describe, expect, test } from "vitest"
import type {
  OrchestrationSnapshot,
  OrchestrationThread,
  OrchestrationTurn,
} from "@student-claw/contracts"
import { resolveChatState } from "../hooks/chat-model"
import type { WsConnectionStatus } from "../rpc/wsConnectionState"

const connected: WsConnectionStatus = {
  phase: "connected",
  wsUrl: "ws://127.0.0.1:8787",
  lastSequence: 0,
  lastError: null,
}

function makeThread(overrides: Partial<OrchestrationThread> = {}): OrchestrationThread {
  return {
    id: "thread-1" as never,
    workspaceId: "workspace-1" as never,
    title: "T",
    accessMode: "default",
    status: "streaming",
    createdAt: "2026-04-19T00:00:00.000Z",
    currentTurnId: "turn-1" as never,
    ...overrides,
  } as OrchestrationThread
}

function makeTurn(overrides: Partial<OrchestrationTurn> = {}): OrchestrationTurn {
  return {
    id: "turn-1" as never,
    threadId: "thread-1" as never,
    input: "hi",
    output: "",
    reasoning: "",
    status: "streaming",
    startedAt: "2026-04-19T00:01:00.000Z",
    completedAt: null,
    skill: null,
    attachments: [],
    ...overrides,
  } as OrchestrationTurn
}

function makeSnapshot(thread: OrchestrationThread, turn: OrchestrationTurn): OrchestrationSnapshot {
  return {
    workspaces: [
      {
        id: "workspace-1" as never,
        kind: "filesystem",
        name: "Repo",
        rootPath: "/repo",
        availability: "ready",
        createdAt: "2026-04-19T00:00:00.000Z",
        updatedAt: "2026-04-19T00:00:00.000Z",
      },
    ],
    threads: [thread],
    turns: [turn],
    pendingApprovals: [],
    providerStatus: "streaming",
    providerRuntime: {
      adapter: "codex",
      status: "streaming",
      authState: "authenticated",
      lastError: null,
      queuedTurnCount: 0,
      lastUpdatedAt: "2026-04-19T00:01:00.000Z",
    },
    ready: true,
    lastSequence: 1,
  }
}

describe("resolveChatState", () => {
  test("returns interrupting when local interruptRequested is set and turn is streaming", () => {
    const thread = makeThread({ status: "streaming" })
    const turn = makeTurn({ status: "streaming" })
    const snapshot = makeSnapshot(thread, turn)

    const result = resolveChatState(snapshot, thread, connected, true)

    expect(result.status).toBe("interrupting")
    expect(result.error).toBeNull()
  })

  test("returns interrupting when local interruptRequested is set and turn is queued", () => {
    const thread = makeThread({ status: "queued" })
    const turn = makeTurn({ status: "queued" })
    const snapshot: OrchestrationSnapshot = {
      ...makeSnapshot(thread, turn),
      providerStatus: "idle",
      providerRuntime: {
        adapter: "codex",
        status: "idle",
        authState: "authenticated",
        lastError: null,
        queuedTurnCount: 1,
        lastUpdatedAt: "2026-04-19T00:01:00.000Z",
      },
    }

    const result = resolveChatState(snapshot, thread, connected, true)

    expect(result.status).toBe("interrupting")
  })

  test("returns interrupting when thread status is interrupting (server wire event)", () => {
    const thread = makeThread({ status: "interrupting" })
    const turn = makeTurn({ status: "interrupting" })
    const snapshot = makeSnapshot(thread, turn)

    const result = resolveChatState(snapshot, thread, connected, false)

    expect(result.status).toBe("interrupting")
  })

  test("returns interrupted once the server confirms the turn is interrupted", () => {
    const thread = makeThread({ status: "interrupted" })
    const turn = makeTurn({ status: "interrupted" })
    const snapshot = makeSnapshot(thread, turn)

    const result = resolveChatState(snapshot, thread, connected, true)

    expect(result.status).toBe("interrupted")
  })

  test("ignores stale local interruptRequested when the turn is already idle/completed", () => {
    const thread = makeThread({ status: "completed", currentTurnId: null })
    const turn = makeTurn({ status: "completed" })
    const snapshot = makeSnapshot(thread, turn)

    const result = resolveChatState(snapshot, thread, connected, true)

    expect(result.status).not.toBe("interrupting")
  })

  test("returns streaming when no interrupt is pending", () => {
    const thread = makeThread({ status: "streaming" })
    const turn = makeTurn({ status: "streaming" })
    const snapshot = makeSnapshot(thread, turn)

    const result = resolveChatState(snapshot, thread, connected, false)

    expect(result.status).toBe("streaming")
  })

  test("returns queued when thread is queued without interrupt", () => {
    const thread = makeThread({ status: "queued" })
    const turn = makeTurn({ status: "queued" })
    const snapshot = makeSnapshot(thread, turn)

    const result = resolveChatState(snapshot, thread, connected, false)

    expect(result.status).toBe("queued")
  })

  test("offline takes priority over local interrupt flag", () => {
    const thread = makeThread({ status: "streaming" })
    const turn = makeTurn({ status: "streaming" })
    const snapshot = makeSnapshot(thread, turn)
    const disconnected: WsConnectionStatus = {
      phase: "disconnected",
      wsUrl: "ws://127.0.0.1:8787",
      lastSequence: 0,
      lastError: "socket closed",
    }

    const result = resolveChatState(snapshot, thread, disconnected, true)

    expect(result.status).toBe("offline")
  })
})
