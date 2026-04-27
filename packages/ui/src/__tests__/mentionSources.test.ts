import { describe, expect, test } from "vitest"
import type { Course, CourseWorkItem } from "@orbyt/contracts"
import { priorityAssignmentEntriesFromCanvasState } from "@/lib/mentionSources"

function course(id: string, code: string): Course {
  return {
    id,
    name: code,
    code,
    color: "#000000",
  } as unknown as Course
}

function assignment(input: {
  id: string
  courseId?: string
  title: string
  due?: string
  urlId?: string
}): CourseWorkItem {
  const courseId = input.courseId ?? "1"
  const urlId = input.urlId ?? input.id
  return {
    id: input.id,
    courseId,
    title: input.title,
    effectiveDueAt: input.due,
    sourceType: "assignment",
    sourceId: urlId,
    freshnessStatus: "fresh",
    htmlUrl: `https://canvas.example.edu/courses/${courseId}/assignments/${urlId}`,
  } as unknown as CourseWorkItem
}

function pageReading(input: {
  id: string
  courseId?: string
  title: string
  due?: string
  sourceId?: string
}): CourseWorkItem {
  const courseId = input.courseId ?? "2"
  const sourceId = input.sourceId ?? "readings"
  return {
    id: input.id,
    courseId,
    title: input.title,
    effectiveDueAt: input.due,
    sourceType: "page",
    sourceId,
    freshnessStatus: "fresh",
    htmlUrl: `https://canvas.example.edu/courses/${courseId}/pages/${sourceId}`,
  } as unknown as CourseWorkItem
}

describe("mention assignment sources", () => {
  test("orders active assignments by priority before submitted work", () => {
    const entries = priorityAssignmentEntriesFromCanvasState(
      {
        upcoming: [
          assignment({ id: "upcoming-later", title: "Later Project", due: "2026-05-20T12:00:00.000Z", urlId: "104" }),
          assignment({ id: "upcoming-soon", title: "Soon Quiz", due: "2026-05-01T12:00:00.000Z", urlId: "103" }),
        ],
        pending: [
          assignment({ id: "pending", title: "Pending Lab", due: "2026-04-29T12:00:00.000Z", urlId: "102" }),
        ],
        overdue: [
          assignment({ id: "overdue", title: "Overdue Essay", due: "2026-04-20T12:00:00.000Z", urlId: "101" }),
        ],
        submitted: [
          assignment({ id: "submitted", title: "Submitted Discussion", due: "2026-04-25T12:00:00.000Z", urlId: "105" }),
        ],
      },
      [course("1", "BIO 101")],
    )

    expect(entries.map((entry) => entry.label)).toEqual([
      "Overdue Essay",
      "Pending Lab",
      "Soon Quiz",
      "Later Project",
      "Submitted Discussion",
    ])
  })

  test("dedupes assignments that appear in more than one Canvas bucket", () => {
    const duplicate = assignment({ id: "same-local-id", title: "Shared Assignment", urlId: "123" })
    const entries = priorityAssignmentEntriesFromCanvasState(
      {
        overdue: [duplicate],
        pending: [duplicate],
        upcoming: [],
        submitted: [],
      },
      [course("1", "BIO 101")],
    )

    expect(entries).toHaveLength(1)
    expect(entries[0]?.label).toBe("Shared Assignment")
  })

  test("includes inferred page readings as Canvas coursework mentions", () => {
    const entries = priorityAssignmentEntriesFromCanvasState(
      {
        overdue: [],
        pending: [],
        upcoming: [
          pageReading({
            id: "reading",
            title: "Read: Folktale and Myth",
            sourceId: "module-16-readings",
          }),
        ],
        submitted: [],
      },
      [course("2", "HUM50")],
    )

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      id: "canvas-coursework:page:2:module-16-readings",
      label: "Read: Folktale and Myth",
      referenceKind: "canvas-coursework",
      sourceType: "page",
      courseCode: "HUM50",
    })
  })
})
