import { Context, Effect, Layer } from "effect"
import { Schema } from "@effect/schema"
import {
  CanvasGetCoursesResult,
  CanvasGetCourseworkResult,
  CanvasGetGradesResult,
  PUSH_CHANNELS,
  type GatewayToolCallFailure,
  type Course,
  type CourseWorkItem,
  type Grade,
} from "@student-claw/contracts"
import { PluginGateway, type PluginGatewayService } from "../mcp/PluginGateway.js"
import { PushBus, type PushBusService } from "../ws/PushBus.js"
import { Database, type DatabaseService } from "../db/Database.js"

const TOOL_GET_COURSES = "canvas.get_courses"
const TOOL_GET_COURSEWORK = "canvas.get_coursework"
const TOOL_GET_GRADES = "canvas.get_grades"

const ALL_SOURCES = ["assignment", "module", "page", "announcement"] as const
const COURSE_ID_PREFIX = "canvas-course:"
const COURSEWORK_ID_PREFIX = "canvas-coursework:"

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
}

type GradeRow = {
  id: string
  course_id: string
  title: string
  grade: string | null
  points_possible: number | null
  points_earned: number | null
  submission_status: string | null
  canvas_assignment_id: string | null
}

export interface CanvasSyncServiceShape {
  readonly sync: () => Promise<void>
  readonly getCourses: () => Course[]
  readonly getCoursework: () => CourseWorkItem[]
  readonly getGrades: () => Grade[]
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

function decodeCanvasCourseId(encodedCourseId: string): string {
  return encodedCourseId.startsWith(COURSE_ID_PREFIX)
    ? encodedCourseId.slice(COURSE_ID_PREFIX.length)
    : encodedCourseId
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

function tryDecodeCoursesResult(raw: unknown): { ok: true; courses: Course[] } | { ok: false } {
  try {
    const decoded = Schema.decodeUnknownSync(CanvasGetCoursesResult)(raw)
    return { ok: true, courses: [...decoded.courses] }
  } catch (error) {
    logError("failed to decode canvas.get_courses result", error)
    return { ok: false }
  }
}

function tryDecodeCourseworkResult(
  raw: unknown,
): { ok: true; items: CourseWorkItem[] } | { ok: false } {
  try {
    const decoded = Schema.decodeUnknownSync(CanvasGetCourseworkResult)(raw)
    return { ok: true, items: [...decoded.items] }
  } catch (error) {
    logError("failed to decode canvas.get_coursework result", error)
    return { ok: false }
  }
}

function tryDecodeGradesResult(raw: unknown): { ok: true; grades: Grade[] } | { ok: false } {
  try {
    const decoded = Schema.decodeUnknownSync(CanvasGetGradesResult)(raw)
    return { ok: true, grades: [...decoded.grades] }
  } catch (error) {
    logError("failed to decode canvas.get_grades result", error)
    return { ok: false }
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
        syncedAt,
      ],
    )
  }
}

function extractCanvasAssignmentId(item: CourseWorkItem): string | null {
  if (item.sourceType !== "assignment") return null
  return item.sourceId || null
}

function upsertCoursework(database: DatabaseService, items: readonly CourseWorkItem[]): void {
  for (const item of items) {
    database.execute(
      `INSERT OR REPLACE INTO coursework_items
         (id, course_id, title, effective_due_at, source_type, freshness_status,
          points_possible, submission_status, grade, html_url, canvas_assignment_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        extractCanvasAssignmentId(item),
      ],
    )
  }
}

function upsertGrades(database: DatabaseService, grades: readonly Grade[]): void {
  for (const grade of grades) {
    const canvasCourseId = decodeCanvasCourseId(grade.courseId)
    const expectedId = `${COURSEWORK_ID_PREFIX}assignment:${canvasCourseId}:${grade.assignmentId}`
    database.execute(
      `UPDATE coursework_items
       SET grade = ?,
           points_earned = ?,
           points_possible = ?,
           submission_status = 'graded',
           canvas_assignment_id = COALESCE(canvas_assignment_id, ?)
       WHERE id = ?
         AND source_type = 'assignment'
         AND course_id = ?`,
      [
        grade.letterGrade ?? String(grade.score),
        grade.score,
        grade.maxScore,
        grade.assignmentId,
        expectedId,
        grade.courseId,
      ],
    )
  }
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
      const coursesCallResult = await gateway.callTool(TOOL_GET_COURSES, {})
      if (!coursesCallResult.ok) {
        logGatewayFailure("canvas.get_courses call failed", coursesCallResult)
        void pushBus.publish(PUSH_CHANNELS.CANVAS_SYNC_PROGRESS, {
          courseId: "",
          progress: 0,
          status: "error",
        })
        return
      }

      const coursesToolResult = readStructuredToolResult(TOOL_GET_COURSES, coursesCallResult.result)
      if (!coursesToolResult.ok) {
        logError("canvas.get_courses tool error", coursesToolResult.message)
        void pushBus.publish(PUSH_CHANNELS.CANVAS_SYNC_PROGRESS, {
          courseId: "",
          progress: 0,
          status: "error",
        })
        return
      }

      const coursesDecode = tryDecodeCoursesResult(coursesToolResult.data)
      if (!coursesDecode.ok) {
        void pushBus.publish(PUSH_CHANNELS.CANVAS_SYNC_PROGRESS, {
          courseId: "",
          progress: 0,
          status: "error",
        })
        return
      }

      const courses = coursesDecode.courses
      if (courses.length > 0) {
        upsertCourses(database, courses)
      }

      void pushBus.publish(PUSH_CHANNELS.CANVAS_SYNC_PROGRESS, {
        courseId: "",
        progress: 10,
        status: "syncing",
      })

      const courseworkCallResult = await gateway.callTool(TOOL_GET_COURSEWORK, {
        sources: ALL_SOURCES,
        includeCompleted: true,
      })

      if (!courseworkCallResult.ok) {
        logGatewayFailure("canvas.get_coursework call failed", courseworkCallResult)
        void pushBus.publish(PUSH_CHANNELS.CANVAS_SYNC_PROGRESS, {
          courseId: "",
          progress: 0,
          status: "error",
        })
        return
      }

      const courseworkToolResult = readStructuredToolResult(
        TOOL_GET_COURSEWORK,
        courseworkCallResult.result,
      )
      if (!courseworkToolResult.ok) {
        logError("canvas.get_coursework tool error", courseworkToolResult.message)
        void pushBus.publish(PUSH_CHANNELS.CANVAS_SYNC_PROGRESS, {
          courseId: "",
          progress: 0,
          status: "error",
        })
        return
      }

      const courseworkDecode = tryDecodeCourseworkResult(courseworkToolResult.data)
      if (!courseworkDecode.ok) {
        void pushBus.publish(PUSH_CHANNELS.CANVAS_SYNC_PROGRESS, {
          courseId: "",
          progress: 0,
          status: "error",
        })
        return
      }

      if (courseworkDecode.items.length > 0) {
        upsertCoursework(database, courseworkDecode.items)
      }

      void pushBus.publish(PUSH_CHANNELS.CANVAS_SYNC_PROGRESS, {
        courseId: "",
        progress: 70,
        status: "syncing",
      })

      const gradesCallResults = await Promise.allSettled(
        courses.map((course) => gateway.callTool(TOOL_GET_GRADES, { courseId: course.id })),
      )

      for (const [index, result] of gradesCallResults.entries()) {
        if (result.status === "rejected") {
          logError(`canvas.get_grades rejected for course ${courses[index]?.id ?? "?"}`, result.reason)
          continue
        }
        if (!result.value.ok) {
          logGatewayFailure(
            `canvas.get_grades failed for course ${courses[index]?.id ?? "?"}`,
            result.value,
          )
          continue
        }
        const gradeToolResult = readStructuredToolResult(
          TOOL_GET_GRADES,
          result.value.result,
        )
        if (!gradeToolResult.ok) {
          logError(
            `canvas.get_grades tool error for course ${courses[index]?.id ?? "?"}`,
            gradeToolResult.message,
          )
          continue
        }
        const gradesDecode = tryDecodeGradesResult(gradeToolResult.data)
        if (gradesDecode.ok && gradesDecode.grades.length > 0) {
          upsertGrades(database, gradesDecode.grades)
        }
      }

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

  function getCourses(): Course[] {
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

  function getCoursework(): CourseWorkItem[] {
    const rows = database.query<CourseworkRow>(
      `SELECT id, course_id, title, effective_due_at, source_type, freshness_status,
              points_possible, submission_status, grade, html_url, canvas_assignment_id
       FROM coursework_items
       ORDER BY effective_due_at ASC NULLS LAST`,
    )
    return rows.map<CourseWorkItem>((row) => ({
      id: row.id as CourseWorkItem["id"],
      courseId: row.course_id as CourseWorkItem["courseId"],
      title: row.title,
      effectiveDueAt: row.effective_due_at ?? undefined,
      sourceType: row.source_type as CourseWorkItem["sourceType"],
      sourceId: row.canvas_assignment_id ?? row.id,
      freshnessStatus: row.freshness_status as CourseWorkItem["freshnessStatus"],
      pointsPossible: row.points_possible ?? undefined,
      submissionStatus: row.submission_status ?? undefined,
      grade: row.grade ?? undefined,
      htmlUrl: row.html_url ?? undefined,
    }))
  }

  function getGrades(): Grade[] {
    const rows = database.query<GradeRow>(
      `SELECT id, course_id, title, grade, points_possible, points_earned,
              submission_status, canvas_assignment_id
       FROM coursework_items
       WHERE (points_earned IS NOT NULL OR grade IS NOT NULL)
         AND source_type = 'assignment'
       ORDER BY course_id ASC`,
    )
    return rows.map<Grade>((row) => ({
      courseId: row.course_id as Grade["courseId"],
      assignmentId: row.canvas_assignment_id ?? row.id,
      score: row.points_earned ?? 0,
      maxScore: row.points_possible ?? 0,
      letterGrade: row.grade ?? undefined,
    }))
  }

  return { sync, getCourses, getCoursework, getGrades }
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
