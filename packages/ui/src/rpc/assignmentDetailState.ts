import type {
  CanvasAssignmentDetailsParams,
  CanvasAssignmentDetailsResult,
  Course,
  CourseWorkItem,
  Grade,
} from "@orbyt/contracts"
import { waitForPrimaryWsRpcClient } from "./appRuntime"
import { appAtomRegistry, createAtom, useAtomValue } from "./atomRegistry"
import { getCourses, getSubmissionStatus, getUpcomingAssignments } from "./canvasState"

export interface AssignmentPreview {
  readonly assignmentId: string
  readonly title: string
  readonly courseId: string
  readonly courseCode: string
  readonly courseName?: string
  readonly effectiveDueAt?: string
  readonly pointsPossible?: number
  readonly submissionStatus?: string
  readonly grade?: string
  readonly courseColor?: string
  readonly htmlUrl?: string
  readonly sourceId?: string
}

export interface AssignmentDetailEntry {
  readonly preview: AssignmentPreview | null
  readonly detail: CanvasAssignmentDetailsResult | null
  readonly status: "idle" | "loading" | "success" | "error"
  readonly error: string | null
}

const EMPTY_ENTRY: AssignmentDetailEntry = {
  preview: null,
  detail: null,
  status: "idle",
  error: null,
}

const assignmentDetailEntriesAtom = createAtom<Record<string, AssignmentDetailEntry>>(
  "assignment-detail-entries",
  {},
)

const inflightLoads = new Map<string, Promise<void>>()

function mergeEntry(
  assignmentId: string,
  partial: Partial<AssignmentDetailEntry>,
): AssignmentDetailEntry {
  const current = appAtomRegistry.get(assignmentDetailEntriesAtom)
  const existing = current[assignmentId] ?? EMPTY_ENTRY
  const next: AssignmentDetailEntry = {
    ...existing,
    ...partial,
    preview: partial.preview ?? existing.preview,
    detail: partial.detail ?? existing.detail,
    error: partial.error ?? existing.error,
  }
  appAtomRegistry.set(assignmentDetailEntriesAtom, {
    ...current,
    [assignmentId]: next,
  })
  return next
}

function resolveCourse(courseId: string): Course | null {
  return getCourses().find((course) => course.id === courseId) ?? null
}

function formatGradeValue(item: CourseWorkItem, grade?: Grade): string | undefined {
  if (item.grade) {
    return item.grade
  }

  if (!grade) {
    return undefined
  }

  const score = Number.isInteger(grade.score) ? String(grade.score) : grade.score.toFixed(1).replace(/\.0$/, "")
  const max = Number.isInteger(grade.maxScore) ? String(grade.maxScore) : grade.maxScore.toFixed(1).replace(/\.0$/, "")
  return grade.letterGrade ? `${grade.letterGrade} (${score}/${max})` : `${score}/${max}`
}

function itemToPreview(item: CourseWorkItem, course: Course | null): AssignmentPreview {
  return {
    assignmentId: item.id,
    title: item.title,
    courseId: item.courseId,
    courseCode: course?.code ?? "Canvas",
    courseName: course?.name,
    effectiveDueAt: item.effectiveDueAt,
    pointsPossible: item.pointsPossible,
    submissionStatus: item.submissionStatus,
    grade: item.grade,
    courseColor: course?.color,
    htmlUrl: item.htmlUrl,
    sourceId: item.sourceId,
  }
}

function findKnownItem(assignmentId: string): CourseWorkItem | null {
  const submissionStatus = getSubmissionStatus()
  const knownItems = [
    ...getUpcomingAssignments(),
    ...submissionStatus.submitted,
    ...submissionStatus.pending,
    ...submissionStatus.overdue,
  ]
  return knownItems.find((item) => item.id === assignmentId) ?? null
}

function resolvePreview(assignmentId: string): AssignmentPreview | null {
  const current = appAtomRegistry.get(assignmentDetailEntriesAtom)[assignmentId]
  if (current?.preview) {
    return current.preview
  }

  const item = findKnownItem(assignmentId)
  if (!item) {
    return null
  }

  const preview = itemToPreview(item, resolveCourse(item.courseId))
  mergeEntry(assignmentId, { preview })
  return preview
}

function buildParams(preview: AssignmentPreview): CanvasAssignmentDetailsParams | null {
  if (preview.htmlUrl) {
    return { assignmentUrl: preview.htmlUrl }
  }

  if (preview.courseId && preview.sourceId) {
    return {
      courseId: preview.courseId as CanvasAssignmentDetailsParams["courseId"],
      assignmentId: preview.sourceId,
    }
  }

  return null
}

function detailToPreview(detail: CanvasAssignmentDetailsResult): AssignmentPreview {
  return {
    assignmentId: detail.item.id,
    title: detail.item.title,
    courseId: detail.item.courseId,
    courseCode: detail.course.code,
    courseName: detail.course.name,
    effectiveDueAt: detail.item.effectiveDueAt,
    pointsPossible: detail.item.pointsPossible ?? detail.source.points_possible ?? undefined,
    submissionStatus: detail.item.submissionStatus ?? detail.source.submission?.workflow_state ?? undefined,
    grade: formatGradeValue(detail.item, detail.grade),
    courseColor: resolveCourse(detail.item.courseId)?.color,
    htmlUrl: detail.item.htmlUrl ?? detail.source.html_url ?? undefined,
    sourceId: detail.item.sourceId,
  }
}

export function seedAssignmentPreview(preview: AssignmentPreview): void {
  mergeEntry(preview.assignmentId, { preview })
}

export function useAssignmentDetailEntry(assignmentId: string): AssignmentDetailEntry {
  return useAtomValue(
    assignmentDetailEntriesAtom,
    (entries) => entries[assignmentId] ?? EMPTY_ENTRY,
  )
}

export function useAssignmentDisplayTitle(assignmentId: string | null): string | null {
  return useAtomValue(assignmentDetailEntriesAtom, (entries) => {
    if (!assignmentId) {
      return null
    }

    const entry = entries[assignmentId]
    return entry?.detail?.item.title ?? entry?.preview?.title ?? null
  })
}

export async function loadAssignmentDetail(assignmentId: string): Promise<void> {
  const existingLoad = inflightLoads.get(assignmentId)
  if (existingLoad) {
    return existingLoad
  }

  const loadPromise = (async () => {
    const preview = resolvePreview(assignmentId)
    if (!preview) {
      mergeEntry(assignmentId, {
        status: "error",
        error: "Assignment details couldn't be loaded from local preview data.",
      })
      return
    }

    const params = buildParams(preview)
    if (!params) {
      mergeEntry(assignmentId, {
        preview,
        status: "error",
        error: "Assignment link information is unavailable for this item.",
      })
      return
    }

    mergeEntry(assignmentId, {
      preview,
      status: "loading",
      error: null,
    })

    try {
      const client = await waitForPrimaryWsRpcClient()
      const detail = await client.canvas.getAssignmentDetails(params)
      mergeEntry(assignmentId, {
        preview: detailToPreview(detail),
        detail,
        status: "success",
        error: null,
      })
    } catch (error) {
      mergeEntry(assignmentId, {
        status: "error",
        error: error instanceof Error ? error.message : "Failed to load assignment details.",
      })
    }
  })().finally(() => {
    inflightLoads.delete(assignmentId)
  })

  inflightLoads.set(assignmentId, loadPromise)
  return loadPromise
}

export function resetAssignmentDetailStateForTests(): void {
  inflightLoads.clear()
  appAtomRegistry.set(assignmentDetailEntriesAtom, {})
}
