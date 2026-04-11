import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import { WeeklyProgress } from "../components/dashboard/WeeklyProgress"
import type { ProgressSession } from "../components/dashboard/progress-model"

function makeSession(date: string, status: "completed" | "skipped" | "scheduled"): ProgressSession {
  return { id: `s-${date}`, date, status }
}

describe("WeeklyProgress", () => {
  const now = new Date("2026-04-09T12:00:00Z")
  const weekStart = "2026-04-06"
  const lastWeekStart = "2026-03-30"

  test("renders completion count and percentage", () => {
    const sessions = [
      makeSession("2026-04-06", "completed"),
      makeSession("2026-04-07", "completed"),
      makeSession("2026-04-08", "skipped"),
    ]

    render(
      <WeeklyProgress
        sessions={sessions}
        weekStart={weekStart}
        lastWeekStart={lastWeekStart}
        now={now}
      />,
    )

    expect(screen.getByTestId("completion-count").textContent).toBe("2/3 sessions")
    expect(screen.getByTestId("completion-pct").textContent).toBe("67%")
  })

  test("renders streak count", () => {
    const sessions = [
      makeSession("2026-04-08", "completed"),
      makeSession("2026-04-09", "completed"),
    ]

    render(
      <WeeklyProgress
        sessions={sessions}
        weekStart={weekStart}
        lastWeekStart={lastWeekStart}
        now={now}
      />,
    )

    expect(screen.getByTestId("streak-count").textContent).toBe("2")
  })

  test("renders week-over-week comparison", () => {
    const sessions = [
      // This week: 2 completed out of 3
      makeSession("2026-04-06", "completed"),
      makeSession("2026-04-07", "completed"),
      makeSession("2026-04-08", "skipped"),
      // Last week: 1 completed out of 3
      makeSession("2026-03-30", "completed"),
      makeSession("2026-03-31", "skipped"),
      makeSession("2026-04-01", "skipped"),
    ]

    render(
      <WeeklyProgress
        sessions={sessions}
        weekStart={weekStart}
        lastWeekStart={lastWeekStart}
        now={now}
      />,
    )

    const wow = screen.getByTestId("week-over-week")
    expect(wow.textContent).toContain("from last week")
  })

  test("handles empty sessions gracefully", () => {
    render(
      <WeeklyProgress
        sessions={[]}
        weekStart={weekStart}
        lastWeekStart={lastWeekStart}
        now={now}
      />,
    )

    expect(screen.getByTestId("completion-count").textContent).toBe("0/0 sessions")
    expect(screen.getByTestId("streak-count").textContent).toBe("0")
  })
})
