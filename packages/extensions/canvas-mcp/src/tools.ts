import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import {
  courseGradesResult,
  listAssignmentsResult,
  listCoursesResult,
  peerReviewsResult,
  submissionStatusResult,
  todoItemsResult,
  upcomingAssignmentsResult,
} from "./mappers.js"
import type { CanvasCacheReader } from "./sqlite-reader.js"

type Reader = () => CanvasCacheReader

function ok(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
    structuredContent: data as Record<string, unknown>,
  }
}

function fail(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error)
  return {
    content: [{ type: "text", text: `canvas-mcp error: ${message}` }],
    isError: true,
  }
}

export function registerCanvasCacheTools(server: McpServer, reader: Reader): void {
  server.registerTool(
    "list_courses",
    {
      title: "List cached Canvas courses",
      description: "List the student's Canvas courses from the local cache.",
      inputSchema: {},
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async () => {
      try {
        return ok(listCoursesResult(reader().listCourseRows()))
      } catch (err) {
        return fail(err)
      }
    },
  )

  server.registerTool(
    "get_my_upcoming_assignments",
    {
      title: "Cached upcoming assignments",
      description: "List upcoming assignments from the local cache.",
      inputSchema: {
        days: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ days }) => {
      try {
        return ok(upcomingAssignmentsResult(reader().listCourseworkRows(), days))
      } catch (err) {
        return fail(err)
      }
    },
  )

  server.registerTool(
    "get_my_submission_status",
    {
      title: "Cached submission status",
      description: "Show submitted, pending, and overdue assignments from the local cache.",
      inputSchema: {
        courseId: z.string().optional(),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ courseId }) => {
      try {
        return ok(submissionStatusResult(reader().listCourseworkRows(), courseId))
      } catch (err) {
        return fail(err)
      }
    },
  )

  server.registerTool(
    "get_my_course_grades",
    {
      title: "Cached Canvas grades",
      description: "Show current Canvas grades from the local cache.",
      inputSchema: {},
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async () => {
      try {
        const r = reader()
        return ok(courseGradesResult(r.listCourseGradeRows(), r.listCourseRows()))
      } catch (err) {
        return fail(err)
      }
    },
  )

  server.registerTool(
    "get_my_todo_items",
    {
      title: "Cached Canvas todo items",
      description: "List Canvas todo items from the local cache.",
      inputSchema: {},
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async () => {
      try {
        return ok(todoItemsResult(reader().listTodoItemRows()))
      } catch (err) {
        return fail(err)
      }
    },
  )

  server.registerTool(
    "get_my_peer_reviews_todo",
    {
      title: "Cached peer reviews owed",
      description: "List peer reviews still owed by the student from the local cache.",
      inputSchema: {
        courseId: z.string().optional(),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ courseId }) => {
      try {
        return ok(peerReviewsResult(reader().listPeerReviewTodoRows(), courseId))
      } catch (err) {
        return fail(err)
      }
    },
  )

  server.registerTool(
    "list_assignments",
    {
      title: "Cached assignments",
      description: "List cached Canvas assignments, optionally filtered by course.",
      inputSchema: {
        courseId: z.string().optional(),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ courseId }) => {
      try {
        const r = reader()
        return ok(listAssignmentsResult(r.listCourseworkRows(), r.listCourseRows(), courseId))
      } catch (err) {
        return fail(err)
      }
    },
  )
}
