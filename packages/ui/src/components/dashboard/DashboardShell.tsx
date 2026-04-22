import type { ReactNode } from "react"

interface DashboardShellProps {
  readonly left: ReactNode
  readonly right: ReactNode
}

/**
 * Asymmetric two-column shell: primary workspace (~65–70%) | contextual sidebar (~30–35%).
 * Divider: subtle 1px border on the sidebar’s leading edge at `lg+`.
 */
export function DashboardShell({ left, right }: DashboardShellProps) {
  return (
    <div
      className="grid min-h-0 min-h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]"
      data-testid="dashboard-shell"
    >
      <div className="min-h-0 overflow-auto px-8 py-8">{left}</div>
      <div className="min-h-0 overflow-auto border-border/40 px-8 py-8 lg:border-l">
        <div className="flex flex-col gap-6">{right}</div>
      </div>
    </div>
  )
}
