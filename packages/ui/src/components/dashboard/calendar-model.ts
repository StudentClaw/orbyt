// Pure functions for weekly calendar grid placement and navigation

export interface CalendarSession {
  readonly id: string
  readonly courseId: string
  readonly courseName?: string
  readonly title: string
  readonly startTime: string
  readonly endTime: string
}

export interface GridPlacement {
  readonly column: number
  readonly rowStart: number
  readonly rowSpan: number
}

export type ConflictPair = readonly [string, string]

const SLOTS_PER_HOUR = 4 // 15-min grid
const MS_PER_DAY = 24 * 60 * 60 * 1000

function snapToSlot(date: Date): number {
  const hours = date.getUTCHours()
  const minutes = date.getUTCMinutes()
  return hours * SLOTS_PER_HOUR + Math.floor(minutes / 15)
}

function dayIndex(dateStr: string, weekStart: string): number {
  const date = new Date(dateStr)
  const start = new Date(weekStart + "T00:00:00Z")
  return Math.floor((date.getTime() - start.getTime()) / MS_PER_DAY)
}

export function sessionToGridPlacement(
  session: CalendarSession,
  weekStart: string,
): GridPlacement {
  const start = new Date(session.startTime)
  const end = new Date(session.endTime)

  const rowStart = snapToSlot(start)
  const rowEnd = snapToSlot(end)

  return {
    column: dayIndex(session.startTime, weekStart),
    rowStart,
    rowSpan: Math.max(1, rowEnd - rowStart),
  }
}

export function detectConflicts(
  sessions: ReadonlyArray<CalendarSession>,
): ReadonlyArray<ConflictPair> {
  const conflicts: ConflictPair[] = []

  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i]
      const b = sessions[j]

      const aStart = new Date(a.startTime).getTime()
      const aEnd = new Date(a.endTime).getTime()
      const bStart = new Date(b.startTime).getTime()
      const bEnd = new Date(b.endTime).getTime()

      if (aStart < bEnd && bStart < aEnd) {
        conflicts.push([a.id, b.id])
      }
    }
  }

  return conflicts
}

export function getWeekDates(weekStart: string): ReadonlyArray<string> {
  const start = new Date(weekStart + "T00:00:00Z")
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getTime() + i * MS_PER_DAY)
    return d.toISOString().split("T")[0]
  })
}

export function navigateWeek(
  current: string,
  direction: "next" | "prev",
): string {
  const d = new Date(current + "T00:00:00Z")
  const offset = direction === "next" ? 7 : -7
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().split("T")[0]
}

export function getSessionsForWeek(
  sessions: ReadonlyArray<CalendarSession>,
  weekStart: string,
): ReadonlyArray<CalendarSession> {
  const start = new Date(weekStart + "T00:00:00Z").getTime()
  const end = start + 7 * MS_PER_DAY

  return sessions.filter((s) => {
    const sessionStart = new Date(s.startTime).getTime()
    return sessionStart >= start && sessionStart < end
  })
}
