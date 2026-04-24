import { beforeEach, describe, expect, test, vi } from "vitest"
import {
  applyOrchestrationDomainEvent,
  applyProviderRuntimeEvent,
  closeChatPanel,
  getOrchestrationSnapshot,
  getChatUiState,
  isOrchestrationStartupReady,
  openChatPanel,
  resetOrchestrationStateForTests,
  setOrchestrationSnapshot,
  setChatPanelWidth,
  selectChatTarget,
  selectChatWorkspace,
  startOrchestrationStateSync,
} from "../rpc/orchestrationState"
import type { WsRpcClient } from "../rpc/wsRpcClient"

function buildSnapshot(overrides: Partial<NonNullable<ReturnType<typeof getOrchestrationSnapshot>>> = {}) {
  return {
    workspaces: [],
    threads: [],
    turns: [],
    pendingApprovals: [],
    providerStatus: "idle" as const,
    providerRuntime: {
      adapter: "codex" as const,
      status: "idle" as const,
      authState: "authenticated" as const,
      lastError: null,
      queuedTurnCount: 0,
      lastUpdatedAt: "2026-04-11T00:02:01.000Z",
    },
    chatSendReady: true,
    ready: true,
    lastSequence: 1,
    ...overrides,
  }
}

function createDeferredSnapshot() {
  type Snapshot = ReturnType<typeof buildSnapshot>
  let resolve: ((snapshot: Snapshot) => void) | null = null
  const promise = new Promise<Snapshot>((nextResolve) => {
    resolve = nextResolve
  })

  return {
    promise,
    resolve(snapshot: Snapshot) {
      if (!resolve) {
        throw new Error("snapshot resolver missing")
      }
      resolve(snapshot)
    },
  }
}

describe("chat UI state", () => {
  beforeEach(() => {
    resetOrchestrationStateForTests()
  })

  test("tracks selected workspace and thread ids", () => {
    selectChatWorkspace("workspace-123")
    selectChatTarget("workspace-123", "thread-123")
    expect(getChatUiState().selectedWorkspaceId).toBe("workspace-123")
    expect(getChatUiState().selectedThreadId).toBe("thread-123")
  })

  test("opens and closes the chat panel", () => {
    openChatPanel()
    expect(getChatUiState().chatPanelOpen).toBe(true)
    closeChatPanel()
    expect(getChatUiState().chatPanelOpen).toBe(false)
  })

  test("stores the chat panel width", () => {
    setChatPanelWidth(42)
    expect(getChatUiState().chatPanelWidth).toBe(42)
  })

  test("applies thread rename and delete events to the snapshot", () => {
    setOrchestrationSnapshot({
      workspaces: [
        {
          id: "workspace-123" as never,
          kind: "filesystem",
          name: "Repo",
          rootPath: "/repo",
          availability: "ready",
          createdAt: "2026-04-11T00:00:00.000Z",
          updatedAt: "2026-04-11T00:00:00.000Z",
        },
      ],
      threads: [
        {
          id: "thread-123" as never,
          workspaceId: "workspace-123" as never,
          title: "Old title",
          accessMode: "default",
          status: "completed",
          createdAt: "2026-04-11T00:01:00.000Z",
          currentTurnId: null,
        },
      ],
      turns: [
        {
          id: "turn-123" as never,
          threadId: "thread-123" as never,
          input: "Hello",
          output: "World",
          reasoning: "",
          status: "completed",
          startedAt: "2026-04-11T00:02:00.000Z",
          completedAt: "2026-04-11T00:02:01.000Z",
          skill: null,
          attachments: [],
          references: [],
        },
      ],
      pendingApprovals: [],
      providerStatus: "idle",
      providerRuntime: {
        adapter: "codex",
        status: "idle",
        authState: "authenticated",
        lastError: null,
        queuedTurnCount: 0,
        lastUpdatedAt: "2026-04-11T00:02:01.000Z",
      },
      chatSendReady: true,
      ready: true,
      lastSequence: 1,
    })

    applyOrchestrationDomainEvent({
      type: "thread.updated",
      thread: {
        id: "thread-123" as never,
        workspaceId: "workspace-123" as never,
        title: "New title",
        accessMode: "full",
        status: "completed",
        createdAt: "2026-04-11T00:01:00.000Z",
        currentTurnId: null,
      },
    }, 2)

    expect(getOrchestrationSnapshot()?.threads[0]?.title).toBe("New title")
    expect(getOrchestrationSnapshot()?.threads[0]?.accessMode).toBe("full")

    applyOrchestrationDomainEvent({
      type: "thread.deleted",
      threadId: "thread-123" as never,
      workspaceId: "workspace-123" as never,
    }, 3)

    expect(getOrchestrationSnapshot()?.threads).toHaveLength(0)
    expect(getOrchestrationSnapshot()?.turns).toHaveLength(0)
  })

  test("tracks pending approvals from provider runtime events", () => {
    setOrchestrationSnapshot({
      workspaces: [],
      threads: [
        {
          id: "thread-123" as never,
          workspaceId: "workspace-123" as never,
          title: "Chat",
          accessMode: "default",
          status: "streaming",
          createdAt: "2026-04-11T00:01:00.000Z",
          currentTurnId: "turn-123" as never,
        },
      ],
      turns: [],
      pendingApprovals: [],
      providerStatus: "streaming",
      providerRuntime: {
        adapter: "codex",
        status: "streaming",
        authState: "authenticated",
        lastError: null,
        queuedTurnCount: 0,
        lastUpdatedAt: "2026-04-11T00:02:01.000Z",
      },
      chatSendReady: true,
      ready: true,
      lastSequence: 1,
    })

    applyProviderRuntimeEvent({
      type: "provider.approvalRequested",
      approval: {
        id: "approval-123",
        threadId: "thread-123" as never,
        turnId: "turn-123" as never,
        kind: "command",
        itemId: "item-123",
        approvalId: "provider-approval-123",
        reason: "Needs approval",
        command: "rm -rf tmp",
        cwd: "/repo",
        availableDecisions: ["approve", "deny"],
      },
    })

    expect(getOrchestrationSnapshot()?.pendingApprovals).toHaveLength(1)

    applyProviderRuntimeEvent({
      type: "provider.approvalResolved",
      approvalRequestId: "approval-123",
      threadId: "thread-123" as never,
      turnId: "turn-123" as never,
      decision: "approve",
    })

    expect(getOrchestrationSnapshot()?.pendingApprovals).toHaveLength(0)
  })

  test("treats queued and started turn events as different thread states", () => {
    setOrchestrationSnapshot({
      workspaces: [
        {
          id: "workspace-1" as never,
          kind: "filesystem",
          name: "Repo",
          rootPath: "/repo",
          availability: "ready",
          createdAt: "2026-04-11T00:00:00.000Z",
          updatedAt: "2026-04-11T00:00:00.000Z",
        },
      ],
      threads: [
        {
          id: "thread-1" as never,
          workspaceId: "workspace-1" as never,
          title: "Chat",
          accessMode: "default",
          status: "idle",
          createdAt: "2026-04-11T00:01:00.000Z",
          currentTurnId: null,
        },
      ],
      turns: [],
      pendingApprovals: [],
      providerStatus: "idle",
      providerRuntime: {
        adapter: "codex",
        status: "idle",
        authState: "authenticated",
        lastError: null,
        queuedTurnCount: 0,
        lastUpdatedAt: "2026-04-11T00:02:01.000Z",
      },
      chatSendReady: true,
      ready: true,
      lastSequence: 1,
    })

    applyOrchestrationDomainEvent({
      type: "turn.queued",
      turn: {
        id: "turn-1" as never,
        threadId: "thread-1" as never,
        input: "Hello",
        output: "",
        reasoning: "",
        status: "queued",
        startedAt: "2026-04-11T00:02:00.000Z",
        completedAt: null,
        skill: null,
        attachments: [],
        references: [],
      },
    }, 2)

    expect(getOrchestrationSnapshot()?.threads[0]?.status).toBe("queued")
    expect(getOrchestrationSnapshot()?.threads[0]?.currentTurnId).toBe("turn-1")

    applyOrchestrationDomainEvent({
      type: "turn.started",
      turn: {
        id: "turn-1" as never,
        threadId: "thread-1" as never,
        input: "Hello",
        output: "",
        reasoning: "",
        status: "streaming",
        startedAt: "2026-04-11T00:02:00.000Z",
        completedAt: null,
        skill: null,
        attachments: [],
        references: [],
      },
    }, 3)

    expect(getOrchestrationSnapshot()?.threads[0]?.status).toBe("streaming")
  })

  test("tracks readiness changes from provider runtime events without a snapshot refetch", () => {
    setOrchestrationSnapshot(buildSnapshot({
      chatSendReady: true,
      lastSequence: 1,
    }))

    applyProviderRuntimeEvent({
      type: "provider.readinessChanged",
      chatSendReady: false,
    }, 5)

    expect(getOrchestrationSnapshot()?.chatSendReady).toBe(false)
    expect(getOrchestrationSnapshot()?.lastSequence).toBe(5)
    expect(isOrchestrationStartupReady(getOrchestrationSnapshot())).toBe(false)

    applyProviderRuntimeEvent({
      type: "provider.readinessChanged",
      chatSendReady: true,
    }, 6)

    expect(getOrchestrationSnapshot()?.chatSendReady).toBe(true)
    expect(getOrchestrationSnapshot()?.lastSequence).toBe(6)
    expect(isOrchestrationStartupReady(getOrchestrationSnapshot())).toBe(true)
  })

  test("ignores stale snapshot responses after a newer resubscribe refresh wins", async () => {
    let domainResubscribe: (() => void) | undefined
    let runtimeResubscribe: (() => void) | undefined
    const firstSnapshot = createDeferredSnapshot()
    const secondSnapshot = createDeferredSnapshot()

    const getSnapshot = vi.fn()
      .mockReturnValueOnce(firstSnapshot.promise)
      .mockReturnValueOnce(secondSnapshot.promise)

    const sync = startOrchestrationStateSync({
      orchestration: {
        getSnapshot,
        onDomainEvent: (
          _listener: Parameters<WsRpcClient["orchestration"]["onDomainEvent"]>[0],
          options?: Parameters<WsRpcClient["orchestration"]["onDomainEvent"]>[1],
        ) => {
          domainResubscribe = options?.onResubscribe
          return () => undefined
        },
      },
      provider: {
        onRuntimeEvent: (
          _listener: Parameters<WsRpcClient["provider"]["onRuntimeEvent"]>[0],
          options?: Parameters<WsRpcClient["provider"]["onRuntimeEvent"]>[1],
        ) => {
          runtimeResubscribe = options?.onResubscribe
          return () => undefined
        },
      },
    } as never)

    expect(getSnapshot).toHaveBeenCalledTimes(1)

    runtimeResubscribe?.()

    expect(getSnapshot).toHaveBeenCalledTimes(2)

    secondSnapshot.resolve(buildSnapshot({
      chatSendReady: false,
      lastSequence: 5,
    }))
    await sync.initialSnapshotReady

    expect(getOrchestrationSnapshot()?.lastSequence).toBe(5)
    expect(getOrchestrationSnapshot()?.chatSendReady).toBe(false)

    firstSnapshot.resolve(buildSnapshot({
      chatSendReady: true,
      lastSequence: 1,
    }))
    await Promise.resolve()
    await Promise.resolve()

    expect(getOrchestrationSnapshot()?.lastSequence).toBe(5)
    expect(getOrchestrationSnapshot()?.chatSendReady).toBe(false)

    sync.stop()
    expect(domainResubscribe).toBeDefined()
  })
})
