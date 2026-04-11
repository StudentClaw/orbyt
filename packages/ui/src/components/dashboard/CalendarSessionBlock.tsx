import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { CalendarSession } from "./calendar-model"

interface CalendarSessionBlockProps {
  readonly session: CalendarSession
  readonly gridColumn: number
  readonly gridRow: string
  readonly hasConflict?: boolean
  readonly onSelect?: (sessionId: string) => void
}

const COURSE_GLASS_COLORS = [
  "bg-blue-500/25 border-blue-500/40 text-blue-300",
  "bg-purple-500/25 border-purple-500/40 text-purple-300",
  "bg-green-500/25 border-green-500/40 text-green-300",
  "bg-orange-500/25 border-orange-500/40 text-orange-300",
  "bg-pink-500/25 border-pink-500/40 text-pink-300",
]

function courseGlassColor(courseId: string): string {
  let hash = 0
  for (const ch of courseId) {
    hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0
  }
  return COURSE_GLASS_COLORS[Math.abs(hash) % COURSE_GLASS_COLORS.length]
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })
}

function durationMinutes(start: string, end: string): number {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60000,
  )
}

export function CalendarSessionBlock({
  session,
  gridColumn,
  gridRow,
  hasConflict = false,
  onSelect,
}: CalendarSessionBlockProps) {
  const glassColor = courseGlassColor(session.courseId)
  const conflictStyle = hasConflict
    ? "ring-1 ring-orange-500/60 animate-[pulse_2s_infinite]"
    : ""
  const dur = durationMinutes(session.startTime, session.endTime)
  const durLabel = dur >= 60 ? `${(dur / 60).toFixed(1)}h` : `${dur}m`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`rounded-xl border backdrop-blur-sm px-1.5 py-1 text-left text-xs pointer-events-auto transition-opacity hover:opacity-90 overflow-hidden ${glassColor} ${conflictStyle}`}
          style={{ gridColumn, gridRow }}
          data-testid={`calendar-session-${session.id}`}
          onClick={() => onSelect?.(session.id)}
        >
          <p className="truncate font-medium leading-tight">
            {session.title}
          </p>
          {session.courseName && (
            <p className="truncate text-[10px] opacity-70">
              {session.courseName}
            </p>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        className="w-56 rounded-xl border border-white/10 bg-card/90 p-3 shadow-xl backdrop-blur-xl"
      >
        <div className="space-y-1">
          <p className="text-sm font-semibold">{session.title}</p>
          {session.courseName && (
            <p className="text-xs text-muted-foreground">{session.courseName}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {formatTime(session.startTime)} – {formatTime(session.endTime)}{" "}
            <span className="opacity-60">({durLabel})</span>
          </p>
          {hasConflict && (
            <p className="text-xs font-medium text-orange-400">
              Conflict with another session
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
