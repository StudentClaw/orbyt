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
    <div
      className="pagelet relative overflow-hidden p-5"
      data-testid="ai-insight-card"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-0.5"
        style={{
          background:
            "linear-gradient(90deg, var(--skill) 0%, var(--primary) 100%)",
        }}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
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
          className="text-xs text-muted-foreground hover:text-foreground"
          aria-label="Dismiss insight"
          data-testid="ai-insight-dismiss"
          onClick={() => setDismissed(true)}
        >
          ✕
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
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
        </button>
      ) : null}
    </div>
  )
}
