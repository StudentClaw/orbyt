import {
  Course,
  CourseWorkItem,
  Grade,
  type CanvasAssignment,
  type CanvasCourse,
  type CanvasEnrollment,
  type CanvasSubmission,
} from "@student-claw/contracts"
import { encodeCourseId, encodeCourseWorkItemId } from "../ids.js"
import { stripHtml, validateContract } from "../utils.js"

function teacherName(course: CanvasCourse): string | undefined {
  return course.teachers?.[0]?.name
    ?? course.teachers?.[0]?.display_name
    ?? course.teacher?.name
    ?? course.teacher?.display_name
    ?? undefined
}

export function normalizeCourse(course: CanvasCourse): Course {
  return validateContract(Course, {
    id: encodeCourseId(course.id),
    name: course.name,
    code: course.course_code ?? course.name,
    professor: teacherName(course),
    canvasId: String(course.id),
    term: course.term?.name,
    lastSyncAt: course.updated_at ?? undefined,
  }, "Course")
}

export function normalizeAssignment(
  assignment: CanvasAssignment,
  course: CanvasCourse,
  submission?: CanvasSubmission,
): CourseWorkItem {
  const submissionStatus = submission?.workflow_state
    ?? (assignment.graded_submissions_exist ? "graded" : assignment.has_submitted_submissions ? "submitted" : undefined)

  return validateContract(CourseWorkItem, {
    id: encodeCourseWorkItemId("assignment", course.id, assignment.id),
    courseId: encodeCourseId(course.id),
    title: assignment.name,
    description: stripHtml(assignment.description),
    effectiveDueAt: assignment.due_at ?? undefined,
    sourceType: "assignment",
    sourceId: String(assignment.id),
    sourceDueDateKind: assignment.due_at ? "assignment_due_at" : undefined,
    freshnessStatus: "fresh",
    cachedAt: new Date().toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    sourceUpdatedAt: assignment.updated_at ?? undefined,
    htmlUrl: assignment.html_url ?? undefined,
    pointsPossible: assignment.points_possible ?? undefined,
    submissionStatus,
    grade: submission?.grade ?? undefined,
  }, "CourseWorkItem")
}

export function normalizeGrade(
  course: CanvasCourse,
  assignment: CanvasAssignment,
  submission: CanvasSubmission,
  enrollment?: CanvasEnrollment,
): Grade | null {
  if (submission.score === null || submission.score === undefined || assignment.points_possible === null || assignment.points_possible === undefined) {
    return null
  }

  return validateContract(Grade, {
    courseId: encodeCourseId(course.id),
    assignmentId: String(assignment.id),
    score: submission.score,
    maxScore: assignment.points_possible,
    letterGrade: submission.grade ?? enrollment?.computed_current_grade ?? undefined,
    postedAt: submission.posted_at ?? submission.updated_at ?? undefined,
  }, "Grade")
}
