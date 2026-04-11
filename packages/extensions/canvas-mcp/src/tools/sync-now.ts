import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { CanvasSyncResult } from "@student-claw/contracts"
import { errorResult, getCanvasClient, successResult, type CanvasToolDependencies } from "./shared.js"

export function registerSyncNowTool(server: McpServer, deps: CanvasToolDependencies): void {
  server.registerTool(
    "sync_now",
    {
      title: "Sync Canvas now",
      description: "Perform an immediate Canvas read pass for courses, assignments, grades, and announcements.",
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async () => {
      try {
        const client = getCanvasClient(deps)
        const courses = await client.getCourses()

        let assignmentCount = 0
        let announcementCount = 0
        let enrollmentCount = 0

        for (const course of courses) {
          assignmentCount += (await client.getAssignments(String(course.id))).length
          announcementCount += (await client.getAnnouncements(String(course.id))).length
          enrollmentCount += (await client.getEnrollments(String(course.id))).length
        }

        return successResult(CanvasSyncResult, {
          state: {
            status: "idle",
            lastSyncAt: deps.now().toISOString(),
            message: `Fetched ${courses.length} courses, ${assignmentCount} assignments, ${announcementCount} announcements, and ${enrollmentCount} enrollments.`,
          },
        }, "CanvasSyncResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
