import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/rpc/onboardingState", () => ({
  setAiAuthStatus: vi.fn(),
}))

import { AiAuthStep } from "../components/onboarding/AiAuthStep"

describe("AiAuthStep", () => {
  const defaultProps = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSkip: vi.fn(),
  }

  test("renders the AI auth step", () => {
    render(<AiAuthStep {...defaultProps} />)
    expect(screen.getByTestId("ai-auth-step")).toBeDefined()
  })

  test("shows connect button", () => {
    render(<AiAuthStep {...defaultProps} />)
    expect(screen.getByTestId("ai-auth-connect-btn")).toBeDefined()
  })

  test("shows status indicator", () => {
    render(<AiAuthStep {...defaultProps} />)
    expect(screen.getByTestId("ai-auth-status")).toBeDefined()
  })

  test("shows skip option", () => {
    render(<AiAuthStep {...defaultProps} />)
    expect(screen.getByTestId("ai-auth-skip")).toBeDefined()
  })

  test("clicking skip calls onNext", async () => {
    const onNext = vi.fn()
    render(<AiAuthStep {...defaultProps} onNext={onNext} />)
    await userEvent.click(screen.getByTestId("ai-auth-skip"))
    expect(onNext).toHaveBeenCalledOnce()
  })
})
