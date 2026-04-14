import type { SourceType } from "@student-claw/contracts"

const COURSE_PREFIX = "canvas-course:"
const COURSEWORK_PREFIX = "canvas-coursework:"
const ANNOUNCEMENT_PREFIX = "canvas-announcement:"

export function encodeCourseId(canvasCourseId: number | string): string {
  return `${COURSE_PREFIX}${canvasCourseId}`
}

export function decodeCourseId(courseId: string): string {
  return courseId.startsWith(COURSE_PREFIX) ? courseId.slice(COURSE_PREFIX.length) : courseId
}

export function encodeCourseWorkItemId(sourceType: SourceType, canvasCourseId: number | string, sourceId: number | string): string {
  return `${COURSEWORK_PREFIX}${sourceType}:${canvasCourseId}:${sourceId}`
}

export function decodeCourseWorkItemId(courseWorkItemId: string): {
  sourceType: SourceType
  canvasCourseId: string
  sourceId: string
} | null {
  if (!courseWorkItemId.startsWith(COURSEWORK_PREFIX)) {
    return null
  }

  const payload = courseWorkItemId.slice(COURSEWORK_PREFIX.length)
  const [sourceType, canvasCourseId, ...rest] = payload.split(":")
  const sourceId = rest.join(":")

  if (
    !sourceType ||
    !canvasCourseId ||
    !sourceId ||
    !["assignment", "module", "page", "announcement"].includes(sourceType)
  ) {
    return null
  }

  return {
    sourceType: sourceType as SourceType,
    canvasCourseId,
    sourceId,
  }
}

export function encodeAnnouncementId(canvasCourseId: number | string, announcementId: number | string): string {
  return `${ANNOUNCEMENT_PREFIX}${canvasCourseId}:${announcementId}`
}
