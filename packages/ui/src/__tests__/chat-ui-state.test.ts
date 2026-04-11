import { beforeEach, describe, expect, test } from "vitest"
import {
  closeChatPanel,
  getChatUiState,
  openChatPanel,
  resetOrchestrationStateForTests,
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
})
