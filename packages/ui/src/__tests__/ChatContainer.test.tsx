import { describe, test, expect, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { ChatStatus } from "../hooks/chat-model"
import type { WsConnectionPhase } from "../rpc/wsConnectionState"

const chatMocks = vi.hoisted(() => ({
  closePanel: vi.fn(),
  state: {
    messages: [] as ReadonlyArray<{
      id: string
      role: "user" | "assistant"
      content: string
      timestamp: number
      isStreaming?: boolean
    }>,
    status: "idle" as ChatStatus,
    error: null as string | null,
    preparingLabel: null as string | null,
    preparingDetail: null as string | null,
    currentThread: null as {
      id: string
      title: string
      status: string
      workspaceId: string
      accessMode: "default" | "full"
    } | null,
    currentWorkspace: null as {
      id: string
      name: string
      kind?: string
      rootPath?: string | null
    } | null,
    sendMessage: vi.fn(),
    interrupt: vi.fn(),
    setThreadAccessMode: vi.fn(),
    respondToApproval: vi.fn(),
    currentPendingApproval: null,
    accessModeMutationPending: false,
    approvalDecisionPending: false,
    connectionState: "connected" as WsConnectionPhase,
    inputDisabled: false,
    inputDisabledReason: null as string | null,
  },
}))

vi.mock("../hooks/useChat", () => ({
  useChat: () => chatMocks.state,
}))

vi.mock("../hooks/useAppRuntime", () => ({
  useChatUiActions: () => ({
    closePanel: chatMocks.closePanel,
  }),
  useSkills: () => [],
}))

import { ChatContainer } from "../components/chat/ChatContainer"

describe("ChatContainer", () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    chatMocks.closePanel.mockReset()
    chatMocks.state = {
      messages: [],
      status: "idle",
      error: null,
      preparingLabel: null,
      preparingDetail: null,
      currentThread: null,
      currentWorkspace: null,
      sendMessage: vi.fn(),
      interrupt: vi.fn(),
      setThreadAccessMode: vi.fn(),
      respondToApproval: vi.fn(),
      currentPendingApproval: null,
      accessModeMutationPending: false,
      approvalDecisionPending: false,
      connectionState: "connected",
      inputDisabled: false,
      inputDisabledReason: null,
    }
  })

  test("renders empty state when no messages", () => {
    render(<ChatContainer />)
    expect(screen.getByText("Start a conversation")).toBeDefined()
  })

  test("renders default header when no thread is selected", () => {
    render(<ChatContainer />)
    expect(screen.getByText("Chat")).toBeDefined()
  })

  test("renders the static empty state without network fetches", () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)

    render(<ChatContainer />)

    expect(screen.getByText("Start a conversation")).toBeDefined()
    expect(screen.getByText("What's due this week?")).toBeDefined()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test("renders the active thread title when selected", () => {
    chatMocks.state.currentThread = {
      id: "thread-1",
      title: "Weekly planning",
      status: "streaming",
      workspaceId: "workspace-1",
      accessMode: "default",
    }
    chatMocks.state.currentWorkspace = { id: "workspace-1", name: "Repo" }
    render(<ChatContainer />)
    expect(screen.getByText("Weekly planning")).toBeDefined()
  })

  test("renders messages when present", () => {
    chatMocks.state.messages = [
      { id: "1", role: "user", content: "Hello", timestamp: Date.now() },
      { id: "2", role: "assistant", content: "Hi there!", timestamp: Date.now() },
    ]
    render(<ChatContainer />)
    expect(screen.getByText("Hello")).toBeDefined()
    expect(screen.getByText("Hi there!")).toBeDefined()
  })

  test("shows error banner for error status", () => {
    chatMocks.state.status = "error"
    chatMocks.state.error = "Connection failed"
    render(<ChatContainer />)
    expect(screen.getByText("Something went wrong")).toBeDefined()
    expect(screen.getByText("Connection failed")).toBeDefined()
  })

  test("shows a blocking loading state while chat is preparing", () => {
    chatMocks.state.status = "preparing"
    chatMocks.state.preparingLabel = "Preparing Codex"
    chatMocks.state.preparingDetail = "Warming the local Codex runtime for chat."
    chatMocks.state.inputDisabled = true
    chatMocks.state.inputDisabledReason = "Warming the local Codex runtime for chat."
    render(<ChatContainer />)
    expect(screen.getByTestId("composer-loading-overlay")).toBeDefined()
    expect(screen.getByText("Start a conversation")).toBeDefined()
    expect(screen.queryByText("Something went wrong")).toBeNull()
  })

  test("keeps transcript messages visible while chat is preparing", () => {
    chatMocks.state.status = "preparing"
    chatMocks.state.preparingLabel = "Preparing Codex"
    chatMocks.state.preparingDetail = "Warming the local Codex runtime for chat."
    chatMocks.state.inputDisabled = true
    chatMocks.state.inputDisabledReason = "Warming the local Codex runtime for chat."
    chatMocks.state.messages = [
      { id: "1", role: "user", content: "Hello", timestamp: Date.now() },
      { id: "2", role: "assistant", content: "Still loading", timestamp: Date.now() },
    ]

    render(<ChatContainer />)

    expect(screen.getByText("Hello")).toBeDefined()
    expect(screen.getByText("Still loading")).toBeDefined()
    expect(screen.getByTestId("composer-loading-overlay")).toBeDefined()
  })

  test("shows offline banner", () => {
    chatMocks.state.status = "offline"
    chatMocks.state.connectionState = "disconnected"
    render(<ChatContainer />)
    expect(screen.getByText("Orbyt is offline")).toBeDefined()
  })

  test("shows panel close button for panel variant", () => {
    render(<ChatContainer />)
    expect(screen.getByText("Close")).toBeDefined()
  })

  test("hides panel close button for page variant", () => {
    render(<ChatContainer variant="page" />)
    expect(screen.queryByText("Close")).toBeNull()
  })

  test("uses a slim header for page variant", () => {
    chatMocks.state.currentThread = {
      id: "thread-1",
      title: "Weekly planning",
      status: "streaming",
      workspaceId: "workspace-1",
      accessMode: "default",
    }
    render(<ChatContainer variant="page" />)

    expect(screen.queryByRole("heading", { name: "Weekly planning" })).toBeNull()
    expect(screen.queryByText("Close")).toBeNull()
  })

  test("shows ChatProviderDisconnected when auth is required", () => {
    chatMocks.state.status = "auth-expired"
    render(<ChatContainer />)
    expect(screen.getByTestId("chat-provider-disconnected")).toBeDefined()
    expect(screen.queryByText("Start a conversation")).toBeNull()
  })

  test("does not show error banner when auth is required", () => {
    chatMocks.state.status = "auth-expired"
    render(<ChatContainer />)
    expect(screen.queryByText("Session expired")).toBeNull()
  })
})
