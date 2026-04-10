import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { WelcomeStep } from "../components/onboarding/WelcomeStep"

describe("WelcomeStep", () => {
  const defaultProps = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSkip: vi.fn(),
  }

  test("renders welcome content", () => {
    render(<WelcomeStep {...defaultProps} />)
    expect(screen.getByTestId("welcome-step")).toBeDefined()
    expect(screen.getByText(/Welcome to Student Claw/)).toBeDefined()
  })

  test("shows time estimate", () => {
    render(<WelcomeStep {...defaultProps} />)
    expect(screen.getByText(/5 min/)).toBeDefined()
  })

  test("Get Started button calls onNext", async () => {
    const onNext = vi.fn()
    render(<WelcomeStep {...defaultProps} onNext={onNext} />)
    await userEvent.click(screen.getByTestId("welcome-get-started"))
    expect(onNext).toHaveBeenCalledOnce()
  })
})
