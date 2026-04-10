import type { CourseWorkItem } from "@student-claw/contracts"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  computeUrgencyZone,
  formatCountdown,
  groupDeadlinesByDay,
  urgencyZoneBgColor,
} from "./dashboard-model"

interface DeadlineTimelineProps {
  readonly items: ReadonlyArray<CourseWorkItem>
  readonly now?: Date
}

const MAX_VISIBLE_PER_DAY = 3

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

export function DeadlineTimeline({
  items,
  now = new Date(),
}: DeadlineTimelineProps) {
  const grouped = groupDeadlinesByDay(items, 14, now)

  if (grouped.size === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Upcoming Deadlines</h2>
        <p className="text-sm text-muted-foreground" data-testid="no-deadlines">
          No upcoming deadlines
        </p>
      </div>
    )
  }

  const sortedDays = Array.from(grouped.entries()).sort(
    ([a], [b]) => a.localeCompare(b),
  )

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Upcoming Deadlines</h2>
      <div
        className="flex gap-3 overflow-x-auto pb-2"
        data-testid="deadline-timeline"
      >
        {sortedDays.map(([day, dayItems]) => {
          const visible = dayItems.slice(0, MAX_VISIBLE_PER_DAY)
          const overflow = dayItems.length - MAX_VISIBLE_PER_DAY

          return (
            <div
              key={day}
              className="flex min-w-[140px] flex-col gap-1.5 rounded-lg border p-3"
              data-testid={`day-column-${day}`}
            >
              <span className="text-xs font-medium text-muted-foreground">
                {formatDayLabel(day)}
              </span>
              {visible.map((item) => {
                const zone = computeUrgencyZone(item, now)
                return (
                  <Badge
                    key={item.id}
                    variant="outline"
                    className={`text-xs ${urgencyZoneBgColor(zone)}`}
                    data-testid={`deadline-item-${item.id}`}
                  >
                    {item.title}
                  </Badge>
                )
              })}
              {overflow > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground"
                      data-testid={`overflow-chip-${day}`}
                    >
                      +{overflow} more
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{formatDayLabel(day)}</p>
                      {dayItems.map((item) => {
                        const zone = computeUrgencyZone(item, now)
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="truncate">{item.title}</span>
                            <Badge
                              variant="outline"
                              className={`ml-2 shrink-0 ${urgencyZoneBgColor(zone)}`}
                            >
                              {formatCountdown(item.effectiveDueAt!, now)}
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
