// Pure functions for weekly progress tracking

export interface ProgressSession {
  readonly id: string
  readonly date: string // YYYY-MM-DD
  readonly status: "completed" | "skipped" | "scheduled"
}

export interface CompletionRatio {
  readonly completed: number
  readonly total: number
  readonly percentage: number
}

export interface WeekOverWeekResult {
  readonly delta: number
  readonly direction: "up" | "same" | "down"
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Consecutive days with at least 1 completed session, counting backward from today.
 * Days with no scheduled sessions are skipped (don't break the streak).
 * A scheduled but skipped day resets the streak.
 */
export function computeStreak(
  sessions: ReadonlyArray<ProgressSession>,
  today: Date,
): number {
  if (sessions.length === 0) return 0

  // Group sessions by date
  const byDate = new Map<string, ReadonlyArray<ProgressSession>>()
  for (const s of sessions) {
    const existing = byDate.get(s.date) ?? []
    byDate.set(s.date, [...existing, s])
  }

  let streak = 0
  const todayStr = today.toISOString().split("T")[0]
  let currentDate = new Date(todayStr + "T00:00:00Z")

  // Walk backward from today up to 365 days
  for (let i = 0; i < 365; i++) {
    const dateStr = currentDate.toISOString().split("T")[0]
    const daySessions = byDate.get(dateStr)

    if (!daySessions) {
      // No sessions scheduled this day — skip without breaking
      currentDate = new Date(currentDate.getTime() - MS_PER_DAY)
      continue
    }

    const hasCompleted = daySessions.some((s) => s.status === "completed")
    if (hasCompleted) {
      streak++
      currentDate = new Date(currentDate.getTime() - MS_PER_DAY)
    } else {
      // Scheduled but not completed — streak breaks
      break
    }
  }

  return streak
}

/**
 * Completion ratio for sessions within a given week (starting from weekStart).
 */
export function computeCompletionRatio(
  sessions: ReadonlyArray<ProgressSession>,
  weekStart: string,
): CompletionRatio {
  const start = new Date(weekStart + "T00:00:00Z").getTime()
  const end = start + 7 * MS_PER_DAY

  const weekSessions = sessions.filter((s) => {
    const d = new Date(s.date + "T00:00:00Z").getTime()
    return d >= start && d < end
  })

  const total = weekSessions.length
  const completed = weekSessions.filter((s) => s.status === "completed").length
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100)

  return { completed, total, percentage }
}

/**
 * Week-over-week comparison based on completion percentages.
 */
export function computeWeekOverWeek(
  thisWeek: CompletionRatio,
  lastWeek: CompletionRatio,
): WeekOverWeekResult {
  const delta = thisWeek.percentage - lastWeek.percentage

  let direction: "up" | "same" | "down"
  if (delta > 0) {
    direction = "up"
  } else if (delta < 0) {
    direction = "down"
  } else {
    direction = "same"
  }

  return { delta, direction }
}
