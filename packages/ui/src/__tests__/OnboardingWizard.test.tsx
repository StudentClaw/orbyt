import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const wizardMocks = vi.hoisted(() => ({
  currentStep: 0,
  steps: Array.from({ length: 6 }, () => ({ status: "pending" as const, completedAt: null })),
  overallStatus: "in_progress" as const,
  aiAuthStatus: "pending" as "pending" | "connected" | "skipped",
  advanceStep: vi.fn(),
  skipStep: vi.fn(),
  goToStep: vi.fn(),
  completeOnboarding: vi.fn(),
  persistState: vi.fn(),
  setAnswers: vi.fn(),
  setDna: vi.fn(),
  classifyDnaThroughServer: vi.fn(async () => null),
  navigate: vi.fn(),
}))

vi.mock("@/rpc/onboardingState", () => ({
  ONBOARDING_STEPS: [
    { id: "dna-discovery", label: "Study DNA", required: true },
    { id: "active-hours", label: "Active Hours", required: false },
    { id: "busy-grid", label: "Weekly Rhythm", required: false },
    { id: "ai-connect", label: "AI Connect", required: false },
    { id: "canvas-sync", label: "Canvas", required: false },
    { id: "launch", label: "Launch", required: false },
  ],
  useOnboardingState: () => ({
    currentStep: wizardMocks.currentStep,
    steps: wizardMocks.steps,
    overallStatus: wizardMocks.overallStatus,
    aiAuthStatus: wizardMocks.aiAuthStatus,
    answers: {},
    dna: null,
    classifying: false,
  }),
  advanceOnboardingStep: (...args: unknown[]) => wizardMocks.advanceStep(...args),
  skipOnboardingStep: (...args: unknown[]) => wizardMocks.skipStep(...args),
  goToOnboardingStep: (...args: unknown[]) => wizardMocks.goToStep(...args),
  completeOnboarding: (...args: unknown[]) => wizardMocks.completeOnboarding(...args),
  persistOnboardingState: (...args: unknown[]) => wizardMocks.persistState(...args),
  setAiAuthStatus: vi.fn(),
  setAnswers: (...args: unknown[]) => wizardMocks.setAnswers(...args),
  setDna: (...args: unknown[]) => wizardMocks.setDna(...args),
  classifyDnaThroughServer: wizardMocks.classifyDnaThroughServer,
}))

vi.mock("@/rpc/appRuntime", () => ({
  getPrimaryWsRpcClient: () => ({
    canvas: { sync: vi.fn() },
    onboarding: {
      setAnswers: vi.fn(async () => undefined),
      setPreferences: vi.fn(async () => undefined),
      setRoutines: vi.fn(async () => undefined),
      setAiAuth: vi.fn(async () => undefined),
    },
    provider: { retryInitialize: vi.fn(async () => undefined) },
  }),
}))

vi.mock("@/hooks/useAppRuntime", () => ({
  useRuntimeOrchestrationSnapshot: () => ({
    providerRuntime: {
      authState: "auth_required",
      status: "auth_required",
      lastError: null,
    },
  }),
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => wizardMocks.navigate,
}))

import { OnboardingWizard } from "../components/onboarding/OnboardingWizard"

describe("OnboardingWizard", () => {
  beforeEach(() => {
    wizardMocks.currentStep = 0
    wizardMocks.steps = Array.from({ length: 6 }, () => ({ status: "pending" as const, completedAt: null }))
    wizardMocks.overallStatus = "in_progress"
    wizardMocks.advanceStep.mockClear()
    wizardMocks.skipStep.mockClear()
    wizardMocks.goToStep.mockClear()
    wizardMocks.completeOnboarding.mockClear()
    wizardMocks.persistState.mockClear()
    wizardMocks.setAnswers.mockClear()
    wizardMocks.setDna.mockClear()
    wizardMocks.classifyDnaThroughServer.mockClear()
    wizardMocks.navigate.mockClear()
  })

  test("renders the wizard container", () => {
    render(<OnboardingWizard />)
    expect(screen.getByTestId("onboarding-wizard")).toBeDefined()
  })

  test("shows the current phase label", () => {
    render(<OnboardingWizard />)
    expect(screen.getByText("Study DNA")).toBeDefined()
  })

  test("starts on the DNA discovery welcome screen", () => {
    wizardMocks.currentStep = 0
    render(<OnboardingWizard />)
    expect(screen.getByText(/questions\./)).toBeDefined()
    expect(screen.getByRole("button", { name: /Start/ })).toBeDefined()
  })

  test("shows Back on phases that support returning", () => {
    wizardMocks.currentStep = 2
    render(<OnboardingWizard />)
    expect(screen.getByTestId("onboarding-back")).toBeDefined()
  })

  test("Back button returns to the previous post-DNA phase", async () => {
    wizardMocks.currentStep = 2
    render(<OnboardingWizard />)
    await userEvent.click(screen.getByTestId("onboarding-back"))
    expect(wizardMocks.goToStep).toHaveBeenCalledWith(1)
  })

  test("AI phase can continue without AI", async () => {
    wizardMocks.currentStep = 3
    wizardMocks.aiAuthStatus = "pending"
    render(<OnboardingWizard />)
    await userEvent.click(screen.getByRole("button", { name: /Continue without AI/ }))
    expect(wizardMocks.advanceStep).toHaveBeenCalled()
  })

  test("launch phase can finish onboarding without tour", async () => {
    wizardMocks.currentStep = 5
    render(<OnboardingWizard />)
    await userEvent.click(screen.getByTestId("onboarding-skip-tour"))
    expect(wizardMocks.completeOnboarding).toHaveBeenCalled()
    expect(wizardMocks.navigate).toHaveBeenCalledWith({ to: "/" })
  })
})
