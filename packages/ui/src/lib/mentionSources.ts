import type { Course, CourseWorkItem } from "@orbyt/contracts"
import type { AssignmentPickerEntry } from "@/components/chat/MentionPicker"

const CANVAS_ASSIGNMENT_URL_RE =
  /^https?:\/\/[^/]+\/courses\/(\d+)\/assignments\/(\d+)(?:[/?#]|$)/

/**
 * Convert `CourseWorkItem[]` plus a course lookup into picker entries. Items
 * that do not have an assignment-shaped `htmlUrl` are dropped because the
 * mention system requires a late-binding URL that round-trips through the
 * canvas MCP tools.
 */
export function assignmentEntriesFromCourseWork(
  items: ReadonlyArray<CourseWorkItem>,
  courses: ReadonlyArray<Course>,
): readonly AssignmentPickerEntry[] {
  const courseCodeById = new Map(courses.map((c) => [String(c.id), c.code]))
  const entries: AssignmentPickerEntry[] = []
  for (const item of items) {
    if (item.sourceType !== "assignment") continue
    const url = item.htmlUrl
    if (!url) continue
    const match = CANVAS_ASSIGNMENT_URL_RE.exec(url)
    if (!match) continue
    const [, courseId, assignmentId] = match
    const id = `canvas-course:${courseId}:assignment:${assignmentId}`
    entries.push({
      id,
      label: item.title,
      url,
      courseCode: courseCodeById.get(String(item.courseId)) ?? undefined,
      dueAt: item.effectiveDueAt ?? null,
    })
  }
  return entries
}
