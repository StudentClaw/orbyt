import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QuickActions } from "../components/dashboard/QuickActions"

describe("QuickActions", () => {
  test("renders three action buttons", () => {
    render(<QuickActions />)

    expect(screen.getByTestId("action-plan-week")).toBeDefined()
    expect(screen.getByTestId("action-help-with")).toBeDefined()
    expect(screen.getByTestId("action-whats-important")).toBeDefined()
  })

  test("'Plan my week' calls onAction with correct id", async () => {
    const onAction = vi.fn()
    render(<QuickActions onAction={onAction} />)

    await userEvent.click(screen.getByTestId("action-plan-week"))
    expect(onAction).toHaveBeenCalledWith("plan-week")
  })

  test("buttons are disabled when not connected", () => {
    render(<QuickActions connected={false} />)

    expect(screen.getByTestId("action-plan-week").hasAttribute("disabled")).toBe(true)
    expect(screen.getByTestId("action-help-with").hasAttribute("disabled")).toBe(true)
    expect(screen.getByTestId("action-whats-important").hasAttribute("disabled")).toBe(true)
  })
})
