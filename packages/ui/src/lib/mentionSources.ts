import type { Course, CourseWorkItem } from "@orbyt/contracts"
import type { AssignmentPickerEntry } from "@/components/chat/MentionPicker"

const CANVAS_ASSIGNMENT_URL_RE =
  /^https?:\/\/[^/]+\/courses\/(\d+)\/assignments\/(\d+)(?:[/?#]|$)/

export type MentionAssignmentBuckets = {
  readonly upcoming: ReadonlyArray<CourseWorkItem>
  readonly pending: ReadonlyArray<CourseWorkItem>
  readonly overdue: ReadonlyArray<CourseWorkItem>
  readonly submitted: ReadonlyArray<CourseWorkItem>
}

type RankedCourseWorkItem = {
  readonly item: CourseWorkItem
  readonly rank: number
}

/**
 * Convert `CourseWorkItem[]` plus a course lookup into picker entries. Canvas
 * references are intentionally URL-backed so Codex can resolve the original
 * Canvas object later without copying page bodies into the turn.
 */
export function assignmentEntriesFromCourseWork(
  items: ReadonlyArray<CourseWorkItem>,
  courses: ReadonlyArray<Course>,
): readonly AssignmentPickerEntry[] {
  return assignmentEntriesFromRankedCourseWork(
    items.map((item) => ({ item, rank: 0 })),
    courses,
  )
}

function assignmentEntriesFromRankedCourseWork(
  rankedItems: ReadonlyArray<RankedCourseWorkItem>,
  courses: ReadonlyArray<Course>,
): readonly AssignmentPickerEntry[] {
  const courseCodeById = new Map(courses.map((c) => [String(c.id), c.code]))
  const entries: AssignmentPickerEntry[] = []
  const seen = new Set<string>()
  for (const { item } of rankedItems) {
    const url = item.htmlUrl
    if (!url) continue
    const match = CANVAS_ASSIGNMENT_URL_RE.exec(url)
    const id = match
      ? (() => {
          const [, courseId, assignmentId] = match as unknown as [string, string, string]
          return `canvas-course:${courseId}:assignment:${assignmentId}`
        })()
      : `canvas-coursework:${item.sourceType}:${item.courseId}:${item.sourceId}`
    if (seen.has(id)) continue
    seen.add(id)
    entries.push({
      id,
      label: item.title,
      url,
      referenceKind: item.sourceType === "assignment"
        ? "canvas-assignment"
        : "canvas-coursework",
      sourceType: item.sourceType,
      courseCode: courseCodeById.get(String(item.courseId)) ?? undefined,
      dueAt: item.effectiveDueAt ?? null,
    })
  }
  return entries
}

function assignmentTime(item: CourseWorkItem, fallback: number): number {
  if (!item.effectiveDueAt) return fallback
  const time = new Date(item.effectiveDueAt).getTime()
  return Number.isFinite(time) ? time : fallback
}

/**
 * Build the chat mention list from the local Canvas cache. Empty @ mentions use
 * this order directly, so active work is ranked first. Typed mentions still
 * search the full returned array.
 */
export function priorityAssignmentEntriesFromCanvasState(
  buckets: MentionAssignmentBuckets,
  courses: ReadonlyArray<Course>,
): readonly AssignmentPickerEntry[] {
  const ranked: RankedCourseWorkItem[] = [
    ...buckets.overdue.map((item) => ({ item, rank: 0 })),
    ...buckets.pending.map((item) => ({ item, rank: 1 })),
    ...buckets.upcoming.map((item) => ({ item, rank: 2 })),
    ...buckets.submitted.map((item) => ({ item, rank: 3 })),
  ]

  ranked.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    if (a.rank === 3) {
      return assignmentTime(b.item, Number.NEGATIVE_INFINITY)
        - assignmentTime(a.item, Number.NEGATIVE_INFINITY)
    }
    return assignmentTime(a.item, Number.POSITIVE_INFINITY)
      - assignmentTime(b.item, Number.POSITIVE_INFINITY)
  })

  return assignmentEntriesFromRankedCourseWork(ranked, courses)
}
