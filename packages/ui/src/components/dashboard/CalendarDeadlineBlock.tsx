import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { computePriorityDisplay, type PrioritizedItem } from "./priority-model"

interface CalendarDeadlineBlockProps {
  readonly item: PrioritizedItem
  readonly gridColumn: number
  readonly gridRow: string
  readonly now?: Date
}

const URGENCY_STYLES: Record<string, string> = {
  overdue: "border-red-500/70 bg-red-500/15 text-red-300",
  urgent: "border-orange-500/70 bg-orange-500/15 text-orange-300",
  attention: "border-yellow-500/70 bg-yellow-500/15 text-yellow-300",
  calm: "border-green-500/70 bg-green-500/15 text-green-300",
}

function formatDueTime(isoString: string): string {
  return new Date(isoString).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function CalendarDeadlineBlock({
  item,
  gridColumn,
  gridRow,
  now = new Date(),
}: CalendarDeadlineBlockProps) {
  const display = computePriorityDisplay(item, now)
  const urgencyStyle = URGENCY_STYLES[display.zone] ?? URGENCY_STYLES.calm

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`pointer-events-auto rounded-xl border backdrop-blur-sm px-1.5 py-1 text-left text-xs leading-tight cursor-pointer select-none overflow-hidden transition-opacity hover:opacity-80 ${urgencyStyle}`}
          style={{ gridColumn, gridRow }}
          data-testid={`calendar-deadline-${item.id}`}
        >
          <p className="truncate font-medium">{item.title}</p>
          <p className="truncate text-[10px] opacity-60">{item.courseCode} · due</p>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        className="w-60 rounded-xl border border-white/10 bg-card/90 p-3 shadow-xl backdrop-blur-xl"
      >
        <div className="space-y-1">
          <p className="text-sm font-semibold">{item.title}</p>
          <p className="text-xs text-muted-foreground">{item.courseCode}</p>
          <p className="text-xs text-muted-foreground">
            Due: {formatDueTime(item.effectiveDueAt)}
          </p>
          {item.estimatedMinutes > 0 && (
            <p className="text-xs text-muted-foreground">
              Est. effort: {item.estimatedMinutes} min
            </p>
          )}
          <p className={`text-xs font-medium ${display.color}`}>{display.label}</p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
