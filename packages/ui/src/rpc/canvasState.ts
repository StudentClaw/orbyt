import { useMemo } from "react"
import type {
  CanvasStudentCourseGradeSummary,
  CanvasStudentPeerReviewTodo,
  CanvasStudentTodoItem,
  Course,
  CourseWorkItem,
} from "@orbyt/contracts"
import type { WsRpcClient } from "./wsRpcClient"
import { appAtomRegistry, createAtom, useAtomValue } from "./atomRegistry"

export interface CanvasSyncProgress {
  readonly courseId: string
  readonly progress: number
  readonly status: "syncing" | "done" | "error"
}

export interface CanvasSubmissionStatusBuckets {
  readonly submitted: ReadonlyArray<CourseWorkItem>
  readonly pending: ReadonlyArray<CourseWorkItem>
  readonly overdue: ReadonlyArray<CourseWorkItem>
}

const EMPTY_SUBMISSION_STATUS: CanvasSubmissionStatusBuckets = {
  submitted: [],
  pending: [],
  overdue: [],
}

const canvasCoursesAtom = createAtom<ReadonlyArray<Course>>("canvas-courses", [])
const canvasUpcomingAssignmentsAtom = createAtom<ReadonlyArray<CourseWorkItem>>(
  "canvas-upcoming-assignments",
  [],
)
const canvasSubmissionStatusAtom = createAtom<CanvasSubmissionStatusBuckets>(
  "canvas-submission-status",
  EMPTY_SUBMISSION_STATUS,
)
const canvasCourseGradesAtom = createAtom<ReadonlyArray<CanvasStudentCourseGradeSummary>>(
  "canvas-course-grade-summaries",
  [],
)
const canvasTodoItemsAtom = createAtom<ReadonlyArray<CanvasStudentTodoItem>>(
  "canvas-todo-items",
  [],
)
const canvasPeerReviewTodoAtom = createAtom<ReadonlyArray<CanvasStudentPeerReviewTodo>>(
  "canvas-peer-review-todo",
  [],
)
const canvasSyncProgressAtom = createAtom<CanvasSyncProgress | null>("canvas-sync-progress", null)
const canvasLastSyncAtom = createAtom<string | null>("canvas-last-sync", null)

export function getCourses(): ReadonlyArray<Course> {
  return appAtomRegistry.get(canvasCoursesAtom)
}

export function setCourses(courses: ReadonlyArray<Course>): void {
  appAtomRegistry.set(canvasCoursesAtom, courses)
}

export function getUpcomingAssignments(): ReadonlyArray<CourseWorkItem> {
  return appAtomRegistry.get(canvasUpcomingAssignmentsAtom)
}

export function setUpcomingAssignments(items: ReadonlyArray<CourseWorkItem>): void {
  appAtomRegistry.set(canvasUpcomingAssignmentsAtom, items)
}

export function getSubmissionStatus(): CanvasSubmissionStatusBuckets {
  return appAtomRegistry.get(canvasSubmissionStatusAtom)
}

export function setSubmissionStatus(status: CanvasSubmissionStatusBuckets): void {
  appAtomRegistry.set(canvasSubmissionStatusAtom, status)
}

function removeItemById(
  items: ReadonlyArray<CourseWorkItem>,
  assignmentId: string,
): ReadonlyArray<CourseWorkItem> {
  return items.filter((item) => item.id !== assignmentId)
}

export function removeArchivedAssignmentFromCanvasState(assignmentId: string): void {
  appAtomRegistry.set(
    canvasUpcomingAssignmentsAtom,
    removeItemById(appAtomRegistry.get(canvasUpcomingAssignmentsAtom), assignmentId),
  )

  const current = appAtomRegistry.get(canvasSubmissionStatusAtom)
  appAtomRegistry.set(canvasSubmissionStatusAtom, {
    submitted: removeItemById(current.submitted, assignmentId),
    pending: removeItemById(current.pending, assignmentId),
    overdue: removeItemById(current.overdue, assignmentId),
  })
}

export function getCourseGrades(): ReadonlyArray<CanvasStudentCourseGradeSummary> {
  return appAtomRegistry.get(canvasCourseGradesAtom)
}

export function setCourseGrades(grades: ReadonlyArray<CanvasStudentCourseGradeSummary>): void {
  appAtomRegistry.set(canvasCourseGradesAtom, grades)
}

export function getTodoItems(): ReadonlyArray<CanvasStudentTodoItem> {
  return appAtomRegistry.get(canvasTodoItemsAtom)
}

export function setTodoItems(items: ReadonlyArray<CanvasStudentTodoItem>): void {
  appAtomRegistry.set(canvasTodoItemsAtom, items)
}

export function getPeerReviewTodo(): ReadonlyArray<CanvasStudentPeerReviewTodo> {
  return appAtomRegistry.get(canvasPeerReviewTodoAtom)
}

export function setPeerReviewTodo(items: ReadonlyArray<CanvasStudentPeerReviewTodo>): void {
  appAtomRegistry.set(canvasPeerReviewTodoAtom, items)
}

export function getSyncProgress(): CanvasSyncProgress | null {
  return appAtomRegistry.get(canvasSyncProgressAtom)
}

export function getLastSync(): string | null {
  return appAtomRegistry.get(canvasLastSyncAtom)
}

export function setLastSync(timestamp: string | null): void {
  appAtomRegistry.set(canvasLastSyncAtom, timestamp)
}

export function applyCanvasSyncProgressEvent(data: CanvasSyncProgress): void {
  appAtomRegistry.set(canvasSyncProgressAtom, data)

  if (data.status === "done") {
    appAtomRegistry.set(canvasLastSyncAtom, new Date().toISOString())
  }
}

export function getAssignmentsForCourse(
  items: ReadonlyArray<CourseWorkItem>,
  courseId: string,
): ReadonlyArray<CourseWorkItem> {
  return items.filter((item) => item.courseId === courseId)
}

export function getUpcomingDeadlines(
  items: ReadonlyArray<CourseWorkItem>,
  windowDays: number,
  now: Date = new Date(),
): ReadonlyArray<CourseWorkItem> {
  const cutoff = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000)

  return items
    .filter((item) => {
      if (!item.effectiveDueAt) return false
      const due = new Date(item.effectiveDueAt)
      return due >= now && due <= cutoff
    })
    .toSorted((a, b) => {
      const aDate = new Date(a.effectiveDueAt!).getTime()
      const bDate = new Date(b.effectiveDueAt!).getTime()
      return aDate - bDate
    })
}

export type StalenessStatus = "fresh" | "stale" | "offline"

export function computeStaleness(
  lastSyncAt: string | null,
  now: Date = new Date(),
): StalenessStatus {
  if (lastSyncAt === null) return "offline"

  const lastSync = new Date(lastSyncAt)
  const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60)

  return hoursSinceSync > 24 ? "stale" : "fresh"
}

let loadInFlight: Promise<void> | null = null

export async function loadCanvasData(client: WsRpcClient): Promise<void> {
  if (loadInFlight) return loadInFlight
  loadInFlight = (async () => {
    const [courses, upcomingAssignments, submissionStatus, courseGrades, todoItems, peerReviewTodo] =
      await Promise.all([
        client.canvas.listCourses(),
        client.canvas.getMyUpcomingAssignments(),
        client.canvas.getMySubmissionStatus(),
        client.canvas.getMyCourseGrades(),
        client.canvas.getMyTodoItems(),
        client.canvas.getMyPeerReviewsTodo(),
      ])

    setCourses(courses)
    setUpcomingAssignments(upcomingAssignments)
    setSubmissionStatus(submissionStatus)
    setCourseGrades(courseGrades)
    setTodoItems(todoItems)
    setPeerReviewTodo(peerReviewTodo)

    const latestSync = [...courses]
      .map((c) => c.lastSyncAt)
      .filter((s): s is string => Boolean(s))
      .sort()
      .at(-1) ?? null
    setLastSync(latestSync)
  })().finally(() => {
    loadInFlight = null
  })
  return loadInFlight
}

export function startCanvasStateSync(client: WsRpcClient): () => void {
  let disposed = false

  const cleanup = client.canvas.onSyncProgress((event) => {
    if (disposed) return
    applyCanvasSyncProgressEvent(event)
    if (event.status === "done") {
      loadCanvasData(client).catch((error) => {
        console.error("Failed to refresh canvas data after sync", error)
      })
    }
  })

  return () => {
    disposed = true
    cleanup()
  }
}

export function useCanvasCourses(): ReadonlyArray<Course> {
  return useAtomValue(canvasCoursesAtom)
}

export function useCanvasUpcomingAssignments(): ReadonlyArray<CourseWorkItem> {
  return useAtomValue(canvasUpcomingAssignmentsAtom)
}

export function useCanvasSubmissionStatus(): CanvasSubmissionStatusBuckets {
  return useAtomValue(canvasSubmissionStatusAtom)
}

export function useCanvasCourseGrades(): ReadonlyArray<CanvasStudentCourseGradeSummary> {
  return useAtomValue(canvasCourseGradesAtom)
}

export function useCanvasTodoItems(): ReadonlyArray<CanvasStudentTodoItem> {
  return useAtomValue(canvasTodoItemsAtom)
}

export function useCanvasPeerReviewTodo(): ReadonlyArray<CanvasStudentPeerReviewTodo> {
  return useAtomValue(canvasPeerReviewTodoAtom)
}

export function useCanvasSyncProgress(): CanvasSyncProgress | null {
  return useAtomValue(canvasSyncProgressAtom)
}

export function useCanvasLastSync(): string | null {
  return useAtomValue(canvasLastSyncAtom)
}

/**
 * Title for a coursework item that appears in synced Canvas lists (upcoming + submission buckets).
 * Subscribes to canvas atoms so navbar labels update when sync completes.
 */
export function useKnownCourseworkItemTitle(assignmentId: string | null): string | null {
  const upcoming = useAtomValue(canvasUpcomingAssignmentsAtom)
  const submission = useAtomValue(canvasSubmissionStatusAtom)
  return useMemo(() => {
    if (!assignmentId) {
      return null
    }
    const buckets = [
      ...upcoming,
      ...submission.submitted,
      ...submission.pending,
      ...submission.overdue,
    ]
    return buckets.find((item) => item.id === assignmentId)?.title ?? null
  }, [assignmentId, upcoming, submission])
}

export function resetCanvasStateForTests(): void {
  appAtomRegistry.set(canvasCoursesAtom, [])
  appAtomRegistry.set(canvasUpcomingAssignmentsAtom, [])
  appAtomRegistry.set(canvasSubmissionStatusAtom, EMPTY_SUBMISSION_STATUS)
  appAtomRegistry.set(canvasCourseGradesAtom, [])
  appAtomRegistry.set(canvasTodoItemsAtom, [])
  appAtomRegistry.set(canvasPeerReviewTodoAtom, [])
  appAtomRegistry.set(canvasSyncProgressAtom, null)
  appAtomRegistry.set(canvasLastSyncAtom, null)
}
