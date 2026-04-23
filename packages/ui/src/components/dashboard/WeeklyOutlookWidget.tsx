import type { CalendarSession } from "./calendar-model"
import { computePriorityDisplay, type PrioritizedItem } from "./priority-model"
import { localDateKey } from "./subject-grouping"
import { resolvedBorderColor } from "./TaskCard"

interface WeeklyOutlookWidgetProps {
  readonly weekStart: string
  readonly sessions: ReadonlyArray<CalendarSession>
  readonly deadlines: ReadonlyArray<PrioritizedItem>
  readonly now: Date
}

interface DayBucket {
  readonly key: string
  readonly date: Date
  readonly label: string
  readonly rows: ReadonlyArray<OutlookRow>
}

interface OutlookRow {
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

export function WeeklyOutlookWidget({
  weekStart,
  sessions,
  deadlines,
  now,
}: WeeklyOutlookWidgetProps) {
  const buckets = buildBuckets(weekStart, sessions, deadlines, now)

  return (
    <div className="pagelet relative pl-0" data-testid="weekly-outlook-widget">
      <div
        className="pointer-events-none absolute bottom-4 left-6 top-4 w-px bg-border/60"
        aria-hidden
      />
      <div className="pl-10 pr-5 pt-5 pb-5">
        <h2 className="mb-4 text-base font-semibold tracking-tight">Weekly Outlook</h2>
        {buckets.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="weekly-outlook-empty">
            No events this week
          </p>
        ) : (
          <div className="space-y-6" data-testid="weekly-outlook-days">
            {buckets.map((day) => {
              const isToday = day.label === "Today"
              return (
              <div key={day.key} data-testid={`weekly-outlook-day-${day.key}`}>
                <p
                  className={`mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${
                    isToday ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {isToday ? (
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full bg-primary"
                    />
                  ) : null}
                  {day.label}
                </p>
                <div className="space-y-2">
                  {day.rows.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center gap-3 rounded-md border border-border border-l-4 bg-card px-3 py-2"
                      data-testid={`weekly-outlook-row-${row.id}`}
                      style={row.borderLeftColor ? { borderLeftColor: row.borderLeftColor } : undefined}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{row.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.subtitle}</p>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {row.timeLabel}
                      </span>
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${row.dotClass}`}
                        aria-hidden
                        data-testid={`weekly-outlook-dot-${row.id}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
