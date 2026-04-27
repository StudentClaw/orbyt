import { Archive } from "lucide-react"
import { formatCountdown } from "./dashboard-model"
import type { PrioritizedItem } from "./priority-model"
import { resolvedBorderColor } from "./task-card-style"

interface TaskCardProps {
  readonly item: PrioritizedItem
  readonly now: Date
  readonly featured?: boolean
  readonly accentColor?: string
  readonly onClick?: () => void
  readonly onArchive?: () => void
}

function dueLabel(item: PrioritizedItem, now: Date): string {
  const raw = formatCountdown(item.effectiveDueAt, now)
  if (raw === "Overdue") return "Overdue"
  return `Due in ${raw}`
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

export function TaskCard({
  item,
  now,
  featured = false,
  accentColor,
  onClick,
  onArchive,
}: TaskCardProps) {
  const hours = (item.estimatedMinutes / 60).toFixed(item.estimatedMinutes % 60 === 0 ? 0 : 1)
  const submissionLabel = normalizeSubmissionStatus(item.submissionStatus)
  const hasMetadata = item.pointsPossible !== undefined || submissionLabel !== null
  const borderColor = resolvedBorderColor(item, now, accentColor)

  return (
    <div
      className={`dashboard-task-card group relative flex w-full items-stretch overflow-visible rounded-lg border border-border border-l-4 bg-card hover:bg-muted/20 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40 ${
        featured ? "xl:col-span-2" : ""
      }`}
      style={{ borderLeftColor: borderColor }}
    >
      <button
        type="button"
        onClick={onClick}
        className={`flex min-w-0 flex-1 items-stretch text-left focus-visible:outline-none ${
          featured ? "p-5" : "p-4"
        }`}
        data-testid={`task-card-${item.id}`}
      >
        <div className="min-w-0 flex-1 pr-3">
          <p className={`pr-9 font-medium leading-snug ${featured ? "text-base" : "text-sm"}`}>
            {item.title}
          </p>
          <p className={`${featured ? "mt-2" : "mt-1"} text-xs text-muted-foreground`}>
            {dueLabel(item, now)}
          </p>
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
        <div
          className={`shrink-0 self-center text-right tabular-nums text-muted-foreground ${
            featured ? "text-sm font-medium" : "text-xs"
          }`}
        >
          {hours}h
        </div>
      </button>
      {onArchive ? (
        <button
          type="button"
          aria-label={`Archive ${item.title}`}
          title="Archive assignment"
          className="dashboard-archive-action pointer-events-none absolute -right-2 -top-2 z-10 flex size-8 items-center justify-center rounded-full border border-destructive/25 bg-destructive/10 text-destructive opacity-0 shadow-sm hover:bg-destructive hover:text-background focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/35 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
          data-testid={`task-card-archive-${item.id}`}
          onClick={(event) => {
            event.stopPropagation()
            onArchive()
          }}
        >
          <Archive className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
