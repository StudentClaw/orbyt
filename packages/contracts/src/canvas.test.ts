import { describe, expect, test } from "bun:test"
import { Schema } from "@effect/schema"
import {
  Announcement,
  CanvasAnnouncement,
  CanvasAssignmentDetailsResult,
  CanvasChangeEvent,
  CanvasCourse,
  CanvasCourseworkDetail,
  CanvasCourseStructureResult,
  CanvasDownloadCourseFileResult,
  CanvasEnrollment,
  CanvasGetAssignmentDetails,
  CanvasGetCourseContentOverview,
  CanvasGetMyCourseGrades,
  CanvasGetMyPeerReviewsTodo,
  CanvasGetMySubmissionStatus,
  CanvasGetMyTodoItems,
  CanvasGetMyUpcomingAssignments,
  CanvasGetMyUpcomingAssignmentsResult,
  CanvasGetMySubmissionStatusResult,
  CanvasGetMyCourseGradesResult,
  CanvasGetMyTodoItemsResult,
  CanvasGetMyPeerReviewsTodoResult,
  CanvasListAssignments,
  CanvasListAssignmentsResult,
  CanvasListCourses,
  CanvasListCoursesResult,
  CanvasStudentCourseGradeSummary,
  CanvasStudentTodoItem,
  CanvasSyncProgress,
  CanvasSyncState,
  CanvasSubmission,
  CanvasCourseContentOverviewResult,
  CanvasCourseStructureResult,
  CanvasDownloadCourseFileResult,
  CanvasModule,
  CanvasModuleItem,
  CanvasPage,
  CourseWorkItem,
} from "./index.js"

describe("canvas contracts", () => {
  test("decodes representative raw Canvas payloads", () => {
    const course = Schema.decodeUnknownSync(CanvasCourse)({
      id: 42,
      name: "Biology 101",
      course_code: "BIO101",
      workflow_state: "available",
      enrollment_term_id: 9,
      term: {
        id: 9,
        name: "Spring 2026",
        start_at: "2026-01-10T00:00:00Z",
        end_at: "2026-05-15T00:00:00Z",
      },
      teachers: [{ id: 7, name: "Dr. Ada Lovelace", short_name: "Ada Lovelace" }],
      updated_at: "2026-04-09T12:00:00Z",
    })

    const assignment = Schema.decodeUnknownSync(CanvasSubmission)({
      id: 501,
      assignment_id: 101,
      course_id: 42,
      user_id: 99,
      score: 18,
      grade: "18",
      submitted_at: "2026-04-08T12:00:00Z",
      workflow_state: "graded",
      late: false,
      missing: false,
      excused: false,
      attempt: 1,
      posted_at: "2026-04-09T12:00:00Z",
      html_url: "https://canvas.example.edu/courses/42/assignments/101/submissions/99",
    })

    const module = Schema.decodeUnknownSync(CanvasModule)({
      id: 5,
      name: "Week 3",
      position: 1,
      require_sequential_progress: false,
      published: true,
      items_count: 1,
      items_url: "https://canvas.example.edu/api/v1/courses/42/modules/5/items",
      state: "active",
      prerequisite_module_ids: [1],
      completion_requirements: [{ type: "must_view", completed: false }],
    })

    const moduleItem = Schema.decodeUnknownSync(CanvasModuleItem)({
      id: 768,
      module_id: 5,
      position: 1,
      title: "Square Roots",
      indent: 0,
      type: "Assignment",
      content_id: 101,
      html_url: "https://canvas.example.edu/courses/42/modules/items/768",
      url: "https://canvas.example.edu/api/v1/courses/42/assignments/101",
      published: true,
      completion_requirement: { type: "must_submit", completed: false },
    })

    const page = Schema.decodeUnknownSync(CanvasPage)({
      page_id: 7,
      url: "study-guide",
      title: "Study Guide",
      body: "<p>Review notes</p>",
      published: true,
      front_page: false,
      created_at: "2026-04-01T12:00:00Z",
      updated_at: "2026-04-09T12:00:00Z",
      html_url: "https://canvas.example.edu/courses/42/pages/study-guide",
    })

    const announcement = Schema.decodeUnknownSync(CanvasAnnouncement)({
      id: 15,
      context_code: "course_42",
      title: "Lab canceled",
      message: "No lab this week.",
      posted_at: "2026-04-09T10:00:00Z",
      created_at: "2026-04-09T09:30:00Z",
      updated_at: "2026-04-09T09:45:00Z",
      html_url: "https://canvas.example.edu/courses/42/discussion_topics/15",
      attachments: [
        {
          id: 9,
          display_name: "schedule.pdf",
          filename: "schedule.pdf",
          content_type: "application/pdf",
          url: "https://canvas.example.edu/files/9/download",
          size: 1234,
        },
      ],
    })

    const enrollment = Schema.decodeUnknownSync(CanvasEnrollment)({
      id: 88,
      course_id: 42,
      user_id: 99,
      type: "StudentEnrollment",
      role: "StudentEnrollment",
      enrollment_state: "active",
      grades: {
        current_score: 91.2,
        final_score: 92.5,
        current_grade: "A-",
        final_grade: "A-",
        grading_period_id: 1,
        html_url: "https://canvas.example.edu/courses/42/grades",
      },
      computed_current_score: 91.2,
      computed_final_score: 92.5,
      computed_current_grade: "A-",
      computed_final_grade: "A-",
    })

    expect(course.course_code).toBe("BIO101")
    expect(assignment.grade).toBe("18")
    expect(moduleItem.type).toBe("Assignment")
    expect(page.title).toBe("Study Guide")
    expect(announcement.attachments[0].filename).toBe("schedule.pdf")
    expect(enrollment.grades?.current_grade).toBe("A-")
  })

  test("accepts sparse Canvas course payloads", () => {
    const course = Schema.decodeUnknownSync(CanvasCourse)({
      id: 7,
      name: "English Composition",
      course_code: null,
      workflow_state: null,
      account_id: null,
      enrollment_term_id: null,
      term: null,
      teacher: null,
      teachers: null,
      uuid: null,
    })

    expect(course.course_code).toBeNull()
    expect(course.term).toBeNull()
    expect(course.teachers).toBeNull()
  })

  test("accepts teacher payloads that use display_name instead of name", () => {
    const course = Schema.decodeUnknownSync(CanvasCourse)({
      id: 42,
      name: "Biology 101",
      teachers: [{
        id: 121,
        display_name: "Michael Salviani",
        avatar_image_url: "https://canvas.example.edu/avatar.png",
      }],
    })

    expect(course.teachers?.[0]?.display_name).toBe("Michael Salviani")
    expect(course.teachers?.[0]?.name).toBeUndefined()
  })

  test("decodes normalized Canvas domain types", () => {
    const item = Schema.decodeUnknownSync(CourseWorkItem)({
      id: "cw_101",
      courseId: "course_42",
      title: "Problem Set 3",
      description: "Solve the optimization exercises.",
      effectiveDueAt: "2026-04-12T23:59:00Z",
      sourceType: "assignment",
      sourceId: "101",
      sourceDueDateKind: "assignment_due_at",
      freshnessStatus: "fresh",
      cachedAt: "2026-04-09T12:00:00Z",
      lastVerifiedAt: "2026-04-09T12:05:00Z",
      sourceUpdatedAt: "2026-04-09T11:00:00Z",
      htmlUrl: "https://canvas.example.edu/courses/42/assignments/101",
      pointsPossible: 20,
      submissionStatus: "submitted",
      grade: "18/20",
    })

    const normalizedAnnouncement = Schema.decodeUnknownSync(Announcement)({
      id: "ann_15",
      courseId: "course_42",
      title: "Lab canceled",
      body: "No lab this week.",
      postedAt: "2026-04-09T10:00:00Z",
      updatedAt: "2026-04-09T09:45:00Z",
      contextCode: "course_42",
      htmlUrl: "https://canvas.example.edu/courses/42/discussion_topics/15",
      attachments: [
        {
          id: "9",
          filename: "schedule.pdf",
          displayName: "schedule.pdf",
          contentType: "application/pdf",
          url: "https://canvas.example.edu/files/9/download",
          size: 1234,
        },
      ],
    })

    const state = Schema.decodeUnknownSync(CanvasSyncState)({
      status: "syncing",
      progress: 0.5,
      lastSyncAt: "2026-04-09T12:00:00Z",
      nextSyncAt: "2026-04-09T12:15:00Z",
      staleAt: "2026-04-10T00:00:00Z",
      message: "Refreshing Canvas data",
    })

    const change = Schema.decodeUnknownSync(CanvasChangeEvent)({
      type: "announcement.posted",
      courseId: "course_42",
      announcement: normalizedAnnouncement,
      detectedAt: "2026-04-09T10:01:00Z",
    })

    const detail = Schema.decodeUnknownSync(CanvasCourseworkDetail)({
      item,
      source: {
        id: 101,
        course_id: 42,
        name: "Problem Set 3",
        description: "Solve the optimization exercises.",
        due_at: "2026-04-12T23:59:00Z",
        points_possible: 20,
        submission_types: ["online_upload"],
        published: true,
        html_url: "https://canvas.example.edu/courses/42/assignments/101",
      },
      submission: {
        assignment_id: 101,
        course_id: 42,
        score: 18,
        grade: "18",
        submitted_at: "2026-04-08T12:00:00Z",
      },
      grade: {
        courseId: "course_42",
        assignmentId: "101",
        score: 18,
        maxScore: 20,
        letterGrade: "A-",
        postedAt: "2026-04-09T12:00:00Z",
      },
    })

    expect(item.sourceDueDateKind).toBe("assignment_due_at")
    expect(normalizedAnnouncement.attachments).toHaveLength(1)
    expect(state.status).toBe("syncing")
    expect(change.type).toBe("announcement.posted")
    expect(detail.item.title).toBe("Problem Set 3")
  })

  test("decodes Canvas protocol messages and events", () => {
    const listCourses = Schema.decodeUnknownSync(CanvasListCourses)({
      method: "canvas.listCourses",
      id: "req-1",
      params: {},
    })

    const upcoming = Schema.decodeUnknownSync(CanvasGetMyUpcomingAssignments)({
      method: "canvas.getMyUpcomingAssignments",
      id: "req-2",
      params: {
        days: 14,
      },
    })

    const submissionStatus = Schema.decodeUnknownSync(CanvasGetMySubmissionStatus)({
      method: "canvas.getMySubmissionStatus",
      id: "req-3",
      params: {
        courseId: "course_42",
      },
    })

    const grades = Schema.decodeUnknownSync(CanvasGetMyCourseGrades)({
      method: "canvas.getMyCourseGrades",
      id: "req-4",
      params: {},
    })

    const todoItems = Schema.decodeUnknownSync(CanvasGetMyTodoItems)({
      method: "canvas.getMyTodoItems",
      id: "req-5",
      params: {},
    })

    const peerReviews = Schema.decodeUnknownSync(CanvasGetMyPeerReviewsTodo)({
      method: "canvas.getMyPeerReviewsTodo",
      id: "req-6",
      params: {
        courseId: "course_42",
      },
    })

    const assignments = Schema.decodeUnknownSync(CanvasListAssignments)({
      method: "canvas.listAssignments",
      id: "req-7",
      params: {
        courseId: "course_42",
        includeCompleted: false,
      },
    })

    const overview = Schema.decodeUnknownSync(CanvasGetCourseContentOverview)({
      method: "canvas.getCourseContentOverview",
      id: "req-8",
      params: {
        courseId: "course_42",
      },
    })

    const detail = Schema.decodeUnknownSync(CanvasGetAssignmentDetails)({
      method: "canvas.getAssignmentDetails",
      id: "req-9",
      params: {
        assignmentUrl: "https://canvas.example.edu/courses/42/assignments/101",
      },
    })

    const syncProgress = Schema.decodeUnknownSync(CanvasSyncProgress)({
      event: "canvas.syncProgress",
      data: {
        courseId: "course_42",
        progress: 0.75,
        status: "syncing",
        message: "Fetching assignments",
      },
    })

    expect(listCourses.method).toBe("canvas.listCourses")
    expect(upcoming.params.days).toBe(14)
    expect(submissionStatus.params.courseId).toBe("course_42")
    expect(grades.method).toBe("canvas.getMyCourseGrades")
    expect(todoItems.method).toBe("canvas.getMyTodoItems")
    expect(peerReviews.params.courseId).toBe("course_42")
    expect(assignments.params.includeCompleted).toBe(false)
    expect(overview.params.courseId).toBe("course_42")
    expect(detail.params.assignmentUrl).toContain("/assignments/101")
    expect(syncProgress.data.progress).toBe(0.75)
  })

  test("decodes student-first Canvas runtime result shapes", () => {
    const course = {
      id: "course_42",
      name: "Biology 101",
      code: "BIO101",
      professor: "Dr. Ada Lovelace",
      canvasId: "42",
      term: "Spring 2026",
      lastSyncAt: "2026-04-09T12:00:00Z",
    }

    const item = {
      id: "cw_101",
      courseId: "course_42",
      title: "Problem Set 3",
      effectiveDueAt: "2026-04-12T23:59:00Z",
      sourceType: "assignment",
      sourceId: "101",
      freshnessStatus: "fresh",
      htmlUrl: "https://canvas.example.edu/courses/42/assignments/101",
      pointsPossible: 20,
      submissionStatus: "submitted",
      grade: "18/20",
    }

    const listCourses = Schema.decodeUnknownSync(CanvasListCoursesResult)({
      courses: [course],
    })

    const upcoming = Schema.decodeUnknownSync(CanvasGetMyUpcomingAssignmentsResult)({
      items: [item],
    })

    const submissionStatus = Schema.decodeUnknownSync(CanvasGetMySubmissionStatusResult)({
      submitted: [item],
      pending: [],
      overdue: [],
    })

    const grades = Schema.decodeUnknownSync(CanvasGetMyCourseGradesResult)({
      courses: [
        {
          course,
          currentScore: 91.2,
          currentGrade: "A-",
          finalScore: 92.5,
          finalGrade: "A-",
        } satisfies CanvasStudentCourseGradeSummary,
      ],
    })

    const todo = Schema.decodeUnknownSync(CanvasGetMyTodoItemsResult)({
      items: [
        {
          courseId: "course_42",
          title: "Read chapter 6",
          type: "assignment",
          dueAt: "2026-04-10T10:00:00Z",
          htmlUrl: "https://canvas.example.edu/courses/42/assignments/102",
        } satisfies CanvasStudentTodoItem,
      ],
    })

    const peerReviews = Schema.decodeUnknownSync(CanvasGetMyPeerReviewsTodoResult)({
      items: [{
        courseId: "course_42",
        assignmentId: "101",
        assignmentName: "Problem Set 3",
        workflowState: "assigned",
      }],
    })

    const assignments = Schema.decodeUnknownSync(CanvasListAssignmentsResult)({
      course,
      items: [item],
    })

    const overview = Schema.decodeUnknownSync(CanvasCourseContentOverviewResult)({
      course,
      pageCount: 2,
      moduleCount: 1,
      moduleItemCount: 3,
      frontPage: undefined,
    })

    const detail = Schema.decodeUnknownSync(CanvasAssignmentDetailsResult)({
      course,
      item,
      source: {
        id: 101,
        course_id: 42,
        name: "Problem Set 3",
        due_at: "2026-04-12T23:59:00Z",
        points_possible: 20,
        submission_types: ["online_upload"],
        published: true,
      },
      grade: {
        courseId: "course_42",
        assignmentId: "101",
        score: 18,
        maxScore: 20,
        letterGrade: "A-",
      },
    })

    const structure = Schema.decodeUnknownSync(CanvasCourseStructureResult)({
      course,
      modules: [
        {
          module: {
            id: 5,
            name: "Week 3",
            position: 1,
            require_sequential_progress: false,
            published: true,
            items_count: 1,
            items_url: "https://canvas.example.edu/api/v1/courses/42/modules/5/items",
          },
          items: [
            {
              id: 768,
              module_id: 5,
              position: 1,
              title: "Square Roots",
              type: "Assignment",
              content_id: 101,
              html_url: "https://canvas.example.edu/courses/42/modules/items/768",
            },
          ],
        },
      ],
    })

    const download = Schema.decodeUnknownSync(CanvasDownloadCourseFileResult)({
      success: true,
      courseId: "course_42",
      fileId: "file_1",
      filename: "linkedlist.c",
      savedPath: "/tmp/linkedlist.c",
      overwritten: false,
      message: "Saved linkedlist.c",
    })

    expect(listCourses.courses).toHaveLength(1)
    expect(upcoming.items[0].title).toBe("Problem Set 3")
    expect(submissionStatus.submitted).toHaveLength(1)
    expect(grades.courses[0].currentGrade).toBe("A-")
    expect(todo.items[0].title).toContain("Read chapter")
    expect(peerReviews.items[0].assignmentId).toBe("101")
    expect(assignments.items[0].sourceId).toBe("101")
    expect(overview.pageCount).toBe(2)
    expect(detail.item.title).toBe("Problem Set 3")
    expect(structure.modules[0].items[0].title).toBe("Square Roots")
    expect(download.savedPath).toBe("/tmp/linkedlist.c")
  })
})
