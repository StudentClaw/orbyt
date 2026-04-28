import { mkdir, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  type CanvasAssignmentWithSubmission,
  type CanvasCourse,
  type CanvasDiscussionEntry,
  type CanvasFile,
  type CanvasModule,
} from "@orbyt/contracts"
import { CanvasClient, type CanvasCredentials } from "./lib/canvas-client.js"
import { decodeCourseId, encodeCourseId } from "./lib/ids.js"
import {
  normalizeAssignment,
  normalizeCourse,
  normalizeGrade,
} from "./lib/normalizers/assignments.js"
import {
  type CanvasApiDependencies,
  getCanvasClient,
  getCanvasClientForBaseUrl,
  getWorkspaceRoot,
  getWritableRoots,
  isNotFoundError,
  isPermissionError,
  requireCourse,
  resolveCourses,
} from "./lib/shared.js"
import { sortCoursework } from "./lib/utils.js"

export type { CanvasApiDependencies, CanvasCredentials }

/**
 * In-server replacement for the canvas-mcp plugin's tool handlers. Exposes
 * the 13 high-level Canvas operations CanvasSyncService relies on as plain
 * async methods backed by a CanvasClient. Each method returns the same
 * structured shape that the corresponding `Canvas*Result` schema in
 * @orbyt/contracts decodes to, so call sites can consume the value directly
 * without an Effect Schema decode round-trip.
 */
export class CanvasApiClient {
  constructor(private readonly deps: CanvasApiDependencies) {}

  async listCourses() {
    const client = getCanvasClient(this.deps)
    const courses = (await client.getCourses()).map(normalizeCourse)
    return { courses }
  }

  async getMyUpcomingAssignments(args: { days?: number } = {}) {
    const client = getCanvasClient(this.deps)
    const courses = await client.getCourses()
    const courseMap = new Map(courses.map((course) => [String(course.id), course]))
    const horizon =
      typeof args.days === "number"
        ? this.deps.now().getTime() + args.days * 24 * 60 * 60 * 1000
        : null

    const items = sortCoursework(
      (await client.getUpcomingEvents())
        .map((event) => {
          const assignment = extractUpcomingEventAssignment(event)
          const course = assignment ? courseMap.get(String(assignment.course_id)) : undefined
          return assignment && course
            ? normalizeAssignment(
                {
                  id: assignment.id,
                  course_id: assignment.course_id,
                  name: assignment.name,
                  due_at: assignment.due_at ?? undefined,
                  points_possible: assignment.points_possible ?? undefined,
                  html_url: assignment.html_url ?? undefined,
                  updated_at: assignment.updated_at ?? undefined,
                },
                course,
              )
            : null
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .filter((item) => {
          if (horizon === null || !item.effectiveDueAt) {
            return true
          }
          const dueAt = Date.parse(item.effectiveDueAt)
          return Number.isFinite(dueAt) && dueAt <= horizon
        }),
    )

    return { items }
  }

  async getMySubmissionStatus(args: { courseId?: string } = {}) {
    const client = getCanvasClient(this.deps)
    const courses = await resolveCourses(client, args.courseId)
    const submitted: ReturnType<typeof normalizeAssignment>[] = []
    const pending: ReturnType<typeof normalizeAssignment>[] = []
    const overdue: ReturnType<typeof normalizeAssignment>[] = []
    const now = this.deps.now().getTime()

    for (const course of courses) {
      let assignments: CanvasAssignmentWithSubmission[]
      try {
        assignments = await client.getAssignmentsWithSubmission(String(course.id))
      } catch (error) {
        if (isPermissionError(error)) {
          continue
        }
        throw error
      }

      for (const assignment of assignments) {
        if (assignment.published === false) {
          continue
        }

        const item = normalizeAssignment(assignment, course, assignment.submission ?? undefined)
        const workflowState = assignment.submission?.workflow_state ?? ""
        const isSubmitted =
          ["submitted", "graded", "complete", "completed"].includes(workflowState) ||
          !!assignment.submission?.submitted_at
        const dueAt = item.effectiveDueAt ? Date.parse(item.effectiveDueAt) : Number.NaN
        const isOverdue = !isSubmitted && Number.isFinite(dueAt) && dueAt < now

        if (isSubmitted) {
          submitted.push(item)
        } else if (isOverdue) {
          overdue.push(item)
        } else {
          pending.push(item)
        }
      }
    }

    return {
      submitted: sortCoursework(submitted),
      pending: sortCoursework(pending),
      overdue: sortCoursework(overdue),
    }
  }

  async getMyCourseGrades() {
    const client = getCanvasClient(this.deps)
    const courses = await client.getCoursesWithEnrollments()
    const courseDetails = await Promise.all(
      courses.map((c) => client.getCourse(String(c.id)).catch(() => null)),
    )

    const summaries = courses.map((course, i) => {
      const enrollment = course.enrollments?.[0]
      const detail = courseDetails[i]
      return {
        course: normalizeCourse(course),
        currentScore:
          enrollment?.grades?.current_score ?? enrollment?.computed_current_score ?? undefined,
        currentGrade:
          enrollment?.grades?.current_grade ?? enrollment?.computed_current_grade ?? undefined,
        finalScore:
          enrollment?.grades?.final_score ?? enrollment?.computed_final_score ?? undefined,
        finalGrade:
          enrollment?.grades?.final_grade ?? enrollment?.computed_final_grade ?? undefined,
        units: detail?.credit_hours ?? undefined,
      }
    })

    return { courses: summaries }
  }

  async getMyTodoItems() {
    const client = getCanvasClient(this.deps)
    const items = (await client.getTodoItems()).map((item) => ({
      courseId: item.course_id ? encodeCourseId(item.course_id) : undefined,
      title: item.assignment?.name ?? item.title ?? "Untitled Canvas todo",
      type: item.type ?? "unknown",
      dueAt: item.assignment?.due_at ?? undefined,
      htmlUrl: item.assignment?.html_url ?? item.html_url ?? undefined,
    }))
    return { items }
  }

  async getMyPeerReviewsTodo(args: { courseId?: string } = {}) {
    const client = getCanvasClient(this.deps)
    const courses = await resolveCourses(client, args.courseId)
    const items: Array<{
      courseId: string
      assignmentId: string
      assignmentName: string
      revieweeUserId?: string
      assessorUserId?: string
      workflowState?: string
    }> = []

    for (const course of courses) {
      let assignments: CanvasAssignmentWithSubmission[]
      try {
        assignments = await client.getAssignmentsWithSubmission(String(course.id))
      } catch (error) {
        if (isPermissionError(error)) {
          continue
        }
        throw error
      }

      for (const assignment of assignments.filter((candidate) => candidate.peer_reviews)) {
        let reviews
        try {
          reviews = await client.getPeerReviews(String(course.id), String(assignment.id))
        } catch (error) {
          if (isPermissionError(error)) {
            continue
          }
          throw error
        }

        for (const review of reviews.filter((c) => c.workflow_state !== "completed")) {
          items.push({
            courseId: encodeCourseId(course.id),
            assignmentId: String(assignment.id),
            assignmentName: assignment.name,
            revieweeUserId:
              review.user_id !== null && review.user_id !== undefined
                ? String(review.user_id)
                : undefined,
            assessorUserId:
              review.assessor_id !== null && review.assessor_id !== undefined
                ? String(review.assessor_id)
                : undefined,
            workflowState: review.workflow_state ?? undefined,
          })
        }
      }
    }

    return { items }
  }

  async getAssignmentDetails(args: {
    courseId?: string | number
    assignmentId?: string | number
    assignmentUrl?: string
    assignment_url?: string
    url?: string
  }) {
    const reference = resolveAssignmentReference(args)
    const client = getCanvasClientForBaseUrl(this.deps, reference.baseUrl)
    const course = await resolveAssignmentCourse(client, reference.courseId)
    const assignment = await client.getAssignmentWithSubmission(
      String(course.id),
      reference.assignmentId,
    )
    const item = normalizeAssignment(assignment, course, assignment.submission ?? undefined)
    const grade = assignment.submission
      ? normalizeGrade(course, assignment, assignment.submission) ?? undefined
      : undefined

    return {
      course: normalizeCourse(course),
      item,
      source: assignment,
      grade,
    }
  }

  async listAssignments(args: { courseId?: string; includeCompleted?: boolean } = {}) {
    const client = getCanvasClient(this.deps)
    if (args.courseId) {
      const course = await requireCourse(client, args.courseId)
      const items = await buildCourseAssignments(client, course, args.includeCompleted)
      return {
        course: normalizeCourse(course),
        items,
        courses: undefined,
      }
    }

    const courses = await resolveCourses(client)
    const buckets: Array<{
      course: ReturnType<typeof normalizeCourse>
      items: ReturnType<typeof normalizeAssignment>[]
    }> = []

    for (const course of courses) {
      buckets.push({
        course: normalizeCourse(course),
        items: await swallowPermission(
          () => buildCourseAssignments(client, course, args.includeCompleted),
          [],
        ),
      })
    }

    return {
      course: undefined,
      items: sortCoursework(buckets.flatMap((bucket) => bucket.items)),
      courses: buckets,
    }
  }

  async getCourseContentOverview(args: { courseId?: string } = {}) {
    const client = getCanvasClient(this.deps)
    if (args.courseId) {
      const course = await requireCourse(client, args.courseId)
      const overview = await buildCourseContentOverview(client, course)
      return {
        ...overview,
        courses: undefined,
      }
    }

    const overviews = await Promise.all(
      (await resolveCourses(client)).map((course) => buildCourseContentOverview(client, course)),
    )

    return {
      course: undefined,
      pageCount: overviews.reduce((total, c) => total + c.pageCount, 0),
      moduleCount: overviews.reduce((total, c) => total + c.moduleCount, 0),
      moduleItemCount: overviews.reduce((total, c) => total + c.moduleItemCount, 0),
      frontPage: undefined,
      courses: overviews,
    }
  }

  async getCourseStructure(args: { courseId?: string } = {}) {
    const client = getCanvasClient(this.deps)
    if (args.courseId) {
      const course = await requireCourse(client, args.courseId)
      const structure = await buildCourseStructure(client, course)
      return {
        ...structure,
        courses: undefined,
      }
    }

    const structures = await Promise.all(
      (await resolveCourses(client)).map((course) => buildCourseStructure(client, course)),
    )

    return {
      course: undefined,
      modules: [],
      courses: structures,
    }
  }

  async getFrontPage(args: { courseId: string }) {
    const client = getCanvasClient(this.deps)
    const course = await requireCourse(client, args.courseId)
    const page = await client.getFrontPage(String(course.id))
    return {
      course: normalizeCourse(course),
      page,
    }
  }

  async getPageContent(args: { courseId: string; pageId: string }) {
    const client = getCanvasClient(this.deps)
    const course = await requireCourse(client, args.courseId)
    const page = await client.getPage(String(course.id), args.pageId)
    return {
      course: normalizeCourse(course),
      page,
    }
  }

  async downloadCourseFile(args: {
    courseId: string
    fileId: string
    destinationPath?: string
  }) {
    const client = getCanvasClient(this.deps)
    const canvasCourseId = decodeCourseId(args.courseId)
    const course = await requireCourse(client, args.courseId)
    const file = await requireFile(client, course, args.fileId)
    if (!file.url) {
      throw new Error(`Canvas file ${args.fileId} does not expose a downloadable URL.`)
    }

    const filename = sanitizeFilename(file.filename || file.display_name)
    const savedPath = await resolveDownloadPath({
      courseId: canvasCourseId,
      filename,
      destinationPath: args.destinationPath,
      workspaceRoot: getWorkspaceRoot(this.deps),
      writableRoots: getWritableRoots(this.deps),
    })
    const existed = await pathExists(savedPath)
    const payload = await client.downloadAuthorizedFile(file.url)

    await mkdir(path.dirname(savedPath), { recursive: true })
    await writeFile(savedPath, Buffer.from(payload))

    return {
      success: true,
      courseId: args.courseId,
      fileId: args.fileId,
      filename,
      savedPath,
      overwritten: existed,
      size: file.size ?? undefined,
      message: `Downloaded ${filename}.`,
    }
  }
}

// ============================================================================
// Helpers ported verbatim from canvas-mcp/src/tools/student-tools.ts
// ============================================================================

async function buildCourseContentOverview(client: CanvasClient, course: CanvasCourse) {
  const [pages, modules, frontPage] = await Promise.all([
    swallowPermission(() => client.getPages(String(course.id)), []),
    swallowPermission(() => client.getModules(String(course.id)), []),
    swallowPermission(() => client.getFrontPage(String(course.id)), undefined, {
      swallowNotFound: true,
    }),
  ])

  let moduleItemCount = 0
  for (const module of modules) {
    const items = await swallowPermission(
      () => client.getModuleItems(String(course.id), String(module.id)),
      [],
    )
    moduleItemCount += items.length
  }

  return {
    course: normalizeCourse(course),
    pageCount: pages.length,
    moduleCount: modules.length,
    moduleItemCount,
    frontPage,
  }
}

async function buildCourseAssignments(
  client: CanvasClient,
  course: CanvasCourse,
  includeCompleted?: boolean,
) {
  return sortCoursework(
    (await client.getAssignmentsWithSubmission(String(course.id)))
      .filter((assignment) => assignment.published !== false)
      .map((assignment) => normalizeAssignment(assignment, course, assignment.submission ?? undefined))
      .filter(
        (item) =>
          includeCompleted ||
          !["submitted", "graded", "complete", "completed"].includes(item.submissionStatus ?? ""),
      ),
  )
}

async function buildCourseStructure(client: CanvasClient, course: CanvasCourse) {
  const modules = await swallowPermission(() => client.getModules(String(course.id)), [])
  const structured: Array<{ module: CanvasModule; items: unknown[] }> = []

  for (const module of modules) {
    const items = await swallowPermission(
      () => client.getModuleItems(String(course.id), String(module.id)),
      [],
    )
    structured.push({ module, items })
  }

  return {
    course: normalizeCourse(course),
    modules: structured,
  }
}

function extractUpcomingEventAssignment(event: {
  assignment?: {
    id: number
    course_id: number
    name: string
    due_at?: string | null
    points_possible?: number | null
    html_url?: string | null
    updated_at?: string | null
  } | null
  id?: string | number | null
  course_id?: string | number | null
  name?: string | null
  due_at?: string | null
  points_possible?: number | null
  html_url?: string | null
  updated_at?: string | null
}) {
  if (event.assignment) {
    return event.assignment
  }

  const id = toCanvasNumber(event.id)
  const courseId = toCanvasNumber(event.course_id)
  if (id === null || courseId === null || !event.name) {
    return null
  }

  return {
    id,
    course_id: courseId,
    name: event.name,
    due_at: event.due_at ?? undefined,
    points_possible: event.points_possible ?? undefined,
    html_url: event.html_url ?? undefined,
    updated_at: event.updated_at ?? undefined,
  }
}

function resolveAssignmentReference(input: {
  courseId?: string | number
  assignmentId?: string | number
  assignmentUrl?: string
  assignment_url?: string
  url?: string
}): { courseId: string; assignmentId: string; baseUrl?: string } {
  const parsed = parseAssignmentUrl(
    input.assignmentUrl ?? input.assignment_url ?? input.url ?? stringifyValue(input.assignmentId),
  )
  const courseId = stringifyValue(input.courseId) ?? parsed?.courseId
  const assignmentId = parsed?.assignmentId ?? stringifyValue(input.assignmentId)

  if (!courseId || !assignmentId) {
    throw new Error("Provide either courseId + assignmentId or a full Canvas assignment URL.")
  }

  return {
    courseId,
    assignmentId,
    baseUrl: parsed?.baseUrl,
  }
}

function stringifyValue(value: string | number | undefined): string | undefined {
  if (typeof value === "number") {
    return String(value)
  }
  return value
}

function toCanvasNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

async function resolveAssignmentCourse(
  client: CanvasClient,
  courseId: string,
): Promise<CanvasCourse> {
  const discoveredCourse = (await resolveCourses(client, courseId))[0]
  if (discoveredCourse) {
    return discoveredCourse
  }

  const canvasCourseId = decodeCourseId(courseId)
  const numericCourseId = Number(canvasCourseId)
  if (!Number.isFinite(numericCourseId)) {
    throw new Error(`Canvas course ${courseId} was not found.`)
  }

  return {
    id: numericCourseId,
    name: `Canvas Course ${canvasCourseId}`,
    course_code: `Canvas Course ${canvasCourseId}`,
  }
}

function parseAssignmentUrl(
  value?: string,
): { courseId: string; assignmentId: string; baseUrl: string } | null {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)
    const match = url.pathname.match(/\/courses\/([^/]+)\/assignments\/([^/]+)/)
    if (!match) {
      return null
    }

    return {
      courseId: match[1] ?? "",
      assignmentId: match[2] ?? "",
      baseUrl: url.origin,
    }
  } catch {
    return null
  }
}

async function requireFile(
  client: CanvasClient,
  course: CanvasCourse,
  fileId: string,
): Promise<CanvasFile> {
  const file = (await client.getCourseFiles(String(course.id))).find(
    (candidate) => String(candidate.id) === fileId,
  )
  if (!file) {
    throw new Error(`Canvas file ${fileId} was not found.`)
  }
  return file
}

async function swallowPermission<T>(
  callback: () => Promise<T>,
  fallback: T,
  options?: { swallowNotFound?: boolean },
): Promise<T> {
  try {
    return await callback()
  } catch (error) {
    if (isPermissionError(error) || (options?.swallowNotFound && isNotFoundError(error))) {
      return fallback
    }
    throw error
  }
}

function sanitizeFilename(filename: string): string {
  // Strip filesystem-unsafe characters and ASCII control codes (U+0000-001F).
  const trimmed = filename.trim()
  const base = trimmed.length > 0 ? trimmed : "canvas-file"
  return base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
}

async function resolveDownloadPath(options: {
  courseId: string
  filename: string
  destinationPath?: string
  workspaceRoot: string
  writableRoots: string[]
}): Promise<string> {
  const preferred = options.destinationPath
    ? resolveUserPath(options.destinationPath, options.workspaceRoot, options.filename)
    : path.resolve(options.workspaceRoot, "downloads", "canvas", options.courseId, options.filename)

  if (!isWithinAnyRoot(preferred, options.writableRoots)) {
    throw new Error("Destination path must stay inside the active workspace or another allowed writable root.")
  }

  return preferred
}

function resolveUserPath(destinationPath: string, workspaceRoot: string, filename: string): string {
  const candidate = path.isAbsolute(destinationPath)
    ? destinationPath
    : path.resolve(workspaceRoot, destinationPath)

  if (destinationPath.endsWith(path.sep) || destinationPath.endsWith("/")) {
    return path.resolve(candidate, filename)
  }

  return candidate
}

function isWithinAnyRoot(candidatePath: string, writableRoots: string[]): boolean {
  return writableRoots.some((root) => isWithinRoot(candidatePath, root))
}

function isWithinRoot(candidatePath: string, root: string): boolean {
  const resolvedRoot = path.resolve(root)
  const resolvedCandidate = path.resolve(candidatePath)
  const relative = path.relative(resolvedRoot, resolvedCandidate)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await stat(candidatePath)
    return true
  } catch {
    return false
  }
}
