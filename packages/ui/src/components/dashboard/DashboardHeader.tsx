import { CalendarClock } from "lucide-react"
import { GlassButton } from "@/components/ui/glass-button"

interface DashboardHeaderProps {
  readonly title: string
  readonly dateLabel: string
  readonly dueThisWeek: number
  readonly onPlanWeek: () => void
  readonly planDisabled?: boolean
}

export function DashboardHeader({
  title,
  dateLabel,
  dueThisWeek,
  onPlanWeek,
  planDisabled = false,
}: DashboardHeaderProps) {
  return (
    <header className="mb-8 flex items-start justify-between gap-4" data-testid="dashboard-header">
      <div className="min-w-0 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
          data-testid="dashboard-subtitle"
        >
          <span>{dateLabel}</span>
          <span aria-hidden className="text-border">
            •
          </span>
          <span className="inline-flex items-baseline gap-1.5">
            <span
              className="tabular-nums text-base font-semibold text-primary"
              data-testid="dashboard-due-count"
            >
              {dueThisWeek}
            </span>
            <span>due this week</span>
          </span>
        </p>
      </div>
      <GlassButton
        type="button"
        size="sm"
        className="shrink-0"
        contentClassName="flex items-center gap-2"
        disabled={planDisabled}
        data-testid="plan-my-week"
        onClick={onPlanWeek}
      >
        <span>Plan my week</span>
        <CalendarClock className="h-4 w-4" aria-hidden />
      </GlassButton>
    </header>
  )
}
