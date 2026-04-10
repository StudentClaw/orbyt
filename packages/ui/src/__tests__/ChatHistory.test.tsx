import { beforeEach, describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { OrchestrationSnapshot } from "@student-claw/contracts"
import { SidebarProvider } from "../components/ui/sidebar"

const historyMocks = vi.hoisted(() => ({
  pathname: "/",
  snapshot: null as OrchestrationSnapshot | null,
  selectedThreadId: null as string | null,
  connectionStatus: {
    phase: "connected" as const,
    wsUrl: "ws://127.0.0.1:8787",
    lastSequence: 0,
    lastError: null as string | null,
  },
  createThread: vi.fn(),
  openPanel: vi.fn(),
  selectThread: vi.fn(),
}))

vi.mock("@tanstack/react-router", () => ({
  useRouterState: () => ({ location: { pathname: historyMocks.pathname } }),
}))

vi.mock("../hooks/useAppRuntime", () => ({
  useRuntimeOrchestrationSnapshot: () => historyMocks.snapshot,
  useRuntimeSelectedThreadId: () => historyMocks.selectedThreadId,
  useRuntimeConnectionStatus: () => historyMocks.connectionStatus,
  useOrchestrationActions: () => ({ createThread: historyMocks.createThread }),
  useChatUiActions: () => ({
    openPanel: historyMocks.openPanel,
    selectThread: historyMocks.selectThread,
  }),
}))

import { ChatHistory } from "../components/shell/ChatHistory"

const snapshot: OrchestrationSnapshot = {
  threads: [
    {
      id: "thread-1" as never,
      title: "Older thread",
      status: "completed",
      createdAt: "2026-04-09T00:00:00.000Z",
      currentTurnId: null,
    },
    {
      id: "thread-2" as never,
      title: "Recent thread",
      status: "streaming",
      createdAt: "2026-04-09T00:02:00.000Z",
      currentTurnId: "turn-2" as never,
    },
  ],
  turns: [],
  providerStatus: "idle",
  ready: true,
  lastSequence: 2,
}

describe("ChatHistory", () => {
  beforeEach(() => {
    historyMocks.pathname = "/"
    historyMocks.snapshot = snapshot
    historyMocks.selectedThreadId = "thread-2"
    historyMocks.connectionStatus = {
      phase: "connected",
      wsUrl: "ws://127.0.0.1:8787",
      lastSequence: 0,
      lastError: null,
    }
    historyMocks.createThread.mockReset()
    historyMocks.openPanel.mockReset()
    historyMocks.selectThread.mockReset()
  })

  test("renders runtime threads in recency order", () => {
    render(<SidebarProvider><ChatHistory /></SidebarProvider>)
    const labels = screen.getAllByRole("button").map((node) => node.textContent)
    expect(labels.some((entry) => entry?.includes("Recent thread"))).toBe(true)
    expect(labels.some((entry) => entry?.includes("Older thread"))).toBe(true)
  })

  test("selecting a thread opens the side panel off-route", async () => {
    const user = userEvent.setup()
    render(<SidebarProvider><ChatHistory /></SidebarProvider>)
    await user.click(screen.getByText("Older thread"))
    expect(historyMocks.selectThread).toHaveBeenCalledWith("thread-1")
    expect(historyMocks.openPanel).toHaveBeenCalled()
  })

  test("selecting a thread on /chat does not reopen the side panel", async () => {
    historyMocks.pathname = "/chat"
    const user = userEvent.setup()
    render(<SidebarProvider><ChatHistory /></SidebarProvider>)
    await user.click(screen.getByText("Older thread"))
    expect(historyMocks.selectThread).toHaveBeenCalledWith("thread-1")
    expect(historyMocks.openPanel).not.toHaveBeenCalled()
  })

  test("creating a thread selects it and opens the panel off-route", async () => {
    historyMocks.createThread.mockResolvedValue("thread-new")
    const user = userEvent.setup()
    render(<SidebarProvider><ChatHistory /></SidebarProvider>)
    await user.click(screen.getByRole("button", { name: "New chat" }))
    expect(historyMocks.createThread).toHaveBeenCalledWith("New chat")
    expect(historyMocks.selectThread).toHaveBeenCalledWith("thread-new")
    expect(historyMocks.openPanel).toHaveBeenCalled()
  })
})
