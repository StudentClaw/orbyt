import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { CanvasGetCourseworkResult, type CanvasCourse, type CourseWorkItem, type SourceType } from "@student-claw/contracts"
import { isWithinDateRange, sortCoursework } from "../utils.js"
import { normalizeAnnouncementCoursework } from "../normalizers/announcements.js"
import { normalizeAssignment } from "../normalizers/assignments.js"
import { normalizeModuleItem } from "../normalizers/modules.js"
import { normalizePage } from "../normalizers/pages.js"
import { errorResult, getCanvasClient, requestedSources, resolveCourses, successResult, type CanvasToolDependencies } from "./shared.js"

export function registerGetCourseworkTool(server: McpServer, deps: CanvasToolDependencies): void {
  server.registerTool(
    "get_coursework",
    {
      title: "Get Canvas coursework",
      description: "Fetch normalized coursework items from assignments and optional Canvas sources.",
      inputSchema: {
        courseId: z.string().optional(),
        sources: z.array(z.enum(["assignment", "module", "page", "announcement"])).optional(),
        dueAfter: z.string().optional(),
        dueBefore: z.string().optional(),
        includeCompleted: z.boolean().optional(),
        refresh: z.enum(["never", "if_stale", "force"]).optional(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId, sources, dueAfter, dueBefore, includeCompleted }) => {
      try {
        const client = getCanvasClient(deps)
        const selectedCourses = await resolveCourses(client, courseId)
        const items = await collectCoursework(client, selectedCourses, requestedSources(sources as SourceType[] | undefined))
        const filtered = sortCoursework(
          items.filter((item) => {
            if (!includeCompleted && item.submissionStatus && ["submitted", "graded", "complete", "completed"].includes(item.submissionStatus)) {
              return false
            }
            return isWithinDateRange(item.effectiveDueAt, dueAfter, dueBefore)
          }),
        )

        return successResult(CanvasGetCourseworkResult, { items: filtered }, "CanvasGetCourseworkResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}

async function collectCoursework(
  client: ReturnType<typeof getCanvasClient>,
  courses: CanvasCourse[],
  sources: SourceType[],
): Promise<CourseWorkItem[]> {
  const items: CourseWorkItem[] = []

  for (const course of courses) {
    if (sources.includes("assignment")) {
      const assignments = await client.getAssignments(String(course.id))
      items.push(...assignments.filter((assignment) => assignment.published !== false).map((assignment) => normalizeAssignment(assignment, course)))
    }

    if (sources.includes("module")) {
      const modules = await client.getModules(String(course.id))
      for (const module of modules) {
        const moduleItems = await client.getModuleItems(String(course.id), String(module.id))
        items.push(...moduleItems.filter((item) => item.published !== false).map((item) => normalizeModuleItem(item, course)))
      }
    }

    if (sources.includes("page")) {
      const pages = await client.getPages(String(course.id))
      items.push(...pages.filter((page) => page.published !== false).map((page) => normalizePage(page, course)))
    }

    if (sources.includes("announcement")) {
      const announcements = await client.getAnnouncements(String(course.id))
      items.push(...announcements.map((announcement) => normalizeAnnouncementCoursework(announcement, course)))
    }
  }

  return items
}
