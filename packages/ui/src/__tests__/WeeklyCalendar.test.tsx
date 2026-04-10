import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { WeeklyCalendar } from "../components/dashboard/WeeklyCalendar"
import type { CalendarSession } from "../components/dashboard/calendar-model"

function makeSession(
  id: string,
  startTime: string,
  endTime: string,
  overrides: Partial<CalendarSession> = {},
): CalendarSession {
  return {
    id,
    courseId: "c1",
    courseName: "CS 101",
    title: `Session ${id}`,
    startTime,
    endTime,
    ...overrides,
  }
}

describe("WeeklyCalendar", () => {
  const weekStart = "2026-04-06"

  test("shows 'No sessions this week' when empty", () => {
    render(<WeeklyCalendar sessions={[]} weekStart={weekStart} />)
    expect(screen.getByTestId("no-sessions")).toBeDefined()
    expect(screen.getByText("No sessions this week")).toBeDefined()
  })

  test("renders calendar grid with sessions", () => {
    const sessions = [
      makeSession("s1", "2026-04-07T09:00:00Z", "2026-04-07T10:00:00Z"),
    ]

    render(<WeeklyCalendar sessions={sessions} weekStart={weekStart} />)

    expect(screen.getByTestId("weekly-calendar")).toBeDefined()
    expect(screen.getByTestId("calendar-session-s1")).toBeDefined()
  })

  test("renders 7 day headers", () => {
    const sessions = [
      makeSession("s1", "2026-04-07T09:00:00Z", "2026-04-07T10:00:00Z"),
    ]

    render(<WeeklyCalendar sessions={sessions} weekStart={weekStart} />)

    expect(screen.getByTestId("day-header-2026-04-06")).toBeDefined()
    expect(screen.getByTestId("day-header-2026-04-12")).toBeDefined()
  })

  test("week navigation calls onWeekChange", async () => {
    const onWeekChange = vi.fn()

    render(
      <WeeklyCalendar
        sessions={[]}
        weekStart={weekStart}
        onWeekChange={onWeekChange}
      />,
    )

    await userEvent.click(screen.getByTestId("week-next"))
    expect(onWeekChange).toHaveBeenCalledWith("2026-04-13")

    await userEvent.click(screen.getByTestId("week-prev"))
    expect(onWeekChange).toHaveBeenCalledWith("2026-03-30")
  })

  test("filters sessions outside the current week", () => {
    const sessions = [
      makeSession("in", "2026-04-07T09:00:00Z", "2026-04-07T10:00:00Z"),
      makeSession("out", "2026-04-20T09:00:00Z", "2026-04-20T10:00:00Z"),
    ]

    render(<WeeklyCalendar sessions={sessions} weekStart={weekStart} />)

    expect(screen.getByTestId("calendar-session-in")).toBeDefined()
    expect(screen.queryByTestId("calendar-session-out")).toBeNull()
  })
})
