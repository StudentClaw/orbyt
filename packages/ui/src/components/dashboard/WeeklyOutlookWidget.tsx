import type { CalendarSession } from "./calendar-model"
import type { PrioritizedItem } from "./priority-model"
import { buildBuckets } from "./weekly-outlook-model"

interface WeeklyOutlookWidgetProps {
  readonly weekStart: string
  readonly sessions: ReadonlyArray<CalendarSession>
  readonly deadlines: ReadonlyArray<PrioritizedItem>
  readonly now: Date
}

export function WeeklyOutlookWidget({
  weekStart,
  sessions,
  deadlines,
  now,
}: WeeklyOutlookWidgetProps) {
  const buckets = buildBuckets(weekStart, sessions, deadlines, now)

  return (
    <div className="dashboard-side-widget pagelet relative pl-0" data-testid="weekly-outlook-widget">
      <div
        className="dashboard-timeline-line pointer-events-none absolute bottom-4 left-6 top-4 w-px bg-border/60"
        aria-hidden
      />
      <div className="pl-10 pr-5 pt-5 pb-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold tracking-tight">Weekly Outlook</h2>
          <p className="mt-1 text-xs text-muted-foreground">Study blocks and deadlines in date order.</p>
        </div>
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
                <div className="divide-y divide-border/50">
                  {day.rows.map((row) => (
                    <div
                      key={row.id}
                      className="dashboard-timeline-row flex items-center gap-3 border-l-2 px-3 py-2.5 first:pt-0 last:pb-0"
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
