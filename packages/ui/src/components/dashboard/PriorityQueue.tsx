import { sortByPriority, type PrioritizedItem } from "./priority-model"
import { PriorityCard } from "./PriorityCard"

interface PriorityQueueProps {
  readonly items: ReadonlyArray<PrioritizedItem>
  readonly now?: Date
  readonly maxItems?: number
}

const DEFAULT_MAX_ITEMS = 7

export function PriorityQueue({
  items,
  now = new Date(),
  maxItems = DEFAULT_MAX_ITEMS,
}: PriorityQueueProps) {
  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Priority Queue</h2>
        <p className="text-sm text-muted-foreground" data-testid="no-priorities">
          No upcoming tasks
        </p>
      </div>
    )
  }

  const sorted = sortByPriority(items, now)
  const visible = sorted.slice(0, maxItems)

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Priority Queue</h2>
      <div className="flex flex-col gap-2" data-testid="priority-queue">
        {visible.map((item) => (
          <PriorityCard key={item.id} item={item} now={now} />
        ))}
      </div>
      {sorted.length > maxItems && (
        <p className="text-xs text-muted-foreground" data-testid="priority-overflow">
          +{sorted.length - maxItems} more
        </p>
      )}
    </div>
  )
}
