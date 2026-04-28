import type {
  CanvasGetMyCourseGradesResult,
  CanvasGetMyPeerReviewsTodoResult,
  CanvasGetMySubmissionStatusResult,
  CanvasGetMyTodoItemsResult,
  CanvasGetMyUpcomingAssignmentsResult,
  CanvasListAssignmentsResult,
  CanvasListCoursesResult,
  CanvasStudentCourseGradeSummary,
  CanvasStudentPeerReviewTodo,
  CanvasStudentTodoItem,
  Course,
  CourseWorkItem,
} from "@orbyt/contracts"
import type {
  CourseGradeSummaryRow,
  CourseRow,
  CourseworkRow,
  PeerReviewTodoRow,
  TodoItemRow,
} from "./sqlite-reader.js"

type SubmissionBucket = "submitted" | "pending" | "overdue"

type CourseworkItemWithMeta = CourseWorkItem & {
  readonly isUpcoming: boolean
  readonly statusBucket?: SubmissionBucket
}

export function rowToCourse(row: CourseRow): Course {
  return {
    id: row.id as Course["id"],
    name: row.name,
    code: row.code ?? "",
    professor: row.professor ?? undefined,
    canvasId: row.canvas_id ?? undefined,
    term: row.term ?? undefined,
    lastSyncAt: row.last_sync_at ?? undefined,
  }
}

export function rowToCoursework(row: CourseworkRow): CourseworkItemWithMeta {
  return {
    id: row.id as CourseWorkItem["id"],
    courseId: row.course_id as CourseWorkItem["courseId"],
    title: row.title,
    description: row.description ?? undefined,
    effectiveDueAt: row.effective_due_at ?? undefined,
    sourceType: row.source_type as CourseWorkItem["sourceType"],
    sourceId: row.canvas_assignment_id ?? row.id,
    sourceDueDateKind: row.source_due_date_kind
      ? (row.source_due_date_kind as CourseWorkItem["sourceDueDateKind"])
      : undefined,
    freshnessStatus: row.freshness_status as CourseWorkItem["freshnessStatus"],
    cachedAt: row.cached_at ?? undefined,
    lastVerifiedAt: row.last_verified_at ?? undefined,
    sourceUpdatedAt: row.source_updated_at ?? undefined,
    pointsPossible: row.points_possible ?? undefined,
    submissionStatus: row.submission_status ?? undefined,
    grade: row.grade ?? undefined,
    htmlUrl: row.html_url ?? undefined,
    isUpcoming: row.is_upcoming === 1,
    statusBucket: (row.status_bucket as SubmissionBucket | null) ?? undefined,
  }
}

export function listCoursesResult(rows: readonly CourseRow[]): CanvasListCoursesResult {
  return {
    courses: rows.map(rowToCourse),
  }
}

export function upcomingAssignmentsResult(
  rows: readonly CourseworkRow[],
  days?: number,
  now: Date = new Date(),
): CanvasGetMyUpcomingAssignmentsResult {
  const horizonMs = typeof days === "number" ? now.getTime() + days * 24 * 60 * 60 * 1000 : null
  const items = rows
    .map(rowToCoursework)
    .filter((item) => item.isUpcoming)
    .filter((item) => {
      if (horizonMs === null) return true
      if (!item.effectiveDueAt) return true
      return new Date(item.effectiveDueAt).getTime() <= horizonMs
    })
    .map((item): CourseWorkItem => stripMeta(item))
  return { items }
}

export function submissionStatusResult(
  rows: readonly CourseworkRow[],
  courseId: string | undefined,
): CanvasGetMySubmissionStatusResult {
  const buckets = {
    submitted: [] as CourseWorkItem[],
    pending: [] as CourseWorkItem[],
    overdue: [] as CourseWorkItem[],
  }
  for (const row of rows) {
    if (courseId && row.course_id !== courseId) continue
    const item = rowToCoursework(row)
    if (!item.statusBucket) continue
    buckets[item.statusBucket].push(stripMeta(item))
  }
  return buckets
}

export function listAssignmentsResult(
  rows: readonly CourseworkRow[],
  courseRows: readonly CourseRow[],
  courseId: string | undefined,
): CanvasListAssignmentsResult {
  const items = rows
    .map(rowToCoursework)
    .filter((item) => !courseId || item.courseId === courseId)
    .map(stripMeta)
  const course = courseId
    ? courseRows.map(rowToCourse).find((c) => c.id === courseId)
    : undefined
  return { course, items, courses: undefined }
}

export function courseGradesResult(
  gradeRows: readonly CourseGradeSummaryRow[],
  courseRows: readonly CourseRow[],
): CanvasGetMyCourseGradesResult {
  const courseById = new Map(courseRows.map((row) => [row.id, rowToCourse(row)] as const))
  const items: CanvasStudentCourseGradeSummary[] = []
  for (const row of gradeRows) {
    const course = courseById.get(row.course_id)
    if (!course) continue
    items.push({
      course,
      currentScore: row.current_score ?? undefined,
      currentGrade: row.current_grade ?? undefined,
      finalScore: row.final_score ?? undefined,
      finalGrade: row.final_grade ?? undefined,
      units: row.units ?? undefined,
    })
  }
  return { courses: items }
}

export function todoItemsResult(rows: readonly TodoItemRow[]): CanvasGetMyTodoItemsResult {
  const items: CanvasStudentTodoItem[] = rows.map((row) => ({
    courseId: row.course_id ? (row.course_id as CanvasStudentTodoItem["courseId"]) : undefined,
    title: row.title,
    type: row.type as CanvasStudentTodoItem["type"],
    dueAt: row.due_at ?? undefined,
    htmlUrl: row.html_url ?? undefined,
  }))
  return { items }
}

export function peerReviewsResult(
  rows: readonly PeerReviewTodoRow[],
  courseId: string | undefined,
): CanvasGetMyPeerReviewsTodoResult {
  const items: CanvasStudentPeerReviewTodo[] = rows
    .filter((row) => !courseId || row.course_id === courseId)
    .map((row) => ({
      courseId: row.course_id as CanvasStudentPeerReviewTodo["courseId"],
      assignmentId: row.assignment_id,
      assignmentName: row.assignment_name,
      revieweeUserId: row.reviewee_user_id ?? undefined,
      assessorUserId: row.assessor_user_id ?? undefined,
      workflowState: row.workflow_state ?? undefined,
    }))
  return { items }
}

function stripMeta(item: CourseworkItemWithMeta): CourseWorkItem {
  const { isUpcoming: _isUpcoming, statusBucket: _statusBucket, ...rest } = item
  return rest
}
