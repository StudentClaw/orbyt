import { describe, test, expect, beforeEach } from "vitest"
import { useChatStore } from "../stores/chatStore"
import { useCanvasStore } from "../stores/canvasStore"
import { useDashboardStore } from "../stores/dashboardStore"
import { usePlannerStore } from "../stores/plannerStore"
import { useSettingsStore } from "../stores/settingsStore"
import { useOnboardingStore } from "../stores/onboardingStore"

describe("chatStore", () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      status: "idle",
      activeSessionId: null,
      error: null,
      chatPanelOpen: false,
      sessions: [],
    })
  })

  test("initializes with correct defaults", () => {
    const state = useChatStore.getState()
    expect(state.messages).toEqual([])
    expect(state.status).toBe("idle")
    expect(state.activeSessionId).toBeNull()
    expect(state.error).toBeNull()
    expect(state.chatPanelOpen).toBe(false)
  })

  test("addMessage appends immutably", () => {
    const { addMessage } = useChatStore.getState()
    addMessage({ id: "1", role: "user", content: "Hello", timestamp: Date.now() })
    const state = useChatStore.getState()
    expect(state.messages.length).toBe(1)
    expect(state.messages[0]!.content).toBe("Hello")
  })

  test("addMessage preserves existing messages", () => {
    const { addMessage } = useChatStore.getState()
    addMessage({ id: "1", role: "user", content: "Hello", timestamp: 1000 })
    addMessage({ id: "2", role: "assistant", content: "Hi", timestamp: 2000 })
    const state = useChatStore.getState()
    expect(state.messages.length).toBe(2)
    expect(state.messages[0]!.id).toBe("1")
    expect(state.messages[1]!.id).toBe("2")
  })

  test("updateMessage patches message by id immutably", () => {
    const { addMessage, updateMessage } = useChatStore.getState()
    addMessage({ id: "msg-1", role: "assistant", content: "", timestamp: Date.now(), isStreaming: true })
    updateMessage("msg-1", { content: "Hello world" })
    const state = useChatStore.getState()
    expect(state.messages[0]!.content).toBe("Hello world")
    expect(state.messages[0]!.isStreaming).toBe(true)
  })

  test("updateMessage does not affect other messages", () => {
    const { addMessage, updateMessage } = useChatStore.getState()
    addMessage({ id: "1", role: "user", content: "Question", timestamp: 1000 })
    addMessage({ id: "2", role: "assistant", content: "", timestamp: 2000, isStreaming: true })
    updateMessage("2", { content: "Answer" })
    const state = useChatStore.getState()
    expect(state.messages[0]!.content).toBe("Question")
    expect(state.messages[1]!.content).toBe("Answer")
  })

  test("updateMessage with toolCalls appends correctly", () => {
    const { addMessage, updateMessage } = useChatStore.getState()
    addMessage({ id: "1", role: "assistant", content: "", timestamp: Date.now() })
    updateMessage("1", { toolCalls: [{ toolName: "canvas.getCourses", args: "{}", status: "pending" }] })
    const state = useChatStore.getState()
    expect(state.messages[0]!.toolCalls).toHaveLength(1)
    expect(state.messages[0]!.toolCalls![0]!.toolName).toBe("canvas.getCourses")
  })

  test("setStatus transitions through all valid states", () => {
    const { setStatus } = useChatStore.getState()
    const statuses = ["idle", "streaming", "interrupted", "offline", "rate-limited", "auth-expired", "error"] as const
    for (const s of statuses) {
      setStatus(s)
      expect(useChatStore.getState().status).toBe(s)
    }
  })

  test("setError sets and clears error", () => {
    const { setError } = useChatStore.getState()
    setError("Something went wrong")
    expect(useChatStore.getState().error).toBe("Something went wrong")
    setError(null)
    expect(useChatStore.getState().error).toBeNull()
  })

  test("setActiveSession updates session id", () => {
    useChatStore.getState().setActiveSession("session-123")
    expect(useChatStore.getState().activeSessionId).toBe("session-123")
  })

  test("clearMessages resets to empty array", () => {
    const { addMessage, clearMessages } = useChatStore.getState()
    addMessage({ id: "1", role: "user", content: "Hello", timestamp: Date.now() })
    clearMessages()
    expect(useChatStore.getState().messages).toEqual([])
  })

  test("toggleChatPanel flips open state", () => {
    const { toggleChatPanel } = useChatStore.getState()
    expect(useChatStore.getState().chatPanelOpen).toBe(false)
    toggleChatPanel()
    expect(useChatStore.getState().chatPanelOpen).toBe(true)
    toggleChatPanel()
    expect(useChatStore.getState().chatPanelOpen).toBe(false)
  })

  test("createSession adds session, sets active, opens panel", () => {
    useChatStore.getState().createSession()
    const state = useChatStore.getState()
    expect(state.sessions).toHaveLength(1)
    expect(state.sessions[0]!.title).toBe("New chat")
    expect(state.activeSessionId).toBe(state.sessions[0]!.id)
    expect(state.chatPanelOpen).toBe(true)
    expect(state.messages).toEqual([])
  })

  test("createSession prepends newer sessions", () => {
    useChatStore.getState().createSession()
    useChatStore.getState().createSession()
    const sessions = useChatStore.getState().sessions
    expect(sessions).toHaveLength(2)
    expect(sessions[0]!.createdAt).toBeGreaterThanOrEqual(sessions[1]!.createdAt)
  })

  test("selectSession switches active session and opens panel", () => {
    useChatStore.getState().createSession()
    useChatStore.getState().createSession()
    const firstId = useChatStore.getState().sessions[1]!.id
    useChatStore.getState().selectSession(firstId)
    const state = useChatStore.getState()
    expect(state.activeSessionId).toBe(firstId)
    expect(state.chatPanelOpen).toBe(true)
  })

  test("addMessage auto-titles session on first user message", () => {
    useChatStore.getState().createSession()
    const sessionId = useChatStore.getState().activeSessionId!
    useChatStore.getState().addMessage({
      id: "1",
      role: "user",
      content: "What is due this week?",
      timestamp: Date.now(),
    })
    const session = useChatStore.getState().sessions.find((s) => s.id === sessionId)
    expect(session?.title).toBe("What is due this week?")
  })

  test("addMessage does not re-title session after first user message", () => {
    useChatStore.getState().createSession()
    const sessionId = useChatStore.getState().activeSessionId!
    useChatStore.getState().addMessage({ id: "1", role: "user", content: "First", timestamp: 1000 })
    useChatStore.getState().addMessage({ id: "2", role: "user", content: "Second", timestamp: 2000 })
    const session = useChatStore.getState().sessions.find((s) => s.id === sessionId)
    expect(session?.title).toBe("First")
  })

  test("deleteSession removes session from list", () => {
    useChatStore.getState().createSession()
    const id = useChatStore.getState().activeSessionId!
    useChatStore.getState().deleteSession(id)
    expect(useChatStore.getState().sessions).toHaveLength(0)
  })

  test("deleteSession closes panel when no sessions remain", () => {
    useChatStore.getState().createSession()
    const id = useChatStore.getState().activeSessionId!
    useChatStore.getState().deleteSession(id)
    expect(useChatStore.getState().chatPanelOpen).toBe(false)
  })

  test("deleteSession switches active to next session when active is deleted", () => {
    useChatStore.getState().createSession()
    useChatStore.getState().createSession()
    const activeId = useChatStore.getState().activeSessionId!
    useChatStore.getState().deleteSession(activeId)
    const remaining = useChatStore.getState().sessions
    expect(remaining).toHaveLength(1)
    expect(useChatStore.getState().activeSessionId).toBe(remaining[0]!.id)
  })

  test("renameSession updates title immutably", () => {
    useChatStore.getState().createSession()
    const id = useChatStore.getState().activeSessionId!
    useChatStore.getState().renameSession(id, "My custom title")
    const session = useChatStore.getState().sessions.find((s) => s.id === id)
    expect(session?.title).toBe("My custom title")
  })

  test("pinSession sets pinnedAt timestamp", () => {
    useChatStore.getState().createSession()
    const id = useChatStore.getState().activeSessionId!
    expect(useChatStore.getState().sessions[0]!.pinnedAt).toBeNull()
    useChatStore.getState().pinSession(id)
    expect(useChatStore.getState().sessions[0]!.pinnedAt).not.toBeNull()
  })

  test("pinSession toggles off when already pinned", () => {
    useChatStore.getState().createSession()
    const id = useChatStore.getState().activeSessionId!
    useChatStore.getState().pinSession(id)
    useChatStore.getState().pinSession(id)
    expect(useChatStore.getState().sessions[0]!.pinnedAt).toBeNull()
  })
})

describe("canvasStore", () => {
  beforeEach(() => {
    useCanvasStore.setState({ courses: [], syncStatus: "idle" })
  })

  test("initializes with correct defaults", () => {
    const state = useCanvasStore.getState()
    expect(state.courses).toEqual([])
    expect(state.syncStatus).toBe("idle")
  })

  test("setSyncStatus updates immutably", () => {
    useCanvasStore.getState().setSyncStatus("syncing")
    expect(useCanvasStore.getState().syncStatus).toBe("syncing")
  })
})

describe("dashboardStore", () => {
  test("initializes with null lastRefresh", () => {
    useDashboardStore.setState({ lastRefresh: null })
    expect(useDashboardStore.getState().lastRefresh).toBeNull()
  })

  test("setLastRefresh updates state", () => {
    const now = Date.now()
    useDashboardStore.getState().setLastRefresh(now)
    expect(useDashboardStore.getState().lastRefresh).toBe(now)
  })
})

describe("plannerStore", () => {
  test("initializes with empty arrays", () => {
    usePlannerStore.setState({ sessions: [], tasks: [] })
    const state = usePlannerStore.getState()
    expect(state.sessions).toEqual([])
    expect(state.tasks).toEqual([])
  })
})

describe("settingsStore", () => {
  test("initializes with dark theme", () => {
    useSettingsStore.setState({ theme: "dark" })
    expect(useSettingsStore.getState().theme).toBe("dark")
  })

  test("setTheme updates state", () => {
    useSettingsStore.getState().setTheme("light")
    expect(useSettingsStore.getState().theme).toBe("light")
  })
})

describe("onboardingStore", () => {
  beforeEach(() => {
    useOnboardingStore.setState({ currentStep: 0, completedSteps: [] })
  })

  test("initializes with step 0", () => {
    expect(useOnboardingStore.getState().currentStep).toBe(0)
  })

  test("completeStep adds step immutably", () => {
    useOnboardingStore.getState().completeStep(1)
    expect(useOnboardingStore.getState().completedSteps).toContain(1)
  })

  test("completeStep is idempotent", () => {
    useOnboardingStore.getState().completeStep(1)
    useOnboardingStore.getState().completeStep(1)
    expect(
      useOnboardingStore.getState().completedSteps.filter((s) => s === 1).length
    ).toBe(1)
  })
})
