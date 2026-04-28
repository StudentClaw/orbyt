import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const wizardMocks = vi.hoisted(() => ({
  currentStep: 0,
  steps: Array.from({ length: 6 }, () => ({ status: "pending" as const, completedAt: null })),
  overallStatus: "in_progress" as const,
  aiAuthStatus: "pending" as "pending" | "connected" | "skipped",
  answers: {},
  dna: null,
  classifying: false,
  advanceStep: vi.fn(),
  goToStep: vi.fn(),
  completeOnboarding: vi.fn(),
  persistState: vi.fn(),
  setAiAuthStatus: vi.fn(),
  setAnswers: vi.fn(),
  setDna: vi.fn(),
  classifyDnaThroughServer: vi.fn(async (_answers: unknown) => null),
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
    answers: wizardMocks.answers,
    dna: wizardMocks.dna,
    classifying: wizardMocks.classifying,
  }),
  advanceOnboardingStep: (...args: unknown[]) => wizardMocks.advanceStep(...args),
  goToOnboardingStep: (...args: unknown[]) => wizardMocks.goToStep(...args),
  completeOnboarding: (...args: unknown[]) => wizardMocks.completeOnboarding(...args),
  persistOnboardingState: (...args: unknown[]) => wizardMocks.persistState(...args),
  setAiAuthStatus: (...args: unknown[]) => wizardMocks.setAiAuthStatus(...args),
  setAnswers: (...args: unknown[]) => wizardMocks.setAnswers(...args),
  setDna: (...args: unknown[]) => wizardMocks.setDna(...args),
  classifyDnaThroughServer: (answers: unknown) => wizardMocks.classifyDnaThroughServer(answers),
}))

vi.mock("@/rpc/appRuntime", () => ({
  getPrimaryWsRpcClient: () => ({
    canvas: {
      listCourses: vi.fn(async () => []),
      sync: vi.fn(),
    },
    onboarding: {
      setAiAuth: vi.fn(),
      setAnswers: vi.fn(),
      setPreferences: vi.fn(),
      setRoutines: vi.fn(),
    },
    provider: {
      retryInitialize: vi.fn(),
    },
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
  useNavigate: () => vi.fn(),
}))

import { OnboardingWizard } from "../components/onboarding/OnboardingWizard"

describe("OnboardingWizard", () => {
  beforeEach(() => {
    wizardMocks.currentStep = 0
    wizardMocks.steps = Array.from({ length: 6 }, () => ({ status: "pending" as const, completedAt: null }))
    wizardMocks.overallStatus = "in_progress"
    wizardMocks.aiAuthStatus = "pending"
    wizardMocks.answers = {}
    wizardMocks.dna = null
    wizardMocks.classifying = false
    wizardMocks.advanceStep.mockClear()
    wizardMocks.goToStep.mockClear()
    wizardMocks.completeOnboarding.mockClear()
    wizardMocks.persistState.mockClear()
    wizardMocks.setAiAuthStatus.mockClear()
    wizardMocks.setAnswers.mockClear()
    wizardMocks.setDna.mockClear()
    wizardMocks.classifyDnaThroughServer.mockClear()
  })

  test("renders the wizard container", () => {
    render(<OnboardingWizard />)
    expect(screen.getByTestId("onboarding-wizard")).toBeDefined()
  })

  test("starts on the Study DNA welcome screen", () => {
    render(<OnboardingWizard />)
    expect(screen.getByText("Building your study profile")).toBeDefined()
    expect(screen.getByText("One Study DNA.")).toBeDefined()
    expect(screen.getByRole("button", { name: /Start/ })).toBeDefined()
  })

  test("clicking Start enters the first DNA question", async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />)

    await user.click(screen.getByRole("button", { name: /Start/ }))

    expect(screen.getByText(/1 \/ 11/)).toBeDefined()
  })

  test("initializes the AI connect phase from the onboarding step", () => {
    wizardMocks.currentStep = 3
    render(<OnboardingWizard />)
    expect(screen.getByText(/AI Connection/)).toBeDefined()
    expect(screen.getByRole("button", { name: /Connect/ })).toBeDefined()
  })

  test("AI connect back button returns to the previous post-DNA phase", async () => {
    const user = userEvent.setup()
    wizardMocks.currentStep = 3
    render(<OnboardingWizard />)

    await user.click(screen.getByTestId("onboarding-back"))

    expect(wizardMocks.goToStep).toHaveBeenCalledWith(2)
  })
})
