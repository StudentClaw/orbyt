import { beforeEach, describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { OrchestrationSnapshot } from "@student-claw/contracts"
import { SidebarProvider } from "../components/ui/sidebar"

const historyMocks = vi.hoisted(() => ({
  pathname: "/",
  snapshot: null as OrchestrationSnapshot | null,
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
  renameThread: vi.fn(),
  deleteThread: vi.fn(),
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
  useRuntimeConnectionStatus: () => historyMocks.connectionStatus,
  useOrchestrationActions: () => ({
    createWorkspace: historyMocks.createWorkspace,
    relinkWorkspace: historyMocks.relinkWorkspace,
    deleteWorkspace: historyMocks.deleteWorkspace,
    createThread: historyMocks.createThread,
    renameThread: historyMocks.renameThread,
    deleteThread: historyMocks.deleteThread,
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
    {
      id: "workspace-legacy" as never,
      kind: "legacy",
      name: "Imported legacy chats",
      rootPath: null,
      availability: null,
      createdAt: "2026-04-09T00:00:00.000Z",
      updatedAt: "2026-04-09T00:00:00.000Z",
    },
  ],
  threads: [
    {
      id: "thread-1" as never,
      workspaceId: "workspace-1" as never,
      title: "Older thread",
      accessMode: "default",
      status: "completed",
      createdAt: "2026-04-09T00:00:00.000Z",
      currentTurnId: null,
    },
    {
      id: "thread-2" as never,
      workspaceId: "workspace-1" as never,
      title: "Recent thread",
      accessMode: "default",
      status: "streaming",
      createdAt: "2026-04-09T00:02:00.000Z",
      currentTurnId: "turn-2" as never,
    },
    {
      id: "thread-legacy" as never,
      workspaceId: "workspace-legacy" as never,
      title: "Legacy thread",
      accessMode: "default",
      status: "completed",
      createdAt: "2026-04-09T00:03:00.000Z",
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
    lastUpdatedAt: "2026-04-09T00:02:00.000Z",
  },
  chatSendReady: true,
  ready: true,
  lastSequence: 2,
}

describe("ChatHistory", () => {
  beforeEach(() => {
    historyMocks.pathname = "/"
    historyMocks.snapshot = snapshot
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
    historyMocks.renameThread.mockReset()
    historyMocks.deleteThread.mockReset()
    historyMocks.navigate.mockReset()
    window.electronAPI = {
      getBootstrap: vi.fn().mockResolvedValue(null),
      codexAuthStart: vi.fn().mockResolvedValue({ status: "connected" as const }),
      invoke: vi.fn().mockResolvedValue("/repo"),
      send: vi.fn(),
      on: vi.fn().mockReturnValue(() => {}),
    }
  })

  test("renders filesystem folders and their chats in recency order", () => {
    render(<SidebarProvider><ChatHistory /></SidebarProvider>)
    expect(screen.getByText("Repo")).toBeTruthy()
    expect(screen.queryByText("Imported legacy chats")).toBeNull()
    const labels = screen.getAllByRole("button").map((node) => node.textContent)
    expect(labels.some((entry) => entry?.includes("Recent thread"))).toBe(true)
    expect(labels.some((entry) => entry?.includes("Older thread"))).toBe(true)
    expect(labels.some((entry) => entry?.includes("Legacy thread"))).toBe(false)
  })

  test("replaces the empty sidebar state after orchestration snapshot hydration", () => {
    historyMocks.snapshot = null

    const { rerender } = render(<SidebarProvider><ChatHistory /></SidebarProvider>)

    expect(screen.getByText("No folders yet")).toBeTruthy()

    historyMocks.snapshot = snapshot
    rerender(<SidebarProvider><ChatHistory /></SidebarProvider>)

    expect(screen.queryByText("No folders yet")).toBeNull()
    expect(screen.getByText("Repo")).toBeTruthy()
  })

  test("selecting a thread navigates to the chat page", async () => {
    const user = userEvent.setup()
    render(<SidebarProvider><ChatHistory /></SidebarProvider>)
    await user.click(screen.getByText("Older thread"))
    expect(historyMocks.navigate).toHaveBeenCalledWith({
      to: "/chat/$workspaceId/$threadId",
      params: { workspaceId: "workspace-1", threadId: "thread-1" },
    })
  })

  test("creating a thread from a workspace navigates to the new chat", async () => {
    historyMocks.createThread.mockResolvedValue("thread-new")
    const user = userEvent.setup()
    render(<SidebarProvider><ChatHistory /></SidebarProvider>)
    await user.click(screen.getByRole("button", { name: "Add chat to Repo" }))
    expect(historyMocks.createThread).toHaveBeenCalledWith("workspace-1", "New chat")
    expect(historyMocks.navigate).toHaveBeenCalledWith({
      to: "/chat/$workspaceId/$threadId",
      params: { workspaceId: "workspace-1", threadId: "thread-new" },
    })
  })

  test("adding a folder navigates to the folder chat page without creating a thread", async () => {
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

  test("renders a newly added folder after the orchestration snapshot updates", async () => {
    historyMocks.snapshot = {
      ...snapshot,
      workspaces: [snapshot.workspaces[1]!],
      threads: [snapshot.threads[2]!],
    }
    historyMocks.createWorkspace.mockResolvedValue("workspace-2")
    window.electronAPI = {
      ...(window.electronAPI as NonNullable<typeof window.electronAPI>),
      invoke: vi.fn().mockResolvedValue("/class-notes"),
    }

    const user = userEvent.setup()
    const { rerender } = render(<SidebarProvider><ChatHistory /></SidebarProvider>)

    expect(screen.getByText("No folders yet")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Add folder" }))

    historyMocks.snapshot = {
      ...historyMocks.snapshot,
      workspaces: [
        snapshot.workspaces[1]!,
        {
          id: "workspace-2" as never,
          kind: "filesystem",
          name: "class-notes",
          rootPath: "/class-notes",
          availability: "ready",
          createdAt: "2026-04-10T00:00:00.000Z",
          updatedAt: "2026-04-10T00:00:00.000Z",
        },
      ],
      threads: [snapshot.threads[2]!],
      lastSequence: 3,
    }
    rerender(<SidebarProvider><ChatHistory /></SidebarProvider>)

    expect(historyMocks.createWorkspace).toHaveBeenCalledWith("/class-notes")
    expect(screen.queryByText("No folders yet")).toBeNull()
    expect(screen.getByText("class-notes")).toBeTruthy()
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
          kind: "filesystem",
          rootPath: "/repo",
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

  test("renaming a thread starts from the dropdown menu", async () => {
    const user = userEvent.setup()
    render(<SidebarProvider><ChatHistory /></SidebarProvider>)

    await user.click(screen.getByRole("button", { name: "Open actions for Older thread" }))
    await user.click(screen.getByText("Rename"))
    await user.clear(screen.getByLabelText("Rename Older thread"))
    await user.type(screen.getByLabelText("Rename Older thread"), "Renamed thread")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(historyMocks.renameThread).toHaveBeenCalledWith("thread-1", "Renamed thread")
  })

  test("double-clicking a thread starts rename inline", async () => {
    const user = userEvent.setup()
    render(<SidebarProvider><ChatHistory /></SidebarProvider>)

    await user.dblClick(screen.getByText("Older thread"))

    expect(screen.getByLabelText("Rename Older thread")).toBeTruthy()
  })

  test("deleting the selected thread returns to the workspace route", async () => {
    historyMocks.pathname = "/chat/workspace-1/thread-1"
    historyMocks.deleteThread.mockResolvedValue(true)
    const confirmSpy = vi.fn(() => true)
    Object.defineProperty(window, "confirm", {
      value: confirmSpy,
      configurable: true,
    })

    const user = userEvent.setup()
    render(<SidebarProvider><ChatHistory /></SidebarProvider>)

    await user.click(screen.getByRole("button", { name: "Open actions for Older thread" }))
    await user.click(screen.getByText("Delete"))

    expect(confirmSpy).toHaveBeenCalledOnce()
    expect(historyMocks.deleteThread).toHaveBeenCalledWith("thread-1")
    expect(historyMocks.navigate).toHaveBeenCalledWith({
      to: "/chat/$workspaceId",
      params: { workspaceId: "workspace-1" },
    })
  })
})
