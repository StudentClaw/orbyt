import { useState } from "react"
import type { InsightData } from "./InsightCard"

export interface InsightStripItem extends InsightData {
  readonly actionLabel?: string
}

interface InsightStripProps {
  readonly insights: ReadonlyArray<InsightStripItem>
}

const DOT_COLORS = [
  "bg-blue-400",
  "bg-green-400",
  "bg-orange-400",
  "bg-purple-400",
  "bg-pink-400",
]

export function InsightStrip({ insights }: InsightStripProps) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set())

  const visible = insights.filter((i) => !dismissed.has(i.id))

  if (visible.length === 0) return null

  function dismiss(id: string) {
    setDismissed((prev) => new Set([...prev, id]))
  }

  return (
    <div
      className="flex flex-col gap-2"
      data-testid="insight-strip"
      role="region"
      aria-label="Insights"
    >
      {visible.map((insight, i) => (
        <InsightPill
          key={insight.id}
          insight={insight}
          dotColor={DOT_COLORS[i % DOT_COLORS.length]}
          onDismiss={() => dismiss(insight.id)}
        />
      ))}
    </div>
  )
}

interface InsightPillProps {
  readonly insight: InsightStripItem
  readonly dotColor: string
  readonly onDismiss: () => void
}

function InsightPill({ insight, dotColor, onDismiss }: InsightPillProps) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl backdrop-blur-xl bg-card/60 border border-white/10 px-4 py-3 animate-[slide-in-down_0.2s_ease-out] shadow-sm"
      data-testid={`insight-pill-${insight.id}`}
      role="status"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-medium leading-tight"
          data-testid={`insight-title-${insight.id}`}
        >
          {insight.title}
        </p>
        {insight.body && (
          <p
            className="mt-0.5 text-xs text-muted-foreground"
            data-testid={`insight-body-${insight.id}`}
          >
            {insight.body}
          </p>
        )}
      </div>
      {insight.actionLabel && (
        <button
          type="button"
          className="shrink-0 text-xs font-medium text-primary hover:underline"
        >
          {insight.actionLabel}
        </button>
      )}
      <button
        type="button"
        className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
        onClick={onDismiss}
        aria-label="Dismiss insight"
        data-testid={`dismiss-${insight.id}`}
      >
        ✕
      </button>
    </div>
  )
}
