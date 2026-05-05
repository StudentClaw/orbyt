import { RefreshCw } from "lucide-react"
import type { FilterScope } from "./subject-grouping"

const TABS: ReadonlyArray<{ readonly id: FilterScope; readonly label: string }> = [
  { id: "today", label: "Today" },
  { id: "thisWeek", label: "This Week" },
  { id: "upcoming", label: "Upcoming" },
  { id: "overdue", label: "Overdue" },
  { id: "submitted", label: "Submitted" },
]

interface DashboardFilterTabsProps {
  readonly value: FilterScope
  readonly onChange: (scope: FilterScope) => void
  readonly onRefresh?: () => void
  readonly isRefreshing?: boolean
  readonly refreshDisabled?: boolean
}

export function DashboardFilterTabs({
  value,
  onChange,
  onRefresh,
  isRefreshing = false,
  refreshDisabled = false,
}: DashboardFilterTabsProps) {
  return (
    <div
      className="dashboard-filter-tabs -mx-1 flex items-stretch gap-2 border-b border-border/50 px-1"
      data-testid="dashboard-filter-tabs"
    >
      <nav
        className="flex flex-1 gap-2 overflow-x-auto"
        aria-label="Assignment filters"
      >
        {TABS.map((tab) => {
          const active = tab.id === value
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`filter-tab-${tab.id}`}
              data-active={active}
              onClick={() => onChange(tab.id)}
              className={`dashboard-filter-tab -mb-px shrink-0 border-b-2 px-2 pb-3 text-sm ${
                active
                  ? "border-primary font-semibold text-foreground"
                  : "border-transparent font-medium text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>
      {onRefresh ? (
        <button
          type="button"
          data-testid="dashboard-canvas-refresh"
          onClick={onRefresh}
          disabled={refreshDisabled || isRefreshing}
          aria-label={isRefreshing ? "Syncing Canvas" : "Refresh Canvas sync"}
          title={isRefreshing ? "Syncing Canvas…" : "Refresh Canvas sync"}
          className="-mb-px flex shrink-0 items-center self-end border-b-2 border-transparent px-2 pb-3 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            aria-hidden
          />
        </button>
      ) : null}
    </div>
  )
}
