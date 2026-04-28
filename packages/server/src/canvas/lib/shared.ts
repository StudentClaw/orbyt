import { CanvasApiError, CanvasPermissionError, type CanvasCourse } from "@orbyt/contracts"
import { decodeCourseId } from "./ids.js"
import { CanvasClient, type CanvasCredentials } from "./canvas-client.js"

export type CanvasApiDependencies = {
  readonly now: () => Date
  readonly getCredentials: () => CanvasCredentials
  readonly createClient?: (credentials: CanvasCredentials) => CanvasClient
  readonly workspaceRoot?: string
  readonly writableRoots?: string[]
}

export function getCanvasClient(deps: CanvasApiDependencies): CanvasClient {
  return getCanvasClientForBaseUrl(deps)
}

export function getCanvasClientForBaseUrl(
  deps: CanvasApiDependencies,
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

export function isPermissionError(error: unknown): error is CanvasPermissionError {
  return error instanceof CanvasPermissionError
}

export function isNotFoundError(error: unknown): error is CanvasApiError {
  return error instanceof CanvasApiError && error.statusCode === 404
}

export function getWorkspaceRoot(deps: CanvasApiDependencies): string {
  return deps.workspaceRoot ?? process.env.CODEX_WORKSPACE_ROOT ?? process.env.PWD ?? process.cwd()
}

export function getWritableRoots(deps: CanvasApiDependencies): string[] {
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
