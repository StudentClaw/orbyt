import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FirstSyncStep } from "../components/onboarding/FirstSyncStep"

describe("FirstSyncStep", () => {
  const defaultProps = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSkip: vi.fn(),
  }

  beforeEach(() => {
    defaultProps.onNext = vi.fn()
  })

  test("renders the first sync step", () => {
    render(<FirstSyncStep {...defaultProps} />)
    expect(screen.getByTestId("first-sync-step")).toBeDefined()
  })

  test("renders the Continue button", () => {
    render(<FirstSyncStep {...defaultProps} />)
    expect(screen.getByTestId("sync-skip-btn")).toBeDefined()
  })

  test("calls onNext when Continue is clicked", async () => {
    render(<FirstSyncStep {...defaultProps} />)
    await userEvent.click(screen.getByTestId("sync-skip-btn"))
    expect(defaultProps.onNext).toHaveBeenCalledOnce()
  })
})
