import { beforeEach, describe, expect, test, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import type { OrchestrationSnapshot } from "@student-claw/contracts"
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
    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.sendMessage({ content: "Hello", attachments: [] })
    })
    expect(hookMocks.sendTurn).toHaveBeenCalledWith("thread-1", "Hello", [], undefined)
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
    expect(hookMocks.sendTurn).toHaveBeenCalledWith("thread-new", "New thread title", [], undefined)
  })

  test("sendMessage passes the selected model through to the runtime", async () => {
    const { result } = renderHook(() => useChat({ model: "o3" }))

    await act(async () => {
      await result.current.sendMessage({ content: "Hello", attachments: [] })
    })

    expect(hookMocks.sendTurn).toHaveBeenCalledWith("thread-1", "Hello", [], "o3")
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
        },
      ],
    }

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.respondToApproval("approve")
    })

    expect(hookMocks.respondToApproval).toHaveBeenCalledWith("approval-1", "approve")
  })
})
