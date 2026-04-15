import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import {
  advanceOnboardingStep,
  completeOnboarding,
  getOnboardingState,
  goToOnboardingStep,
  hydrateOnboardingState,
  hydrateOnboardingStateFromServer,
  isOnboardingComplete,
  ONBOARDING_STEPS,
  persistOnboardingState,
  resetOnboardingStateForTests,
  setAiAuthStatus,
  skipOnboardingStep,
} from "./onboardingState"

const STORAGE_KEY = "student-claw:onboarding"

function getLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  }
}

describe("onboardingState", () => {
  let storageMock: ReturnType<typeof getLocalStorageMock>

  beforeEach(() => {
    resetOnboardingStateForTests()
    storageMock = getLocalStorageMock()
    Object.defineProperty(globalThis, "localStorage", {
      value: storageMock,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("ONBOARDING_STEPS", () => {
    test("has 6 steps", () => {
      expect(ONBOARDING_STEPS).toHaveLength(6)
    })

    test("ai-auth is not required", () => {
      const aiStep = ONBOARDING_STEPS.find((s) => s.id === "ai-auth")
      expect(aiStep?.required).toBe(false)
    })

    test("welcome is not required", () => {
      const step = ONBOARDING_STEPS.find((s) => s.id === "welcome")
      expect(step?.required).toBe(false)
    })
  })

  describe("initial state", () => {
    test("starts at step 0", () => {
      expect(getOnboardingState().currentStep).toBe(0)
    })

    test("all steps are pending", () => {
      const state = getOnboardingState()
      expect(state.steps.every((s) => s.status === "pending")).toBe(true)
    })

    test("overall status is in_progress", () => {
      expect(getOnboardingState().overallStatus).toBe("in_progress")
    })

    test("is not complete", () => {
      expect(isOnboardingComplete()).toBe(false)
    })
  })

  describe("advanceOnboardingStep", () => {
    test("increments current step and marks current as completed", () => {
      advanceOnboardingStep()
      const state = getOnboardingState()
      expect(state.currentStep).toBe(1)
      expect(state.steps[0].status).toBe("completed")
      expect(state.steps[0].completedAt).not.toBeNull()
    })

    test("advances through multiple steps", () => {
      advanceOnboardingStep()
      advanceOnboardingStep()
      advanceOnboardingStep()
      const state = getOnboardingState()
      expect(state.currentStep).toBe(3)
      expect(state.steps[0].status).toBe("completed")
      expect(state.steps[1].status).toBe("completed")
      expect(state.steps[2].status).toBe("completed")
    })

    test("does not advance past last step", () => {
      for (let i = 0; i < 10; i++) {
        advanceOnboardingStep()
      }
      expect(getOnboardingState().currentStep).toBe(ONBOARDING_STEPS.length - 1)
    })
  })

  describe("skipOnboardingStep", () => {
    test("marks step as skipped and advances", () => {
      skipOnboardingStep()
      const state = getOnboardingState()
      expect(state.currentStep).toBe(1)
      expect(state.steps[0].status).toBe("skipped")
    })

    test("marks step as skipped on non-required steps", () => {
      goToOnboardingStep(1) // ai-auth (not required)
      skipOnboardingStep()
      const state = getOnboardingState()
      expect(state.currentStep).toBe(2) // should have advanced
      expect(state.steps[1].status).toBe("skipped")
    })
  })

  describe("goToOnboardingStep", () => {
    test("navigates to a specific step", () => {
      advanceOnboardingStep()
      advanceOnboardingStep()
      goToOnboardingStep(0)
      expect(getOnboardingState().currentStep).toBe(0)
    })

    test("clamps to valid range", () => {
      goToOnboardingStep(-1)
      expect(getOnboardingState().currentStep).toBe(0)

      goToOnboardingStep(100)
      expect(getOnboardingState().currentStep).toBe(ONBOARDING_STEPS.length - 1)
    })
  })

  describe("setAiAuthStatus", () => {
    test("updates AI auth status", () => {
      setAiAuthStatus("connected")
      expect(getOnboardingState().aiAuthStatus).toBe("connected")
    })

    test("supports all status values", () => {
      for (const status of ["pending", "connected", "skipped"] as const) {
        setAiAuthStatus(status)
        expect(getOnboardingState().aiAuthStatus).toBe(status)
      }
    })
  })

  describe("completeOnboarding", () => {
    test("sets overall status to completed", () => {
      completeOnboarding()
      expect(getOnboardingState().overallStatus).toBe("completed")
    })

    test("isOnboardingComplete returns true after completion", () => {
      completeOnboarding()
      expect(isOnboardingComplete()).toBe(true)
    })
  })

  describe("isOnboardingComplete", () => {
    test("returns false when not all required steps are done", () => {
      expect(isOnboardingComplete()).toBe(false)
    })

    test("returns true when overallStatus is completed", () => {
      completeOnboarding()
      expect(isOnboardingComplete()).toBe(true)
    })
  })

  describe("localStorage persistence", () => {
    test("persistOnboardingState writes to localStorage", () => {
      advanceOnboardingStep()
      persistOnboardingState()
      expect(storageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.any(String),
      )
    })

    test("hydrateOnboardingState restores from localStorage", () => {
      advanceOnboardingStep()
      advanceOnboardingStep()
      persistOnboardingState()

      resetOnboardingStateForTests()
      expect(getOnboardingState().currentStep).toBe(0)

      hydrateOnboardingState()
      const state = getOnboardingState()
      expect(state.currentStep).toBe(2)
      expect(state.steps[0].status).toBe("completed")
      expect(state.steps[1].status).toBe("completed")
    })

    test("hydrateOnboardingState handles missing localStorage gracefully", () => {
      storageMock.getItem = vi.fn((_key: string) => undefined as unknown as string)
      hydrateOnboardingState()
      expect(getOnboardingState().currentStep).toBe(0)
    })

    test("hydrateOnboardingState handles corrupted localStorage gracefully", () => {
      storageMock.getItem = vi.fn(() => "not-valid-json{{{")
      hydrateOnboardingState()
      expect(getOnboardingState().currentStep).toBe(0)
    })

    test("completed onboarding survives persistence round-trip", () => {
      completeOnboarding()
      persistOnboardingState()

      resetOnboardingStateForTests()
      hydrateOnboardingState()
      expect(isOnboardingComplete()).toBe(true)
    })

    test("server hydration preserves a completed local onboarding state", async () => {
      completeOnboarding()
      persistOnboardingState()

      resetOnboardingStateForTests()

      const client = {
        onboarding: {
          getSnapshot: vi.fn().mockResolvedValue({
            steps: [],
            overallStatus: "in_progress" as const,
          }),
          getAiAuth: vi.fn().mockResolvedValue({
            status: "pending" as const,
            provider: null,
            connectedAt: null,
          }),
          setOverallStatus: vi.fn().mockResolvedValue({ ok: true }),
          setAiAuth: vi.fn().mockResolvedValue({
            status: "connected" as const,
            provider: "codex",
            connectedAt: null,
          }),
        },
      } as any

      await hydrateOnboardingStateFromServer(client)

      expect(isOnboardingComplete()).toBe(true)
      expect(client.onboarding.setOverallStatus).toHaveBeenCalledWith({ status: "completed" })
    })

    test("server hydration promotes connected Codex auth to completed onboarding", async () => {
      const client = {
        onboarding: {
          getSnapshot: vi.fn().mockResolvedValue({
            steps: [],
            overallStatus: "in_progress" as const,
          }),
          getAiAuth: vi.fn().mockResolvedValue({
            status: "connected" as const,
            provider: "codex",
            connectedAt: "2026-04-14T00:00:00.000Z",
          }),
          setOverallStatus: vi.fn().mockResolvedValue({ ok: true }),
          setAiAuth: vi.fn().mockResolvedValue({
            status: "connected" as const,
            provider: "codex",
            connectedAt: "2026-04-14T00:00:00.000Z",
          }),
        },
      } as any

      await hydrateOnboardingStateFromServer(client)

      expect(getOnboardingState().aiAuthStatus).toBe("connected")
      expect(isOnboardingComplete()).toBe(true)
      expect(client.onboarding.setOverallStatus).toHaveBeenCalledWith({ status: "completed" })
    })
  })

  describe("resetOnboardingStateForTests", () => {
    test("resets all state to initial values", () => {
      advanceOnboardingStep()
      setAiAuthStatus("connected")
      completeOnboarding()

      resetOnboardingStateForTests()

      const state = getOnboardingState()
      expect(state.currentStep).toBe(0)
      expect(state.overallStatus).toBe("in_progress")
      expect(state.aiAuthStatus).toBe("pending")
      expect(state.steps.every((s) => s.status === "pending")).toBe(true)
    })
  })
})
