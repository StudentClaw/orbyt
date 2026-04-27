import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { DashboardHeader } from "../components/dashboard/DashboardHeader"

describe("DashboardHeader", () => {
  test("renders the current planning label", () => {
    render(
      <DashboardHeader
        title="Dashboard"
        dateLabel="Sunday, Apr 26"
        dueThisWeek={3}
        planLabel="Plan my overdue work"
        onPlanWeek={vi.fn()}
      />,
    )

    expect(screen.getByTestId("plan-my-week").textContent).toContain("Plan my overdue work")
  })
})
