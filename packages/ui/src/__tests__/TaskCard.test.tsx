import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { resolvedBorderColor, TaskCard } from "../components/dashboard/TaskCard"
import type { PrioritizedItem } from "../components/dashboard/priority-model"

const NOW = new Date("2026-04-21T12:00:00Z")

function makeItem(overrides: Partial<PrioritizedItem> = {}): PrioritizedItem {
  return {
    id: "item-1",
    title: "Problem Set 7",
    courseId: "course-1",
    courseCode: "CS 101",
    effectiveDueAt: new Date("2026-04-23T12:00:00Z").toISOString(),
    estimatedMinutes: 90,
    impactScore: 0.8,
    coursePriority: 1,
    ...overrides,
  }
}

describe("TaskCard", () => {
  test("renders points and a normalized submission label when metadata is present", () => {
    render(
      <TaskCard
        item={makeItem({ pointsPossible: 10, submissionStatus: "unsubmitted" })}
        now={NOW}
      />,
    )

    expect(screen.getByText("10 pts")).toBeDefined()
    expect(screen.getByText("Not submitted")).toBeDefined()
  })

  test("renders a graded label for graded work", () => {
    render(
      <TaskCard
        item={makeItem({ pointsPossible: 12.5, submissionStatus: "graded" })}
        now={NOW}
      />,
    )

    expect(screen.getByText("12.5 pts")).toBeDefined()
    expect(screen.getByText("Graded")).toBeDefined()
  })

  test("falls back to title-cased labels for unknown submission statuses", () => {
    render(
      <TaskCard
        item={makeItem({ submissionStatus: "late_submission" })}
        now={NOW}
      />,
    )

    expect(screen.getByText("Late Submission")).toBeDefined()
  })

  test("omits metadata chips when fields are absent", () => {
    render(<TaskCard item={makeItem()} now={NOW} />)

    expect(screen.queryByText(/pts$/)).toBeNull()
    expect(screen.queryByText("Not submitted")).toBeNull()
    expect(screen.queryByText("Submitted")).toBeNull()
    expect(screen.queryByText("Graded")).toBeNull()
  })

  test("uses the course color for the card border when present", () => {
    const item = makeItem({ courseColor: "oklch(0.72 0.15 42)" })
    expect(resolvedBorderColor(item, NOW)).toBe("oklch(0.72 0.15 42)")
  })

  test("invokes the click handler when the card is activated", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(<TaskCard item={makeItem()} now={NOW} onClick={onClick} />)

    await user.click(screen.getByTestId("task-card-item-1"))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
