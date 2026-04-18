import { beforeEach, describe, expect, test } from "vitest"
import {
  applyOrchestrationDomainEvent,
  applyProviderRuntimeEvent,
  closeChatPanel,
  getOrchestrationSnapshot,
  getChatUiState,
  openChatPanel,
  resetOrchestrationStateForTests,
  setOrchestrationSnapshot,
  setChatPanelWidth,
  selectChatTarget,
  selectChatWorkspace,
} from "../rpc/orchestrationState"

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
      },
    }, 3)

    expect(getOrchestrationSnapshot()?.threads[0]?.status).toBe("streaming")
  })
})
