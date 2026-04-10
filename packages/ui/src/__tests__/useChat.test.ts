import { beforeEach, describe, expect, test, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import type { OrchestrationSnapshot } from "@student-claw/contracts"
import type { WsConnectionStatus } from "../rpc/wsConnectionState"

const hookMocks = vi.hoisted(() => ({
  snapshot: null as OrchestrationSnapshot | null,
  selectedThreadId: null as string | null,
  connectionStatus: {
    phase: "connected" as const,
    wsUrl: "ws://127.0.0.1:8787",
    lastSequence: 0,
    lastError: null as string | null,
  } as WsConnectionStatus,
  createThread: vi.fn(),
  sendTurn: vi.fn(),
  interruptTurn: vi.fn(),
  selectThread: vi.fn(),
}))

vi.mock("../hooks/useAppRuntime", () => ({
  useRuntimeOrchestrationSnapshot: () => hookMocks.snapshot,
  useRuntimeSelectedThreadId: () => hookMocks.selectedThreadId,
  useRuntimeConnectionStatus: () => hookMocks.connectionStatus,
  useOrchestrationActions: () => ({
    createThread: hookMocks.createThread,
    sendTurn: hookMocks.sendTurn,
    interruptTurn: hookMocks.interruptTurn,
  }),
  useChatUiActions: () => ({
    selectThread: hookMocks.selectThread,
    openPanel: vi.fn(),
    closePanel: vi.fn(),
    setPanelWidth: vi.fn(),
  }),
}))

import { useChat } from "../hooks/useChat"

const baseSnapshot: OrchestrationSnapshot = {
  threads: [
    {
      id: "thread-1" as never,
      title: "Weekly plan",
      status: "streaming",
      createdAt: "2026-04-09T00:00:00.000Z",
      currentTurnId: "turn-1" as never,
    },
  ],
  turns: [
    {
      id: "turn-1" as never,
      threadId: "thread-1" as never,
      input: "Plan my week",
      output: "Working on it",
      status: "streaming",
      startedAt: "2026-04-09T00:01:00.000Z",
      completedAt: null,
    },
  ],
  providerStatus: "streaming",
  providerRuntime: {
    adapter: "codex",
    status: "streaming",
    authState: "authenticated",
    lastError: null,
    queuedTurnCount: 0,
    lastUpdatedAt: "2026-04-09T00:01:00.000Z",
  },
  ready: true,
  lastSequence: 2,
}

describe("useChat", () => {
  beforeEach(() => {
    hookMocks.snapshot = baseSnapshot
    hookMocks.selectedThreadId = "thread-1"
    hookMocks.connectionStatus = {
      phase: "connected",
      wsUrl: "ws://127.0.0.1:8787",
      lastSequence: 0,
      lastError: null,
    }
    hookMocks.createThread.mockReset()
    hookMocks.sendTurn.mockReset()
    hookMocks.interruptTurn.mockReset()
    hookMocks.selectThread.mockReset()
  })

  test("maps the current thread to user and assistant messages", () => {
    const { result } = renderHook(() => useChat())
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0]?.role).toBe("user")
    expect(result.current.messages[0]?.content).toBe("Plan my week")
    expect(result.current.messages[1]?.role).toBe("assistant")
    expect(result.current.messages[1]?.isStreaming).toBe(true)
  })

  test("sendMessage reuses the selected thread", async () => {
    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage("Hello")
    })
    expect(hookMocks.sendTurn).toHaveBeenCalledWith("thread-1", "Hello")
    expect(hookMocks.createThread).not.toHaveBeenCalled()
  })

  test("sendMessage creates and selects a thread when none is active", async () => {
    hookMocks.snapshot = { ...baseSnapshot, threads: [], turns: [], providerStatus: "idle", lastSequence: 0 }
    hookMocks.selectedThreadId = null
    hookMocks.createThread.mockResolvedValue("thread-new")

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage("  New thread title  ")
    })

    expect(hookMocks.createThread).toHaveBeenCalledWith("New thread title")
    expect(hookMocks.selectThread).toHaveBeenCalledWith("thread-new")
    expect(hookMocks.sendTurn).toHaveBeenCalledWith("thread-new", "New thread title")
  })

  test("interrupt calls the runtime interrupt action", async () => {
    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.interrupt()
    })
    expect(hookMocks.interruptTurn).toHaveBeenCalledWith("thread-1")
  })

  test("returns offline state when disconnected", () => {
    hookMocks.connectionStatus = {
      ...hookMocks.connectionStatus,
      phase: "disconnected",
    }

    const { result } = renderHook(() => useChat())
    expect(result.current.status).toBe("offline")
  })
})
