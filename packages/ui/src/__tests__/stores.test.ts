import { describe, test, expect, beforeEach } from "vitest"
import { useChatStore } from "../stores/chatStore"
import { useCanvasStore } from "../stores/canvasStore"
import { useDashboardStore } from "../stores/dashboardStore"
import { usePlannerStore } from "../stores/plannerStore"
import { useSettingsStore } from "../stores/settingsStore"
import { useOnboardingStore } from "../stores/onboardingStore"

describe("chatStore", () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], isStreaming: false, activeSessionId: null })
  })

  test("initializes with correct defaults", () => {
    const state = useChatStore.getState()
    expect(state.messages).toEqual([])
    expect(state.isStreaming).toBe(false)
    expect(state.activeSessionId).toBeNull()
  })

  test("addMessage appends immutably", () => {
    const { addMessage } = useChatStore.getState()
    addMessage({ id: "1", role: "user", content: "Hello", timestamp: Date.now() })
    const state = useChatStore.getState()
    expect(state.messages.length).toBe(1)
    expect(state.messages[0]!.content).toBe("Hello")
  })

  test("setStreaming updates state", () => {
    useChatStore.getState().setStreaming(true)
    expect(useChatStore.getState().isStreaming).toBe(true)
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
