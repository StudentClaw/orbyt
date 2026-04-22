import type { FilterScope } from "./subject-grouping"

const TABS: ReadonlyArray<{ readonly id: FilterScope; readonly label: string }> = [
  { id: "today", label: "Today" },
  { id: "thisWeek", label: "This Week" },
  { id: "upcoming", label: "Upcoming" },
  { id: "overdue", label: "Overdue" },
]

interface DashboardFilterTabsProps {
  readonly value: FilterScope
  readonly onChange: (scope: FilterScope) => void
}

export function DashboardFilterTabs({ value, onChange }: DashboardFilterTabsProps) {
  return (
    <nav
      className="flex flex-wrap gap-8 border-b border-border/50"
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
            onClick={() => onChange(tab.id)}
            className={`-mb-px border-b-2 pb-3 text-sm transition-colors ${
              active
                ? "border-foreground font-semibold text-foreground"
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
