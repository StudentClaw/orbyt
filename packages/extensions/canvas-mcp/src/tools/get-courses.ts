import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { CanvasGetCoursesResult } from "@student-claw/contracts"
import { normalizeCourse } from "../normalizers/assignments.js"
import { errorResult, getCanvasClient, successResult, type CanvasToolDependencies } from "./shared.js"

export function registerGetCoursesTool(server: McpServer, deps: CanvasToolDependencies): void {
  server.registerTool(
    "get_courses",
    {
      title: "Get Canvas courses",
      description: "List active Canvas courses for the authenticated student.",
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async () => {
      try {
        const client = getCanvasClient(deps)
        const courses = (await client.getCourses()).map(normalizeCourse)
        return successResult(CanvasGetCoursesResult, { courses }, "CanvasGetCoursesResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
