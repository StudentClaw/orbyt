import { Schema } from "@effect/schema"
import { type CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { CanvasApiError, CanvasPermissionError, type CanvasCourse, type SourceType } from "@student-claw/contracts"
import { decodeCourseId } from "../ids.js"
import { CanvasClient } from "../canvas-client.js"
import type { CanvasPluginCredentials } from "../runtime.js"
import { formatCanvasError, summarizeTextResult, validateContract } from "../utils.js"

export type CanvasToolDependencies = {
  now: () => Date
  getCredentials: () => CanvasPluginCredentials
  createClient?: (credentials: CanvasPluginCredentials) => CanvasClient
  workspaceRoot?: string
  writableRoots?: string[]
}

export function getCanvasClient(deps: CanvasToolDependencies): CanvasClient {
  return getCanvasClientForBaseUrl(deps)
}

export function getCanvasClientForBaseUrl(
  deps: CanvasToolDependencies,
  baseUrl?: string,
): CanvasClient {
  const credentials = deps.getCredentials()
  const resolvedCredentials = baseUrl ? { ...credentials, baseUrl } : credentials
  return deps.createClient ? deps.createClient(resolvedCredentials) : new CanvasClient(resolvedCredentials)
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
  const normalizedRequested = canvasCourseId.trim().toLowerCase()

  return courses.filter((course) => {
    const aliases = [
      String(course.id),
      encodeCourseAlias(course.id),
      course.course_code,
      course.sis_course_id,
      typeof course.sis_course_id === "string" ? `sis_course_id:${course.sis_course_id}` : undefined,
      course.integration_id,
      course.uuid,
    ]

    return aliases
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .some((value) => value.trim().toLowerCase() === normalizedRequested)
  })
}

export async function requireCourse(
  client: CanvasClient,
  requestedCourseId: string,
): Promise<CanvasCourse> {
  const course = (await resolveCourses(client, requestedCourseId))[0]
  if (!course) {
    throw new Error(`Canvas course ${requestedCourseId} was not found.`)
  }
  return course
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

export function isNotFoundError(error: unknown): error is CanvasApiError {
  return error instanceof CanvasApiError && error.statusCode === 404
}

export function getWorkspaceRoot(deps: CanvasToolDependencies): string {
  return deps.workspaceRoot ?? process.env.CODEX_WORKSPACE_ROOT ?? process.env.PWD ?? process.cwd()
}

export function getWritableRoots(deps: CanvasToolDependencies): string[] {
  if (deps.writableRoots && deps.writableRoots.length > 0) {
    return deps.writableRoots
  }

  const encoded = process.env.CODEX_WRITABLE_ROOTS
  if (encoded && encoded.length > 0) {
    return encoded.split(process.platform === "win32" ? ";" : ":").filter((value) => value.length > 0)
  }

  return [getWorkspaceRoot(deps)]
}

function encodeCourseAlias(courseId: string | number): string {
  return `canvas-course:${courseId}`
}
