import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { CanvasGetGradesResult } from "@student-claw/contracts"
import { normalizeGrade } from "../normalizers/assignments.js"
import { errorResult, getCanvasClient, resolveCourses, successResult, type CanvasToolDependencies } from "./shared.js"

export function registerGetGradesTool(server: McpServer, deps: CanvasToolDependencies): void {
  server.registerTool(
    "get_grades",
    {
      title: "Get Canvas grades",
      description: "Fetch assignment-level grades for a Canvas course.",
      inputSchema: {
        courseId: z.string(),
        refresh: z.enum(["never", "if_stale", "force"]).optional(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ courseId }) => {
      try {
        const client = getCanvasClient(deps)
        const courses = await resolveCourses(client, courseId)
        const course = courses[0]
        if (!course) {
          throw new Error(`Canvas course ${courseId} was not found.`)
        }

        const [assignments, enrollments] = await Promise.all([
          client.getAssignments(String(course.id)),
          client.getEnrollments(String(course.id)),
        ])

        const enrollment = enrollments[0]
        const grades = []

        for (const assignment of assignments) {
          const submission = await client.getSubmission(String(course.id), String(assignment.id))
          const grade = normalizeGrade(course, assignment, submission, enrollment)
          if (grade) {
            grades.push(grade)
          }
        }

        return successResult(CanvasGetGradesResult, { grades }, "CanvasGetGradesResult")
      } catch (error) {
        return errorResult(error)
      }
    },
  )
}
