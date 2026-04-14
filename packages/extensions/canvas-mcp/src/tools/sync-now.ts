import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { CanvasSyncResult } from "@student-claw/contracts"
import { errorResult, getCanvasClient, isPermissionError, successResult, type CanvasToolDependencies } from "./shared.js"

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
        let skippedPermissionDeniedCount = 0

        for (const course of courses) {
          try {
            assignmentCount += (await client.getAssignments(String(course.id))).length
          } catch (error) {
            if (!isPermissionError(error)) {
              throw error
            }
            skippedPermissionDeniedCount += 1
          }

          try {
            announcementCount += (await client.getAnnouncements(String(course.id))).length
          } catch (error) {
            if (!isPermissionError(error)) {
              throw error
            }
            skippedPermissionDeniedCount += 1
          }

          try {
            enrollmentCount += (await client.getEnrollments(String(course.id))).length
          } catch (error) {
            if (!isPermissionError(error)) {
              throw error
            }
            skippedPermissionDeniedCount += 1
          }
        }

        const skippedSummary = skippedPermissionDeniedCount > 0
          ? ` Skipped ${skippedPermissionDeniedCount} permission-denied requests.`
          : ""

        return successResult(CanvasSyncResult, {
          state: {
            status: "idle",
            lastSyncAt: deps.now().toISOString(),
            message: `Fetched ${courses.length} courses, ${assignmentCount} assignments, ${announcementCount} announcements, and ${enrollmentCount} enrollments.${skippedSummary}`,
          },
        }, "CanvasSyncResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
