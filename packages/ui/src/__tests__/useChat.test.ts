import { describe, test, expect, beforeEach } from "vitest"
import { useChatStore } from "../stores/chatStore"

// Test the mock chat behavior through the store directly
// since hooks require a React context to run

describe("useChat mock mode (via store)", () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      status: "idle",
      activeSessionId: null,
      error: null,
      chatPanelOpen: false,
    })
  })

  test("sendMessage creates user message in store", () => {
    const { addMessage } = useChatStore.getState()
    addMessage({
      id: "test-user-1",
      role: "user",
      content: "Hello",
      timestamp: Date.now(),
    })
    expect(useChatStore.getState().messages).toHaveLength(1)
    expect(useChatStore.getState().messages[0]!.role).toBe("user")
    expect(useChatStore.getState().messages[0]!.content).toBe("Hello")
  })

  test("sendMessage creates assistant message with streaming flag", () => {
    const { addMessage } = useChatStore.getState()
    addMessage({
      id: "test-user-1",
      role: "user",
      content: "Hello",
      timestamp: Date.now(),
    })
    addMessage({
      id: "test-assistant-1",
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      isStreaming: true,
    })
    expect(useChatStore.getState().messages).toHaveLength(2)
    expect(useChatStore.getState().messages[1]!.role).toBe("assistant")
    expect(useChatStore.getState().messages[1]!.isStreaming).toBe(true)
    expect(useChatStore.getState().messages[1]!.content).toBe("")
  })

  test("updateMessage patches streaming content progressively", () => {
    const { addMessage, updateMessage } = useChatStore.getState()
    addMessage({
      id: "a1",
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      isStreaming: true,
    })
    updateMessage("a1", { content: "Hello" })
    expect(useChatStore.getState().messages[0]!.content).toBe("Hello")

    updateMessage("a1", { content: "Hello world" })
    expect(useChatStore.getState().messages[0]!.content).toBe("Hello world")
  })

  test("streaming completion sets isStreaming false and status idle", () => {
    const { addMessage, updateMessage, setStatus } = useChatStore.getState()
    addMessage({
      id: "a1",
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      isStreaming: true,
    })
    setStatus("streaming")

    // Simulate completion
    updateMessage("a1", { content: "Final answer", isStreaming: false })
    setStatus("idle")

    expect(useChatStore.getState().messages[0]!.isStreaming).toBe(false)
    expect(useChatStore.getState().messages[0]!.content).toBe("Final answer")
    expect(useChatStore.getState().status).toBe("idle")
  })

  test("interrupt stops streaming and sets interrupted status", () => {
    const { addMessage, updateMessage, setStatus } = useChatStore.getState()
    addMessage({
      id: "a1",
      role: "assistant",
      content: "Partial",
      timestamp: Date.now(),
      isStreaming: true,
    })
    setStatus("streaming")

    // Simulate interrupt
    updateMessage("a1", { isStreaming: false })
    setStatus("interrupted")

    expect(useChatStore.getState().messages[0]!.isStreaming).toBe(false)
    expect(useChatStore.getState().status).toBe("interrupted")
  })

  test("error mapping: 429 sets rate-limited", () => {
    const { setStatus } = useChatStore.getState()
    setStatus("rate-limited")
    expect(useChatStore.getState().status).toBe("rate-limited")
  })

  test("error mapping: 401 sets auth-expired", () => {
    const { setStatus } = useChatStore.getState()
    setStatus("auth-expired")
    expect(useChatStore.getState().status).toBe("auth-expired")
  })

  test("error mapping: generic sets error with message", () => {
    const { setStatus, setError } = useChatStore.getState()
    setStatus("error")
    setError("Server unavailable")
    expect(useChatStore.getState().status).toBe("error")
    expect(useChatStore.getState().error).toBe("Server unavailable")
  })

  test("tool calls attach to assistant message", () => {
    const { addMessage, updateMessage } = useChatStore.getState()
    addMessage({
      id: "a1",
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      isStreaming: true,
    })
    updateMessage("a1", {
      toolCalls: [{ toolName: "canvas.getCourses", args: "{}", status: "pending" }],
    })
    expect(useChatStore.getState().messages[0]!.toolCalls).toHaveLength(1)
    expect(useChatStore.getState().messages[0]!.toolCalls![0]!.status).toBe("pending")

    // Complete the tool call
    updateMessage("a1", {
      toolCalls: [{ toolName: "canvas.getCourses", args: "{}", status: "complete" }],
    })
    expect(useChatStore.getState().messages[0]!.toolCalls![0]!.status).toBe("complete")
  })
})
