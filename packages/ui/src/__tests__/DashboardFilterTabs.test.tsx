import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { DashboardFilterTabs } from "../components/dashboard/DashboardFilterTabs"
import type { FilterScope } from "../components/dashboard/subject-grouping"

function Harness() {
  const [value, setValue] = useState<FilterScope>("today")
  return <DashboardFilterTabs value={value} onChange={setValue} />
}

describe("DashboardFilterTabs", () => {
  test("renders four tabs", () => {
    render(<Harness />)
    expect(screen.getByTestId("filter-tab-today")).toBeDefined()
    expect(screen.getByTestId("filter-tab-thisWeek")).toBeDefined()
    expect(screen.getByTestId("filter-tab-upcoming")).toBeDefined()
    expect(screen.getByTestId("filter-tab-overdue")).toBeDefined()
  })

  test("clicking a tab updates active styling via state", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByTestId("filter-tab-overdue"))
    const overdue = screen.getByTestId("filter-tab-overdue")
    expect(overdue.className).toContain("border-foreground")
  })
})
