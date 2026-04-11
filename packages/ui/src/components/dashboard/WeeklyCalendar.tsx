import { Fragment } from "react"
import { Button } from "@/components/ui/button"
import {
  getWeekDates,
  navigateWeek,
  getSessionsForWeek,
  getDeadlinesForWeek,
  sessionToGridPlacement,
  deadlineToGridPlacement,
  slotToGridRow,
  detectConflicts,
  computeVisibleRange,
  SLOT_PX,
  type CalendarSession,
} from "./calendar-model"
import { CalendarSessionBlock } from "./CalendarSessionBlock"
import { CalendarDeadlineBlock } from "./CalendarDeadlineBlock"
import type { PrioritizedItem } from "./priority-model"

interface WeeklyCalendarProps {
  readonly sessions: ReadonlyArray<CalendarSession>
  readonly weekStart: string
  readonly deadlines?: ReadonlyArray<PrioritizedItem>
  readonly onWeekChange?: (weekStart: string) => void
  readonly onSessionSelect?: (sessionId: string) => void
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString([], {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  })
}

function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM"
  const display = hour > 12 ? hour - 12 : hour
  return `${display}${period}`
}

function isToday(dateStr: string): boolean {
  const today = new Date()
  const local = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  return dateStr === local
}

export function WeeklyCalendar({
  sessions,
  weekStart,
  deadlines = [],
  onWeekChange,
  onSessionSelect,
}: WeeklyCalendarProps) {
  const weekDates = getWeekDates(weekStart)
  const weekSessions = getSessionsForWeek(sessions, weekStart)
  const weekDeadlines = getDeadlinesForWeek(deadlines, weekStart)
  const conflicts = detectConflicts(weekSessions)
  const conflictIds = new Set(conflicts.flatMap(([a, b]) => [a, b]))
  const isEmpty = weekSessions.length === 0 && weekDeadlines.length === 0

  // Dynamic visible range: expand/shrink to fit the actual events this week
  const { firstHour, lastHour } = computeVisibleRange(weekSessions, weekDeadlines)
  const HOURS = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => i + firstHour)
  const TOTAL_SLOTS = HOURS.length * 4
  const dynamicFirstSlot = firstHour * 4

  // Parse weekStart as local date (same as formatDayHeader) to avoid UTC-offset mismatches
  const [wy, wm, wd] = weekStart.split("-").map(Number)
  const headerStart = isNaN(wy) ? new Date() : new Date(wy, wm - 1, wd)
  const headerEnd = isNaN(wy) ? new Date() : new Date(wy, wm - 1, wd + 6)
  const dateRangeLabel = `${headerStart.toLocaleDateString([], { month: "short", day: "numeric" })} – ${headerEnd.toLocaleDateString([], { month: "short", day: "numeric" })}`

  return (
    <div
      className="overflow-hidden rounded-3xl border border-white/10 bg-card/60 shadow-sm backdrop-blur-xl"
      data-testid="weekly-calendar-card"
    >
      {/* Header: ← [title + date] → */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-4">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 rounded-xl p-0 text-muted-foreground hover:bg-white/8"
          data-testid="week-prev"
          onClick={() => onWeekChange?.(navigateWeek(weekStart, "prev"))}
        >
          ←
        </Button>
        <div className="flex flex-col items-center gap-0.5">
          <h2 className="text-base font-semibold">Calendar</h2>
          <span className="text-xs text-muted-foreground" data-testid="week-label">
            {dateRangeLabel}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 rounded-xl p-0 text-muted-foreground hover:bg-white/8"
          data-testid="week-next"
          onClick={() => onWeekChange?.(navigateWeek(weekStart, "next"))}
        >
          →
        </Button>
      </div>

      {isEmpty ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground" data-testid="no-sessions">
          No events this week
        </p>
      ) : (
        <div className="overflow-x-auto" data-testid="weekly-calendar">
          {/*
           * Grid structure:
           *   Columns: auto (time labels) | 7 × 1fr (days)
           *   Rows:    auto (day headers) | 64 × SLOT_PX (15-min slots, 4 per hour)
           *
           * Session and deadline blocks are direct grid children so their
           * gridColumn/gridRow placement properties work correctly.
           */}
          <div
            className="grid min-w-[640px] grid-cols-[auto_repeat(7,1fr)]"
            style={{ gridTemplateRows: `auto repeat(${TOTAL_SLOTS}, ${SLOT_PX}px)` }}
            data-testid="calendar-grid"
          >
            {/* Row 1: column headers */}
            <div className="border-b border-white/8 bg-white/3 p-2 text-xs text-muted-foreground" />
            {weekDates.map((date) => (
              <div
                key={date}
                className={`border-b border-l border-white/8 p-2 text-center text-xs font-medium ${
                  isToday(date)
                    ? "bg-primary/10 text-primary"
                    : "bg-white/3 text-muted-foreground"
                }`}
                data-testid={`day-header-${date}`}
              >
                {formatDayHeader(date)}
              </div>
            ))}

            {/* Rows 2+: hour labels and day cells, each hour spans 4 slot-rows */}
            {HOURS.map((hour, i) => {
              const rowStart = i * 4 + 2 // row 1 = headers, rows 2-65 = slots
              return (
                <Fragment key={hour}>
                  <div
                    className="border-t border-white/5 p-1 pr-2 text-right text-[10px] text-muted-foreground/50"
                    style={{ gridColumn: 1, gridRow: `${rowStart} / span 4` }}
                  >
                    {formatHourLabel(hour)}
                  </div>
                  {weekDates.map((date, j) => (
                    <div
                      key={`${date}-${hour}`}
                      className={`border-l border-t border-white/5 ${
                        isToday(date) ? "bg-primary/5" : ""
                      }`}
                      style={{ gridColumn: j + 2, gridRow: `${rowStart} / span 4` }}
                    />
                  ))}
                </Fragment>
              )
            })}

            {/* Session blocks — direct grid children for correct placement */}
            {weekSessions.map((session) => {
              const p = sessionToGridPlacement(session, weekStart)
              return (
                <CalendarSessionBlock
                  key={session.id}
                  session={session}
                  gridColumn={p.column + 2}
                  gridRow={`${slotToGridRow(p.rowStart, dynamicFirstSlot)} / span ${p.rowSpan}`}
                  hasConflict={conflictIds.has(session.id)}
                  onSelect={onSessionSelect}
                />
              )
            })}

            {/* Deadline blocks — positioned at actual due time within dynamic range */}
            {weekDeadlines.map((item) => {
              const col = deadlineToGridPlacement(item.effectiveDueAt, weekStart).column
              const due = new Date(item.effectiveDueAt)
              const rawSlot = due.getHours() * 4 + Math.floor(due.getMinutes() / 15)
              const visibleEndSlot = (lastHour + 1) * 4
              const clampedSlot = Math.max(dynamicFirstSlot, Math.min(rawSlot, visibleEndSlot - 2))
              return (
                <CalendarDeadlineBlock
                  key={`deadline-${item.id}`}
                  item={item}
                  gridColumn={col + 2}
                  gridRow={`${slotToGridRow(clampedSlot, dynamicFirstSlot)} / span 2`}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

