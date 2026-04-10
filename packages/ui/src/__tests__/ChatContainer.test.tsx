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
    currentThread: null as { title: string; status: string } | null,
    sendMessage: vi.fn(),
    interrupt: vi.fn(),
    connectionState: "connected" as WsConnectionPhase,
  },
}))

vi.mock("../hooks/useChat", () => ({
  useChat: () => chatMocks.state,
}))

vi.mock("../hooks/useAppRuntime", () => ({
  useChatUiActions: () => ({ closePanel: chatMocks.closePanel }),
}))

import { ChatContainer } from "../components/chat/ChatContainer"

describe("ChatContainer", () => {
  beforeEach(() => {
    chatMocks.closePanel.mockReset()
    chatMocks.state = {
      messages: [],
      status: "idle",
      error: null,
      currentThread: null,
      sendMessage: vi.fn(),
      interrupt: vi.fn(),
      connectionState: "connected",
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

  test("renders the active thread title when selected", () => {
    chatMocks.state.currentThread = { title: "Weekly planning", status: "streaming" }
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

  test("shows offline banner", () => {
    chatMocks.state.status = "offline"
    chatMocks.state.connectionState = "disconnected"
    render(<ChatContainer />)
    expect(screen.getByText("Student Claw is offline")).toBeDefined()
  })

  test("shows panel close button for panel variant", () => {
    render(<ChatContainer />)
    expect(screen.getByText("Close")).toBeDefined()
  })

  test("hides panel close button for page variant", () => {
    render(<ChatContainer variant="page" />)
    expect(screen.queryByText("Close")).toBeNull()
  })
})
