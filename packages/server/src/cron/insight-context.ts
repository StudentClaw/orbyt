import type { DatabaseService } from "../db/Database.js"
import {
  recentInsightsWithStatus,
  type InsightHistoryRecord,
} from "../activity/feed.js"
import {
  classifyAssignmentByTitle,
  type AssignmentType,
} from "./assignment-type.js"

export interface UpcomingCourseworkRecord {
  readonly itemId: string
  readonly course: string
  readonly title: string
  readonly dueAt: string | null
  readonly assignmentType: AssignmentType
  readonly htmlUrl: string | null
}

interface UpcomingCourseworkRow {
  id: string
  course_name: string
  course_code: string
  title: string
  effective_due_at: string | null
  assignment_type: string | null
  html_url: string | null
}

interface PlannedSessionRow {
  start_time: string
  end_time: string
  title: string
}

interface RecapRow {
  id: string
  category: string
  type: string
  title: string
  body: string | null
  acted_at: number | null
}

export interface RecapAction {
  readonly category: string
  readonly type: string
  readonly title: string
  readonly body: string | null
  readonly actedAtMs: number
}

export interface RecapContext {
  readonly completedSessions: ReadonlyArray<{
    readonly start: string
    readonly end: string
    readonly title: string
  }>
  readonly actedNotifications: ReadonlyArray<RecapAction>
  readonly submissionsToday: ReadonlyArray<{
    readonly course: string
    readonly title: string
  }>
}

export interface InsightContext {
  readonly recentInsights: ReadonlyArray<InsightHistoryRecord>
  readonly upcomingCoursework: ReadonlyArray<UpcomingCourseworkRecord>
  readonly todaysSessions: ReadonlyArray<{
    readonly start: string
    readonly end: string
    readonly title: string
  }>
  readonly recap: RecapContext
}

function startOfLocalDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfLocalDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function asAssignmentType(
  cached: string | null,
  title: string,
): AssignmentType {
  if (cached === "assessment" || cached === "work" || cached === "passive") {
    return cached
  }
  return classifyAssignmentByTitle(title)
}

/**
 * Reads everything the daily-insight and heartbeat prompts need in a single pass.
 *
 * Failures are demoted: the relevant section is returned empty rather than
 * blowing up the run. Archived coursework is excluded so dismissed items don't
 * keep generating noise.
 */
export function loadInsightContext(
  database: DatabaseService,
  now: Date = new Date(),
): InsightContext {
  let recentInsights: ReadonlyArray<InsightHistoryRecord> = []
  try {
    recentInsights = recentInsightsWithStatus(database, 7, now)
  } catch {
    recentInsights = []
  }

  let upcomingCoursework: ReadonlyArray<UpcomingCourseworkRecord> = []
  try {
    const horizon = new Date(now)
    horizon.setDate(horizon.getDate() + 7)
    // Lower bound: items past-due by more than 7 days are considered stale
    // (likely from a prior term or already addressed) and excluded so they
    // don't pollute the daily-insight or heartbeat candidate lists. Items
    // with NULL due dates are kept so they remain visible in context.
    const stalenessFloor = new Date(now)
    stalenessFloor.setDate(stalenessFloor.getDate() - 7)
    const rows = database.query<UpcomingCourseworkRow>(
      `SELECT cw.id, c.name AS course_name, c.code AS course_code,
              cw.title, cw.effective_due_at,
              cw.assignment_type, cw.html_url
         FROM coursework_items cw
         JOIN courses c ON c.id = cw.course_id
        WHERE cw.source_type = 'assignment'
          AND (cw.effective_due_at IS NULL
               OR (cw.effective_due_at <= ? AND cw.effective_due_at >= ?))
          AND cw.id NOT IN (SELECT id FROM archived_coursework_items)
        ORDER BY cw.effective_due_at IS NULL, cw.effective_due_at ASC
        LIMIT 24`,
      [horizon.toISOString(), stalenessFloor.toISOString()],
    )
    upcomingCoursework = rows.map<UpcomingCourseworkRecord>((row) => ({
      itemId: row.id,
      course: row.course_code || row.course_name,
      title: row.title,
      dueAt: row.effective_due_at,
      assignmentType: asAssignmentType(row.assignment_type, row.title),
      htmlUrl: row.html_url,
    }))
  } catch {
    upcomingCoursework = []
  }

  let todaysSessions: InsightContext["todaysSessions"] = []
  try {
    const dayStart = startOfLocalDay(now).toISOString()
    const dayEnd = endOfLocalDay(now).toISOString()
    const rows = database.query<PlannedSessionRow>(
      `SELECT ps.start_time, ps.end_time, t.title
         FROM planned_sessions ps
         JOIN tasks t ON t.id = ps.task_id
        WHERE ps.start_time >= ?
          AND ps.start_time <= ?
          AND ps.status = 'scheduled'
        ORDER BY ps.start_time ASC`,
      [dayStart, dayEnd],
    )
    todaysSessions = rows.map((row) => ({
      start: row.start_time,
      end: row.end_time,
      title: row.title,
    }))
  } catch {
    todaysSessions = []
  }

  const recap = loadRecap(database, now)

  return { recentInsights, upcomingCoursework, todaysSessions, recap }
}

function loadRecap(database: DatabaseService, now: Date): RecapContext {
  const dayStart = startOfLocalDay(now).getTime()
  const dayEnd = endOfLocalDay(now).getTime()
  const dayStartIso = startOfLocalDay(now).toISOString()
  const dayEndIso = endOfLocalDay(now).toISOString()

  let completedSessions: RecapContext["completedSessions"] = []
  try {
    const rows = database.query<PlannedSessionRow>(
      `SELECT ps.start_time, ps.end_time, t.title
         FROM planned_sessions ps
         JOIN tasks t ON t.id = ps.task_id
        WHERE ps.start_time >= ?
          AND ps.start_time <= ?
          AND ps.status IN ('done', 'active', 'completed')
        ORDER BY ps.start_time ASC`,
      [dayStartIso, dayEndIso],
    )
    completedSessions = rows.map((row) => ({
      start: row.start_time,
      end: row.end_time,
      title: row.title,
    }))
  } catch {
    completedSessions = []
  }

  let actedNotifications: ReadonlyArray<RecapAction> = []
  try {
    const rows = database.query<RecapRow>(
      `SELECT id, category, type, title, body, acted_at
         FROM activity_feed
        WHERE acted_on = 1
          AND acted_at IS NOT NULL
          AND acted_at >= ?
          AND acted_at <= ?
        ORDER BY acted_at DESC
        LIMIT 16`,
      [dayStart, dayEnd],
    )
    actedNotifications = rows
      .filter((row): row is RecapRow & { acted_at: number } => row.acted_at !== null)
      .map((row) => ({
        category: row.category,
        type: row.type,
        title: row.title,
        body: row.body,
        actedAtMs: row.acted_at,
      }))
  } catch {
    actedNotifications = []
  }

  let submissionsToday: RecapContext["submissionsToday"] = []
  try {
    const rows = database.query<{
      title: string
      course_code: string
      course_name: string
    }>(
      `SELECT cw.title, c.code AS course_code, c.name AS course_name
         FROM coursework_items cw
         JOIN courses c ON c.id = cw.course_id
        WHERE cw.submission_status IN ('submitted', 'graded')
          AND cw.source_updated_at IS NOT NULL
          AND cw.source_updated_at >= ?
          AND cw.source_updated_at <= ?
        LIMIT 16`,
      [dayStartIso, dayEndIso],
    )
    submissionsToday = rows.map((row) => ({
      course: row.course_code || row.course_name,
      title: row.title,
    }))
  } catch {
    submissionsToday = []
  }

  return { completedSessions, actedNotifications, submissionsToday }
}
