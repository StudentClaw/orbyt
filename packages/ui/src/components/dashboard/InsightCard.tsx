import { Card, CardContent } from "@/components/ui/card"

export interface InsightData {
  readonly id: string
  readonly title: string
  readonly body: string
}

interface InsightCardProps {
  readonly insight: InsightData
}

export function InsightCard({ insight }: InsightCardProps) {
  return (
    <Card
      size="sm"
      className="min-w-[240px] shrink-0 snap-start"
      data-testid={`insight-card-${insight.id}`}
    >
      <CardContent className="space-y-1 py-3">
        <p className="text-sm font-medium" data-testid={`insight-title-${insight.id}`}>
          {insight.title}
        </p>
        <p className="text-xs text-muted-foreground" data-testid={`insight-body-${insight.id}`}>
          {insight.body}
        </p>
      </CardContent>
    </Card>
  )
}
