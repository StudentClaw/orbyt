import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { WalkthroughOverlay } from "../components/onboarding/WalkthroughOverlay"
import type { WalkthroughStep } from "../components/onboarding/walkthrough-steps"

const mockSteps: ReadonlyArray<WalkthroughStep> = [
  { targetTestId: "test-target-1", title: "Step 1", description: "First step", placement: "bottom" },
  { targetTestId: "test-target-2", title: "Step 2", description: "Second step", placement: "bottom" },
]

describe("WalkthroughOverlay", () => {
  test("renders the overlay", () => {
    render(
      <WalkthroughOverlay
        steps={mockSteps}
        currentStep={0}
        onNext={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByTestId("walkthrough-overlay")).toBeDefined()
  })

  test("shows current step title and description", () => {
    render(
      <WalkthroughOverlay
        steps={mockSteps}
        currentStep={0}
        onNext={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByText("Step 1")).toBeDefined()
    expect(screen.getByText("First step")).toBeDefined()
  })

  test("Next button calls onNext", async () => {
    const onNext = vi.fn()
    render(
      <WalkthroughOverlay
        steps={mockSteps}
        currentStep={0}
        onNext={onNext}
        onDismiss={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByTestId("walkthrough-next"))
    expect(onNext).toHaveBeenCalledOnce()
  })

  test("Dismiss button calls onDismiss", async () => {
    const onDismiss = vi.fn()
    render(
      <WalkthroughOverlay
        steps={mockSteps}
        currentStep={0}
        onNext={vi.fn()}
        onDismiss={onDismiss}
      />,
    )
    await userEvent.click(screen.getByTestId("walkthrough-dismiss"))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  test("shows Got it on last step instead of Next", () => {
    render(
      <WalkthroughOverlay
        steps={mockSteps}
        currentStep={1}
        onNext={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByTestId("walkthrough-next").textContent).toBe("Got it")
  })

  test("shows step counter", () => {
    render(
      <WalkthroughOverlay
        steps={mockSteps}
        currentStep={0}
        onNext={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByText("1 / 2")).toBeDefined()
  })
})
