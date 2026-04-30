import type { UpcomingCourseworkRecord, RecapContext } from "./insight-context.js"

const DAY_MS = 24 * 60 * 60 * 1000

export interface PrioritizedCoursework {
  /** Items that should be shown in the insight body, capped at 3, in display order. */
  readonly featured: ReadonlyArray<UpcomingCourseworkRecord>
  /** All items the insight saw, sorted (used for quiet-day fallback / context). */
  readonly orderedAll: ReadonlyArray<UpcomingCourseworkRecord>
  /** True when no actionable items (assessment or work in 3 days) exist. */
  readonly isQuiet: boolean
}

/**
 * Prioritization rules (7-day horizon, hard cap of 3 featured):
 *   1. Assessments (quiz/exam/test/midterm/finals) within 7 days, by proximity.
 *   2. Work due within 3 days.
 *   3. Work 4-7 days out, only if room remains.
 *   4. Passive items only if 1-3 produced zero featured items.
 */
export function prioritizeCoursework(
  items: ReadonlyArray<UpcomingCourseworkRecord>,
  now: Date = new Date(),
): PrioritizedCoursework {
  const nowMs = now.getTime()
  const horizon7Ms = nowMs + 7 * DAY_MS
  const horizon3Ms = nowMs + 3 * DAY_MS

  const inWindow = items.filter((it) => {
    if (it.dueAt === null) return false
    const due = Date.parse(it.dueAt)
    return Number.isFinite(due) && due >= nowMs && due <= horizon7Ms
  })

  const due = (it: UpcomingCourseworkRecord) =>
    it.dueAt === null ? Number.POSITIVE_INFINITY : Date.parse(it.dueAt)

  const assessments = inWindow
    .filter((it) => it.assignmentType === "assessment")
    .sort((a, b) => due(a) - due(b))

  const workClose = inWindow
    .filter((it) => it.assignmentType === "work" && due(it) <= horizon3Ms)
    .sort((a, b) => due(a) - due(b))

  const workFar = inWindow
    .filter((it) => it.assignmentType === "work" && due(it) > horizon3Ms)
    .sort((a, b) => due(a) - due(b))

  const passives = inWindow
    .filter((it) => it.assignmentType === "passive")
    .sort((a, b) => due(a) - due(b))

  const featured: UpcomingCourseworkRecord[] = []
  const cap = 3
  for (const list of [assessments, workClose, workFar]) {
    for (const it of list) {
      if (featured.length >= cap) break
      featured.push(it)
    }
    if (featured.length >= cap) break
  }
  if (featured.length === 0) {
    for (const it of passives) {
      if (featured.length >= cap) break
      featured.push(it)
    }
  }

  const orderedAll = [...assessments, ...workClose, ...workFar, ...passives]
  const isQuiet = assessments.length === 0 && workClose.length === 0

  return { featured, orderedAll, isQuiet }
}

/**
 * Deterministic fallback when the LLM produces nothing valid. Always non-empty.
 *
 * - If quiet: encouraging rest message, with the furthest important item as
 *   a heads-up (or the first orderedAll item if any).
 * - Otherwise: the standard 1-line headline + bulleted items, plus optional
 *   recap line.
 */
export function buildFallbackInsight(
  prioritized: PrioritizedCoursework,
  recap: RecapContext,
  slot: "morning" | "evening",
): { title: string; body: string; deepLink?: string } {
  const lines: string[] = []
  const { featured, orderedAll, isQuiet } = prioritized

  // Recap / lead line (slot-aware).
  if (slot === "evening") {
    const sessionLine = recapSessionsLine(recap)
    if (sessionLine !== null) lines.push(`${sessionLine} — nice momentum.`)
    else lines.push("Take a breath — wrap the day on a calm note.")
  } else {
    lines.push("Here's what's on your plate today.")
  }

  if (isQuiet && featured.length === 0) {
    lines.push("No deadlines in the next 3 days — use the breathing room.")
    const furthest = orderedAll.at(-1)
    if (furthest) {
      lines.push(`Heads-up next: ${furthest.course} ${furthest.title}${furthest.dueAt ? ` (due ${formatDueShort(furthest.dueAt)})` : ""}.`)
    }
    return {
      title: orderedAll.length > 0
        ? `Quiet week ahead — heads-up: ${orderedAll[0]?.course ?? "next item"}`
        : "Quiet week ahead",
      body: lines.join("\n"),
    }
  }

  for (const it of featured) {
    lines.push(`${markerFor(it)} ${it.course} ${it.title}${it.dueAt ? ` due ${formatDueShort(it.dueAt)}` : ""}.`)
  }

  const headline = featured[0]
    ? `${featured[0].course} ${featured[0].title}${featured[0].dueAt ? ` due ${formatDueShort(featured[0].dueAt)}` : ""}`
    : "Today at a glance"

  const deepLink = featured[0]?.htmlUrl ?? undefined
  return {
    title: trimTitle(headline),
    body: lines.join("\n"),
    ...(deepLink ? { deepLink } : {}),
  }
}

function recapSessionsLine(recap: RecapContext): string | null {
  if (
    recap.completedSessions.length === 0 &&
    recap.actedNotifications.length === 0 &&
    recap.submissionsToday.length === 0
  ) {
    return null
  }
  const parts: string[] = []
  if (recap.completedSessions.length > 0) {
    parts.push(`${recap.completedSessions.length} session${recap.completedSessions.length === 1 ? "" : "s"}`)
  }
  if (recap.submissionsToday.length > 0) {
    parts.push(`${recap.submissionsToday.length} submission${recap.submissionsToday.length === 1 ? "" : "s"}`)
  }
  if (parts.length === 0 && recap.actedNotifications.length > 0) {
    parts.push(`${recap.actedNotifications.length} acted alert${recap.actedNotifications.length === 1 ? "" : "s"}`)
  }
  return parts.length > 0 ? `Today: ${parts.join(", ")}` : null
}

function markerFor(it: UpcomingCourseworkRecord): string {
  if (it.assignmentType === "assessment") return "Heads up:"
  if (it.assignmentType === "passive") return "Read:"
  return "Due:"
}

function formatDueShort(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  const month = d.toLocaleString("en-US", { month: "short" })
  const day = d.getDate()
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const time = minutes === 0 ? `${hours}:00` : `${hours}:${String(minutes).padStart(2, "0")}`
  return `${month} ${day} ${time}`
}

function trimTitle(s: string): string {
  return s.length <= 70 ? s : `${s.slice(0, 67)}…`
}
