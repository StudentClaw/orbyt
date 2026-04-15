import { describe, test, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MarkdownContent } from "../components/chat/MarkdownContent"
import { StreamingResponse } from "../components/chat/StreamingResponse"
import { ReasoningBlock } from "../components/chat/ReasoningBlock"
import { ToolCallIndicator } from "../components/chat/ToolCallIndicator"
import { MessageBubble } from "../components/chat/MessageBubble"
import { ChatEmptyState } from "../components/chat/ChatEmptyState"
import { ErrorBanner } from "../components/chat/ErrorBanner"
import { ChatStatusBadge } from "../components/chat/ChatStatusBadge"
import type { ChatMessage, ToolCallInfo } from "../hooks/chat-model"

describe("MarkdownContent", () => {
  test("renders plain text", () => {
    render(<MarkdownContent content="Hello world" />)
    expect(screen.getByText("Hello world")).toBeDefined()
  })

  test("renders bold text", () => {
    render(<MarkdownContent content="This is **bold** text" />)
    expect(screen.getByText("bold")).toBeDefined()
  })

  test("renders code blocks", () => {
    render(<MarkdownContent content={"```js\nconsole.log('hi')\n```"} />)
    expect(screen.getByText("console.log('hi')")).toBeDefined()
  })

  test("renders inline code", () => {
    render(<MarkdownContent content="Use `bun run dev` to start" />)
    expect(screen.getByText("bun run dev")).toBeDefined()
  })

  test("renders links", () => {
    render(<MarkdownContent content="Visit [here](https://example.com)" />)
    const link = screen.getByText("here")
    expect(link.closest("a")).toBeDefined()
  })

  test("renders lists", () => {
    render(<MarkdownContent content={"- Item one\n- Item two\n- Item three"} />)
    expect(screen.getByText("Item one")).toBeDefined()
    expect(screen.getByText("Item two")).toBeDefined()
    expect(screen.getByText("Item three")).toBeDefined()
  })
})

describe("StreamingResponse", () => {
  test("shows thinking state when streaming with no content", () => {
    render(<StreamingResponse content="" isStreaming />)
    expect(screen.getByText("Thinking...")).toBeDefined()
  })

  test("renders content with cursor when streaming", () => {
    const { container } = render(<StreamingResponse content="Hello" isStreaming />)
    expect(screen.getByText("Hello")).toBeDefined()
    expect(container.querySelector(".animate-pulse")).not.toBeNull()
  })

  test("renders content without cursor when not streaming", () => {
    const { container } = render(<StreamingResponse content="Hello" isStreaming={false} />)
    expect(screen.getByText("Hello")).toBeDefined()
    expect(container.querySelector(".animate-pulse")).toBeNull()
  })
})

describe("ReasoningBlock", () => {
  test("renders trigger text", () => {
    render(<ReasoningBlock reasoning="I need to think about this" />)
    expect(screen.getByText("View reasoning")).toBeDefined()
    expect(screen.getByText("Thinking")).toBeDefined()
  })

  test("content is collapsed by default", () => {
    render(<ReasoningBlock reasoning="I need to think about this" />)
    const content = screen.queryByText("I need to think about this")
    expect(content).toBeNull()
  })

  test("expands on click", async () => {
    const user = userEvent.setup()
    render(<ReasoningBlock reasoning="I need to think about this" />)
    await user.click(screen.getByText("View reasoning"))
    expect(screen.getByText("I need to think about this")).toBeDefined()
  })
})

describe("ToolCallIndicator", () => {
  test("shows spinner for pending tool call", () => {
    const toolCall: ToolCallInfo = { toolName: "canvas.getCourses", args: "{}", status: "pending" }
    const { container } = render(<ToolCallIndicator toolCall={toolCall} />)
    expect(screen.getByText("Fetching courses...")).toBeDefined()
    expect(container.querySelector("[role='status']")).not.toBeNull()
  })

  test("shows check for complete tool call", () => {
    const toolCall: ToolCallInfo = { toolName: "canvas.getCourses", args: "{}", status: "complete" }
    render(<ToolCallIndicator toolCall={toolCall} />)
    expect(screen.getByText("Fetching courses...")).toBeDefined()
  })

  test("shows failed badge for error tool call", () => {
    const toolCall: ToolCallInfo = { toolName: "canvas.getCourses", args: "{}", status: "error" }
    render(<ToolCallIndicator toolCall={toolCall} />)
    expect(screen.getByText("Failed")).toBeDefined()
  })

  test("falls back to tool name for unknown tools", () => {
    const toolCall: ToolCallInfo = { toolName: "custom.tool", args: "{}", status: "pending" }
    render(<ToolCallIndicator toolCall={toolCall} />)
    expect(screen.getByText("Running custom.tool...")).toBeDefined()
  })
})

describe("MessageBubble", () => {
  const now = Date.now()

  test("renders user message", () => {
    const message: ChatMessage = { id: "1", role: "user", content: "Hello", timestamp: now }
    render(<MessageBubble message={message} />)
    expect(screen.getByText("Hello")).toBeDefined()
    expect(screen.getByText("You")).toBeDefined()
  })

  test("renders assistant message with markdown", () => {
    const message: ChatMessage = { id: "2", role: "assistant", content: "**Bold response**", timestamp: now }
    render(<MessageBubble message={message} />)
    expect(screen.getByText("Bold response")).toBeDefined()
    expect(screen.getByText("SC")).toBeDefined()
  })

  test("renders streaming assistant message", () => {
    const message: ChatMessage = { id: "3", role: "assistant", content: "Partial", timestamp: now, isStreaming: true }
    const { container } = render(<MessageBubble message={message} />)
    expect(screen.getByText("Partial")).toBeDefined()
    expect(container.querySelector(".animate-pulse")).not.toBeNull()
  })

  test("renders tool calls in assistant message", () => {
    const message: ChatMessage = {
      id: "4",
      role: "assistant",
      content: "Here are your courses:",
      timestamp: now,
      toolCalls: [{ toolName: "canvas.getCourses", args: "{}", status: "complete" }],
    }
    render(<MessageBubble message={message} />)
    expect(screen.getByText("Fetching courses...")).toBeDefined()
  })

  test("renders reasoning block in assistant message", async () => {
    const user = userEvent.setup()
    const message: ChatMessage = {
      id: "5",
      role: "assistant",
      content: "The answer is 42.",
      timestamp: now,
      reasoning: "Let me think step by step...",
    }
    render(<MessageBubble message={message} />)
    expect(screen.getByText("View reasoning")).toBeDefined()
    await user.click(screen.getByText("View reasoning"))
    expect(screen.getByText("Let me think step by step...")).toBeDefined()
  })
})

describe("ChatEmptyState", () => {
  test("renders title and description", () => {
    render(<ChatEmptyState onSuggestionClick={() => {}} />)
    expect(screen.getByText("Start a conversation")).toBeDefined()
    expect(screen.getByText(/Ask about your assignments/)).toBeDefined()
  })

  test("renders suggestion buttons", () => {
    render(<ChatEmptyState onSuggestionClick={() => {}} />)
    expect(screen.getByText("What's due this week?")).toBeDefined()
    expect(screen.getByText("Plan my study session")).toBeDefined()
  })

  test("calls onSuggestionClick when clicked", async () => {
    const user = userEvent.setup()
    let clicked = ""
    render(<ChatEmptyState onSuggestionClick={(c) => { clicked = c }} />)
    await user.click(screen.getByText("What's due this week?"))
    expect(clicked).toBe("What's due this week?")
  })
})

describe("ErrorBanner", () => {
  test("returns null for idle status", () => {
    const { container } = render(<ErrorBanner status="idle" error={null} />)
    expect(container.innerHTML).toBe("")
  })

  test("returns null for streaming status", () => {
    const { container } = render(<ErrorBanner status="streaming" error={null} />)
    expect(container.innerHTML).toBe("")
  })

  test("shows offline message", () => {
    render(<ErrorBanner status="offline" error={null} />)
    expect(screen.getByText("Student Claw is offline")).toBeDefined()
  })

  test("shows rate-limited message", () => {
    render(<ErrorBanner status="rate-limited" error={null} />)
    expect(screen.getByText("Rate limit reached")).toBeDefined()
  })

  test("shows auth-expired with re-auth button", () => {
    const onReauth = () => {}
    render(<ErrorBanner status="auth-expired" error={null} onReauth={onReauth} />)
    expect(screen.getByText("Session expired")).toBeDefined()
    expect(screen.getByText("Re-authenticate")).toBeDefined()
  })

  test("shows error with retry button", () => {
    const onRetry = () => {}
    render(<ErrorBanner status="error" error="Connection failed" onRetry={onRetry} />)
    expect(screen.getByText("Something went wrong")).toBeDefined()
    expect(screen.getByText("Connection failed")).toBeDefined()
    expect(screen.getByText("Retry")).toBeDefined()
  })

  test("shows default error when error is null", () => {
    render(<ErrorBanner status="error" error={null} />)
    expect(screen.getByText("An unexpected error occurred.")).toBeDefined()
  })
})

describe("ChatStatusBadge", () => {
  test("renders a ready state label", () => {
    render(<ChatStatusBadge status="idle" />)
    expect(screen.getByTestId("chat-status-badge").textContent).toContain("Ready")
  })

  test("renders a streaming state label", () => {
    const { container } = render(<ChatStatusBadge status="streaming" />)
    expect(screen.getByTestId("chat-status-badge").textContent).toContain("Streaming")
    expect(container.querySelector(".animate-pulse")).not.toBeNull()
  })
})
