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
}

export function DashboardFilterTabs({ value, onChange }: DashboardFilterTabsProps) {
  return (
    <nav
      className="dashboard-filter-tabs -mx-1 flex gap-2 overflow-x-auto border-b border-border/50 px-1"
      aria-label="Assignment filters"
      data-testid="dashboard-filter-tabs"
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
  )
}
