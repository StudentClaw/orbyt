import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCountdown } from "./dashboard-model"
import {
  computePriorityDisplay,
  type PrioritizedItem,
} from "./priority-model"

interface PriorityCardProps {
  readonly item: PrioritizedItem
  readonly now: Date
}

export function PriorityCard({ item, now }: PriorityCardProps) {
  const display = computePriorityDisplay(item, now)
  const countdown = formatCountdown(item.effectiveDueAt, now)
  const estimatedHours = (item.estimatedMinutes / 60).toFixed(1)

  return (
    <Card
      size="sm"
      data-testid={`priority-card-${item.id}`}
      className="transition-colors"
    >
      <CardContent className="flex items-center gap-3 py-3">
        <Badge
          variant="outline"
          className={`${display.color} ${display.bgColor} shrink-0`}
          data-testid={`urgency-badge-${item.id}`}
        >
          {display.label}
        </Badge>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" data-testid={`priority-title-${item.id}`}>
            {item.title}
          </p>
          <p className="text-xs text-muted-foreground">{item.courseCode}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span data-testid={`countdown-${item.id}`}>{countdown}</span>
          <span data-testid={`effort-${item.id}`}>{estimatedHours}h</span>
        </div>
      </CardContent>
    </Card>
  )
}
