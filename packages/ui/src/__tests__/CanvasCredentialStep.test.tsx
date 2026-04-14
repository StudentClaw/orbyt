import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/rpc/onboardingState", () => ({
  setCanvasTokenValidated: vi.fn(),
}))

import { CanvasCredentialStep } from "../components/onboarding/CanvasCredentialStep"

describe("CanvasCredentialStep", () => {
  const defaultProps = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSkip: vi.fn(),
  }

  beforeEach(() => {
    defaultProps.onNext = vi.fn()
  })

  test("renders the canvas credential form", () => {
    render(<CanvasCredentialStep {...defaultProps} />)
    expect(screen.getByTestId("canvas-step")).toBeDefined()
    expect(screen.getByTestId("canvas-url-input")).toBeDefined()
    expect(screen.getByTestId("canvas-token-input")).toBeDefined()
  })

  test("validate button is present", () => {
    render(<CanvasCredentialStep {...defaultProps} />)
    expect(screen.getByTestId("canvas-validate-btn")).toBeDefined()
  })

  test("shows error for invalid URL format", async () => {
    render(<CanvasCredentialStep {...defaultProps} />)
    const urlInput = screen.getByTestId("canvas-url-input")
    const tokenInput = screen.getByTestId("canvas-token-input")

    await userEvent.type(urlInput, "not-a-url")
    await userEvent.type(tokenInput, "a".repeat(20))
    await userEvent.click(screen.getByTestId("canvas-validate-btn"))

    expect(screen.getByTestId("canvas-validation-status")).toBeDefined()
    expect(screen.getByTestId("canvas-validation-status").textContent).toMatch(/invalid/i)
  })

  test("shows success for valid URL and token", async () => {
    render(<CanvasCredentialStep {...defaultProps} />)
    const urlInput = screen.getByTestId("canvas-url-input")
    const tokenInput = screen.getByTestId("canvas-token-input")

    await userEvent.type(urlInput, "https://canvas.socccd.edu/")
    await userEvent.type(tokenInput, "a".repeat(20))
    await userEvent.click(screen.getByTestId("canvas-validate-btn"))

    expect(screen.getByTestId("canvas-validation-status").textContent).toMatch(/valid/i)
  })
})
