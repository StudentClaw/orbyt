import { Button } from "@/components/ui/button"
import {
  getWeekDates,
  navigateWeek,
  getSessionsForWeek,
  sessionToGridPlacement,
  detectConflicts,
  type CalendarSession,
} from "./calendar-model"
import { CalendarSessionBlock } from "./CalendarSessionBlock"

interface WeeklyCalendarProps {
  readonly sessions: ReadonlyArray<CalendarSession>
  readonly weekStart: string
  readonly onWeekChange?: (weekStart: string) => void
  readonly onSessionSelect?: (sessionId: string) => void
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6) // 6:00 - 21:00

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z")
  return d.toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" })
}

function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM"
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${display} ${period}`
}

export function WeeklyCalendar({
  sessions,
  weekStart,
  onWeekChange,
  onSessionSelect,
}: WeeklyCalendarProps) {
  const weekDates = getWeekDates(weekStart)
  const weekSessions = getSessionsForWeek(sessions, weekStart)
  const conflicts = detectConflicts(weekSessions)
  const conflictIds = new Set(conflicts.flatMap(([a, b]) => [a, b]))

  if (weekSessions.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Weekly Calendar</h2>
          <WeekNav weekStart={weekStart} onWeekChange={onWeekChange} />
        </div>
        <p className="text-sm text-muted-foreground" data-testid="no-sessions">
          No sessions this week
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Weekly Calendar</h2>
        <WeekNav weekStart={weekStart} onWeekChange={onWeekChange} />
      </div>
      <div className="overflow-x-auto rounded-lg border" data-testid="weekly-calendar">
        <div className="grid min-w-[700px] grid-cols-[auto_repeat(7,1fr)]">
          {/* Header row */}
          <div className="border-b bg-muted/30 p-2 text-xs font-medium text-muted-foreground" />
          {weekDates.map((date) => (
            <div
              key={date}
              className="border-b border-l bg-muted/30 p-2 text-center text-xs font-medium"
              data-testid={`day-header-${date}`}
            >
              {formatDayHeader(date)}
            </div>
          ))}

          {/* Hour rows */}
          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="border-t p-1 pr-2 text-right text-[10px] text-muted-foreground">
                {formatHourLabel(hour)}
              </div>
              {weekDates.map((date) => (
                <div key={`${date}-${hour}`} className="relative border-l border-t" style={{ minHeight: 48 }} />
              ))}
            </div>
          ))}
        </div>

        {/* Session blocks overlaid */}
        <div className="pointer-events-none absolute inset-0">
          {weekSessions.map((session) => {
            const placement = sessionToGridPlacement(session, weekStart)
            return (
              <CalendarSessionBlock
                key={session.id}
                session={session}
                placement={placement}
                hasConflict={conflictIds.has(session.id)}
                onSelect={onSessionSelect}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function WeekNav({
  weekStart,
  onWeekChange,
}: {
  readonly weekStart: string
  readonly onWeekChange?: (weekStart: string) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        data-testid="week-prev"
        onClick={() => onWeekChange?.(navigateWeek(weekStart, "prev"))}
      >
        ←
      </Button>
      <span className="text-xs text-muted-foreground" data-testid="week-label">
        Week of {new Date(weekStart + "T00:00:00Z").toLocaleDateString([], { month: "short", day: "numeric" })}
      </span>
      <Button
        variant="ghost"
        size="sm"
        data-testid="week-next"
        onClick={() => onWeekChange?.(navigateWeek(weekStart, "next"))}
      >
        →
      </Button>
    </div>
  )
}
