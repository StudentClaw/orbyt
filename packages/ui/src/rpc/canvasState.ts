import type { Course, CourseWorkItem, Grade } from "@student-claw/contracts"
import type { WsRpcClient } from "./wsRpcClient"
import { appAtomRegistry, createAtom, useAtomValue } from "./atomRegistry"

export interface CanvasSyncProgress {
  readonly courseId: string
  readonly progress: number
  readonly status: "syncing" | "done" | "error"
}

const canvasCoursesAtom = createAtom<ReadonlyArray<Course>>(
  "canvas-courses",
  [],
)

const canvasCourseworkAtom = createAtom<ReadonlyArray<CourseWorkItem>>(
  "canvas-coursework",
  [],
)

const canvasGradesAtom = createAtom<ReadonlyArray<Grade>>(
  "canvas-grades",
  [],
)

const canvasSyncProgressAtom = createAtom<CanvasSyncProgress | null>(
  "canvas-sync-progress",
  null,
)

const canvasLastSyncAtom = createAtom<string | null>(
  "canvas-last-sync",
  null,
)

// --- Imperative getters/setters ---

export function getCourses(): ReadonlyArray<Course> {
  return appAtomRegistry.get(canvasCoursesAtom)
}

export function setCourses(courses: ReadonlyArray<Course>): void {
  appAtomRegistry.set(canvasCoursesAtom, courses)
}

export function getCoursework(): ReadonlyArray<CourseWorkItem> {
  return appAtomRegistry.get(canvasCourseworkAtom)
}

export function setCoursework(items: ReadonlyArray<CourseWorkItem>): void {
  appAtomRegistry.set(canvasCourseworkAtom, items)
}

export function getGrades(): ReadonlyArray<Grade> {
  return appAtomRegistry.get(canvasGradesAtom)
}

export function setGrades(grades: ReadonlyArray<Grade>): void {
  appAtomRegistry.set(canvasGradesAtom, grades)
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

// --- Event application ---

export function applyCanvasSyncProgressEvent(data: {
  readonly courseId: string
  readonly progress: number
  readonly status: "syncing" | "done" | "error"
}): void {
  appAtomRegistry.set(canvasSyncProgressAtom, {
    courseId: data.courseId,
    progress: data.progress,
    status: data.status,
  })

  if (data.status === "done") {
    appAtomRegistry.set(canvasLastSyncAtom, new Date().toISOString())
  }
}

// --- Pure derivation functions ---

export function getCourseGrades(
  grades: ReadonlyArray<Grade>,
  courseId: string,
): ReadonlyArray<Grade> {
  return grades.filter((g) => g.courseId === courseId)
}

export function getCourseworkForCourse(
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

// --- Sync starter ---

export function startCanvasStateSync(client: WsRpcClient): () => void {
  let disposed = false

  const cleanups = [
    client.canvas.onSyncProgress(
      (event) => {
        if (!disposed) {
          applyCanvasSyncProgressEvent(event)
        }
      },
    ),
    client.dashboard.onUpdate(() => {
      // Dashboard update events handled by dashboardState
    }),
  ]

  return () => {
    disposed = true
    for (const cleanup of cleanups) {
      cleanup()
    }
  }
}

// --- React hooks ---

export function useCanvasCourses(): ReadonlyArray<Course> {
  return useAtomValue(canvasCoursesAtom)
}

export function useCanvasCoursework(): ReadonlyArray<CourseWorkItem> {
  return useAtomValue(canvasCourseworkAtom)
}

export function useCanvasGrades(): ReadonlyArray<Grade> {
  return useAtomValue(canvasGradesAtom)
}

export function useCanvasSyncProgress(): CanvasSyncProgress | null {
  return useAtomValue(canvasSyncProgressAtom)
}

export function useCanvasLastSync(): string | null {
  return useAtomValue(canvasLastSyncAtom)
}

// --- Test reset ---

export function resetCanvasStateForTests(): void {
  appAtomRegistry.set(canvasCoursesAtom, [])
  appAtomRegistry.set(canvasCourseworkAtom, [])
  appAtomRegistry.set(canvasGradesAtom, [])
  appAtomRegistry.set(canvasSyncProgressAtom, null)
  appAtomRegistry.set(canvasLastSyncAtom, null)
}
