import { formatCountdown } from "./dashboard-model"
import { computePriorityDisplay, type PrioritizedItem } from "./priority-model"

interface TaskCardProps {
  readonly item: PrioritizedItem
  readonly now: Date
}

function urgencyBorderClass(item: PrioritizedItem, now: Date): string {
  const { zone } = computePriorityDisplay(item, now)
  switch (zone) {
    case "overdue":
      return "border-l-destructive"
    case "urgent":
      return "border-l-[var(--warning)]"
    case "attention":
      return "border-l-amber-500"
    case "calm":
    default:
      return "border-l-muted-foreground/50"
  }
}

function dueLabel(item: PrioritizedItem, now: Date): string {
  const raw = formatCountdown(item.effectiveDueAt, now)
  if (raw === "Overdue") return "Overdue"
  return `Due in ${raw}`
}

export function TaskCard({ item, now }: TaskCardProps) {
  const hours = (item.estimatedMinutes / 60).toFixed(item.estimatedMinutes % 60 === 0 ? 0 : 1)

  return (
    <div
      className={`flex items-stretch rounded-lg border border-border bg-card p-4 border-l-4 ${urgencyBorderClass(item, now)}`}
      data-testid={`task-card-${item.id}`}
    >
      <div className="min-w-0 flex-1 pr-3">
        <p className="text-sm font-medium leading-snug">{item.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{dueLabel(item, now)}</p>
      </div>
      <div className="shrink-0 self-center text-right text-xs tabular-nums text-muted-foreground">
        {hours}h
      </div>
    </div>
  )
}
