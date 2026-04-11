import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { CanvasGetAnnouncementsResult } from "@student-claw/contracts"
import { normalizeAnnouncement } from "../normalizers/announcements.js"
import { sortAnnouncements } from "../utils.js"
import { errorResult, getCanvasClient, resolveCourses, successResult, type CanvasToolDependencies } from "./shared.js"

export function registerGetAnnouncementsTool(server: McpServer, deps: CanvasToolDependencies): void {
  server.registerTool(
    "get_announcements",
    {
      title: "Get Canvas announcements",
      description: "Fetch recent Canvas announcements for one course or all active courses.",
      inputSchema: {
        courseId: z.string().optional(),
        limit: z.number().int().positive().optional(),
        refresh: z.enum(["never", "if_stale", "force"]).optional(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId, limit }) => {
      try {
        const client = getCanvasClient(deps)
        const courses = await resolveCourses(client, courseId)
        const announcements = []

        for (const course of courses) {
          const courseAnnouncements = await client.getAnnouncements(String(course.id))
          announcements.push(...courseAnnouncements.map((announcement) => normalizeAnnouncement(announcement, course)))
        }

        return successResult(CanvasGetAnnouncementsResult, {
          announcements: sortAnnouncements(announcements).slice(0, limit ?? announcements.length),
        }, "CanvasGetAnnouncementsResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
