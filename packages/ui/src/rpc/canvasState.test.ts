import { beforeEach, describe, expect, test } from "vitest"
import type {
  CanvasStudentCourseGradeSummary,
  CanvasStudentPeerReviewTodo,
  CanvasStudentTodoItem,
  Course,
  CourseWorkItem,
} from "@student-claw/contracts"
import {
  applyCanvasSyncProgressEvent,
  computeStaleness,
  getAssignmentsForCourse,
  getCourseGrades,
  getCourses,
  getLastSync,
  getPeerReviewTodo,
  getSubmissionStatus,
  getSyncProgress,
  getTodoItems,
  getUpcomingAssignments,
  getUpcomingDeadlines,
  resetCanvasStateForTests,
  setCourseGrades,
  setCourses,
  setLastSync,
  setPeerReviewTodo,
  setSubmissionStatus,
  setTodoItems,
  setUpcomingAssignments,
} from "./canvasState"

function makeCourse(id: string, name: string): Course {
  return {
    id: id as any,
    name,
    code: name,
  }
}

function makeItem(id: string, courseId: string, title: string, dueAt?: string): CourseWorkItem {
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

function makeCourseGradeSummary(course: Course, score?: number): CanvasStudentCourseGradeSummary {
  return {
    course,
    currentScore: score,
    currentGrade: undefined,
    finalScore: undefined,
    finalGrade: undefined,
  }
}

function makeTodoItem(title: string): CanvasStudentTodoItem {
  return {
    title,
    type: "assignment",
    dueAt: undefined,
    htmlUrl: undefined,
    courseId: undefined,
  }
}

function makePeerReviewTodo(courseId: string, assignmentId: string): CanvasStudentPeerReviewTodo {
  return {
    courseId: courseId as any,
    assignmentId,
    assignmentName: "Peer review",
    revieweeUserId: undefined,
    assessorUserId: undefined,
    workflowState: undefined,
  }
}

function daysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

describe("canvasState", () => {
  beforeEach(() => {
    resetCanvasStateForTests()
  })

  test("stores and retrieves courses", () => {
    const courses = [makeCourse("c1", "CS 101"), makeCourse("c2", "MATH 240")]
    setCourses(courses)
    expect(getCourses()).toEqual(courses)
  })

  test("stores and retrieves upcoming assignments", () => {
    const items = [makeItem("i1", "c1", "HW1"), makeItem("i2", "c2", "HW2")]
    setUpcomingAssignments(items)
    expect(getUpcomingAssignments()).toEqual(items)
  })

  test("stores and retrieves submission status buckets", () => {
    const status = {
      submitted: [makeItem("i1", "c1", "Done")],
      pending: [makeItem("i2", "c1", "Soon")],
      overdue: [makeItem("i3", "c1", "Late")],
    }
    setSubmissionStatus(status)
    expect(getSubmissionStatus()).toEqual(status)
  })

  test("stores and retrieves course grade summaries", () => {
    const grades = [makeCourseGradeSummary(makeCourse("c1", "CS 101"), 92)]
    setCourseGrades(grades)
    expect(getCourseGrades()).toEqual(grades)
  })

  test("stores and retrieves todo items", () => {
    const items = [makeTodoItem("Read chapter 1")]
    setTodoItems(items)
    expect(getTodoItems()).toEqual(items)
  })

  test("stores and retrieves peer review todo", () => {
    const items = [makePeerReviewTodo("c1", "a1")]
    setPeerReviewTodo(items)
    expect(getPeerReviewTodo()).toEqual(items)
  })

  test("updates sync progress atom", () => {
    applyCanvasSyncProgressEvent({
      courseId: "c1",
      progress: 50,
      status: "syncing",
    })
    expect(getSyncProgress()).toEqual({
      courseId: "c1",
      progress: 50,
      status: "syncing",
    })
  })

  test("sets lastSync when status is done", () => {
    expect(getLastSync()).toBeNull()
    applyCanvasSyncProgressEvent({
      courseId: "c1",
      progress: 100,
      status: "done",
    })
    expect(getLastSync()).not.toBeNull()
  })

  test("returns offline/fresh/stale staleness states", () => {
    expect(computeStaleness(null)).toBe("offline")
    expect(computeStaleness(new Date().toISOString())).toBe("fresh")
    expect(computeStaleness(new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString())).toBe("stale")
  })

  test("filters assignments by course", () => {
    const items = [
      makeItem("i1", "c1", "HW1"),
      makeItem("i2", "c2", "HW2"),
      makeItem("i3", "c1", "HW3"),
    ]
    expect(getAssignmentsForCourse(items, "c1")).toHaveLength(2)
    expect(getAssignmentsForCourse(items, "c2")).toHaveLength(1)
  })

  test("filters upcoming deadlines by window and sorts by due date", () => {
    const now = new Date()
    const items = [
      makeItem("i1", "c1", "Due in 5 days", daysFromNow(5)),
      makeItem("i2", "c1", "Due in 1 day", daysFromNow(1)),
      makeItem("i3", "c1", "Due in 3 days", daysFromNow(3)),
      makeItem("i4", "c1", "Due in 20 days", daysFromNow(20)),
      makeItem("i5", "c1", "No due date"),
    ]
    const upcoming = getUpcomingDeadlines(items, 14, now)
    expect(upcoming).toHaveLength(3)
    expect(upcoming[0].title).toBe("Due in 1 day")
    expect(upcoming[1].title).toBe("Due in 3 days")
    expect(upcoming[2].title).toBe("Due in 5 days")
  })

  test("resetCanvasStateForTests clears all atoms", () => {
    setCourses([makeCourse("c1", "CS 101")])
    setUpcomingAssignments([makeItem("i1", "c1", "HW1")])
    setSubmissionStatus({
      submitted: [],
      pending: [makeItem("i2", "c1", "HW2")],
      overdue: [],
    })
    setCourseGrades([makeCourseGradeSummary(makeCourse("c1", "CS 101"), 90)])
    setTodoItems([makeTodoItem("Read")])
    setPeerReviewTodo([makePeerReviewTodo("c1", "a1")])
    setLastSync(new Date().toISOString())
    applyCanvasSyncProgressEvent({ courseId: "c1", progress: 100, status: "done" })

    resetCanvasStateForTests()

    expect(getCourses()).toEqual([])
    expect(getUpcomingAssignments()).toEqual([])
    expect(getSubmissionStatus()).toEqual({ submitted: [], pending: [], overdue: [] })
    expect(getCourseGrades()).toEqual([])
    expect(getTodoItems()).toEqual([])
    expect(getPeerReviewTodo()).toEqual([])
    expect(getLastSync()).toBeNull()
    expect(getSyncProgress()).toBeNull()
  })
})
