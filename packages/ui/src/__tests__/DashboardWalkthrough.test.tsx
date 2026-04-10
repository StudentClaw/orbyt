import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const walkthroughMocks = vi.hoisted(() => ({
  completeOnboarding: vi.fn(),
  persistState: vi.fn(),
}))

vi.mock("@/rpc/onboardingState", () => ({
  completeOnboarding: (...args: unknown[]) => walkthroughMocks.completeOnboarding(...args),
  persistOnboardingState: (...args: unknown[]) => walkthroughMocks.persistState(...args),
}))

import { DashboardWalkthrough } from "../components/onboarding/DashboardWalkthrough"

describe("DashboardWalkthrough", () => {
  const defaultProps = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSkip: vi.fn(),
  }

  beforeEach(() => {
    walkthroughMocks.completeOnboarding.mockClear()
    walkthroughMocks.persistState.mockClear()
  })

  test("renders the walkthrough step", () => {
    render(<DashboardWalkthrough {...defaultProps} />)
    expect(screen.getByTestId("dashboard-walkthrough-step")).toBeDefined()
  })

  test("renders the walkthrough overlay", () => {
    render(<DashboardWalkthrough {...defaultProps} />)
    expect(screen.getByTestId("walkthrough-overlay")).toBeDefined()
  })

  test("completing walkthrough calls completeOnboarding", async () => {
    render(<DashboardWalkthrough {...defaultProps} />)
    // Click through all steps
    const steps = 5 // DASHBOARD_WALKTHROUGH_STEPS.length
    for (let i = 0; i < steps; i++) {
      await userEvent.click(screen.getByTestId("walkthrough-next"))
    }
    expect(walkthroughMocks.completeOnboarding).toHaveBeenCalledOnce()
  })
})
