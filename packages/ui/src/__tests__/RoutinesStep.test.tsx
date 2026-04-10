import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { RoutinesStep } from "../components/onboarding/RoutinesStep"

describe("RoutinesStep", () => {
  const defaultProps = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSkip: vi.fn(),
  }

  test("renders the routines step", () => {
    render(<RoutinesStep {...defaultProps} />)
    expect(screen.getByTestId("routines-step")).toBeDefined()
  })

  test("renders the weekly grid", () => {
    render(<RoutinesStep {...defaultProps} />)
    expect(screen.getByTestId("routines-grid")).toBeDefined()
  })

  test("renders day headers", () => {
    render(<RoutinesStep {...defaultProps} />)
    expect(screen.getByText("Mon")).toBeDefined()
    expect(screen.getByText("Sun")).toBeDefined()
  })

  test("clicking a cell toggles it", async () => {
    render(<RoutinesStep {...defaultProps} />)
    const cell = screen.getByTestId("routine-cell-0-8")
    await userEvent.click(cell)
    expect(cell.getAttribute("data-active")).toBe("true")
  })

  test("clicking an active cell deactivates it", async () => {
    render(<RoutinesStep {...defaultProps} />)
    const cell = screen.getByTestId("routine-cell-0-8")
    await userEvent.click(cell)
    expect(cell.getAttribute("data-active")).toBe("true")
    await userEvent.click(cell)
    expect(cell.getAttribute("data-active")).toBe("false")
  })
})
