import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { InsightCard, type InsightData } from "./InsightCard"

interface InsightCardsProps {
  readonly insights: ReadonlyArray<InsightData>
}

export function InsightCards({ insights }: InsightCardsProps) {
  if (insights.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Insights</h2>
        <p className="text-sm text-muted-foreground" data-testid="no-insights">
          No insights yet
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Insights</h2>
      <ScrollArea className="w-full" data-testid="insights-scroll">
        <div className="flex snap-x gap-3 pb-2" data-testid="insights-container">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
