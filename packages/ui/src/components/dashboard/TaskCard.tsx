import { formatCountdown } from "./dashboard-model"
import { computePriorityDisplay, type PrioritizedItem } from "./priority-model"

interface TaskCardProps {
  readonly item: PrioritizedItem
  readonly now: Date
  readonly onClick?: () => void
}

function dueLabel(item: PrioritizedItem, now: Date): string {
  const raw = formatCountdown(item.effectiveDueAt, now)
  if (raw === "Overdue") return "Overdue"
  return `Due in ${raw}`
}

export function resolvedBorderColor(item: PrioritizedItem, now: Date): string {
  if (item.courseColor) return item.courseColor
  const { zone } = computePriorityDisplay(item, now)
  switch (zone) {
    case "overdue":
      return "var(--destructive)"
    case "urgent":
      return "var(--warning)"
    case "attention":
      return "oklch(0.79 0.14 78)"
    case "calm":
    default:
      return "color-mix(in oklab, var(--muted-foreground) 65%, transparent)"
  }
}

function formatPoints(pointsPossible: number): string {
  return Number.isInteger(pointsPossible) ? `${pointsPossible} pts` : `${pointsPossible.toFixed(1).replace(/\.0$/, "")} pts`
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

function submissionPillClasses(label: string | null): string {
  switch (label) {
    case "Graded":
      return "border-success/30 bg-success/10 text-success"
    case "Submitted":
      return "border-info/30 bg-info/10 text-info"
    case "Not submitted":
      return "border-warning/40 bg-warning/10 text-warning"
    default:
      return "border-border bg-muted/30 text-muted-foreground"
  }
}

function normalizeSubmissionStatus(submissionStatus?: string): string | null {
  if (!submissionStatus) return null

  switch (submissionStatus.trim().toLowerCase()) {
    case "graded":
      return "Graded"
    case "submitted":
      return "Submitted"
    case "unsubmitted":
    case "not_submitted":
      return "Not submitted"
    default: {
      const label = toTitleCase(submissionStatus)
      return label.length > 0 ? label : null
    }
  }
}

export function TaskCard({ item, now, onClick }: TaskCardProps) {
  const hours = (item.estimatedMinutes / 60).toFixed(item.estimatedMinutes % 60 === 0 ? 0 : 1)
  const submissionLabel = normalizeSubmissionStatus(item.submissionStatus)
  const hasMetadata = item.pointsPossible !== undefined || submissionLabel !== null
  const borderColor = resolvedBorderColor(item, now)

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-stretch rounded-lg border border-border border-l-4 bg-card p-4 text-left transition-colors hover:bg-muted/20 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
      data-testid={`task-card-${item.id}`}
      style={{ borderLeftColor: borderColor }}
    >
      <div className="min-w-0 flex-1 pr-3">
        <p className="text-sm font-medium leading-snug">{item.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{dueLabel(item, now)}</p>
        {hasMetadata ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.pointsPossible !== undefined ? (
              <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {formatPoints(item.pointsPossible)}
              </span>
            ) : null}
            {submissionLabel ? (
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${submissionPillClasses(submissionLabel)}`}
              >
                {submissionLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="shrink-0 self-center text-right text-xs tabular-nums text-muted-foreground">
        {hours}h
      </div>
    </button>
  )
}
