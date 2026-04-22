import { describe, expect, test } from "vitest"
import type { Course } from "@student-claw/contracts"
import type { PrioritizedItem } from "../components/dashboard/priority-model"
import {
  classifyAssignmentScope,
  countDueThisWeek,
  filterItemsByScope,
  groupAssignmentsByCourse,
  localDateKey,
} from "../components/dashboard/subject-grouping"

function course(id: string, code: string): Course {
  return { id: id as Course["id"], code, name: `${code} full name` } as Course
}

function item(overrides: Partial<PrioritizedItem>): PrioritizedItem {
  return {
    id: "i1",
    title: "Task",
    courseId: "c-a",
    courseCode: "CS",
    effectiveDueAt: new Date().toISOString(),
    estimatedMinutes: 60,
    impactScore: 0.5,
    coursePriority: 1,
    ...overrides,
  }
}

/** Wed Jun 11 2025 12:00 local — week Mon Jun 9 – Sun Jun 15 */
const ANCHOR = new Date(2025, 5, 11, 12, 0, 0, 0)

describe("subject-grouping", () => {
  test("localDateKey formats YYYY-MM-DD", () => {
    expect(localDateKey(ANCHOR)).toBe("2025-06-11")
  })

  test("classifyAssignmentScope: overdue", () => {
    const it = item({
      id: "o1",
      effectiveDueAt: new Date(2025, 5, 10, 12, 0, 0).toISOString(),
    })
    expect(classifyAssignmentScope(it, ANCHOR)).toBe("overdue")
  })

  test("classifyAssignmentScope: today", () => {
    const it = item({
      id: "t1",
      effectiveDueAt: new Date(2025, 5, 11, 18, 0, 0).toISOString(),
    })
    expect(classifyAssignmentScope(it, ANCHOR)).toBe("today")
  })

  test("classifyAssignmentScope: thisWeek (not today)", () => {
    const it = item({
      id: "w1",
      effectiveDueAt: new Date(2025, 5, 13, 10, 0, 0).toISOString(),
    })
    expect(classifyAssignmentScope(it, ANCHOR)).toBe("thisWeek")
  })

  test("classifyAssignmentScope: upcoming", () => {
    const it = item({
      id: "u1",
      effectiveDueAt: new Date(2025, 5, 20, 10, 0, 0).toISOString(),
    })
    expect(classifyAssignmentScope(it, ANCHOR)).toBe("upcoming")
  })

  test("filterItemsByScope keeps only matching items", () => {
    const items: PrioritizedItem[] = [
      item({ id: "a", effectiveDueAt: new Date(2025, 5, 11, 18, 0, 0).toISOString() }),
      item({ id: "b", effectiveDueAt: new Date(2025, 5, 13, 9, 0, 0).toISOString(), courseId: "c-b" }),
    ]
    const todayOnly = filterItemsByScope(items, "today", ANCHOR)
    expect(todayOnly.map((i) => i.id)).toEqual(["a"])
  })

  test("filterItemsByScope keeps submitted and graded items for submitted filter", () => {
    const items: PrioritizedItem[] = [
      item({ id: "submitted", submissionStatus: "submitted" }),
      item({ id: "graded", submissionStatus: "graded" }),
      item({ id: "pending", submissionStatus: "not_submitted" }),
    ]

    const submittedOnly = filterItemsByScope(items, "submitted", ANCHOR)

    expect(submittedOnly.map((i) => i.id)).toEqual(["submitted", "graded"])
  })

  test("groupAssignmentsByCourse preserves course order and groups", () => {
    const courses = [course("c-a", "AAA"), course("c-b", "BBB")]
    const items: PrioritizedItem[] = [
      item({ id: "x", courseId: "c-b", effectiveDueAt: new Date(2025, 5, 13, 9, 0, 0).toISOString() }),
      item({ id: "y", courseId: "c-a", effectiveDueAt: new Date(2025, 5, 12, 9, 0, 0).toISOString() }),
    ]
    const groups = groupAssignmentsByCourse(courses, items, "thisWeek", ANCHOR)
    expect(groups.map((g) => g.course.id)).toEqual(["c-a", "c-b"])
    expect(groups[0].items.map((i) => i.id)).toEqual(["y"])
    expect(groups[1].items.map((i) => i.id)).toEqual(["x"])
  })

  test("countDueThisWeek excludes overdue", () => {
    const items: PrioritizedItem[] = [
      item({ id: "ok", effectiveDueAt: new Date(2025, 5, 12, 9, 0, 0).toISOString() }),
      item({ id: "bad", effectiveDueAt: new Date(2025, 5, 8, 9, 0, 0).toISOString() }),
    ]
    expect(countDueThisWeek(items, ANCHOR)).toBe(1)
  })
})
