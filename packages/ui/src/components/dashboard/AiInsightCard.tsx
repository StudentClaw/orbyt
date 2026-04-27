import { useState } from "react"
import { X } from "lucide-react"
import type { InsightAction, InsightWithAction } from "./insight-types"

interface AiInsightCardProps {
  readonly insight: InsightWithAction | undefined
  readonly onAction?: (action: InsightAction) => void
}

export function AiInsightCard({ insight, onAction }: AiInsightCardProps) {
  const [dismissed, setDismissed] = useState(false)

  if (!insight || dismissed) return null

  return (
    <div
      className="dashboard-side-widget pagelet relative overflow-hidden border-l-2 p-5"
      data-testid="ai-insight-card"
      style={{ borderLeftColor: "var(--skill)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="dashboard-ai-pulse inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "var(--skill)" }}
          />
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: "var(--skill)" }}
          >
            AI Insight
          </p>
        </div>
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-label="Dismiss insight"
          data-testid="ai-insight-dismiss"
          onClick={() => setDismissed(true)}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <p className="mt-2 text-sm font-semibold leading-snug" data-testid={`ai-insight-title-${insight.id}`}>
        {insight.title}
      </p>
      {insight.body ? (
        <p className="mt-1 text-xs text-muted-foreground" data-testid={`ai-insight-body-${insight.id}`}>
          {insight.body}
        </p>
      ) : null}
      {insight.action ? (
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
          data-testid="ai-insight-action"
          onClick={() => onAction?.(insight.action!)}
        >
          {insight.action.label}
        </button>
      ) : null}
    </div>
  )
}
