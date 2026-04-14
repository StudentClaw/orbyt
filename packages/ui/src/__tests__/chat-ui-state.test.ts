import { beforeEach, describe, expect, test } from "vitest"
import {
  applyOrchestrationDomainEvent,
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
          status: "completed",
          startedAt: "2026-04-11T00:02:00.000Z",
          completedAt: "2026-04-11T00:02:01.000Z",
          skill: null,
        },
      ],
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
        status: "completed",
        createdAt: "2026-04-11T00:01:00.000Z",
        currentTurnId: null,
      },
    }, 2)

    expect(getOrchestrationSnapshot()?.threads[0]?.title).toBe("New title")

    applyOrchestrationDomainEvent({
      type: "thread.deleted",
      threadId: "thread-123" as never,
      workspaceId: "workspace-123" as never,
    }, 3)

    expect(getOrchestrationSnapshot()?.threads).toHaveLength(0)
    expect(getOrchestrationSnapshot()?.turns).toHaveLength(0)
  })
})
