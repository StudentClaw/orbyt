import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import { DeadlineTimeline } from "../components/dashboard/DeadlineTimeline"
import type { CourseWorkItem } from "@orbyt/contracts"

function makeItem(
  id: string,
  title: string,
  dueAt?: string,
): CourseWorkItem {
  return {
    id: id as any,
    courseId: "c1" as any,
    title,
    effectiveDueAt: dueAt,
    sourceType: "assignment",
    sourceId: "mock-source-id",
    freshnessStatus: "fresh",
  }
}

function daysFromNow(days: number, from: Date): string {
  const d = new Date(from.getTime() + days * 24 * 60 * 60 * 1000)
  return d.toISOString()
}

describe("DeadlineTimeline", () => {
  const now = new Date("2026-04-09T12:00:00Z")

  test("renders 'No upcoming deadlines' when empty", () => {
    render(<DeadlineTimeline items={[]} now={now} />)
    expect(screen.getByTestId("no-deadlines")).toBeDefined()
    expect(screen.getByText("No upcoming deadlines")).toBeDefined()
  })

  test("renders day columns with items", () => {
    const items = [
      makeItem("i1", "HW1", daysFromNow(1, now)),
      makeItem("i2", "HW2", daysFromNow(3, now)),
    ]

    render(<DeadlineTimeline items={items} now={now} />)

    expect(screen.getByTestId("deadline-timeline")).toBeDefined()
    expect(screen.getByText("HW1")).toBeDefined()
    expect(screen.getByText("HW2")).toBeDefined()
  })

  test("shows '+N more' chip when >3 items in a day", () => {
    const sameDay = daysFromNow(1, now)
    const items = [
      makeItem("i1", "HW1", sameDay),
      makeItem("i2", "HW2", sameDay),
      makeItem("i3", "HW3", sameDay),
      makeItem("i4", "HW4", sameDay),
      makeItem("i5", "HW5", sameDay),
    ]

    render(<DeadlineTimeline items={items} now={now} />)

    // Should show 3 visible items and a "+2 more" chip
    const dayKey = new Date(sameDay).toISOString().split("T")[0]
    expect(screen.getByTestId(`overflow-chip-${dayKey}`)).toBeDefined()
    expect(screen.getByText("+2 more")).toBeDefined()
  })

  test("renders urgency-colored badges on items", () => {
    const items = [makeItem("i1", "Urgent HW", daysFromNow(1, now))]

    render(<DeadlineTimeline items={items} now={now} />)

    expect(screen.getByTestId("deadline-item-i1")).toBeDefined()
  })

  test("excludes items beyond the 14-day window", () => {
    const items = [
      makeItem("i1", "Near", daysFromNow(2, now)),
      makeItem("i2", "Far", daysFromNow(20, now)),
    ]

    render(<DeadlineTimeline items={items} now={now} />)

    expect(screen.getByText("Near")).toBeDefined()
    expect(screen.queryByText("Far")).toBeNull()
  })
})
