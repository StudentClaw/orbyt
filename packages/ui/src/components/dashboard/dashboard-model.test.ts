import { describe, expect, test } from "vitest"
import {
  computeGradeTrend,
  computeCourseGradePercentage,
  computeUrgencyZone,
  formatCountdown,
  groupDeadlinesByDay,
} from "./dashboard-model"
import type { CanvasStudentCourseGradeSummary, Course, CourseWorkItem } from "@student-claw/contracts"

function makeCourse(id: string, code = "CS 101"): Course {
  return {
    id: id as any,
    code,
    name: code,
  }
}

function makeGradeSummary(
  courseId: string,
  currentScore?: number,
  finalScore?: number,
): CanvasStudentCourseGradeSummary {
  return {
    course: makeCourse(courseId, courseId.toUpperCase()),
    currentScore,
    finalScore,
    currentGrade: undefined,
    finalGrade: undefined,
  }
}

function makeItem(
  id: string,
  courseId: string,
  title: string,
  dueAt?: string,
): CourseWorkItem {
  return {
    id: id as any,
    courseId: courseId as any,
    title,
    effectiveDueAt: dueAt,
    sourceType: "assignment",
    sourceId: "mock-source-id",
    freshnessStatus: "fresh",
  }
}

function daysFromNow(days: number, from: Date = new Date()): string {
  const d = new Date(from.getTime() + days * 24 * 60 * 60 * 1000)
  return d.toISOString()
}

describe("computeGradeTrend", () => {
  test("returns 'up' when weighted grade movement exceeds +1%", () => {
    const grades = [makeGradeSummary("c1", 80, 95)]
    expect(computeGradeTrend(grades, "c1")).toBe("up")
  })

  test("returns 'down' when weighted grade movement is below -1%", () => {
    const grades = [makeGradeSummary("c1", 95, 75)]
    expect(computeGradeTrend(grades, "c1")).toBe("down")
  })

  test("returns 'stable' when movement is within ±1%", () => {
    const grades = [makeGradeSummary("c1", 85, 85.5)]
    expect(computeGradeTrend(grades, "c1")).toBe("stable")
  })

  test("returns 'stable' without both current and final scores", () => {
    const grades = [makeGradeSummary("c1", 90)]
    expect(computeGradeTrend(grades, "c1")).toBe("stable")
  })

  test("only considers grades for the specified course", () => {
    const grades = [
      makeGradeSummary("c1", 80, 95),
      makeGradeSummary("c2", 95, 60),
    ]
    expect(computeGradeTrend(grades, "c1")).toBe("up")
    expect(computeGradeTrend(grades, "c2")).toBe("down")
  })
})

describe("computeCourseGradePercentage", () => {
  test("uses current score when present", () => {
    const grades = [makeGradeSummary("c1", 86.67, 88)]
    expect(computeCourseGradePercentage(grades, "c1")).toBeCloseTo(86.67, 1)
  })

  test("returns 0 for no grades", () => {
    expect(computeCourseGradePercentage([], "c1")).toBe(0)
  })

  test("only considers grades for the specified course", () => {
    const grades = [
      makeGradeSummary("c1", 90),
      makeGradeSummary("c2", 50),
    ]
    expect(computeCourseGradePercentage(grades, "c1")).toBeCloseTo(90, 1)
  })
})

describe("computeUrgencyZone", () => {
  test("returns 'overdue' for past-due items", () => {
    const now = new Date()
    const item = makeItem("i1", "c1", "HW", new Date(now.getTime() - 60 * 1000).toISOString())
    expect(computeUrgencyZone(item, now)).toBe("overdue")
  })

  test("returns 'urgent' for items due within 1-2 days", () => {
    const now = new Date()
    const item = makeItem("i1", "c1", "HW", daysFromNow(1, now))
    expect(computeUrgencyZone(item, now)).toBe("urgent")
  })

  test("returns 'attention' for items due within 3-6 days", () => {
    const now = new Date()
    const item = makeItem("i1", "c1", "HW", daysFromNow(4, now))
    expect(computeUrgencyZone(item, now)).toBe("attention")
  })

  test("returns 'calm' for items due in 7+ days", () => {
    const now = new Date()
    const item = makeItem("i1", "c1", "HW", daysFromNow(10, now))
    expect(computeUrgencyZone(item, now)).toBe("calm")
  })

  test("returns 'calm' for items with no due date", () => {
    const now = new Date()
    const item = makeItem("i1", "c1", "HW")
    expect(computeUrgencyZone(item, now)).toBe("calm")
  })
})

describe("formatCountdown", () => {
  test("returns 'Overdue' for past dates", () => {
    const now = new Date()
    const past = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    expect(formatCountdown(past, now)).toBe("Overdue")
  })

  test("returns hours when less than 24 hours", () => {
    const now = new Date()
    const soon = new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString()
    expect(formatCountdown(soon, now)).toBe("5 hours")
  })

  test("returns '1 hour' for singular", () => {
    const now = new Date()
    const soon = new Date(now.getTime() + 1.5 * 60 * 60 * 1000).toISOString()
    expect(formatCountdown(soon, now)).toBe("1 hour")
  })

  test("returns days when 1+ days away", () => {
    const now = new Date()
    const later = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatCountdown(later, now)).toBe("3 days")
  })

  test("returns '1 day' for singular", () => {
    const now = new Date()
    const later = new Date(now.getTime() + 1.5 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatCountdown(later, now)).toBe("1 day")
  })
})

describe("groupDeadlinesByDay", () => {
  test("groups items by their due date string", () => {
    const now = new Date()
    const items = [
      makeItem("i1", "c1", "HW1", daysFromNow(1, now)),
      makeItem("i2", "c1", "HW2", daysFromNow(1, now)),
      makeItem("i3", "c1", "HW3", daysFromNow(3, now)),
    ]
    const grouped = groupDeadlinesByDay(items, 14, now)
    const keys = Array.from(grouped.keys())
    expect(keys.length).toBeGreaterThanOrEqual(2)

    // The day with 2 items should have 2 entries
    const dayWithTwo = Array.from(grouped.values()).find((v) => v.length === 2)
    expect(dayWithTwo).toBeDefined()
  })

  test("caps at the specified window", () => {
    const now = new Date()
    const items = [
      makeItem("i1", "c1", "HW1", daysFromNow(1, now)),
      makeItem("i2", "c1", "HW2", daysFromNow(20, now)),
    ]
    const grouped = groupDeadlinesByDay(items, 14, now)
    const totalItems = Array.from(grouped.values()).reduce((sum, v) => sum + v.length, 0)
    expect(totalItems).toBe(1)
  })

  test("returns empty map for no items", () => {
    const grouped = groupDeadlinesByDay([], 14)
    expect(grouped.size).toBe(0)
  })
})
