import { describe, expect, test } from "bun:test"
import { normalizeAnnouncement, normalizeAnnouncementCoursework } from "./normalizers/announcements.js"
import { normalizeAssignment, normalizeCourse, normalizeGrade } from "./normalizers/assignments.js"

describe("Canvas normalizers", () => {
  test("normalizes courses, assignments, grades, and announcements to shared contracts", () => {
    const rawCourse = {
      id: 42,
      name: "Linear Algebra",
      course_code: "MATH221",
      teachers: [{ id: 7, name: "Dr. Noether" }],
      term: { id: 1, name: "Spring 2026" },
      updated_at: "2026-04-10T12:00:00Z",
    }

    const course = normalizeCourse(rawCourse)
    const assignment = normalizeAssignment(
      {
        id: 101,
        course_id: 42,
        name: "Problem Set 4",
        description: "<p>Show your work.</p>",
        due_at: "2026-04-15T23:59:00Z",
        points_possible: 20,
        html_url: "https://canvas.example.edu/courses/42/assignments/101",
        graded_submissions_exist: true,
      },
      rawCourse,
      {
        assignment_id: 101,
        course_id: 42,
        score: 18,
        grade: "A-",
        workflow_state: "graded",
        posted_at: "2026-04-10T12:30:00Z",
      },
    )
    const grade = normalizeGrade(
      rawCourse,
      {
        id: 101,
        course_id: 42,
        name: "Problem Set 4",
        points_possible: 20,
      },
      {
        assignment_id: 101,
        course_id: 42,
        score: 18,
        grade: "A-",
        posted_at: "2026-04-10T12:30:00Z",
      },
    )
    const announcement = normalizeAnnouncement(
      {
        id: 5,
        context_code: "course_42",
        title: "Quiz moved",
        message: "<p>The quiz moved to Friday.</p>",
        posted_at: "2026-04-10T09:00:00Z",
        attachments: [],
      },
      rawCourse,
    )
    const announcementWork = normalizeAnnouncementCoursework(
      {
        id: 5,
        context_code: "course_42",
        title: "Quiz moved",
        message: "<p>The quiz moved to Friday.</p>",
        posted_at: "2026-04-10T09:00:00Z",
        attachments: [],
      },
      rawCourse,
    )

    expect(course.professor).toBe("Dr. Noether")
    expect(assignment.description).toBe("Show your work.")
    expect(grade?.score).toBe(18)
    expect(announcement.body).toContain("Friday")
    expect(announcementWork.sourceType).toBe("announcement")
  })
})
