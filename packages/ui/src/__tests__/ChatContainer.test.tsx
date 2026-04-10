import { describe, test, expect, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { useChatStore } from "../stores/chatStore"

// Mock useChat hook to avoid WebSocket dependency in tests
vi.mock("../hooks/useChat", () => ({
  useChat: () => ({
    sendMessage: vi.fn(),
    interrupt: vi.fn(),
    connectionState: "connected" as const,
  }),
}))

// Must import after mock
import { ChatContainer } from "../components/chat/ChatContainer"

describe("ChatContainer", () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      status: "idle",
      activeSessionId: null,
      error: null,
      chatPanelOpen: false,
    })
  })

  test("renders empty state when no messages", () => {
    render(<ChatContainer />)
    expect(screen.getByText("Start a conversation")).toBeDefined()
  })

  test("renders header", () => {
    render(<ChatContainer />)
    expect(screen.getByText("Chat")).toBeDefined()
  })

  test("renders input area", () => {
    render(<ChatContainer />)
    expect(screen.getByLabelText("Chat message input")).toBeDefined()
  })

  test("renders messages when present", () => {
    useChatStore.setState({
      messages: [
        { id: "1", role: "user", content: "Hello", timestamp: Date.now() },
        { id: "2", role: "assistant", content: "Hi there!", timestamp: Date.now() },
      ],
    })
    render(<ChatContainer />)
    expect(screen.getByText("Hello")).toBeDefined()
    expect(screen.getByText("Hi there!")).toBeDefined()
  })

  test("hides empty state when messages exist", () => {
    useChatStore.setState({
      messages: [{ id: "1", role: "user", content: "Hello", timestamp: Date.now() }],
    })
    render(<ChatContainer />)
    expect(screen.queryByText("Start a conversation")).toBeNull()
  })

  test("shows error banner for error status", () => {
    useChatStore.setState({ status: "error", error: "Connection failed" })
    render(<ChatContainer />)
    expect(screen.getByText("Something went wrong")).toBeDefined()
    expect(screen.getByText("Connection failed")).toBeDefined()
  })

  test("shows offline banner", () => {
    useChatStore.setState({ status: "offline" })
    render(<ChatContainer />)
    expect(screen.getByText("You're offline")).toBeDefined()
  })

  test("does not show banner for idle status", () => {
    render(<ChatContainer />)
    expect(screen.queryByText("You're offline")).toBeNull()
    expect(screen.queryByText("Something went wrong")).toBeNull()
  })

  test("renders suggestion buttons in empty state", () => {
    render(<ChatContainer />)
    expect(screen.getByText("What's due this week?")).toBeDefined()
    expect(screen.getByText("Plan my study session")).toBeDefined()
  })
})
