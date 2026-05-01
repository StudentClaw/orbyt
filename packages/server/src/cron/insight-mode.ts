import type {
  InsightContext,
  RecapContext,
  UpcomingCourseworkRecord,
} from "./insight-context.js"
import { simplifyCourseCode } from "./course-code.js"

const HOUR_MS = 60 * 60 * 1000

export type MorningMode = "briefing" | "quiet"
export type EveningMode = "briefing" | "quiet"

export interface EveningRecapItemSeed {
  readonly kind: "session" | "submission" | "acted_summary"
  readonly course: string | null
  readonly label: string
}

/**
 * Decides whether the morning insight should render the full briefing layout
 * or fall back to the minimal quiet-day card. The check is intentionally
 * strict: a quiet day means *all* of the anchor signals are empty.
 *
 * - mustDo today                    → at least one upcoming item due today
 * - planned blocks today            → at least one scheduled session
 * - already-logged work today       → recap has a session/submission
 * - notable horizon (within 48h)    → at least one upcoming item due in 48h
 *
 * If any of those is non-empty the day is anchor-worthy and the briefing fires.
 */
export function detectMorningMode(
  ctx: InsightContext,
  now: Date = new Date(),
): MorningMode {
  if (todayMustDo(ctx.upcomingCoursework, now).length > 0) return "briefing"
  if (ctx.todaysSessions.length > 0) return "briefing"
  if (
    ctx.recap.completedSessions.length > 0 ||
    ctx.recap.submissionsToday.length > 0
  ) {
    return "briefing"
  }
  if (hasNearHorizon(ctx.upcomingCoursework, now, 48 * HOUR_MS)) return "briefing"
  return "quiet"
}

/**
 * Filters upcoming coursework to items actually due today (local day window).
 * Excludes passive items (reading/discussion) which are not "must do today"
 * even if technically dated for today — they belong on the lever or horizon
 * instead.
 */
export function todayMustDo(
  items: ReadonlyArray<UpcomingCourseworkRecord>,
  now: Date = new Date(),
): ReadonlyArray<UpcomingCourseworkRecord> {
  const dayStart = startOfLocalDay(now).getTime()
  const dayEnd = endOfLocalDay(now).getTime()
  return items.filter((it) => {
    if (it.assignmentType === "passive") return false
    if (it.dueAt === null) return false
    const due = Date.parse(it.dueAt)
    if (!Number.isFinite(due)) return false
    return due >= dayStart && due <= dayEnd
  })
}

function hasNearHorizon(
  items: ReadonlyArray<UpcomingCourseworkRecord>,
  now: Date,
  windowMs: number,
): boolean {
  const nowMs = now.getTime()
  const limit = nowMs + windowMs
  return items.some((it) => {
    if (it.assignmentType === "passive") return false
    if (it.dueAt === null) return false
    const due = Date.parse(it.dueAt)
    if (!Number.isFinite(due)) return false
    return due >= nowMs && due <= limit
  })
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
 * Decides whether the evening insight should render the full briefing or the
 * minimal quiet-day card. Quiet fires only when *both* today is empty (no
 * recap material at all) and tomorrow is empty (no assignment-type item due
 * within 24h). Either side being non-empty produces a briefing.
 */
export function detectEveningMode(
  ctx: InsightContext,
  now: Date = new Date(),
): EveningMode {
  const todayHasContent =
    ctx.recap.completedSessions.length > 0 ||
    ctx.recap.submissionsToday.length > 0 ||
    ctx.recap.actedNotifications.length > 0
  if (todayHasContent) return "briefing"
  if (hasNearHorizon(ctx.upcomingCoursework, now, 24 * HOUR_MS)) return "briefing"
  return "quiet"
}

/**
 * Maps the recap context into chip-ready seeds that the prompt can pass to
 * the model verbatim. Sessions and submissions become individual chips;
 * acted notifications collapse into a single aggregated chip so the recap row
 * stays scannable.
 */
export function buildEveningRecapItems(
  recap: RecapContext,
): ReadonlyArray<EveningRecapItemSeed> {
  const items: EveningRecapItemSeed[] = []
  for (const session of recap.completedSessions) {
    items.push({
      kind: "session",
      course: extractCourseFromTitle(session.title),
      label: formatSessionLabel(session),
    })
  }
  for (const submission of recap.submissionsToday) {
    items.push({
      kind: "submission",
      course: simplifyCourseCode(submission.course),
      label: submission.title,
    })
  }
  if (recap.actedNotifications.length > 0) {
    const count = recap.actedNotifications.length
    items.push({
      kind: "acted_summary",
      course: null,
      label: `${count} reminder${count === 1 ? "" : "s"} acted`,
    })
  }
  return items
}

function formatSessionLabel(session: {
  readonly start: string
  readonly end: string
  readonly title: string
}): string {
  const start = Date.parse(session.start)
  const end = Date.parse(session.end)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return session.title
  const minutes = Math.max(0, Math.round((end - start) / 60000))
  if (minutes === 0) return session.title
  if (minutes < 60) return `${minutes}min ${session.title}`
  const hours = Math.round((minutes / 60) * 10) / 10
  const hoursText =
    Number.isInteger(hours) ? `${hours}hr` : `${hours.toFixed(1)}hr`
  return `${hoursText} ${session.title}`
}

const COURSE_CODE_TOKEN = /[A-Za-z0-9-]+_([A-Za-z0-9-]+)_[A-Za-z0-9_-]+/

function extractCourseFromTitle(title: string): string | null {
  const match = COURSE_CODE_TOKEN.exec(title)
  return match?.[1] ?? null
}
