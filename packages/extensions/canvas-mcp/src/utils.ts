import {
  CanvasApiError,
  CanvasAuthError,
  CanvasDecodeError,
  CanvasPermissionError,
  CanvasRateLimitError,
  type Announcement,
  type Course,
  type CourseWorkItem,
  type Grade,
} from "@orbyt/contracts"
import { Schema } from "@effect/schema"

export function stripHtml(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  const text = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  return text.length > 0 ? text : undefined
}

export function parseIsoDate(value: string | undefined): number | null {
  if (!value) {
    return null
  }

  const millis = Date.parse(value)
  return Number.isNaN(millis) ? null : millis
}

export function isWithinDateRange(value: string | undefined, after?: string, before?: string): boolean {
  if (!after && !before) {
    return true
  }

  const target = parseIsoDate(value)
  if (target === null) {
    return false
  }

  const afterMillis = parseIsoDate(after)
  if (afterMillis !== null && target < afterMillis) {
    return false
  }

  const beforeMillis = parseIsoDate(before)
  if (beforeMillis !== null && target > beforeMillis) {
    return false
  }

  return true
}

export function sortCoursework(items: CourseWorkItem[]): CourseWorkItem[] {
  return [...items].sort((left, right) => {
    const leftDue = parseIsoDate(left.effectiveDueAt) ?? Number.MAX_SAFE_INTEGER
    const rightDue = parseIsoDate(right.effectiveDueAt) ?? Number.MAX_SAFE_INTEGER
    if (leftDue !== rightDue) {
      return leftDue - rightDue
    }

    return left.title.localeCompare(right.title)
  })
}

export function sortAnnouncements(items: Announcement[]): Announcement[] {
  return [...items].sort((left, right) => {
    const leftDate = parseIsoDate(left.postedAt) ?? 0
    const rightDate = parseIsoDate(right.postedAt) ?? 0
    return rightDate - leftDate
  })
}

export function validateContract<A, I>(
  schema: Schema.Schema<A, I, never>,
  value: I,
  resource: string,
): A {
  try {
    return Schema.decodeUnknownSync(schema)(value)
  } catch (error) {
    throw new CanvasDecodeError({
      message: `Decoded ${resource} did not match the shared contract.`,
      resource,
      rawPayload: JSON.stringify(value),
    })
  }
}

export function summarizeTextResult(data: unknown): string {
  return JSON.stringify(data, null, 2)
}

export function formatCanvasError(error: unknown): { message: string; isError: true } {
  if (error instanceof CanvasRateLimitError) {
    return {
      message: error.retryAfterSeconds
        ? `Canvas rate limited the request. Retry after ${error.retryAfterSeconds}s.`
        : "Canvas rate limited the request.",
      isError: true,
    }
  }

  if (error instanceof CanvasAuthError) {
    return { message: error.message, isError: true }
  }

  if (error instanceof CanvasPermissionError) {
    return { message: error.message, isError: true }
  }

  if (error instanceof CanvasDecodeError) {
    return { message: error.message, isError: true }
  }

  if (error instanceof CanvasApiError) {
    return { message: `${error.message} (status ${error.statusCode})`, isError: true }
  }

  if (error instanceof Error) {
    return { message: error.message, isError: true }
  }

  return { message: "Unknown Canvas MCP error.", isError: true }
}

export function buildGradeMap(grades: Grade[]): Map<string, Grade> {
  const map = new Map<string, Grade>()
  for (const grade of grades) {
    map.set(`${grade.courseId}:${grade.assignmentId}`, grade)
  }
  return map
}
