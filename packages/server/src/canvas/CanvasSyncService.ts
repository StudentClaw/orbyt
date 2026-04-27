import { Context, Effect, Layer } from "effect"
import { Schema } from "@effect/schema"
import {
  CanvasAssignmentDetailsParams,
  CanvasAssignmentDetailsResult,
  CanvasCourseContentOverviewParams,
  CanvasCourseContentOverviewResult,
  CanvasCourseStructureParams,
  CanvasCourseStructureResult,
  CanvasDownloadCourseFileParams,
  CanvasDownloadCourseFileResult,
  CanvasGetMyCourseGradesResult,
  CanvasGetMyPeerReviewsTodoResult,
  CanvasGetMySubmissionStatusParams,
  CanvasGetMySubmissionStatusResult,
  CanvasGetMyTodoItemsResult,
  CanvasGetMyUpcomingAssignmentsResult,
  CanvasListAssignmentsParams,
  CanvasListAssignmentsResult,
  CanvasListCoursesResult,
  PUSH_CHANNELS,
  type CanvasStudentCourseGradeSummary,
  type CanvasStudentPeerReviewTodo,
  type CanvasStudentTodoItem,
  type Course,
  type CourseWorkItem,
  type GatewayToolCallFailure,
} from "@orbyt/contracts"
import { PluginGateway, type PluginGatewayService } from "../mcp/PluginGateway.js"
import { PushBus, type PushBusService } from "../ws/PushBus.js"
import { Database, type DatabaseService } from "../db/Database.js"

const TOOL_LIST_COURSES = "canvas.list_courses"
const TOOL_GET_MY_UPCOMING_ASSIGNMENTS = "canvas.get_my_upcoming_assignments"
const TOOL_GET_MY_SUBMISSION_STATUS = "canvas.get_my_submission_status"
const TOOL_GET_MY_COURSE_GRADES = "canvas.get_my_course_grades"
const TOOL_GET_MY_TODO_ITEMS = "canvas.get_my_todo_items"
const TOOL_GET_MY_PEER_REVIEWS_TODO = "canvas.get_my_peer_reviews_todo"
const TOOL_GET_ASSIGNMENT_DETAILS = "canvas.get_assignment_details"
const TOOL_LIST_ASSIGNMENTS = "canvas.list_assignments"
const TOOL_GET_COURSE_CONTENT_OVERVIEW = "canvas.get_course_content_overview"
const TOOL_GET_COURSE_STRUCTURE = "canvas.get_course_structure"
const TOOL_DOWNLOAD_COURSE_FILE = "canvas.download_course_file"

type SubmissionBucket = "submitted" | "pending" | "overdue"

type CourseRow = {
  id: string
  name: string
  code: string
  professor: string | null
  canvas_id: string | null
  term: string | null
  last_sync_at: string | null
}

type CourseworkRow = {
  id: string
  course_id: string
  title: string
  effective_due_at: string | null
  source_type: string
  freshness_status: string
  points_possible: number | null
  submission_status: string | null
  grade: string | null
  html_url: string | null
  canvas_assignment_id: string | null
  is_upcoming: number | null
  status_bucket: SubmissionBucket | null
}

type CourseGradeSummaryRow = {
  course_id: string
  current_score: number | null
  current_grade: string | null
  final_score: number | null
  final_grade: string | null
}

type TodoItemRow = {
  course_id: string | null
  title: string
  type: string
  due_at: string | null
  html_url: string | null
}

type PeerReviewTodoRow = {
  course_id: string
  assignment_id: string
  assignment_name: string
  reviewee_user_id: string | null
  assessor_user_id: string | null
  workflow_state: string | null
}

type SyncedAssignmentRecord = {
  item: CourseWorkItem
  isUpcoming: boolean
  statusBucket?: SubmissionBucket
}

export interface CanvasSyncServiceShape {
  readonly sync: () => Promise<void>
  readonly listCourses: () => Course[]
  readonly getMyUpcomingAssignments: (days?: number) => CourseWorkItem[]
  readonly getMySubmissionStatus: (courseId?: string) => {
    submitted: CourseWorkItem[]
    pending: CourseWorkItem[]
    overdue: CourseWorkItem[]
  }
  readonly getMyCourseGrades: () => CanvasStudentCourseGradeSummary[]
  readonly getMyTodoItems: () => CanvasStudentTodoItem[]
  readonly getMyPeerReviewsTodo: (courseId?: string) => CanvasStudentPeerReviewTodo[]
  readonly getAssignmentDetails: (params: CanvasAssignmentDetailsParams) => Promise<CanvasAssignmentDetailsResult>
  readonly listAssignments: (params: CanvasListAssignmentsParams) => Promise<CanvasListAssignmentsResult>
  readonly getCourseContentOverview: (params: CanvasCourseContentOverviewParams) => Promise<CanvasCourseContentOverviewResult>
  readonly getCourseStructure: (params: CanvasCourseStructureParams) => Promise<CanvasCourseStructureResult>
  readonly downloadCourseFile: (params: CanvasDownloadCourseFileParams) => Promise<CanvasDownloadCourseFileResult>
}

export class CanvasSyncService extends Context.Tag("CanvasSyncService")<
  CanvasSyncService,
  CanvasSyncServiceShape
>() {}

function logError(context: string, error: unknown): void {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  process.stderr.write(`[CanvasSync] ${context}: ${message}\n`)
}

function logGatewayFailure(context: string, failure: GatewayToolCallFailure): void {
  process.stderr.write(`[CanvasSync] ${context} (${failure.reason}): ${failure.message}\n`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function readToolText(result: unknown): string | null {
  if (!isRecord(result) || !Array.isArray(result.content)) {
    return null
  }

  for (const item of result.content) {
    if (isRecord(item) && typeof item.text === "string" && item.text.trim().length > 0) {
      return item.text.trim()
    }
  }

  return null
}

function readStructuredToolResult(
  toolName: string,
  result: unknown,
): { ok: true; data: unknown } | { ok: false; message: string } {
  if (!isRecord(result)) {
    return {
      ok: false,
      message: `${toolName} returned an invalid tool response.`,
    }
  }

  if (result.isError === true) {
    return {
      ok: false,
      message: readToolText(result) ?? `${toolName} returned a tool error.`,
    }
  }

  if ("structuredContent" in result) {
    return {
      ok: true,
      data: result.structuredContent,
    }
  }

  return {
    ok: false,
    message: `${toolName} returned no structured content.`,
  }
}

function decodeResult<A>(
  schema: Schema.Schema<A, any, never>,
  toolName: string,
  raw: unknown,
): A {
  try {
    return Schema.decodeUnknownSync(schema)(raw)
  } catch (error) {
    logError(`failed to decode ${toolName} result`, error)
    throw error
  }
}

function toNullableNumber(value: number | undefined): number | null {
  return value ?? null
}

function courseSort(left: Course, right: Course): number {
  return left.name.localeCompare(right.name)
}

function courseworkSort(left: CourseWorkItem, right: CourseWorkItem): number {
  const leftDue = left.effectiveDueAt ? new Date(left.effectiveDueAt).getTime() : Number.POSITIVE_INFINITY
  const rightDue = right.effectiveDueAt ? new Date(right.effectiveDueAt).getTime() : Number.POSITIVE_INFINITY
  if (leftDue !== rightDue) {
    return leftDue - rightDue
  }
  return left.title.localeCompare(right.title)
}

function mergeItem(base: CourseWorkItem | undefined, next: CourseWorkItem): CourseWorkItem {
  if (!base) return next
  return {
    ...base,
    title: next.title || base.title,
    effectiveDueAt: next.effectiveDueAt ?? base.effectiveDueAt,
    sourceType: next.sourceType ?? base.sourceType,
    sourceId: next.sourceId ?? base.sourceId,
    freshnessStatus: next.freshnessStatus ?? base.freshnessStatus,
    pointsPossible: next.pointsPossible ?? base.pointsPossible,
    submissionStatus: next.submissionStatus ?? base.submissionStatus,
    grade: next.grade ?? base.grade,
    htmlUrl: next.htmlUrl ?? base.htmlUrl,
  }
}

function extractAssignmentMap(
  upcoming: readonly CourseWorkItem[],
  submissionStatus: CanvasGetMySubmissionStatusResult,
): Map<string, SyncedAssignmentRecord> {
  const records = new Map<string, SyncedAssignmentRecord>()

  for (const item of upcoming) {
    records.set(item.id, {
      item,
      isUpcoming: true,
    })
  }

  const buckets: ReadonlyArray<readonly [SubmissionBucket, readonly CourseWorkItem[]]> = [
    ["submitted", submissionStatus.submitted],
    ["pending", submissionStatus.pending],
    ["overdue", submissionStatus.overdue],
  ]

  for (const [bucket, items] of buckets) {
    for (const item of items) {
      const existing = records.get(item.id)
      records.set(item.id, {
        item: mergeItem(existing?.item, item),
        isUpcoming: existing?.isUpcoming ?? false,
        statusBucket: bucket,
      })
    }
  }

  return records
}

function replaceAssignmentState(
  database: DatabaseService,
  records: ReadonlyMap<string, SyncedAssignmentRecord>,
): void {
  database.execute("DELETE FROM coursework_items")

  for (const record of records.values()) {
    const item = record.item
    database.execute(
      `INSERT INTO coursework_items
         (id, course_id, title, effective_due_at, source_type, freshness_status,
          points_possible, submission_status, grade, html_url, canvas_assignment_id, is_upcoming, status_bucket)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.courseId,
        item.title,
        item.effectiveDueAt ?? null,
        item.sourceType,
        item.freshnessStatus,
        item.pointsPossible ?? null,
        item.submissionStatus ?? null,
        item.grade ?? null,
        item.htmlUrl ?? null,
        item.sourceId,
        record.isUpcoming ? 1 : 0,
        record.statusBucket ?? null,
      ],
    )
  }
}

function replaceCourseGradeSummaries(
  database: DatabaseService,
  summaries: readonly CanvasStudentCourseGradeSummary[],
): void {
  database.execute("DELETE FROM canvas_course_grade_summaries")
  for (const summary of summaries) {
    database.execute(
      `INSERT INTO canvas_course_grade_summaries
         (course_id, current_score, current_grade, final_score, final_grade)
       VALUES (?, ?, ?, ?, ?)`,
      [
        summary.course.id,
        toNullableNumber(summary.currentScore),
        summary.currentGrade ?? null,
        toNullableNumber(summary.finalScore),
        summary.finalGrade ?? null,
      ],
    )
  }
}

function replaceTodoItems(
  database: DatabaseService,
  items: readonly CanvasStudentTodoItem[],
): void {
  database.execute("DELETE FROM canvas_todo_items")
  for (const item of items) {
    database.execute(
      `INSERT INTO canvas_todo_items (course_id, title, type, due_at, html_url)
       VALUES (?, ?, ?, ?, ?)`,
      [
        item.courseId ?? null,
        item.title,
        item.type,
        item.dueAt ?? null,
        item.htmlUrl ?? null,
      ],
    )
  }
}

function buildPeerReviewRowId(item: CanvasStudentPeerReviewTodo): string {
  return [
    item.courseId,
    item.assignmentId,
    item.revieweeUserId ?? "none",
    item.assessorUserId ?? "none",
  ].join(":")
}

function replacePeerReviewTodo(
  database: DatabaseService,
  items: readonly CanvasStudentPeerReviewTodo[],
): void {
  database.execute("DELETE FROM canvas_peer_review_todo")
  for (const item of items) {
    database.execute(
      `INSERT INTO canvas_peer_review_todo
         (id, course_id, assignment_id, assignment_name, reviewee_user_id, assessor_user_id, workflow_state)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        buildPeerReviewRowId(item),
        item.courseId,
        item.assignmentId,
        item.assignmentName,
        item.revieweeUserId ?? null,
        item.assessorUserId ?? null,
        item.workflowState ?? null,
      ],
    )
  }
}

function upsertCourses(database: DatabaseService, courses: readonly Course[]): void {
  const syncedAt = new Date().toISOString()
  for (const course of courses) {
    database.execute(
      `INSERT OR REPLACE INTO courses (id, name, code, professor, canvas_id, term, last_sync_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        course.id,
        course.name,
        course.code,
        course.professor ?? null,
        course.canvasId ?? null,
        course.term ?? null,
        course.lastSyncAt ?? syncedAt,
      ],
    )
  }
}

async function callDecodedTool<A>(
  gateway: PluginGatewayService,
  toolName: string,
  args: Record<string, unknown>,
  schema: Schema.Schema<A, any, never>,
): Promise<A> {
  const callResult = await gateway.callTool(toolName, args)
  if (!callResult.ok) {
    logGatewayFailure(`${toolName} call failed`, callResult)
    throw new Error(callResult.message)
  }

  const toolResult = readStructuredToolResult(toolName, callResult.result)
  if (!toolResult.ok) {
    throw new Error(toolResult.message)
  }

  return decodeResult(schema, toolName, toolResult.data)
}

function readCourses(database: DatabaseService): Course[] {
  const rows = database.query<CourseRow>(
    `SELECT id, name, code, professor, canvas_id, term, last_sync_at FROM courses ORDER BY name ASC`,
  )
  return rows.map<Course>((row) => ({
    id: row.id as Course["id"],
    name: row.name,
    code: row.code,
    professor: row.professor ?? undefined,
    canvasId: row.canvas_id ?? undefined,
    term: row.term ?? undefined,
    lastSyncAt: row.last_sync_at ?? undefined,
  }))
}

function readAssignments(database: DatabaseService): Array<CourseWorkItem & {
  readonly isUpcoming: boolean
  readonly statusBucket?: SubmissionBucket
}> {
  const rows = database.query<CourseworkRow>(
    `SELECT id, course_id, title, effective_due_at, source_type, freshness_status,
            points_possible, submission_status, grade, html_url, canvas_assignment_id,
            is_upcoming, status_bucket
     FROM coursework_items
     WHERE source_type = 'assignment'
     ORDER BY effective_due_at ASC NULLS LAST`,
  )

  return rows.map((row) => ({
    id: row.id as CourseWorkItem["id"],
    courseId: row.course_id as CourseWorkItem["courseId"],
    title: row.title,
    effectiveDueAt: row.effective_due_at ?? undefined,
    sourceType: "assignment" as const,
    sourceId: row.canvas_assignment_id ?? row.id,
    freshnessStatus: row.freshness_status as CourseWorkItem["freshnessStatus"],
    pointsPossible: row.points_possible ?? undefined,
    submissionStatus: row.submission_status ?? undefined,
    grade: row.grade ?? undefined,
    htmlUrl: row.html_url ?? undefined,
    isUpcoming: row.is_upcoming === 1,
    statusBucket: row.status_bucket ?? undefined,
  })).sort(courseworkSort)
}

function readCourseGradeSummaries(database: DatabaseService): CanvasStudentCourseGradeSummary[] {
  const courses = new Map(readCourses(database).map((course) => [course.id, course]))
  const rows = database.query<CourseGradeSummaryRow>(
    `SELECT course_id, current_score, current_grade, final_score, final_grade
     FROM canvas_course_grade_summaries
     ORDER BY course_id ASC`,
  )

  return rows.flatMap<CanvasStudentCourseGradeSummary>((row) => {
    const course = courses.get(row.course_id as Course["id"])
    if (!course) return []
    return [{
      course,
      currentScore: row.current_score ?? undefined,
      currentGrade: row.current_grade ?? undefined,
      finalScore: row.final_score ?? undefined,
      finalGrade: row.final_grade ?? undefined,
    }]
  })
}

function readTodoItems(database: DatabaseService): CanvasStudentTodoItem[] {
  const rows = database.query<TodoItemRow>(
    `SELECT course_id, title, type, due_at, html_url FROM canvas_todo_items ORDER BY due_at ASC NULLS LAST`,
  )
  return rows.map<CanvasStudentTodoItem>((row) => ({
    courseId: row.course_id ? (row.course_id as CanvasStudentTodoItem["courseId"]) : undefined,
    title: row.title,
    type: row.type,
    dueAt: row.due_at ?? undefined,
    htmlUrl: row.html_url ?? undefined,
  }))
}

function readPeerReviewTodo(database: DatabaseService): CanvasStudentPeerReviewTodo[] {
  const rows = database.query<PeerReviewTodoRow>(
    `SELECT course_id, assignment_id, assignment_name, reviewee_user_id, assessor_user_id, workflow_state
     FROM canvas_peer_review_todo
     ORDER BY assignment_name ASC`,
  )
  return rows.map<CanvasStudentPeerReviewTodo>((row) => ({
    courseId: row.course_id as CanvasStudentPeerReviewTodo["courseId"],
    assignmentId: row.assignment_id,
    assignmentName: row.assignment_name,
    revieweeUserId: row.reviewee_user_id ?? undefined,
    assessorUserId: row.assessor_user_id ?? undefined,
    workflowState: row.workflow_state ?? undefined,
  }))
}

export function createSyncService(
  gateway: PluginGatewayService,
  pushBus: PushBusService,
  database: DatabaseService,
): CanvasSyncServiceShape {
  let inFlight: Promise<void> | null = null

  async function runSync(): Promise<void> {
    void pushBus.publish(PUSH_CHANNELS.CANVAS_SYNC_PROGRESS, {
      courseId: "",
      progress: 0,
      status: "syncing",
    })

    try {
      const [coursesResult, upcomingAssignments, submissionStatus, courseGrades] = await Promise.all([
        callDecodedTool(gateway, TOOL_LIST_COURSES, {}, CanvasListCoursesResult),
        callDecodedTool(gateway, TOOL_GET_MY_UPCOMING_ASSIGNMENTS, {}, CanvasGetMyUpcomingAssignmentsResult),
        callDecodedTool(gateway, TOOL_GET_MY_SUBMISSION_STATUS, {}, CanvasGetMySubmissionStatusResult),
        callDecodedTool(gateway, TOOL_GET_MY_COURSE_GRADES, {}, CanvasGetMyCourseGradesResult),
      ])

      const courses = [...coursesResult.courses].sort(courseSort)

      void pushBus.publish(PUSH_CHANNELS.CANVAS_SYNC_PROGRESS, {
        courseId: "",
        progress: 65,
        status: "syncing",
      })

      const [todoResult, peerResult] = await Promise.allSettled([
        callDecodedTool(gateway, TOOL_GET_MY_TODO_ITEMS, {}, CanvasGetMyTodoItemsResult),
        callDecodedTool(gateway, TOOL_GET_MY_PEER_REVIEWS_TODO, {}, CanvasGetMyPeerReviewsTodoResult),
      ])

      const todoItems: CanvasStudentTodoItem[] =
        todoResult.status === "fulfilled" ? todoResult.value.items.slice() : []
      if (todoResult.status === "rejected") logError("optional canvas todo sync failed", todoResult.reason)

      const peerReviewsTodo: CanvasStudentPeerReviewTodo[] =
        peerResult.status === "fulfilled" ? peerResult.value.items.slice() : []
      if (peerResult.status === "rejected") logError("optional canvas peer review sync failed", peerResult.reason)

      const assignmentRecords = extractAssignmentMap(upcomingAssignments.items, submissionStatus)

      database.transaction(() => {
        upsertCourses(database, courses)
        replaceAssignmentState(database, assignmentRecords)
        replaceCourseGradeSummaries(database, courseGrades.courses)
        replaceTodoItems(database, todoItems)
        replacePeerReviewTodo(database, peerReviewsTodo)
      })

      void pushBus.publish(PUSH_CHANNELS.CANVAS_SYNC_PROGRESS, {
        courseId: "",
        progress: 100,
        status: "done",
      })
    } catch (error) {
      logError("sync failed", error)
      void pushBus.publish(PUSH_CHANNELS.CANVAS_SYNC_PROGRESS, {
        courseId: "",
        progress: 0,
        status: "error",
      })
    }
  }

  async function sync(): Promise<void> {
    if (inFlight) return inFlight
    inFlight = runSync().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  function listCourses(): Course[] {
    return readCourses(database)
  }

  function getMyUpcomingAssignments(days?: number): CourseWorkItem[] {
    const all = readAssignments(database).filter((item) => item.isUpcoming)
    if (days === undefined) return all

    const cutoff = Date.now() + days * 24 * 60 * 60 * 1000
    return all.filter((item) => {
      if (!item.effectiveDueAt) return false
      return new Date(item.effectiveDueAt).getTime() <= cutoff
    })
  }

  function getMySubmissionStatus(courseId?: string): {
    submitted: CourseWorkItem[]
    pending: CourseWorkItem[]
    overdue: CourseWorkItem[]
  } {
    const items = readAssignments(database).filter((item) => !courseId || item.courseId === courseId)
    return {
      submitted: items.filter((item) => item.statusBucket === "submitted"),
      pending: items.filter((item) => item.statusBucket === "pending"),
      overdue: items.filter((item) => item.statusBucket === "overdue"),
    }
  }

  function getMyCourseGrades(): CanvasStudentCourseGradeSummary[] {
    return readCourseGradeSummaries(database)
  }

  function getMyTodoItems(): CanvasStudentTodoItem[] {
    return readTodoItems(database)
  }

  function getMyPeerReviewsTodo(courseId?: string): CanvasStudentPeerReviewTodo[] {
    return readPeerReviewTodo(database).filter((item) => !courseId || item.courseId === courseId)
  }

  async function getAssignmentDetails(
    params: CanvasAssignmentDetailsParams,
  ): Promise<CanvasAssignmentDetailsResult> {
    return callDecodedTool(gateway, TOOL_GET_ASSIGNMENT_DETAILS, params, CanvasAssignmentDetailsResult)
  }

  async function listAssignments(
    params: CanvasListAssignmentsParams,
  ): Promise<CanvasListAssignmentsResult> {
    return callDecodedTool(gateway, TOOL_LIST_ASSIGNMENTS, params, CanvasListAssignmentsResult)
  }

  async function getCourseContentOverview(
    params: CanvasCourseContentOverviewParams,
  ): Promise<CanvasCourseContentOverviewResult> {
    return callDecodedTool(
      gateway,
      TOOL_GET_COURSE_CONTENT_OVERVIEW,
      params,
      CanvasCourseContentOverviewResult,
    )
  }

  async function getCourseStructure(
    params: CanvasCourseStructureParams,
  ): Promise<CanvasCourseStructureResult> {
    return callDecodedTool(gateway, TOOL_GET_COURSE_STRUCTURE, params, CanvasCourseStructureResult)
  }

  async function downloadCourseFile(
    params: CanvasDownloadCourseFileParams,
  ): Promise<CanvasDownloadCourseFileResult> {
    return callDecodedTool(gateway, TOOL_DOWNLOAD_COURSE_FILE, params, CanvasDownloadCourseFileResult)
  }

  return {
    sync,
    listCourses,
    getMyUpcomingAssignments,
    getMySubmissionStatus,
    getMyCourseGrades,
    getMyTodoItems,
    getMyPeerReviewsTodo,
    getAssignmentDetails,
    listAssignments,
    getCourseContentOverview,
    getCourseStructure,
    downloadCourseFile,
  }
}

export const CanvasSyncServiceLive = Layer.effect(
  CanvasSyncService,
  Effect.gen(function* () {
    const gateway = yield* PluginGateway
    const pushBus = yield* PushBus
    const database = yield* Database
    return createSyncService(gateway, pushBus, database)
  }),
)
