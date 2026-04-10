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

function SectionSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-3" data-testid={`skeleton-${label}`}>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

export function DashboardLayout({ sections }: DashboardLayoutProps) {
  return (
    <div className="flex flex-col gap-6 p-6" data-testid="dashboard-layout">
      {sections.map((section) => (
        <section key={section.id} data-testid={`section-${section.id}`}>
          {section.content ?? <SectionSkeleton label={section.id} />}
        </section>
      ))}
    </div>
  )
}

/** Fixed section order per spec. */
export const DASHBOARD_SECTION_ORDER = [
  "priorityQueue",
  "insights",
  "deadlines",
  "calendar",
  "grades",
  "progress",
  "announcements",
  "quickActions",
] as const
