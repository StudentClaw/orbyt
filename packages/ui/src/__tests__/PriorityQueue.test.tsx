import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import { PriorityQueue } from "../components/dashboard/PriorityQueue"
import type { PrioritizedItem } from "../components/dashboard/priority-model"

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

function makeItem(id: string, overrides: Partial<PrioritizedItem> = {}): PrioritizedItem {
  return {
    id,
    title: `Task ${id}`,
    courseCode: "CS 101",
    effectiveDueAt: hoursFromNow(100),
    estimatedMinutes: 60,
    impactScore: 0.5,
    coursePriority: 0.5,
    ...overrides,
  }
}

describe("PriorityQueue", () => {
  const now = new Date()

  test("shows 'No upcoming tasks' when empty", () => {
    render(<PriorityQueue items={[]} now={now} />)
    expect(screen.getByTestId("no-priorities")).toBeDefined()
    expect(screen.getByText("No upcoming tasks")).toBeDefined()
  })

  test("renders items sorted by priority", () => {
    const items = [
      makeItem("green", { effectiveDueAt: hoursFromNow(200), estimatedMinutes: 60 }),
      makeItem("red", { effectiveDueAt: hoursFromNow(1), estimatedMinutes: 120 }),
    ]

    render(<PriorityQueue items={items} now={now} />)

    const queue = screen.getByTestId("priority-queue")
    const cards = queue.children
    expect(cards[0].getAttribute("data-testid")).toBe("priority-card-red")
    expect(cards[1].getAttribute("data-testid")).toBe("priority-card-green")
  })

  test("limits visible items to maxItems", () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem(`item-${i}`, { effectiveDueAt: hoursFromNow(100 + i) }),
    )

    render(<PriorityQueue items={items} now={now} maxItems={5} />)

    const queue = screen.getByTestId("priority-queue")
    expect(queue.children).toHaveLength(5)
    expect(screen.getByTestId("priority-overflow")).toBeDefined()
    expect(screen.getByText("+5 more")).toBeDefined()
  })

  test("renders urgency badge and countdown for each card", () => {
    const items = [
      makeItem("urgent", {
        effectiveDueAt: hoursFromNow(1),
        estimatedMinutes: 120,
      }),
    ]

    render(<PriorityQueue items={items} now={now} />)

    expect(screen.getByTestId("urgency-badge-urgent")).toBeDefined()
    expect(screen.getByTestId("countdown-urgent")).toBeDefined()
    expect(screen.getByTestId("effort-urgent")).toBeDefined()
  })

  test("shows title and course code on cards", () => {
    const items = [
      makeItem("hw1", { title: "Homework 1", courseCode: "MATH 240" }),
    ]

    render(<PriorityQueue items={items} now={now} />)

    expect(screen.getByText("Homework 1")).toBeDefined()
    expect(screen.getByText("MATH 240")).toBeDefined()
  })
})
