import type { CalendarSession } from "./calendar-model"
import { computePriorityDisplay, type PrioritizedItem } from "./priority-model"
import { localDateKey } from "./subject-grouping"
import { resolvedBorderColor } from "./task-card-style"

export interface DayBucket {
  readonly key: string
  readonly date: Date
  readonly label: string
  readonly rows: ReadonlyArray<OutlookRow>
}

export interface OutlookRow {
  readonly id: string
  readonly title: string
  readonly subtitle: string
  readonly timeLabel: string
  readonly dotClass: string
  readonly borderLeftColor?: string
  readonly sortAt: number
}

function parseLocalMidnight(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number)
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return new Date()
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

function dayHeading(date: Date, now: Date): string {
  if (localDateKey(date) === localDateKey(now)) return "Today"
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
}

function deadlineDotClass(item: PrioritizedItem, now: Date): string {
  const { zone } = computePriorityDisplay(item, now)
  switch (zone) {
    case "overdue":
      return "bg-destructive"
    case "urgent":
    case "attention":
      return "bg-[var(--warning)]"
    case "calm":
    default:
      return "bg-muted-foreground"
  }
}

export function buildBuckets(
  weekStart: string,
  sessions: ReadonlyArray<CalendarSession>,
  deadlines: ReadonlyArray<PrioritizedItem>,
  now: Date,
): ReadonlyArray<DayBucket> {
  const start = parseLocalMidnight(weekStart)
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    const key = localDateKey(date)
    const sessionRows: OutlookRow[] = sessions
      .filter((s) => localDateKey(new Date(s.startTime)) === key)
      .map((s) => {
        const at = new Date(s.startTime)
        return {
          id: `session-${s.id}`,
          title: s.title,
          subtitle: s.courseName ?? s.courseId,
          timeLabel: formatTime(at),
          dotClass: "bg-[var(--info)]",
          sortAt: at.getTime(),
        }
      })
    const deadlineRows: OutlookRow[] = deadlines
      .filter((d) => localDateKey(new Date(d.effectiveDueAt)) === key)
      .map((d) => {
        const at = new Date(d.effectiveDueAt)
        return {
          id: `deadline-${d.id}`,
          title: d.title,
          subtitle: d.courseCode,
          timeLabel: formatTime(at),
          dotClass: deadlineDotClass(d, now),
          borderLeftColor: resolvedBorderColor(d, now),
          sortAt: at.getTime(),
        }
      })
    const rows = [...sessionRows, ...deadlineRows].sort((a, b) => a.sortAt - b.sortAt)
    return { key, date, label: dayHeading(date, now), rows }
  })
  return days.filter((d) => d.rows.length > 0)
}
