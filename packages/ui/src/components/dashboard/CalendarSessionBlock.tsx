import { Badge } from "@/components/ui/badge"
import type { CalendarSession, GridPlacement } from "./calendar-model"

interface CalendarSessionBlockProps {
  readonly session: CalendarSession
  readonly placement: GridPlacement
  readonly hasConflict?: boolean
  readonly onSelect?: (sessionId: string) => void
}

function courseColor(courseId: string): string {
  const colors = [
    "bg-blue-500/20 border-blue-500/40 text-blue-700 dark:text-blue-300",
    "bg-purple-500/20 border-purple-500/40 text-purple-700 dark:text-purple-300",
    "bg-green-500/20 border-green-500/40 text-green-700 dark:text-green-300",
    "bg-orange-500/20 border-orange-500/40 text-orange-700 dark:text-orange-300",
    "bg-pink-500/20 border-pink-500/40 text-pink-700 dark:text-pink-300",
  ]
  let hash = 0
  for (const ch of courseId) {
    hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0
  }
  return colors[Math.abs(hash) % colors.length]
}

function formatTime(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

export function CalendarSessionBlock({
  session,
  placement,
  hasConflict = false,
  onSelect,
}: CalendarSessionBlockProps) {
  return (
    <button
      type="button"
      className={`absolute rounded border px-1.5 py-0.5 text-left text-xs transition-opacity hover:opacity-80 ${courseColor(session.courseId)}`}
      style={{
        gridColumn: placement.column + 1,
        gridRow: `${placement.rowStart + 1} / span ${placement.rowSpan}`,
      }}
      data-testid={`calendar-session-${session.id}`}
      onClick={() => onSelect?.(session.id)}
    >
      <p className="truncate font-medium">{session.title}</p>
      {session.courseName && (
        <p className="truncate text-[10px] opacity-70">{session.courseName}</p>
      )}
      <p className="text-[10px] opacity-70">
        {formatTime(session.startTime)} – {formatTime(session.endTime)}
      </p>
      {hasConflict && (
        <Badge variant="outline" className="mt-0.5 border-red-500/40 text-red-500 text-[10px]">
          Conflict
        </Badge>
      )}
    </button>
  )
}
