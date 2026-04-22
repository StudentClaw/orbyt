import { Button } from "@/components/ui/button"

interface DashboardHeaderProps {
  readonly title: string
  readonly subtitle: string
  readonly onPlanWeek: () => void
  readonly planDisabled?: boolean
}

export function DashboardHeader({
  title,
  subtitle,
  onPlanWeek,
  planDisabled = false,
}: DashboardHeaderProps) {
  return (
    <header className="mb-8 flex items-start justify-between gap-4" data-testid="dashboard-header">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
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
