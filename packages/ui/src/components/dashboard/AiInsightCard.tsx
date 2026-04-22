import { useState } from "react"
import type { InsightAction, InsightWithAction } from "./insight-types"

interface AiInsightCardProps {
  readonly insight: InsightWithAction | undefined
  readonly onAction?: (action: InsightAction) => void
}

export function AiInsightCard({ insight, onAction }: AiInsightCardProps) {
  const [dismissed, setDismissed] = useState(false)

  if (!insight || dismissed) return null

  return (
    <div className="pagelet p-5" data-testid="ai-insight-card">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">AI Insight</h2>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          aria-label="Dismiss insight"
          data-testid="ai-insight-dismiss"
          onClick={() => setDismissed(true)}
        >
          ✕
        </button>
      </div>
      <p className="mt-2 text-sm font-medium" data-testid={`ai-insight-title-${insight.id}`}>
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
          className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
          data-testid="ai-insight-action"
          onClick={() => onAction?.(insight.action!)}
        >
          {insight.action.label}
        </button>
      ) : null}
    </div>
  )
}
