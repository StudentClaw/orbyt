import { CourseWorkItem, type CanvasCourse, type CanvasModuleItem } from "@orbyt/contracts"
import { encodeCourseId, encodeCourseWorkItemId } from "../ids.js"
import { validateContract } from "../utils.js"

export function normalizeModuleItem(moduleItem: CanvasModuleItem, course: CanvasCourse): CourseWorkItem {
  return validateContract(CourseWorkItem, {
    id: encodeCourseWorkItemId("module", course.id, moduleItem.id),
    courseId: encodeCourseId(course.id),
    title: moduleItem.title,
    effectiveDueAt: undefined,
    sourceType: "module",
    sourceId: String(moduleItem.id),
    freshnessStatus: "fresh",
    cachedAt: new Date().toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    sourceUpdatedAt: moduleItem.updated_at ?? undefined,
    htmlUrl: moduleItem.html_url ?? undefined,
    submissionStatus: moduleItem.completion_requirement?.completed ? "completed" : undefined,
  }, "CourseWorkItem")
}
