import type { ReactNode } from "react"

interface DashboardShellProps {
  readonly left: ReactNode
  readonly right: ReactNode
}

/**
 * Asymmetric two-column shell: primary workspace | quieter contextual sidebar.
 */
export function DashboardShell({ left, right }: DashboardShellProps) {
  return (
    <div
      className="dashboard-depth-shell grid min-h-0 min-h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] xl:grid-cols-[minmax(0,1fr)_400px]"
      data-testid="dashboard-shell"
    >
      <main className="min-h-0 overflow-auto px-6 py-6 md:px-8 lg:px-10 lg:py-8">
        <div className="dashboard-panel-enter mx-auto max-w-6xl">{left}</div>
      </main>
      <aside className="min-h-0 overflow-auto border-border/60 bg-card/45 px-6 py-6 md:px-8 lg:border-l lg:py-8">
        <div className="dashboard-panel-enter dashboard-panel-context mx-auto flex max-w-[28rem] flex-col gap-5 lg:mx-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Context
          </p>
          {right}
        </div>
      </aside>
    </div>
  )
}
