import { Schema } from "@effect/schema"
import { type CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { CanvasPermissionError, type CanvasCourse, type SourceType } from "@student-claw/contracts"
import { decodeCourseId } from "../ids.js"
import { CanvasClient } from "../canvas-client.js"
import type { CanvasPluginCredentials } from "../runtime.js"
import { formatCanvasError, summarizeTextResult, validateContract } from "../utils.js"

export type CanvasToolDependencies = {
  now: () => Date
  getCredentials: () => CanvasPluginCredentials
  createClient?: (credentials: CanvasPluginCredentials) => CanvasClient
}

export function getCanvasClient(deps: CanvasToolDependencies): CanvasClient {
  const credentials = deps.getCredentials()
  return deps.createClient ? deps.createClient(credentials) : new CanvasClient(credentials)
}

export async function resolveCourses(
  client: CanvasClient,
  requestedCourseId?: string,
): Promise<CanvasCourse[]> {
  const courses = await client.getCourses()
  if (!requestedCourseId) {
    return courses
  }

  const canvasCourseId = decodeCourseId(requestedCourseId)
  return courses.filter((course) => String(course.id) === canvasCourseId)
}

export function successResult<A, I, R>(
  schema: Schema.Schema<A, I, never>,
  data: I,
  resource: string,
): CallToolResult {
  const structured = validateContract(schema, data, resource)
  return {
    content: [{ type: "text", text: summarizeTextResult(structured) }],
    structuredContent: structured as Record<string, unknown>,
  }
}

export function errorResult(error: unknown): CallToolResult {
  const formatted = formatCanvasError(error)
  return {
    content: [{ type: "text", text: formatted.message }],
    isError: true,
  }
}

export function requestedSources(sources?: SourceType[]): SourceType[] {
  return sources && sources.length > 0 ? sources : ["assignment"]
}

export function isPermissionError(error: unknown): error is CanvasPermissionError {
  return error instanceof CanvasPermissionError
}
