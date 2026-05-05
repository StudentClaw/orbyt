import { Context, Effect, Layer } from "effect"
import {
  CanvasAssignmentDetailsParams,
  CanvasAssignmentDetailsResult,
  CanvasArchiveAssignmentParams,
  CanvasArchiveAssignmentResult,
  CanvasUnarchiveAssignmentParams,
  CanvasUnarchiveAssignmentResult,
  CanvasCourseContentOverviewParams,
  CanvasCourseContentOverviewResult,
  CanvasCourseStructureParams,
  CanvasCourseStructureResult,
  CanvasDownloadCourseFileParams,
  CanvasDownloadCourseFileResult,
  CanvasGetMySubmissionStatusParams,
  CanvasGetMySubmissionStatusResult,
  CanvasListAssignmentsParams,
  CanvasListAssignmentsResult,
  PUSH_CHANNELS,
  type CanvasStudentCourseGradeSummary,
  type CanvasStudentPeerReviewTodo,
  type CanvasStudentTodoItem,
  type CanvasSyncStatusSummary,
  type Course,
  type CourseWorkItem,
} from "@orbyt/contracts"
import { CanvasApi, type CanvasApiService } from "./CanvasApi.js"
import { PushBus, type PushBusService } from "../ws/PushBus.js"
import { Database, type DatabaseService } from "../db/Database.js"
import { createMemoryPaths } from "../memory/paths.js"
import type { MemoryPaths } from "../memory/paths.js"
import {
  promoteAssignmentSourceRuleInMemory,
  projectAssignmentSourceDiscoveryHints,
  projectAssignmentSourceRules,
} from "../memory/assignment-source-rules.js"
import { ensureCanvasCourseMemoryNodes } from "../memory/course-nodes.js"
import { MemorizeService } from "../memory/service.js"
import { parseDatedReadingSchedule } from "./dated-reading-schedule.js"

// Canvas tool names previously routed through the plugin gateway have been
// replaced with direct CanvasApiClient method calls. See ./CanvasApiClient.ts.

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
  description: string | null
  effective_due_at: string | null
  source_type: string
  source_due_date_kind: string | null
  freshness_status: string
  cached_at: string | null
  last_verified_at: string | null
  source_updated_at: string | null
  points_possible: number | null
  submission_status: string | null
  grade: string | null
  html_url: string | null
  canvas_assignment_id: string | null
  assignment_source_id: string | null
  is_upcoming: number | null
  status_bucket: SubmissionBucket | null
}

type ArchivedCourseworkRow = {
  id: string
  payload: string | null
}

type AssignmentSourceRow = {
  id: string
  local_course_id: string
  canvas_course_id: string
  source_kind: "canvas_page"
  url: string
  parser: "dated_reading_schedule"
  purpose: string | null
  graph_node_path: string | null
}

type MemoryGraphPreferenceRow = {
  memory_graph_path: string | null
}

type CourseGradeSummaryRow = {
  course_id: string
  current_score: number | null
  current_grade: string | null
  final_score: number | null
  final_grade: string | null
  units: number | null
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

export type CanvasMemoryPromotionFlush = () => Promise<void>

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
  readonly archiveAssignment: (assignmentId: CanvasArchiveAssignmentParams["assignmentId"]) => CanvasArchiveAssignmentResult
  readonly unarchiveAssignment: (assignmentId: CanvasUnarchiveAssignmentParams["assignmentId"]) => CanvasUnarchiveAssignmentResult
  readonly getCourseContentOverview: (params: CanvasCourseContentOverviewParams) => Promise<CanvasCourseContentOverviewResult>
  readonly getCourseStructure: (params: CanvasCourseStructureParams) => Promise<CanvasCourseStructureResult>
  readonly downloadCourseFile: (params: CanvasDownloadCourseFileParams) => Promise<CanvasDownloadCourseFileResult>
  readonly getSyncStatus: () => CanvasSyncStatusSummary
}

export class CanvasSyncService extends Context.Tag("CanvasSyncService")<
  CanvasSyncService,
  CanvasSyncServiceShape
>() {}

function logError(context: string, error: unknown): void {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  process.stderr.write(`[CanvasSync] ${context}: ${message}\n`)
}

const CANVAS_SYNC_JOB_NAME = "canvas-sync"

type CanvasSyncRunRow = {
  finished_at: number | null
  error: string | null
}

/**
 * Reads the most recent successful and failed canvas-sync cron runs out of
 * cron_runs. Used to hydrate the dashboard's lastSync atom on app start so
 * the "Showing your saved Canvas snapshot" toast doesn't show falsely after
 * a successful sync that left the courses table empty (or after an app
 * restart wiped in-memory state).
 */
function readCanvasSyncStatus(database: DatabaseService): CanvasSyncStatusSummary {
  const lastSuccess = database.get<CanvasSyncRunRow>(
    `SELECT cr.finished_at, cr.error
       FROM cron_runs cr
       JOIN cron_jobs cj ON cj.id = cr.job_id
      WHERE cj.name = ? AND cr.status = 'success'
      ORDER BY cr.started_at DESC
      LIMIT 1`,
    [CANVAS_SYNC_JOB_NAME],
  )
  const lastFailure = database.get<CanvasSyncRunRow>(
    `SELECT cr.finished_at, cr.error
       FROM cron_runs cr
       JOIN cron_jobs cj ON cj.id = cr.job_id
      WHERE cj.name = ? AND cr.status = 'failed'
      ORDER BY cr.started_at DESC
      LIMIT 1`,
    [CANVAS_SYNC_JOB_NAME],
  )

  const successAt = lastSuccess?.finished_at ?? null
  const failureAt = lastFailure?.finished_at ?? null

  const lastSuccessAt = successAt ? new Date(successAt).toISOString() : null

  let lastError: CanvasSyncStatusSummary["lastError"] = null
  if (failureAt && (!successAt || failureAt > successAt)) {
    lastError = {
      at: new Date(failureAt).toISOString(),
      message: lastFailure?.error ?? "Canvas sync failed.",
    }
  }

  return { lastSuccessAt, lastError }
}

async function flushMemoryPromotion(
  memoryPromotionFlush?: CanvasMemoryPromotionFlush,
): Promise<void> {
  if (!memoryPromotionFlush) return

  try {
    await memoryPromotionFlush()
  } catch (error) {
    logError("memory promotion flush failed", error)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
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
    description: next.description ?? base.description,
    effectiveDueAt: next.effectiveDueAt ?? base.effectiveDueAt,
    sourceType: next.sourceType ?? base.sourceType,
    sourceId: next.sourceId ?? base.sourceId,
    sourceDueDateKind: next.sourceDueDateKind ?? base.sourceDueDateKind,
    freshnessStatus: next.freshnessStatus ?? base.freshnessStatus,
    cachedAt: next.cachedAt ?? base.cachedAt,
    lastVerifiedAt: next.lastVerifiedAt ?? base.lastVerifiedAt,
    sourceUpdatedAt: next.sourceUpdatedAt ?? base.sourceUpdatedAt,
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

function writeCourseworkRecord(
  database: DatabaseService,
  record: SyncedAssignmentRecord,
  assignmentSourceId: string | null,
): void {
  const item = record.item
  database.execute(
    `INSERT OR REPLACE INTO coursework_items
       (id, course_id, title, description, effective_due_at, source_type, source_due_date_kind,
        freshness_status, cached_at, last_verified_at, source_updated_at, points_possible,
        submission_status, grade, html_url, canvas_assignment_id, assignment_source_id,
        is_upcoming, status_bucket)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.courseId,
      item.title,
      item.description ?? null,
      item.effectiveDueAt ?? null,
      item.sourceType,
      item.sourceDueDateKind ?? null,
      item.freshnessStatus,
      item.cachedAt ?? null,
      item.lastVerifiedAt ?? null,
      item.sourceUpdatedAt ?? null,
      item.pointsPossible ?? null,
      item.submissionStatus ?? null,
      item.grade ?? null,
      item.htmlUrl ?? null,
      item.sourceId,
      assignmentSourceId,
      record.isUpcoming ? 1 : 0,
      record.statusBucket ?? null,
    ],
  )
}

function readArchivedCourseworkIds(database: DatabaseService): Set<string> {
  return new Set(
    database.query<ArchivedCourseworkRow>("SELECT id FROM archived_coursework_items")
      .map((row) => row.id),
  )
}

function replaceOfficialAssignmentState(
  database: DatabaseService,
  records: ReadonlyMap<string, SyncedAssignmentRecord>,
): void {
  const archivedIds = readArchivedCourseworkIds(database)
  database.execute("DELETE FROM coursework_items WHERE source_type = 'assignment'")

  for (const record of records.values()) {
    if (archivedIds.has(record.item.id)) continue
    writeCourseworkRecord(database, record, null)
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
         (course_id, current_score, current_grade, final_score, final_grade, units)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        summary.course.id,
        toNullableNumber(summary.currentScore),
        summary.currentGrade ?? null,
        toNullableNumber(summary.finalScore),
        summary.finalGrade ?? null,
        toNullableNumber(summary.units),
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
      `INSERT OR REPLACE INTO canvas_peer_review_todo
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
    `SELECT id, course_id, title, description, effective_due_at, source_type,
            source_due_date_kind, freshness_status, cached_at, last_verified_at,
            source_updated_at, points_possible, submission_status, grade, html_url,
            canvas_assignment_id, assignment_source_id, is_upcoming, status_bucket
     FROM coursework_items
     ORDER BY effective_due_at ASC NULLS LAST`,
  )

  return rows.map((row) => ({
    id: row.id as CourseWorkItem["id"],
    courseId: row.course_id as CourseWorkItem["courseId"],
    title: row.title,
    description: row.description ?? undefined,
    effectiveDueAt: row.effective_due_at ?? undefined,
    sourceType: row.source_type as CourseWorkItem["sourceType"],
    sourceId: row.canvas_assignment_id ?? row.id,
    sourceDueDateKind: row.source_due_date_kind
      ? row.source_due_date_kind as CourseWorkItem["sourceDueDateKind"]
      : undefined,
    freshnessStatus: row.freshness_status as CourseWorkItem["freshnessStatus"],
    cachedAt: row.cached_at ?? undefined,
    lastVerifiedAt: row.last_verified_at ?? undefined,
    sourceUpdatedAt: row.source_updated_at ?? undefined,
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
    `SELECT course_id, current_score, current_grade, final_score, final_grade, units
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
      units: row.units ?? undefined,
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

function resolveMemoryPaths(database: DatabaseService) {
  const row = database.get<MemoryGraphPreferenceRow>(
    "SELECT memory_graph_path FROM user_preferences WHERE id = 1",
  )
  return createMemoryPaths({
    env: process.env,
    graphDirOverride: row?.memory_graph_path ?? null,
  })
}

function readEnabledAssignmentSources(database: DatabaseService): AssignmentSourceRow[] {
  return database.query<AssignmentSourceRow>(
    `SELECT id, local_course_id, canvas_course_id, source_kind, url, parser, purpose, graph_node_path
     FROM course_assignment_sources
     WHERE enabled = 1 AND local_course_id IS NOT NULL
     ORDER BY updated_at ASC`,
  )
}

function updateAssignmentSourceChecked(
  database: DatabaseService,
  sourceId: string,
  error: string | null,
  now: Date,
): void {
  database.execute(
    `UPDATE course_assignment_sources
     SET last_checked_at = ?, last_error = ?, updated_at = ?
     WHERE id = ?`,
    [now.toISOString(), error, now.toISOString(), sourceId],
  )
}

function sourcePageIdFromUrl(url: string): { type: "front" } | { type: "page"; pageId: string } {
  const parsed = new URL(url)
  const parts = parsed.pathname.split("/").filter(Boolean)
  const wikiIndex = parts.findIndex((part) => part === "wiki")
  if (wikiIndex >= 0 && wikiIndex === parts.length - 1) {
    return { type: "front" }
  }
  const pagesIndex = parts.findIndex((part) => part === "pages")
  const pageId = pagesIndex >= 0 ? parts[pagesIndex + 1] : undefined
  return pageId ? { type: "page", pageId } : { type: "front" }
}

function statusForInferredItem(item: CourseWorkItem, now: Date): {
  readonly isUpcoming: boolean
  readonly statusBucket: SubmissionBucket
} {
  if (!item.effectiveDueAt) {
    return { isUpcoming: false, statusBucket: "pending" }
  }
  const due = new Date(item.effectiveDueAt).getTime()
  const current = now.getTime()
  return due >= current
    ? { isUpcoming: true, statusBucket: "pending" }
    : { isUpcoming: false, statusBucket: "overdue" }
}

function markMissingSourceItemsStale(
  database: DatabaseService,
  sourceId: string,
  freshIds: readonly string[],
  now: Date,
): void {
  if (freshIds.length === 0) {
    database.execute(
      `UPDATE coursework_items
       SET freshness_status = 'stale', last_verified_at = ?
       WHERE assignment_source_id = ? AND source_type = 'page'`,
      [now.toISOString(), sourceId],
    )
    return
  }

  const placeholders = freshIds.map(() => "?").join(", ")
  database.execute(
    `UPDATE coursework_items
     SET freshness_status = 'stale', last_verified_at = ?
     WHERE assignment_source_id = ? AND source_type = 'page' AND id NOT IN (${placeholders})`,
    [now.toISOString(), sourceId, ...freshIds],
  )
}

async function fetchAssignmentSourcePage(
  apiClient: CanvasApiService,
  source: AssignmentSourceRow,
) {
  const lookup = sourcePageIdFromUrl(source.url)
  if (lookup.type === "front") {
    return apiClient.getFrontPage({ courseId: source.canvas_course_id })
  }
  return apiClient.getPageContent({
    courseId: source.canvas_course_id,
    pageId: lookup.pageId,
  })
}

async function syncRememberedAssignmentSources(
  apiClient: CanvasApiService,
  database: DatabaseService,
  sources: readonly AssignmentSourceRow[],
  now: Date,
): Promise<void> {
  const courses = new Map(readCourses(database).map((course) => [course.id, course]))

  for (const source of sources) {
    const course = courses.get(source.local_course_id as Course["id"])
    if (!course) {
      updateAssignmentSourceChecked(database, source.id, "Local course not found.", now)
      continue
    }

    try {
      const result = await fetchAssignmentSourcePage(apiClient, source)
      const page = result.page
      const body = page.body ?? ""
      const parsedItems = source.parser === "dated_reading_schedule"
        ? parseDatedReadingSchedule({
            body,
            course,
            sourceId: source.id,
            sourceUrl: page.html_url ?? source.url,
            sourceUpdatedAt: page.updated_at ?? undefined,
            now,
          })
        : []
      if (parsedItems.length === 0) {
        updateAssignmentSourceChecked(database, source.id, "No coursework items found in remembered source.", now)
        continue
      }

      promoteAssignmentSourceRuleInMemory({
        id: source.id,
        canvasCourseId: source.canvas_course_id,
        sourceKind: source.source_kind,
        url: source.url,
        parser: source.parser,
        purpose: source.purpose,
        graphNodePath: source.graph_node_path,
      })

      const archivedIds = readArchivedCourseworkIds(database)
      const visibleItems = parsedItems.filter((item) => !archivedIds.has(item.id))
      const freshIds = visibleItems.map((item) => item.id)
      database.transaction(() => {
        for (const item of visibleItems) {
          const status = statusForInferredItem(item, now)
          writeCourseworkRecord(
            database,
            {
              item,
              isUpcoming: status.isUpcoming,
              statusBucket: status.statusBucket,
            },
            source.id,
          )
        }
        markMissingSourceItemsStale(database, source.id, freshIds, now)
        updateAssignmentSourceChecked(database, source.id, null, now)
      })
    } catch (error) {
      logError(`remembered assignment source ${source.id} failed`, error)
      updateAssignmentSourceChecked(
        database,
        source.id,
        error instanceof Error ? error.message : String(error),
        now,
      )
    }
  }
}

export function createSyncService(
  apiClient: CanvasApiService,
  pushBus: PushBusService,
  database: DatabaseService,
  memoryPathsOverride?: MemoryPaths,
  memoryPromotionFlush?: CanvasMemoryPromotionFlush,
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
        apiClient.listCourses(),
        apiClient.getMyUpcomingAssignments(),
        apiClient.getMySubmissionStatus(),
        apiClient.getMyCourseGrades(),
      ])

      const courses = [...coursesResult.courses].sort(courseSort)

      void pushBus.publish(PUSH_CHANNELS.CANVAS_SYNC_PROGRESS, {
        courseId: "",
        progress: 65,
        status: "syncing",
      })

      const [todoResult, peerResult] = await Promise.allSettled([
        apiClient.getMyTodoItems(),
        apiClient.getMyPeerReviewsTodo(),
      ])

      const todoItems = (todoResult.status === "fulfilled"
        ? todoResult.value.items.slice()
        : []) as CanvasStudentTodoItem[]
      if (todoResult.status === "rejected") logError("optional canvas todo sync failed", todoResult.reason)

      const peerReviewsTodo = (peerResult.status === "fulfilled"
        ? peerResult.value.items.slice()
        : []) as CanvasStudentPeerReviewTodo[]
      if (peerResult.status === "rejected") logError("optional canvas peer review sync failed", peerResult.reason)

      const assignmentRecords = extractAssignmentMap(
        upcomingAssignments.items,
        submissionStatus as unknown as CanvasGetMySubmissionStatusResult,
      )

      database.transaction(() => {
        upsertCourses(database, courses)
        replaceOfficialAssignmentState(database, assignmentRecords)
        replaceCourseGradeSummaries(database, courseGrades.courses)
        replaceTodoItems(database, todoItems)
        replacePeerReviewTodo(database, peerReviewsTodo)
      })

      const memoryPaths = memoryPathsOverride ?? resolveMemoryPaths(database)
      ensureCanvasCourseMemoryNodes(memoryPaths, courses)
      await flushMemoryPromotion(memoryPromotionFlush)
      const confirmedRules = projectAssignmentSourceRules(database, memoryPaths)
      projectAssignmentSourceDiscoveryHints(database, memoryPaths, confirmedRules)
      await syncRememberedAssignmentSources(
        apiClient,
        database,
        readEnabledAssignmentSources(database),
        new Date(),
      )

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
      throw error
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
    return apiClient.getAssignmentDetails(params) as Promise<CanvasAssignmentDetailsResult>
  }

  function archiveAssignment(
    assignmentId: CanvasArchiveAssignmentParams["assignmentId"],
  ): CanvasArchiveAssignmentResult {
    const existingArchive = database.get<ArchivedCourseworkRow>(
      "SELECT id FROM archived_coursework_items WHERE id = ?",
      [assignmentId],
    )
    if (existingArchive) {
      return { archived: true, assignmentId }
    }

    const row = database.get<CourseworkRow>(
      `SELECT id, course_id, title, description, effective_due_at, source_type,
              source_due_date_kind, freshness_status, cached_at, last_verified_at,
              source_updated_at, points_possible, submission_status, grade, html_url,
              canvas_assignment_id, assignment_source_id, is_upcoming, status_bucket
       FROM coursework_items
       WHERE id = ?`,
      [assignmentId],
    )
    if (!row) {
      throw new Error(`Assignment ${assignmentId} was not found in local coursework.`)
    }

    const now = new Date().toISOString()
    const payload = JSON.stringify(row)
    database.transaction(() => {
      database.execute(
        `INSERT INTO archived_coursework_items
           (id, course_id, source_type, source_id, title, html_url, archived_at, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.course_id,
          row.source_type,
          row.canvas_assignment_id ?? row.id,
          row.title,
          row.html_url,
          now,
          payload,
        ],
      )
      database.execute("DELETE FROM coursework_items WHERE id = ?", [assignmentId])
    })

    return { archived: true, assignmentId }
  }

  function unarchiveAssignment(
    assignmentId: CanvasUnarchiveAssignmentParams["assignmentId"],
  ): CanvasUnarchiveAssignmentResult {
    const archived = database.get<ArchivedCourseworkRow>(
      "SELECT id, payload FROM archived_coursework_items WHERE id = ?",
      [assignmentId],
    )
    if (!archived) {
      return { unarchived: true, assignmentId }
    }
    if (!archived.payload) {
      throw new Error(`Assignment ${assignmentId} cannot be restored: missing snapshot.`)
    }

    const row = JSON.parse(archived.payload) as CourseworkRow

    database.transaction(() => {
      database.execute(
        `INSERT OR REPLACE INTO coursework_items
           (id, course_id, title, description, effective_due_at, source_type,
            source_due_date_kind, freshness_status, cached_at, last_verified_at,
            source_updated_at, points_possible, submission_status, grade, html_url,
            canvas_assignment_id, assignment_source_id, is_upcoming, status_bucket)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.course_id,
          row.title,
          row.description,
          row.effective_due_at,
          row.source_type,
          row.source_due_date_kind,
          row.freshness_status,
          row.cached_at,
          row.last_verified_at,
          row.source_updated_at,
          row.points_possible,
          row.submission_status,
          row.grade,
          row.html_url,
          row.canvas_assignment_id,
          row.assignment_source_id,
          row.is_upcoming,
          row.status_bucket,
        ],
      )
      database.execute("DELETE FROM archived_coursework_items WHERE id = ?", [assignmentId])
    })

    return { unarchived: true, assignmentId }
  }

  async function listAssignments(
    params: CanvasListAssignmentsParams,
  ): Promise<CanvasListAssignmentsResult> {
    return apiClient.listAssignments(params) as Promise<CanvasListAssignmentsResult>
  }

  async function getCourseContentOverview(
    params: CanvasCourseContentOverviewParams,
  ): Promise<CanvasCourseContentOverviewResult> {
    return apiClient.getCourseContentOverview(params) as Promise<CanvasCourseContentOverviewResult>
  }

  async function getCourseStructure(
    params: CanvasCourseStructureParams,
  ): Promise<CanvasCourseStructureResult> {
    return apiClient.getCourseStructure(params) as Promise<CanvasCourseStructureResult>
  }

  async function downloadCourseFile(
    params: CanvasDownloadCourseFileParams,
  ): Promise<CanvasDownloadCourseFileResult> {
    return apiClient.downloadCourseFile(params) as Promise<CanvasDownloadCourseFileResult>
  }

  function getSyncStatus(): CanvasSyncStatusSummary {
    return readCanvasSyncStatus(database)
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
    archiveAssignment,
    unarchiveAssignment,
    getCourseContentOverview,
    getCourseStructure,
    downloadCourseFile,
    getSyncStatus,
  }
}

export const CanvasSyncServiceLive = Layer.effect(
  CanvasSyncService,
  Effect.gen(function* () {
    const apiClient = yield* CanvasApi
    const pushBus = yield* PushBus
    const database = yield* Database
    const memorize = yield* MemorizeService
    return createSyncService(apiClient, pushBus, database, undefined, async () => {
      await memorize.runIfNeeded(new Date(), { trigger: "auto" })
    })
  }),
)
