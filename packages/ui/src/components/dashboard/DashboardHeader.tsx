import { Button } from "@/components/ui/button"

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
      <Button
        type="button"
        variant="default"
        size="default"
        className="shrink-0"
        disabled={planDisabled}
        data-testid="plan-my-week"
        onClick={onPlanWeek}
      >
        Plan my week
      </Button>
    </header>
  )
}
