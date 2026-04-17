import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mockGetRoutines = vi.fn()
const mockSetRoutines = vi.fn().mockResolvedValue({})

vi.mock("@/rpc/appRuntime", () => ({
  getPrimaryWsRpcClient: () => ({
    onboarding: {
      getRoutines: mockGetRoutines,
      setRoutines: mockSetRoutines,
    },
  }),
}))

import { RoutinesStep } from "../components/onboarding/RoutinesStep"

describe("RoutinesStep", () => {
  const defaultProps = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSkip: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRoutines.mockResolvedValue({ cells: [] })
  })

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

  test("hydrates saved routines without writing on mount", async () => {
    mockGetRoutines.mockResolvedValue({
      cells: [{ dayOfWeek: 2, hourOfDay: 10 }],
    })

    render(<RoutinesStep {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId("routine-cell-2-10").getAttribute("data-active")).toBe("true")
    })
    expect(mockSetRoutines).not.toHaveBeenCalled()
  })
})
