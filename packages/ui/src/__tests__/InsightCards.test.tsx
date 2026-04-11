import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import { InsightCards } from "../components/dashboard/InsightCards"
import type { InsightData } from "../components/dashboard/InsightCard"

function makeInsight(id: string, title: string, body: string): InsightData {
  return { id, title, body }
}

describe("InsightCards", () => {
  test("shows 'No insights yet' when empty", () => {
    render(<InsightCards insights={[]} />)
    expect(screen.getByTestId("no-insights")).toBeDefined()
    expect(screen.getByText("No insights yet")).toBeDefined()
  })

  test("renders cards in horizontal scroll container", () => {
    const insights = [
      makeInsight("i1", "Study Tip", "Review before sleep"),
      makeInsight("i2", "Grade Alert", "CHEM grade dropping"),
    ]

    render(<InsightCards insights={insights} />)

    expect(screen.getByTestId("insights-container")).toBeDefined()
    expect(screen.getByTestId("insight-card-i1")).toBeDefined()
    expect(screen.getByTestId("insight-card-i2")).toBeDefined()
  })

  test("each card shows title and body", () => {
    const insights = [
      makeInsight("i1", "Study Tip", "Review before sleep"),
    ]

    render(<InsightCards insights={insights} />)

    expect(screen.getByText("Study Tip")).toBeDefined()
    expect(screen.getByText("Review before sleep")).toBeDefined()
  })
})
