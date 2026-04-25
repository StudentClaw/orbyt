import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import type { OrchestrationSnapshot } from "@orbyt/contracts"

const pageMocks = vi.hoisted(() => ({
  pathname: "/chat",
  navigate: vi.fn(async ({ to, params }: { to: string; params?: Record<string, string> }) => {
    if (to === "/chat") {
      pageMocks.pathname = "/chat"
      return
    }

    if (to === "/chat/$workspaceId") {
      pageMocks.pathname = `/chat/${params?.workspaceId ?? ""}`
      return
    }

    if (to === "/chat/$workspaceId/$threadId") {
      pageMocks.pathname = `/chat/${params?.workspaceId ?? ""}/${params?.threadId ?? ""}`
    }
  }),
  snapshot: null as OrchestrationSnapshot | null,
  lastSelection: null as null | {
    workspaceId?: string | null
    threadId?: string | null
    onThreadCreated?: (workspaceId: string, threadId: string) => void | Promise<void>
  },
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => pageMocks.navigate,
  useRouterState: ({ select }: { select?: (state: { location: { pathname: string } }) => unknown } = {}) => {
    const state = { location: { pathname: pageMocks.pathname } }
    return select ? select(state) : state
  },
}))

vi.mock("@/hooks/useAppRuntime", () => ({
  useRuntimeOrchestrationSnapshot: () => pageMocks.snapshot,
}))

vi.mock("@/components/chat/ChatContainer", () => ({
  ChatContainer: ({ selection }: { selection?: typeof pageMocks.lastSelection }) => {
    pageMocks.lastSelection = selection ?? null
    return <div data-testid="chat-container" />
  },
}))

vi.mock("@/components/shell/ChatHistory", () => ({
  ChatHistory: () => <div data-testid="chat-history" />,
}))

import { ChatPage } from "../pages/ChatPage"

describe("ChatPage layout", () => {
  beforeEach(() => {
    pageMocks.pathname = "/chat"
    pageMocks.navigate.mockReset()
    pageMocks.navigate.mockImplementation(async ({ to, params }: { to: string; params?: Record<string, string> }) => {
      if (to === "/chat") {
        pageMocks.pathname = "/chat"
        return
      }

      if (to === "/chat/$workspaceId") {
        pageMocks.pathname = `/chat/${params?.workspaceId ?? ""}`
        return
      }

      if (to === "/chat/$workspaceId/$threadId") {
        pageMocks.pathname = `/chat/${params?.workspaceId ?? ""}/${params?.threadId ?? ""}`
      }
    })
    pageMocks.snapshot = null
    pageMocks.lastSelection = null
  })

  test("renders the in-page chat browser and main chat pane", () => {
    render(<ChatPage />)

    expect(screen.getByTestId("chat-container")).toBeDefined()
    expect(screen.queryByTestId("chat-history")).toBeNull()
  })

  test("does not navigate away from a freshly created thread before the snapshot catches up", async () => {
    pageMocks.pathname = "/chat/workspace-1"
    pageMocks.snapshot = {
      workspaces: [
        {
          id: "workspace-1",
          kind: "filesystem",
          name: "Repo",
          rootPath: "/repo",
          availability: "ready",
          createdAt: "2026-04-25T00:00:00.000Z",
          updatedAt: "2026-04-25T00:00:00.000Z",
        },
      ],
      threads: [],
      turns: [],
      pendingApprovals: [],
      providerStatus: "idle",
      providerRuntime: {
        adapter: "codex",
        status: "idle",
        authState: "authenticated",
        lastError: null,
        queuedTurnCount: 0,
        lastUpdatedAt: "2026-04-25T00:00:00.000Z",
      },
      chatSendReady: true,
      ready: true,
      lastSequence: 1,
    }

    render(<ChatPage />)

    await pageMocks.lastSelection?.onThreadCreated?.("workspace-1", "thread-new")

    expect(pageMocks.pathname).toBe("/chat/workspace-1/thread-new")
    expect(pageMocks.navigate).toHaveBeenCalledTimes(1)
    expect(pageMocks.navigate).toHaveBeenLastCalledWith({
      to: "/chat/$workspaceId/$threadId",
      params: {
        workspaceId: "workspace-1",
        threadId: "thread-new",
      },
    })
  })
})
