import { describe, expect, test } from "vitest"
import {
  sortByPriority,
  computePriorityDisplay,
  type PrioritizedItem,
} from "./priority-model"

function makeItem(overrides: Partial<PrioritizedItem>): PrioritizedItem {
  return {
    id: "item-1",
    title: "Default Item",
    courseId: "course-1",
    courseCode: "CS 101",
    effectiveDueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedMinutes: 120,
    impactScore: 0.5,
    coursePriority: 0.5,
    ...overrides,
  }
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

describe("sortByPriority", () => {
  test("RED zone items sort before YELLOW and GREEN", () => {
    const now = new Date()
    const items: PrioritizedItem[] = [
      makeItem({
        id: "green",
        title: "Green",
        effectiveDueAt: hoursFromNow(200),
        estimatedMinutes: 60,
      }),
      makeItem({
        id: "red",
        title: "Red",
        effectiveDueAt: hoursFromNow(1), // 1 hour left, effort=2h → RED
        estimatedMinutes: 120,
      }),
      makeItem({
        id: "yellow",
        title: "Yellow",
        effectiveDueAt: hoursFromNow(30), // 30h left → YELLOW
        estimatedMinutes: 60,
      }),
    ]

    const sorted = sortByPriority(items, now)
    expect(sorted[0].id).toBe("red")
    expect(sorted[1].id).toBe("yellow")
    expect(sorted[2].id).toBe("green")
  })

  test("within YELLOW zone, higher impact score sorts first", () => {
    const now = new Date()
    const items: PrioritizedItem[] = [
      makeItem({
        id: "low-impact",
        title: "Low Impact",
        effectiveDueAt: hoursFromNow(30),
        estimatedMinutes: 60,
        impactScore: 0.3,
      }),
      makeItem({
        id: "high-impact",
        title: "High Impact",
        effectiveDueAt: hoursFromNow(30),
        estimatedMinutes: 60,
        impactScore: 0.8,
      }),
    ]

    const sorted = sortByPriority(items, now)
    expect(sorted[0].id).toBe("high-impact")
    expect(sorted[1].id).toBe("low-impact")
  })

  test("within ±0.05 impact epsilon, shorter effort sorts first (WSJF)", () => {
    const now = new Date()
    const items: PrioritizedItem[] = [
      makeItem({
        id: "long",
        title: "Long Task",
        effectiveDueAt: hoursFromNow(100),
        estimatedMinutes: 240,
        impactScore: 0.50,
      }),
      makeItem({
        id: "short",
        title: "Short Task",
        effectiveDueAt: hoursFromNow(100),
        estimatedMinutes: 30,
        impactScore: 0.52, // within 0.05 of 0.50
      }),
    ]

    const sorted = sortByPriority(items, now)
    expect(sorted[0].id).toBe("short")
    expect(sorted[1].id).toBe("long")
  })

  test("within RED zone, sorts by earliest deadline", () => {
    const now = new Date()
    const items: PrioritizedItem[] = [
      makeItem({
        id: "later-red",
        title: "Later Red",
        effectiveDueAt: hoursFromNow(2),
        estimatedMinutes: 120,
      }),
      makeItem({
        id: "earlier-red",
        title: "Earlier Red",
        effectiveDueAt: hoursFromNow(1),
        estimatedMinutes: 120,
      }),
    ]

    const sorted = sortByPriority(items, now)
    expect(sorted[0].id).toBe("earlier-red")
    expect(sorted[1].id).toBe("later-red")
  })
})

describe("computePriorityDisplay", () => {
  test("returns 'overdue' zone for past-due items", () => {
    const now = new Date()
    const item = makeItem({
      effectiveDueAt: new Date(now.getTime() - 60000).toISOString(),
    })
    const display = computePriorityDisplay(item, now)
    expect(display.zone).toBe("overdue")
  })

  test("returns 'urgent' zone for RED items", () => {
    const now = new Date()
    const item = makeItem({
      effectiveDueAt: hoursFromNow(1),
      estimatedMinutes: 120,
    })
    const display = computePriorityDisplay(item, now)
    expect(display.zone).toBe("urgent")
  })

  test("returns 'attention' zone for YELLOW items", () => {
    const now = new Date()
    const item = makeItem({
      effectiveDueAt: hoursFromNow(30),
      estimatedMinutes: 60,
    })
    const display = computePriorityDisplay(item, now)
    expect(display.zone).toBe("attention")
  })

  test("returns 'calm' zone for GREEN items", () => {
    const now = new Date()
    const item = makeItem({
      effectiveDueAt: hoursFromNow(200),
      estimatedMinutes: 60,
    })
    const display = computePriorityDisplay(item, now)
    expect(display.zone).toBe("calm")
  })
})
