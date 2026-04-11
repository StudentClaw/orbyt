import { beforeEach, describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { OrchestrationSnapshot } from "@student-claw/contracts"
import { SidebarProvider } from "../components/ui/sidebar"

const historyMocks = vi.hoisted(() => ({
  pathname: "/",
  snapshot: null as OrchestrationSnapshot | null,
  selectedWorkspaceId: null as string | null,
  selectedThreadId: null as string | null,
  connectionStatus: {
    phase: "connected" as const,
    wsUrl: "ws://127.0.0.1:8787",
    lastSequence: 0,
    lastError: null as string | null,
  },
  createWorkspace: vi.fn(),
  relinkWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
  createThread: vi.fn(),
  openPanel: vi.fn(),
  selectWorkspace: vi.fn(),
  selectChatTarget: vi.fn(),
  clearSelection: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select?: (state: { location: { pathname: string } }) => unknown } = {}) => {
    const state = { location: { pathname: historyMocks.pathname } }
    return select ? select(state) : state
  },
  useNavigate: () => historyMocks.navigate,
}))

vi.mock("../hooks/useAppRuntime", () => ({
  useRuntimeOrchestrationSnapshot: () => historyMocks.snapshot,
  useRuntimeSelectedWorkspaceId: () => historyMocks.selectedWorkspaceId,
  useRuntimeSelectedThreadId: () => historyMocks.selectedThreadId,
  useRuntimeConnectionStatus: () => historyMocks.connectionStatus,
  useOrchestrationActions: () => ({
    createWorkspace: historyMocks.createWorkspace,
    relinkWorkspace: historyMocks.relinkWorkspace,
    deleteWorkspace: historyMocks.deleteWorkspace,
    createThread: historyMocks.createThread,
  }),
  useChatUiActions: () => ({
    openPanel: historyMocks.openPanel,
    selectWorkspace: historyMocks.selectWorkspace,
    selectChatTarget: historyMocks.selectChatTarget,
    clearSelection: historyMocks.clearSelection,
  }),
}))

import { ChatHistory } from "../components/shell/ChatHistory"

const snapshot: OrchestrationSnapshot = {
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
      title: "Older thread",
      status: "completed",
      createdAt: "2026-04-09T00:00:00.000Z",
      currentTurnId: null,
    },
    {
      id: "thread-2" as never,
      workspaceId: "workspace-1" as never,
      title: "Recent thread",
      status: "streaming",
      createdAt: "2026-04-09T00:02:00.000Z",
      currentTurnId: "turn-2" as never,
    },
  ],
  turns: [],
  providerStatus: "idle",
  providerRuntime: {
    adapter: "codex",
    status: "idle",
    authState: "authenticated",
    lastError: null,
    queuedTurnCount: 0,
    lastUpdatedAt: "2026-04-09T00:02:00.000Z",
  },
  ready: true,
  lastSequence: 2,
}

describe("ChatHistory", () => {
  beforeEach(() => {
    historyMocks.pathname = "/"
    historyMocks.snapshot = snapshot
    historyMocks.selectedWorkspaceId = "workspace-1"
    historyMocks.selectedThreadId = "thread-2"
    historyMocks.connectionStatus = {
      phase: "connected",
      wsUrl: "ws://127.0.0.1:8787",
      lastSequence: 0,
      lastError: null,
    }
    historyMocks.createWorkspace.mockReset()
    historyMocks.relinkWorkspace.mockReset()
    historyMocks.deleteWorkspace.mockReset()
    historyMocks.createThread.mockReset()
    historyMocks.openPanel.mockReset()
    historyMocks.selectWorkspace.mockReset()
    historyMocks.selectChatTarget.mockReset()
    historyMocks.clearSelection.mockReset()
    historyMocks.navigate.mockReset()
    window.electronAPI = {
      getBootstrap: vi.fn().mockResolvedValue(null),
      codexAuthStart: vi.fn().mockResolvedValue({ status: "connected" as const }),
      invoke: vi.fn().mockResolvedValue("/repo"),
      send: vi.fn(),
      on: vi.fn().mockReturnValue(() => {}),
    }
  })

  test("renders workspaces and runtime threads in recency order", () => {
    render(<SidebarProvider><ChatHistory /></SidebarProvider>)
    expect(screen.getByText("Repo")).toBeTruthy()
    const labels = screen.getAllByRole("button").map((node) => node.textContent)
    expect(labels.some((entry) => entry?.includes("Recent thread"))).toBe(true)
    expect(labels.some((entry) => entry?.includes("Older thread"))).toBe(true)
  })

  test("selecting a thread opens the side panel off-route", async () => {
    const user = userEvent.setup()
    render(<SidebarProvider><ChatHistory /></SidebarProvider>)
    await user.click(screen.getByText("Older thread"))
    expect(historyMocks.selectChatTarget).toHaveBeenCalledWith("workspace-1", "thread-1")
    expect(historyMocks.openPanel).toHaveBeenCalled()
  })

  test("selecting a thread on /chat navigates instead of reopening the side panel", async () => {
    historyMocks.pathname = "/chat/workspace-1/thread-2"
    const user = userEvent.setup()
    render(<SidebarProvider><ChatHistory /></SidebarProvider>)
    await user.click(screen.getByText("Older thread"))
    expect(historyMocks.navigate).toHaveBeenCalledWith({
      to: "/chat/$workspaceId/$threadId",
      params: { workspaceId: "workspace-1", threadId: "thread-1" },
    })
    expect(historyMocks.openPanel).not.toHaveBeenCalled()
  })

  test("creating a thread from a workspace targets that workspace", async () => {
    historyMocks.createThread.mockResolvedValue("thread-new")
    const user = userEvent.setup()
    render(<SidebarProvider><ChatHistory /></SidebarProvider>)
    await user.click(screen.getByRole("button", { name: "Add chat to Repo" }))
    expect(historyMocks.createThread).toHaveBeenCalledWith("workspace-1", "New chat")
    expect(historyMocks.selectChatTarget).toHaveBeenCalledWith("workspace-1", "thread-new")
    expect(historyMocks.openPanel).toHaveBeenCalled()
  })

  test("adding a folder on /chat opens the folder empty state without creating a chat", async () => {
    historyMocks.pathname = "/chat"
    historyMocks.createWorkspace.mockResolvedValue("workspace-2")
    const user = userEvent.setup()
    render(<SidebarProvider><ChatHistory /></SidebarProvider>)
    await user.click(screen.getByRole("button", { name: "Add folder" }))
    expect(window.electronAPI?.invoke).toHaveBeenCalledWith("file:open-dialog", { directory: true })
    expect(historyMocks.createWorkspace).toHaveBeenCalledWith("/repo")
    expect(historyMocks.navigate).toHaveBeenCalledWith({
      to: "/chat/$workspaceId",
      params: { workspaceId: "workspace-2" },
    })
    expect(historyMocks.createThread).not.toHaveBeenCalled()
  })

  test("adding an existing folder off-route focuses it without creating a chat", async () => {
    historyMocks.createWorkspace.mockResolvedValue("workspace-1")
    const user = userEvent.setup()
    render(<SidebarProvider><ChatHistory /></SidebarProvider>)
    await user.click(screen.getByRole("button", { name: "Add folder" }))
    expect(historyMocks.selectWorkspace).toHaveBeenCalledWith("workspace-1")
    expect(historyMocks.openPanel).toHaveBeenCalled()
    expect(historyMocks.createThread).not.toHaveBeenCalled()
  })

  test("shows an actionable error when folder picking is unavailable", async () => {
    Reflect.deleteProperty(window, "electronAPI")
    const user = userEvent.setup()
    render(<SidebarProvider><ChatHistory /></SidebarProvider>)
    await user.click(screen.getByRole("button", { name: "Add folder" }))
    expect(screen.getByText("Adding folders is only available in the desktop app.")).toBeTruthy()
    expect(historyMocks.createWorkspace).not.toHaveBeenCalled()
  })

  test("workspace removal requires confirmation", async () => {
    historyMocks.snapshot = {
      ...snapshot,
      workspaces: [
        {
          ...snapshot.workspaces[0],
          availability: "missing",
        },
      ],
    }
    const confirmSpy = vi.fn(() => false)
    Object.defineProperty(window, "confirm", {
      value: confirmSpy,
      configurable: true,
    })
    const user = userEvent.setup()
    render(<SidebarProvider><ChatHistory /></SidebarProvider>)
    await user.click(screen.getByRole("button", { name: "Remove" }))
    expect(confirmSpy).toHaveBeenCalledOnce()
    expect(historyMocks.deleteWorkspace).not.toHaveBeenCalled()
  })
})
