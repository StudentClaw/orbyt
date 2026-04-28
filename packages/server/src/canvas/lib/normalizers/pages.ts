import { CourseWorkItem, type CanvasCourse, type CanvasPage } from "@orbyt/contracts"
import { encodeCourseId, encodeCourseWorkItemId } from "../ids.js"
import { stripHtml, validateContract } from "../utils.js"

export function normalizePage(page: CanvasPage, course: CanvasCourse): CourseWorkItem {
  return validateContract(CourseWorkItem, {
    id: encodeCourseWorkItemId("page", course.id, page.url),
    courseId: encodeCourseId(course.id),
    title: page.title,
    description: stripHtml(page.body),
    effectiveDueAt: undefined,
    sourceType: "page",
    sourceId: page.url,
    freshnessStatus: "fresh",
    cachedAt: new Date().toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    sourceUpdatedAt: page.updated_at ?? undefined,
    htmlUrl: page.html_url ?? undefined,
  }, "CourseWorkItem")
}
