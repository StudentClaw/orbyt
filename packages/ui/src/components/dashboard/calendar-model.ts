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

/** The slot index of the first visible hour (6 AM). */
export const FIRST_SLOT = 6 * SLOTS_PER_HOUR // 24

/** Pixel height of each 15-min slot row in the calendar grid. */
export const SLOT_PX = 15

/**
 * Convert a slot index to a 1-indexed CSS grid row (row 1 = column headers).
 * Pass a dynamic firstSlot when the visible range is not the default 6 AM.
 */
export function slotToGridRow(slot: number, firstSlot = FIRST_SLOT): number {
  return Math.max(slot - firstSlot, 0) + 2
}

/**
 * Compute the tightest visible hour range that contains all events,
 * with 1-hour padding on each side. Clamped to [0, 23].
 */
export function computeVisibleRange(
  sessions: ReadonlyArray<CalendarSession>,
  deadlines: ReadonlyArray<{ readonly effectiveDueAt: string }>,
): { readonly firstHour: number; readonly lastHour: number } {
  if (sessions.length === 0 && deadlines.length === 0) {
    return { firstHour: 8, lastHour: 17 }
  }

  let minHour = 23
  let maxHour = 0

  for (const s of sessions) {
    const startHour = new Date(s.startTime).getHours()
    const endHour = new Date(s.endTime).getHours()
    if (startHour < minHour) minHour = startHour
    if (endHour > maxHour) maxHour = endHour
  }

  for (const d of deadlines) {
    const hour = new Date(d.effectiveDueAt).getHours()
    if (hour < minHour) minHour = hour
    if (hour > maxHour) maxHour = hour
  }

  return {
    firstHour: Math.max(0, minHour - 1),
    lastHour: Math.min(23, maxHour + 1),
  }
}

/** Snap a Date to its 15-minute slot using local time. */
function snapToSlot(date: Date): number {
  return date.getHours() * SLOTS_PER_HOUR + Math.floor(date.getMinutes() / 15)
}

/** Day index (0 = first day of week) using local calendar dates. */
function dayIndex(dateStr: string, weekStart: string): number {
  const d = new Date(dateStr)
  const eventDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const [y, m, day] = weekStart.split("-").map(Number)
  const weekDay = new Date(y, m - 1, day)
  return Math.floor((eventDay.getTime() - weekDay.getTime()) / MS_PER_DAY)
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

/** Clamp and snap a deadline's due time to a 30-min block in the calendar grid. */
export function deadlineToGridPlacement(dueAt: string, weekStart: string): GridPlacement {
  const due = new Date(dueAt)
  // Visible grid: 6 AM – 9 PM. Clamp so the 2-slot block fits within range.
  const MIN_SLOT = 6 * SLOTS_PER_HOUR       // slot 24 = 6:00 AM
  const MAX_SLOT = 21 * SLOTS_PER_HOUR - 2  // slot 82 = 8:30 PM (leaves room for 2-slot span)
  const raw = snapToSlot(due)
  const clamped = Math.max(MIN_SLOT, Math.min(raw, MAX_SLOT))

  return {
    column: dayIndex(dueAt, weekStart),
    rowStart: clamped,
    rowSpan: 2,
  }
}

/** Filter deadlines whose due date falls within the displayed week. */
export function getDeadlinesForWeek<T extends { readonly effectiveDueAt: string }>(
  deadlines: ReadonlyArray<T>,
  weekStart: string,
): ReadonlyArray<T> {
  const start = new Date(weekStart + "T00:00:00Z").getTime()
  const end = start + 7 * MS_PER_DAY

  return deadlines.filter((d) => {
    const t = new Date(d.effectiveDueAt).getTime()
    return t >= start && t < end
  })
}
