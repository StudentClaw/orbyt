import { useState, useRef, useCallback } from "react"
import { sortByPriority, type PrioritizedItem } from "./priority-model"
import { PriorityCard } from "./PriorityCard"

interface PriorityQueueProps {
  readonly items: ReadonlyArray<PrioritizedItem>
  readonly now?: Date
  readonly maxItems?: number
}

const DEFAULT_MAX_ITEMS = 5

export function PriorityQueue({
  items,
  now = new Date(),
  maxItems = DEFAULT_MAX_ITEMS,
}: PriorityQueueProps) {
  const sorted = sortByPriority(items, now)
  const [remaining, setRemaining] = useState(Math.max(0, sorted.length - maxItems))
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || sorted.length === 0) return
    const remainingPx = el.scrollHeight - el.scrollTop - el.clientHeight
    if (remainingPx <= 4) {
      setRemaining(0)
    } else {
      const avgItemHeight = el.scrollHeight / sorted.length
      setRemaining(Math.max(1, Math.ceil(remainingPx / avgItemHeight)))
    }
  }, [sorted.length])

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-card/60 shadow-sm backdrop-blur-xl"
      data-testid="priority-queue-card"
    >
      {/* Header — no toggle */}
      <div className="flex items-center gap-2 px-5 py-4">
        <h2 className="text-base font-semibold">Coursework</h2>
        {items.length > 0 && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
            {items.length}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1.5 px-3 pb-4">
        {items.length === 0 ? (
          <p
            className="px-2 py-3 text-sm text-muted-foreground"
            data-testid="no-priorities"
          >
            No upcoming tasks
          </p>
        ) : (
          <>
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="max-h-[280px] overflow-y-auto"
              style={{ scrollbarWidth: "none" }}
            >
              <div className="flex flex-col gap-1.5 pb-2" data-testid="priority-queue">
                {sorted.map((item, i) => (
                  <PriorityCard key={item.id} item={item} now={now} rank={i} />
                ))}
              </div>
            </div>
            {remaining > 0 && (
              <p
                className="pt-2 pb-1 text-center text-xs text-muted-foreground"
                data-testid="priority-overflow"
              >
                ↓ {remaining} more
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
