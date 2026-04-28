import { beforeEach, describe, expect, test, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import type { OrchestrationSnapshot } from "@orbyt/contracts"
import type { WsConnectionStatus } from "../rpc/wsConnectionState"

const hookMocks = vi.hoisted(() => ({
  snapshot: null as OrchestrationSnapshot | null,
  selectedWorkspaceId: null as string | null,
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
  setThreadAccessMode: vi.fn(),
  respondToApproval: vi.fn(),
  selectChatTarget: vi.fn(),
}))

vi.mock("../hooks/useAppRuntime", () => ({
  useRuntimeOrchestrationSnapshot: () => hookMocks.snapshot,
  useRuntimeProviderToolCallsByTurnId: () => ({}),
  useRuntimeSelectedWorkspaceId: () => hookMocks.selectedWorkspaceId,
  useRuntimeSelectedThreadId: () => hookMocks.selectedThreadId,
  useRuntimeConnectionStatus: () => hookMocks.connectionStatus,
  useOrchestrationActions: () => ({
    createThread: hookMocks.createThread,
    sendTurn: hookMocks.sendTurn,
    interruptTurn: hookMocks.interruptTurn,
    setThreadAccessMode: hookMocks.setThreadAccessMode,
    respondToApproval: hookMocks.respondToApproval,
  }),
  useChatUiActions: () => ({
    selectChatTarget: hookMocks.selectChatTarget,
    selectWorkspace: vi.fn(),
    clearSelection: vi.fn(),
    openPanel: vi.fn(),
    closePanel: vi.fn(),
    setPanelWidth: vi.fn(),
  }),
}))

import { useChat } from "../hooks/useChat"

const baseSnapshot: OrchestrationSnapshot = {
  workspaces: [
    {
      id: "workspace-1" as never,
      kind: "filesystem",
      name: "Repo",
      rootPath: "/repo",
      availability: "ready",
      createdAt: "2026-04-09T00:00:00.000Z",
      updatedAt: "2026-04-09T00:00:00.000Z",
    },
  ],
  threads: [
    {
      id: "thread-1" as never,
      workspaceId: "workspace-1" as never,
      title: "Weekly plan",
      accessMode: "default",
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
      reasoning: "",
      status: "streaming",
      startedAt: "2026-04-09T00:01:00.000Z",
      completedAt: null,
      skill: null,
      attachments: [],
      references: [],
    },
  ],
  pendingApprovals: [],
  providerStatus: "streaming",
  providerRuntime: {
    adapter: "codex",
    status: "streaming",
    authState: "authenticated",
    lastError: null,
    queuedTurnCount: 0,
    lastUpdatedAt: "2026-04-09T00:01:00.000Z",
  },
  chatSendReady: true,
  ready: true,
  lastSequence: 2,
}

describe("useChat", () => {
  beforeEach(() => {
    hookMocks.snapshot = baseSnapshot
    hookMocks.selectedWorkspaceId = "workspace-1"
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
    hookMocks.setThreadAccessMode.mockReset()
    hookMocks.respondToApproval.mockReset()
    hookMocks.selectChatTarget.mockReset()
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
    hookMocks.snapshot = {
      ...baseSnapshot,
      threads: [{ ...baseSnapshot.threads[0], status: "completed", currentTurnId: null }],
      turns: [{ ...baseSnapshot.turns[0], status: "completed", completedAt: "2026-04-09T00:02:00.000Z" }],
      providerStatus: "idle",
      providerRuntime: {
        ...baseSnapshot.providerRuntime,
        status: "idle",
      },
    }

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage({ content: "Hello", attachments: [] })
    })
    expect(hookMocks.sendTurn).toHaveBeenCalledWith("thread-1", "Hello", [], undefined, undefined, [])
    expect(hookMocks.createThread).not.toHaveBeenCalled()
  })

  test("sendMessage creates and selects a thread when none is active", async () => {
    hookMocks.snapshot = { ...baseSnapshot, threads: [], turns: [], providerStatus: "idle", lastSequence: 0 }
    hookMocks.selectedThreadId = null
    hookMocks.createThread.mockResolvedValue("thread-new")

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage({ content: "  New thread title  ", attachments: [] })
    })

    expect(hookMocks.createThread).toHaveBeenCalledWith("workspace-1", "New thread title")
    expect(hookMocks.selectChatTarget).toHaveBeenCalledWith("workspace-1", "thread-new")
    expect(hookMocks.sendTurn).toHaveBeenCalledWith("thread-new", "New thread title", [], undefined, undefined, [])
  })

  test("sendMessage plumbs references into buildPromptContent and forwards them to sendTurn", async () => {
    hookMocks.snapshot = {
      ...baseSnapshot,
      threads: [{ ...baseSnapshot.threads[0], status: "completed", currentTurnId: null }],
      turns: [{ ...baseSnapshot.turns[0], status: "completed", completedAt: "2026-04-09T00:02:00.000Z" }],
      providerStatus: "idle",
      providerRuntime: {
        ...baseSnapshot.providerRuntime,
        status: "idle",
      },
    }

    const references = [
      {
        kind: "canvas-assignment" as const,
        id: "canvas-course:42:assignment:12345",
        label: "Essay 3",
        url: "https://canvas.example.edu/courses/42/assignments/12345",
      },
    ]
    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage({
        content: "Review this",
        attachments: [],
        references,
      })
    })

    expect(hookMocks.sendTurn).toHaveBeenCalledTimes(1)
    const args = hookMocks.sendTurn.mock.calls[0] as unknown[]
    expect(args[0]).toBe("thread-1")
    expect(typeof args[1]).toBe("string")
    const promptContent = args[1] as string
    expect(promptContent.startsWith("Referenced Canvas items:")).toBe(true)
    expect(promptContent).toContain("canvas-course:42:assignment:12345")
    expect(promptContent).toContain("Review this")
    expect(args[5]).toEqual(references)
  })

  test("sendMessage passes the selected model through to the runtime", async () => {
    hookMocks.snapshot = {
      ...baseSnapshot,
      threads: [{ ...baseSnapshot.threads[0], status: "completed", currentTurnId: null }],
      turns: [{ ...baseSnapshot.turns[0], status: "completed", completedAt: "2026-04-09T00:02:00.000Z" }],
      providerStatus: "idle",
      providerRuntime: {
        ...baseSnapshot.providerRuntime,
        status: "idle",
      },
    }

    const { result } = renderHook(() => useChat({ model: "o3" }))

    await act(async () => {
      await result.current.sendMessage({ content: "Hello", attachments: [] })
    })

    expect(hookMocks.sendTurn).toHaveBeenCalledWith("thread-1", "Hello", [], "o3", undefined, [])
  })

  test("sendMessage is a no-op while chat is still preparing", async () => {
    hookMocks.snapshot = {
      ...baseSnapshot,
      threads: [{ ...baseSnapshot.threads[0], status: "completed", currentTurnId: null }],
      turns: [{ ...baseSnapshot.turns[0], status: "completed", completedAt: "2026-04-09T00:02:00.000Z" }],
      providerStatus: "idle",
      providerRuntime: {
        adapter: "stub",
        status: "idle",
        authState: "unknown",
        lastError: null,
        queuedTurnCount: 0,
        lastUpdatedAt: "2026-04-09T00:01:00.000Z",
      },
      chatSendReady: false,
    }

    const { result } = renderHook(() => useChat())

    expect(result.current.status).toBe("preparing")
    expect(result.current.inputDisabled).toBe(true)

    await act(async () => {
      await result.current.sendMessage({ content: "Hello", attachments: [] })
    })

    expect(hookMocks.sendTurn).not.toHaveBeenCalled()
    expect(hookMocks.createThread).not.toHaveBeenCalled()
  })

  test("sendMessage is a no-op while cold-start send readiness is still false", async () => {
    hookMocks.snapshot = {
      ...baseSnapshot,
      threads: [{ ...baseSnapshot.threads[0], status: "completed", currentTurnId: null }],
      turns: [{ ...baseSnapshot.turns[0], status: "completed", completedAt: "2026-04-09T00:02:00.000Z" }],
      providerStatus: "idle",
      providerRuntime: {
        ...baseSnapshot.providerRuntime,
        status: "idle",
      },
      chatSendReady: false,
    }

    const { result } = renderHook(() => useChat())

    expect(result.current.status).toBe("preparing")
    expect(result.current.inputDisabled).toBe(true)

    await act(async () => {
      await result.current.sendMessage({ content: "Hello", attachments: [] })
    })

    expect(hookMocks.sendTurn).not.toHaveBeenCalled()
    expect(hookMocks.createThread).not.toHaveBeenCalled()
  })

  test("interrupt calls the runtime interrupt action", async () => {
    hookMocks.interruptTurn.mockResolvedValueOnce(true)
    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.interrupt()
    })
    expect(hookMocks.interruptTurn).toHaveBeenCalledWith("thread-1")
  })

  test("interrupt is a no-op when no active thread is selected", async () => {
    hookMocks.snapshot = { ...baseSnapshot, threads: [], turns: [] }
    hookMocks.selectedThreadId = null

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.interrupt()
    })
    expect(hookMocks.interruptTurn).not.toHaveBeenCalled()
  })

  test("interrupt is a no-op when the thread status is not interruptible", async () => {
    hookMocks.snapshot = {
      ...baseSnapshot,
      threads: [{ ...baseSnapshot.threads[0], status: "completed" }],
      turns: [{ ...baseSnapshot.turns[0], status: "completed" }],
    }

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.interrupt()
    })
    expect(hookMocks.interruptTurn).not.toHaveBeenCalled()
  })

  test("interrupt sets interruptPending and status transitions to interrupting", async () => {
    let resolveInterrupt: ((value: boolean) => void) | null = null
    hookMocks.interruptTurn.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => { resolveInterrupt = resolve }),
    )

    const { result } = renderHook(() => useChat())

    act(() => {
      void result.current.interrupt()
    })

    expect(result.current.interruptPending).toBe(true)
    expect(result.current.status).toBe("interrupting")

    await act(async () => {
      resolveInterrupt?.(true)
    })

    expect(hookMocks.interruptTurn).toHaveBeenCalledWith("thread-1")
  })

  test("interrupt clears interruptPending when server returns false", async () => {
    hookMocks.interruptTurn.mockResolvedValueOnce(false)
    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.interrupt()
    })

    expect(result.current.interruptPending).toBe(false)
    expect(result.current.interruptError).toBeNull()
  })

  test("interrupt surfaces an error and clears pending on RPC failure", async () => {
    hookMocks.interruptTurn.mockRejectedValueOnce(new Error("ws offline"))
    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.interrupt()
    })

    expect(result.current.interruptPending).toBe(false)
    expect(result.current.interruptError).toBe("ws offline")
  })

  test("concurrent interrupt calls fire exactly one underlying RPC", async () => {
    let resolveInterrupt: ((value: boolean) => void) | null = null
    hookMocks.interruptTurn.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => { resolveInterrupt = resolve }),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      void result.current.interrupt()
      void result.current.interrupt()
      void result.current.interrupt()
    })

    expect(hookMocks.interruptTurn).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveInterrupt?.(true)
    })
  })

  test("returns offline state when disconnected", () => {
    hookMocks.connectionStatus = {
      ...hookMocks.connectionStatus,
      phase: "disconnected",
    }

    const { result } = renderHook(() => useChat())
    expect(result.current.status).toBe("offline")
  })

  test("returns queued state for a queued thread without treating it as streaming", () => {
    hookMocks.snapshot = {
      ...baseSnapshot,
      threads: [
        {
          ...baseSnapshot.threads[0],
          status: "queued",
        },
      ],
      turns: [
        {
          ...baseSnapshot.turns[0],
          status: "queued",
        },
      ],
      providerStatus: "idle",
      providerRuntime: {
        ...baseSnapshot.providerRuntime,
        status: "idle",
      },
    }

    const { result } = renderHook(() => useChat())

    expect(result.current.status).toBe("queued")
    expect(result.current.messages[1]?.isStreaming).toBe(false)
  })

  test("keeps the selected idle thread idle when another thread is streaming", () => {
    hookMocks.snapshot = {
      ...baseSnapshot,
      threads: [
        {
          id: "thread-1" as never,
          workspaceId: "workspace-1" as never,
          title: "Idle thread",
          accessMode: "default",
          status: "completed",
          createdAt: "2026-04-09T00:00:00.000Z",
          currentTurnId: null,
        },
        {
          id: "thread-2" as never,
          workspaceId: "workspace-1" as never,
          title: "Streaming thread",
          accessMode: "default",
          status: "streaming",
          createdAt: "2026-04-09T00:02:00.000Z",
          currentTurnId: "turn-2" as never,
        },
      ],
      turns: [
        {
          ...baseSnapshot.turns[0],
          id: "turn-2" as never,
          threadId: "thread-2" as never,
          status: "streaming",
        },
      ],
      providerStatus: "streaming",
      providerRuntime: {
        ...baseSnapshot.providerRuntime,
        status: "streaming",
      },
    }
    hookMocks.selectedThreadId = "thread-1"

    const { result } = renderHook(() => useChat())

    expect(result.current.status).toBe("idle")
    expect(result.current.messages).toHaveLength(0)
  })

  test("setThreadAccessMode delegates to the runtime for the active thread", async () => {
    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.setThreadAccessMode("full")
    })

    expect(hookMocks.setThreadAccessMode).toHaveBeenCalledWith("thread-1", "full")
  })

  test("respondToApproval delegates to the runtime for the current thread approval", async () => {
    hookMocks.snapshot = {
      ...baseSnapshot,
      pendingApprovals: [
        {
          id: "approval-1",
          threadId: "thread-1" as never,
          turnId: "turn-1" as never,
          kind: "command",
          itemId: "item-1",
          approvalId: "provider-approval-1",
          reason: "Needs approval",
          command: "rm -rf ./tmp",
          cwd: "/repo",
          availableDecisions: ["approve", "deny"],
          toolKey: "cmd:rm",
          toolLabel: "rm",
        },
      ],
    }

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.respondToApproval("approve")
    })

    expect(hookMocks.respondToApproval).toHaveBeenCalledWith("approval-1", "approve", undefined)
  })
})
