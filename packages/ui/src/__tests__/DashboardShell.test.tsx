import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import { DashboardShell } from "../components/dashboard/DashboardShell"

describe("DashboardShell", () => {
  test("renders left and right slots", () => {
    render(
      <DashboardShell
        left={<span data-testid="left-slot">L</span>}
        right={<span data-testid="right-slot">R</span>}
      />,
    )
    expect(screen.getByTestId("dashboard-shell")).toBeDefined()
    expect(screen.getByTestId("left-slot")).toBeDefined()
    expect(screen.getByTestId("right-slot")).toBeDefined()
  })
})
