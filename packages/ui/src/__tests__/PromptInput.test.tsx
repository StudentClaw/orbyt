import { describe, test, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PromptInput } from "../components/chat/PromptInput"

describe("PromptInput", () => {
  const defaultProps = {
    onSend: vi.fn(),
    onInterrupt: vi.fn(),
    status: "idle" as const,
    connectionState: "connected" as const,
  }

  test("renders textarea with placeholder", () => {
    render(<PromptInput {...defaultProps} />)
    expect(screen.getByPlaceholderText("Ask anything...")).toBeDefined()
  })

  test("shows reconnecting placeholder when disconnected", () => {
    render(<PromptInput {...defaultProps} connectionState="disconnected" />)
    expect(screen.getByPlaceholderText("Reconnecting...")).toBeDefined()
  })

  test("shows wait placeholder when streaming", () => {
    render(<PromptInput {...defaultProps} status="streaming" />)
    expect(screen.getByPlaceholderText("Wait for response...")).toBeDefined()
  })

  test("disables textarea when disconnected", () => {
    render(<PromptInput {...defaultProps} connectionState="disconnected" />)
    const textarea = screen.getByLabelText("Chat message input")
    expect(textarea.hasAttribute("disabled")).toBe(true)
  })

  test("send button is disabled when empty", () => {
    render(<PromptInput {...defaultProps} />)
    const sendBtn = screen.getByLabelText("Send message")
    expect(sendBtn.hasAttribute("disabled")).toBe(true)
  })

  test("send button enables when text is entered", async () => {
    const user = userEvent.setup()
    render(<PromptInput {...defaultProps} />)
    await user.type(screen.getByLabelText("Chat message input"), "Hello")
    const sendBtn = screen.getByLabelText("Send message")
    expect(sendBtn.hasAttribute("disabled")).toBe(false)
  })

  test("calls onSend with trimmed content on click", async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    render(<PromptInput {...defaultProps} onSend={onSend} />)
    await user.type(screen.getByLabelText("Chat message input"), "  Hello  ")
    await user.click(screen.getByLabelText("Send message"))
    expect(onSend).toHaveBeenCalledWith("Hello")
  })

  test("calls onSend on Enter key", async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    render(<PromptInput {...defaultProps} onSend={onSend} />)
    await user.type(screen.getByLabelText("Chat message input"), "Hello{Enter}")
    expect(onSend).toHaveBeenCalledWith("Hello")
  })

  test("Shift+Enter inserts newline instead of sending", async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    render(<PromptInput {...defaultProps} onSend={onSend} />)
    await user.type(screen.getByLabelText("Chat message input"), "Line 1{Shift>}{Enter}{/Shift}Line 2")
    expect(onSend).not.toHaveBeenCalled()
  })

  test("clears input after sending", async () => {
    const user = userEvent.setup()
    render(<PromptInput {...defaultProps} onSend={vi.fn()} />)
    const textarea = screen.getByLabelText("Chat message input") as HTMLTextAreaElement
    await user.type(textarea, "Hello{Enter}")
    expect(textarea.value).toBe("")
  })

  test("shows Stop button during streaming", () => {
    render(<PromptInput {...defaultProps} status="streaming" />)
    expect(screen.getByLabelText("Stop generating")).toBeDefined()
  })

  test("calls onInterrupt when Stop is clicked", async () => {
    const onInterrupt = vi.fn()
    const user = userEvent.setup()
    render(<PromptInput {...defaultProps} status="streaming" onInterrupt={onInterrupt} />)
    await user.click(screen.getByLabelText("Stop generating"))
    expect(onInterrupt).toHaveBeenCalledOnce()
  })

  test("does not send when disconnected", () => {
    const onSend = vi.fn()
    render(<PromptInput {...defaultProps} onSend={onSend} connectionState="disconnected" />)
    expect(screen.getByLabelText("Chat message input").hasAttribute("disabled")).toBe(true)
    expect(onSend).not.toHaveBeenCalled()
  })
})
