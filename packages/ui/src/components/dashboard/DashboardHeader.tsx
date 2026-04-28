import { CalendarClock } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DashboardHeaderProps {
  readonly title: string
  readonly dateLabel: string
  readonly dueThisWeek: number
  readonly planLabel: string
  readonly onPlanWeek: () => void
  readonly planDisabled?: boolean
}

export function DashboardHeader({
  title,
  dateLabel,
  dueThisWeek,
  planLabel,
  onPlanWeek,
  planDisabled = false,
}: DashboardHeaderProps) {
  return (
    <header
      className="dashboard-header-motion mb-6 flex flex-col gap-4 border-b border-border/50 pb-6 sm:flex-row sm:items-end sm:justify-between"
      data-testid="dashboard-header"
    >
      <div className="min-w-0 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
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
              className="dashboard-due-count tabular-nums text-base font-semibold text-primary"
              data-testid="dashboard-due-count"
            >
              {dueThisWeek}
            </span>
            <span>due this week</span>
          </span>
        </p>
      </div>
      <Button
        type="button"
        size="default"
        className="w-full text-white sm:w-auto"
        disabled={planDisabled}
        data-testid="plan-my-week"
        onClick={onPlanWeek}
      >
        <CalendarClock className="h-4 w-4" aria-hidden />
        <span>{planLabel}</span>
      </Button>
    </header>
  )
}
