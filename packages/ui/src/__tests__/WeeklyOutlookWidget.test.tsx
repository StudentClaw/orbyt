import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import { WeeklyOutlookWidget } from "../components/dashboard/WeeklyOutlookWidget"
import type { CalendarSession } from "../components/dashboard/calendar-model"
import type { PrioritizedItem } from "../components/dashboard/priority-model"
import { buildBuckets } from "../components/dashboard/weekly-outlook-model"

const WEEK_START = "2025-06-09"
const NOW = new Date(2025, 5, 11, 12, 0, 0, 0)

describe("WeeklyOutlookWidget", () => {
  test("shows empty state when no events", () => {
    render(
      <WeeklyOutlookWidget weekStart={WEEK_START} sessions={[]} deadlines={[]} now={NOW} />,
    )
    expect(screen.getByTestId("weekly-outlook-empty")).toBeDefined()
  })

  test("groups session by local day and renders row", () => {
    const sessions: CalendarSession[] = [
      {
        id: "s1",
        courseId: "c1",
        courseName: "CS 101",
        title: "Study block",
        startTime: new Date(2025, 5, 10, 14, 30, 0).toISOString(),
        endTime: new Date(2025, 5, 10, 15, 30, 0).toISOString(),
      },
    ]
    render(
      <WeeklyOutlookWidget weekStart={WEEK_START} sessions={sessions} deadlines={[]} now={NOW} />,
    )
    expect(screen.getByTestId("weekly-outlook-day-2025-06-10")).toBeDefined()
    expect(screen.getByTestId("weekly-outlook-row-session-s1")).toBeDefined()
    expect(screen.getByText("Study block")).toBeDefined()
  })

  test("renders deadline row on matching day", () => {
    const deadlines: PrioritizedItem[] = [
      {
        id: "d1",
        title: "Homework",
        courseId: "c1",
        courseCode: "MATH 240",
        effectiveDueAt: new Date(2025, 5, 12, 23, 0, 0).toISOString(),
        estimatedMinutes: 60,
        impactScore: 0.5,
        coursePriority: 1,
      },
    ]
    render(
      <WeeklyOutlookWidget weekStart={WEEK_START} sessions={[]} deadlines={deadlines} now={NOW} />,
    )
    expect(screen.getByTestId("weekly-outlook-day-2025-06-12")).toBeDefined()
    expect(screen.getByTestId("weekly-outlook-row-deadline-d1")).toBeDefined()
  })

  test("uses the course color as the left rail for deadline rows", () => {
    const deadlines: PrioritizedItem[] = [
      {
        id: "d1",
        title: "Homework",
        courseId: "c1",
        courseCode: "MATH 240",
        effectiveDueAt: new Date(2025, 5, 12, 23, 0, 0).toISOString(),
        estimatedMinutes: 60,
        impactScore: 0.5,
        coursePriority: 1,
        courseColor: "oklch(0.72 0.15 42)",
      },
    ]

    const buckets = buildBuckets(WEEK_START, [], deadlines, NOW)
    const deadlineRow = buckets.flatMap((bucket) => bucket.rows).find((row) => row.id === "deadline-d1")

    expect(deadlineRow?.borderLeftColor).toBe("oklch(0.72 0.15 42)")
  })
})
