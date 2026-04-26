import type { DatabaseService } from "../db/Database.js"
import {
  recentInsightsWithStatus,
  type InsightHistoryRecord,
} from "../activity/feed.js"

interface UpcomingCourseworkRow {
  course_name: string
  course_code: string
  title: string
  effective_due_at: string | null
}

interface PlannedSessionRow {
  start_time: string
  end_time: string
  title: string
}

export interface InsightContext {
  readonly recentInsights: ReadonlyArray<InsightHistoryRecord>
  readonly upcomingCoursework: ReadonlyArray<{
    readonly course: string
    readonly title: string
    readonly dueAt: string | null
  }>
  readonly todaysSessions: ReadonlyArray<{
    readonly start: string
    readonly end: string
    readonly title: string
  }>
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

/**
 * Reads everything the daily-insight prompt needs in a single pass.
 *
 * Failures are demoted: the relevant section is returned empty rather than
 * blowing up the run. This is consistent with PDF §8 — proactive runs should
 * never lose a day's pulse because Canvas didn't sync.
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

  let upcomingCoursework: InsightContext["upcomingCoursework"] = []
  try {
    const horizon = new Date(now)
    horizon.setDate(horizon.getDate() + 7)
    const rows = database.query<UpcomingCourseworkRow>(
      `SELECT c.name AS course_name, c.code AS course_code,
              cw.title, cw.effective_due_at
         FROM coursework_items cw
         JOIN courses c ON c.id = cw.course_id
        WHERE cw.source_type = 'assignment'
          AND (cw.effective_due_at IS NULL OR cw.effective_due_at <= ?)
        ORDER BY cw.effective_due_at IS NULL, cw.effective_due_at ASC
        LIMIT 12`,
      [horizon.toISOString()],
    )
    upcomingCoursework = rows.map((row) => ({
      course: row.course_code || row.course_name,
      title: row.title,
      dueAt: row.effective_due_at,
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

  return { recentInsights, upcomingCoursework, todaysSessions }
}
