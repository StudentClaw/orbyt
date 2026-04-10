import { useEffect, useRef, useCallback } from "react"
import { useChatStore } from "@/stores/chatStore"
import { useWebSocket } from "./useWebSocket"
import { useStreaming } from "./useStreaming"
import type { ChatMessage } from "@/stores/chatStore"

const MOCK_RESPONSES = [
  "Here's what I found for you:\n\n## Upcoming Assignments\n\n1. **Problem Set 3** — Due Friday at 11:59 PM\n2. **Reading Response** — Due next Monday\n3. **Lab Report** — Due in 10 days\n\nWould you like me to help you plan your study sessions?",
  "Let me help you with that!\n\n### Study Plan\n\n- **Today**: Review chapters 5-6 (~2 hours)\n- **Tomorrow**: Start Problem Set 3 (~1.5 hours)\n- **Thursday**: Finish Problem Set 3 + review\n\n> Tip: Break the problem set into smaller chunks for better focus.\n\nShall I set reminders for these sessions?",
  "Great question! Here's a quick summary:\n\n| Course | Grade | Trend |\n|--------|-------|-------|\n| CS 201 | A- | Stable |\n| MATH 301 | B+ | Up |\n| ENG 102 | A | Stable |\n\nYour **overall GPA** is trending at `3.67`. Keep it up!",
]

function generateId(): string {
  return crypto.randomUUID()
}

function useMockChat() {
  const { addMessage, updateMessage, setStatus } = useChatStore.getState()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const assistantIdRef = useRef<string | null>(null)

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const sendMessage = useCallback((content: string) => {
    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      content,
      timestamp: Date.now(),
    }
    addMessage(userMsg)

    const assistantId = generateId()
    assistantIdRef.current = assistantId
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      isStreaming: true,
    }
    addMessage(assistantMsg)
    setStatus("streaming")

    const response = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)]!
    const showToolCall = Math.random() < 0.3
    const showReasoning = Math.random() < 0.2

    if (showReasoning) {
      updateMessage(assistantId, { reasoning: "Let me think about what information would be most helpful here..." })
    }

    let delay = 300
    if (showToolCall) {
      setTimeout(() => {
        updateMessage(assistantId, {
          toolCalls: [{ toolName: "canvas.getCourses", args: "{}", status: "pending" }],
        })
      }, delay)
      delay += 800
      setTimeout(() => {
        const current = useChatStore.getState().messages.find((m) => m.id === assistantId)
        if (current?.toolCalls) {
          updateMessage(assistantId, {
            toolCalls: current.toolCalls.map((tc) => ({ ...tc, status: "complete" as const })),
          })
        }
      }, delay)
      delay += 200
    }

    setTimeout(() => {
      let charIndex = 0
      intervalRef.current = setInterval(() => {
        charIndex += 1 + Math.floor(Math.random() * 3)
        if (charIndex >= response.length) {
          cleanup()
          updateMessage(assistantId, { content: response, isStreaming: false })
          setStatus("idle")
          assistantIdRef.current = null
        } else {
          updateMessage(assistantId, { content: response.slice(0, charIndex) })
        }
      }, 25)
    }, delay)
  }, [addMessage, updateMessage, setStatus, cleanup])

  const interrupt = useCallback(() => {
    cleanup()
    const id = assistantIdRef.current
    if (id) {
      updateMessage(id, { isStreaming: false })
      assistantIdRef.current = null
    }
    setStatus("interrupted")
    setTimeout(() => setStatus("idle"), 0)
  }, [cleanup, updateMessage, setStatus])

  useEffect(() => cleanup, [cleanup])

  return { sendMessage, interrupt }
}

function useRealChat() {
  const { addMessage, updateMessage, setStatus, setError } = useChatStore.getState()
  const { send, subscribe } = useWebSocket()
  const { addToken, startStreaming, stopStreaming } = useStreaming()
  const assistantIdRef = useRef<string | null>(null)
  const contentRef = useRef("")

  useEffect(() => {
    const unsubs = [
      subscribe("chat.streaming", (evt) => {
        const token = (evt.data as { token: string }).token
        addToken(token)
        contentRef.current += token
        if (assistantIdRef.current) {
          updateMessage(assistantIdRef.current, { content: contentRef.current })
        }
      }),
      subscribe("chat.complete", (evt) => {
        const data = evt.data as { messageId: string; content: string }
        if (assistantIdRef.current) {
          updateMessage(assistantIdRef.current, {
            content: data.content,
            isStreaming: false,
          })
        }
        stopStreaming()
        setStatus("idle")
        assistantIdRef.current = null
        contentRef.current = ""
      }),
      subscribe("chat.toolCall", (evt) => {
        const data = evt.data as { toolName: string; args: string }
        if (assistantIdRef.current) {
          const current = useChatStore.getState().messages.find((m) => m.id === assistantIdRef.current)
          const existing = current?.toolCalls ?? []
          updateMessage(assistantIdRef.current, {
            toolCalls: [...existing, { toolName: data.toolName, args: data.args, status: "pending" as const }],
          })
        }
      }),
      subscribe("error", (evt) => {
        const data = evt.data as { code: number; message: string }
        if (data.code === 429) {
          setStatus("rate-limited")
        } else if (data.code === 401) {
          setStatus("auth-expired")
        } else {
          setStatus("error")
          setError(data.message)
        }
        if (assistantIdRef.current) {
          updateMessage(assistantIdRef.current, { isStreaming: false })
          assistantIdRef.current = null
        }
        stopStreaming()
        contentRef.current = ""
      }),
    ]

    return () => unsubs.forEach((fn) => fn())
  }, [subscribe, addToken, stopStreaming, updateMessage, setStatus, setError])

  const sendMessage = useCallback((content: string) => {
    const sessionId = useChatStore.getState().activeSessionId

    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      content,
      timestamp: Date.now(),
    }
    addMessage(userMsg)

    const assistantId = generateId()
    assistantIdRef.current = assistantId
    contentRef.current = ""
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      isStreaming: true,
    }
    addMessage(assistantMsg)
    setStatus("streaming")
    startStreaming()

    send({
      method: "chat.sendMessage",
      id: generateId(),
      params: { content, ...(sessionId ? { sessionId } : {}) },
    })
  }, [addMessage, setStatus, startStreaming, send])

  const interrupt = useCallback(() => {
    send({ method: "chat.interrupt", id: generateId(), params: {} })
    setStatus("interrupted")
    if (assistantIdRef.current) {
      updateMessage(assistantIdRef.current, { isStreaming: false })
      assistantIdRef.current = null
    }
    stopStreaming()
    contentRef.current = ""
    setTimeout(() => setStatus("idle"), 0)
  }, [send, setStatus, updateMessage, stopStreaming])

  return { sendMessage, interrupt }
}

export function useChat() {
  const { connectionState } = useWebSocket()
  const mock = useMockChat()
  const real = useRealChat()

  const useMock = connectionState !== "connected"

  return {
    sendMessage: useMock ? mock.sendMessage : real.sendMessage,
    interrupt: useMock ? mock.interrupt : real.interrupt,
    connectionState,
  }
}
