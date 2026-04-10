import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const wizardMocks = vi.hoisted(() => ({
  currentStep: 0,
  steps: Array.from({ length: 7 }, () => ({ status: "pending" as const, completedAt: null })),
  overallStatus: "in_progress" as const,
  canvasTokenValidated: false,
  aiAuthStatus: "pending" as const,
  advanceStep: vi.fn(),
  skipStep: vi.fn(),
  goToStep: vi.fn(),
  completeOnboarding: vi.fn(),
  persistState: vi.fn(),
}))

vi.mock("@/rpc/onboardingState", () => ({
  ONBOARDING_STEPS: [
    { id: "welcome", label: "Welcome", required: false },
    { id: "canvas-credential", label: "Canvas Setup", required: true },
    { id: "ai-auth", label: "AI Connection", required: true },
    { id: "preferences", label: "Preferences", required: false },
    { id: "routines", label: "Routines", required: false },
    { id: "first-sync", label: "First Sync", required: false },
    { id: "dashboard-walkthrough", label: "Dashboard Tour", required: false },
  ],
  useOnboardingState: () => ({
    currentStep: wizardMocks.currentStep,
    steps: wizardMocks.steps,
    overallStatus: wizardMocks.overallStatus,
    canvasTokenValidated: wizardMocks.canvasTokenValidated,
    aiAuthStatus: wizardMocks.aiAuthStatus,
  }),
  advanceOnboardingStep: (...args: unknown[]) => wizardMocks.advanceStep(...args),
  skipOnboardingStep: (...args: unknown[]) => wizardMocks.skipStep(...args),
  goToOnboardingStep: (...args: unknown[]) => wizardMocks.goToStep(...args),
  completeOnboarding: (...args: unknown[]) => wizardMocks.completeOnboarding(...args),
  persistOnboardingState: (...args: unknown[]) => wizardMocks.persistState(...args),
  setCanvasTokenValidated: vi.fn(),
  setAiAuthStatus: vi.fn(),
}))

vi.mock("@/rpc/appRuntime", () => ({
  getPrimaryWsRpcClient: () => ({
    canvas: { sync: vi.fn() },
  }),
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}))

import { OnboardingWizard } from "../components/onboarding/OnboardingWizard"

describe("OnboardingWizard", () => {
  beforeEach(() => {
    wizardMocks.currentStep = 0
    wizardMocks.steps = Array.from({ length: 7 }, () => ({ status: "pending" as const, completedAt: null }))
    wizardMocks.overallStatus = "in_progress"
    wizardMocks.advanceStep.mockClear()
    wizardMocks.skipStep.mockClear()
    wizardMocks.goToStep.mockClear()
    wizardMocks.completeOnboarding.mockClear()
    wizardMocks.persistState.mockClear()
  })

  test("renders the wizard container", () => {
    render(<OnboardingWizard />)
    expect(screen.getByTestId("onboarding-wizard")).toBeDefined()
  })

  test("shows progress indicator", () => {
    render(<OnboardingWizard />)
    expect(screen.getByTestId("onboarding-progress")).toBeDefined()
  })

  test("shows current step label", () => {
    render(<OnboardingWizard />)
    expect(screen.getByText("Welcome")).toBeDefined()
  })

  test("shows step counter", () => {
    render(<OnboardingWizard />)
    expect(screen.getByText("Step 1 of 7")).toBeDefined()
  })

  test("hides Back button on first step", () => {
    wizardMocks.currentStep = 0
    render(<OnboardingWizard />)
    expect(screen.queryByTestId("onboarding-back")).toBeNull()
  })

  test("shows Back button on step > 0", () => {
    wizardMocks.currentStep = 1
    render(<OnboardingWizard />)
    expect(screen.getByTestId("onboarding-back")).toBeDefined()
  })

  test("Back button calls goToOnboardingStep", async () => {
    wizardMocks.currentStep = 2
    render(<OnboardingWizard />)
    await userEvent.click(screen.getByTestId("onboarding-back"))
    expect(wizardMocks.goToStep).toHaveBeenCalledWith(1)
  })

  test("shows Skip button on non-required steps", () => {
    wizardMocks.currentStep = 0 // "welcome" is not required
    render(<OnboardingWizard />)
    expect(screen.getByTestId("onboarding-skip")).toBeDefined()
  })

  test("hides Skip button on required steps", () => {
    wizardMocks.currentStep = 1 // "canvas-credential" is required
    render(<OnboardingWizard />)
    expect(screen.queryByTestId("onboarding-skip")).toBeNull()
  })

  test("shows Finish on last step", () => {
    wizardMocks.currentStep = 6
    render(<OnboardingWizard />)
    expect(screen.getByTestId("onboarding-next").textContent).toBe("Finish")
  })

  test("shows Next on non-last steps", () => {
    wizardMocks.currentStep = 0
    render(<OnboardingWizard />)
    expect(screen.getByTestId("onboarding-next").textContent).toBe("Next")
  })
})
