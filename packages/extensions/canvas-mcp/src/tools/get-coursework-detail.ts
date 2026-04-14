import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { CanvasGetCourseworkDetailResult } from "@student-claw/contracts"
import { getCourseworkDetail } from "../detail-fetchers/coursework-detail.js"
import { errorResult, getCanvasClient, successResult, type CanvasToolDependencies } from "./shared.js"

export function registerGetCourseworkDetailTool(server: McpServer, deps: CanvasToolDependencies): void {
  server.registerTool(
    "get_coursework_detail",
    {
      title: "Get Canvas coursework detail",
      description: "Fetch full detail for a normalized coursework item or source object.",
      inputSchema: {
        courseWorkItemId: z.string().optional(),
        sourceType: z.enum(["assignment", "module", "page", "announcement"]).optional(),
        sourceId: z.string().optional(),
        courseId: z.string().optional(),
        moduleId: z.string().optional(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseWorkItemId, sourceType, sourceId, courseId, moduleId }) => {
      try {
        if (!courseWorkItemId && (!sourceType || !sourceId)) {
          throw new Error("Provide either courseWorkItemId or sourceType + sourceId.")
        }

        const client = getCanvasClient(deps)
        const courses = await client.getCourses()
        const detail = await getCourseworkDetail(
          client,
          courses,
          courseWorkItemId ? { courseWorkItemId } : { sourceType: sourceType!, sourceId: sourceId!, courseId, moduleId },
        )

        return successResult(CanvasGetCourseworkDetailResult, { detail }, "CanvasGetCourseworkDetailResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
