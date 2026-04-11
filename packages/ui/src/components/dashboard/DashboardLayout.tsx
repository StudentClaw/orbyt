import type { ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"

export interface DashboardSectionSlot {
  readonly id: string
  readonly label: string
  readonly content: ReactNode | null
}

interface DashboardLayoutProps {
  readonly sections: ReadonlyArray<DashboardSectionSlot>
}

const INSIGHTS_ID = "insights"
const LEFT_COL_ID = "priorityQueue"
const RIGHT_COL_ID = "grades"
const FULL_WIDTH_ID = "calendar"
const QUICK_ACTIONS_ID = "quickActions"

function SectionSkeleton({ label }: { readonly label: string }) {
  return (
    <div className="space-y-3" data-testid={`skeleton-${label}`}>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

export function DashboardLayout({ sections }: DashboardLayoutProps) {
  const sectionMap = new Map<string, DashboardSectionSlot>(
    sections.map((s) => [s.id, s]),
  )

  const insightSlot = sectionMap.get(INSIGHTS_ID)
  const leftSlot = sectionMap.get(LEFT_COL_ID)
  const rightSlot = sectionMap.get(RIGHT_COL_ID)
  const fullWidthSlot = sectionMap.get(FULL_WIDTH_ID)
  const quickActionsSlot = sectionMap.get(QUICK_ACTIONS_ID)

  return (
    <div className="flex flex-col gap-4 px-4 py-4 lg:px-6" data-testid="dashboard-layout">
      {/* iPhone-style insight strip — full width, hidden when empty */}
      {insightSlot?.content && (
        <section data-testid={`section-${insightSlot.id}`}>
          {insightSlot.content}
        </section>
      )}

      {/* Two-column row: Coursework (45%) | Grades (55%) */}
      <div className="grid gap-4 lg:grid-cols-[45fr_55fr]">
        {leftSlot && (
          <section data-testid={`section-${leftSlot.id}`} className="min-h-0">
            {leftSlot.content ?? <SectionSkeleton label={leftSlot.id} />}
          </section>
        )}
        {rightSlot && (
          <section data-testid={`section-${rightSlot.id}`} className="min-h-0">
            {rightSlot.content ?? <SectionSkeleton label={rightSlot.id} />}
          </section>
        )}
      </div>

      {/* Full-width calendar */}
      {fullWidthSlot && (
        <section data-testid={`section-${fullWidthSlot.id}`}>
          {fullWidthSlot.content ?? <SectionSkeleton label={fullWidthSlot.id} />}
        </section>
      )}

      {/* Quick Actions — always visible, no toggle */}
      {quickActionsSlot?.content && (
        <section data-testid={`section-${quickActionsSlot.id}`}>
          {quickActionsSlot.content}
        </section>
      )}
    </div>
  )
}

/** Fixed section order per spec. */
export const DASHBOARD_SECTION_ORDER = [
  "priorityQueue",
  "insights",
  "calendar",
  "grades",
  "quickActions",
] as const
