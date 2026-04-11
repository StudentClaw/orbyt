import { beforeEach, describe, expect, test } from "vitest"
import {
  applyCanvasSyncProgressEvent,
  computeStaleness,
  getCourseGrades,
  getCourses,
  getCoursework,
  getCourseworkForCourse,
  getGrades,
  getLastSync,
  getSyncProgress,
  getUpcomingDeadlines,
  resetCanvasStateForTests,
  setCourses,
  setCoursework,
  setGrades,
  setLastSync,
} from "./canvasState"
import type { Course, CourseWorkItem, Grade } from "@student-claw/contracts"

function makeCourse(id: string, name: string): Course {
  return {
    id: id as any,
    name,
    code: name,
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
    freshnessStatus: "fresh",
  }
}

function makeGrade(
  courseId: string,
  assignmentId: string,
  score: number,
  maxScore: number,
): Grade {
  return {
    courseId: courseId as any,
    assignmentId,
    score,
    maxScore,
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

  describe("setCourses / getCourses", () => {
    test("stores and retrieves courses", () => {
      const courses = [makeCourse("c1", "CS 101"), makeCourse("c2", "MATH 240")]
      setCourses(courses)
      expect(getCourses()).toEqual(courses)
    })

    test("returns empty array initially", () => {
      expect(getCourses()).toEqual([])
    })
  })

  describe("setCoursework / getCoursework", () => {
    test("stores and retrieves coursework items", () => {
      const items = [makeItem("i1", "c1", "HW1"), makeItem("i2", "c2", "HW2")]
      setCoursework(items)
      expect(getCoursework()).toEqual(items)
    })
  })

  describe("setGrades / getGrades", () => {
    test("stores and retrieves grades", () => {
      const grades = [makeGrade("c1", "a1", 90, 100)]
      setGrades(grades)
      expect(getGrades()).toEqual(grades)
    })
  })

  describe("applyCanvasSyncProgressEvent", () => {
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

    test("does not set lastSync when status is syncing", () => {
      applyCanvasSyncProgressEvent({
        courseId: "c1",
        progress: 50,
        status: "syncing",
      })
      expect(getLastSync()).toBeNull()
    })
  })

  describe("computeStaleness", () => {
    test("returns 'offline' when lastSyncAt is null", () => {
      expect(computeStaleness(null)).toBe("offline")
    })

    test("returns 'fresh' when sync was recent", () => {
      const recent = new Date().toISOString()
      expect(computeStaleness(recent)).toBe("fresh")
    })

    test("returns 'stale' when sync was over 24 hours ago", () => {
      const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
      expect(computeStaleness(old)).toBe("stale")
    })

    test("returns 'fresh' at exactly 24 hours", () => {
      const exactly24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      expect(computeStaleness(exactly24h)).toBe("fresh")
    })
  })

  describe("getCourseGrades", () => {
    test("filters grades by courseId", () => {
      const grades = [
        makeGrade("c1", "a1", 90, 100),
        makeGrade("c2", "a1", 80, 100),
        makeGrade("c1", "a2", 85, 100),
      ]
      expect(getCourseGrades(grades, "c1")).toHaveLength(2)
      expect(getCourseGrades(grades, "c2")).toHaveLength(1)
      expect(getCourseGrades(grades, "c3")).toHaveLength(0)
    })
  })

  describe("getCourseworkForCourse", () => {
    test("filters coursework by courseId", () => {
      const items = [
        makeItem("i1", "c1", "HW1"),
        makeItem("i2", "c2", "HW2"),
        makeItem("i3", "c1", "HW3"),
      ]
      expect(getCourseworkForCourse(items, "c1")).toHaveLength(2)
      expect(getCourseworkForCourse(items, "c2")).toHaveLength(1)
    })
  })

  describe("getUpcomingDeadlines", () => {
    test("filters items within the window and sorts by due date", () => {
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

    test("returns empty for no items with due dates in window", () => {
      const items = [
        makeItem("i1", "c1", "No due date"),
        makeItem("i2", "c1", "Far away", daysFromNow(30)),
      ]
      expect(getUpcomingDeadlines(items, 14)).toHaveLength(0)
    })

    test("excludes past-due items", () => {
      const pastDue = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const items = [makeItem("i1", "c1", "Past due", pastDue)]
      expect(getUpcomingDeadlines(items, 14)).toHaveLength(0)
    })
  })

  describe("resetCanvasStateForTests", () => {
    test("clears all atoms to initial values", () => {
      setCourses([makeCourse("c1", "CS 101")])
      setCoursework([makeItem("i1", "c1", "HW1")])
      setGrades([makeGrade("c1", "a1", 90, 100)])
      setLastSync(new Date().toISOString())
      applyCanvasSyncProgressEvent({ courseId: "c1", progress: 100, status: "done" })

      resetCanvasStateForTests()

      expect(getCourses()).toEqual([])
      expect(getCoursework()).toEqual([])
      expect(getGrades()).toEqual([])
      expect(getLastSync()).toBeNull()
      expect(getSyncProgress()).toBeNull()
    })
  })
})
