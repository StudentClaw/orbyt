import type { ActivityFeedEntry } from "@student-claw/contracts"
import { useNavigate } from "@tanstack/react-router"
import { Card, CardContent } from "@/components/ui/card"

interface ActivityFeedItemProps {
  readonly entry: ActivityFeedEntry
}

const CATEGORY_COLORS: Record<string, string> = {
  canvas: "bg-blue-500/10 text-blue-500",
  planner: "bg-green-500/10 text-green-500",
  workflow: "bg-purple-500/10 text-purple-500",
  insight: "bg-amber-500/10 text-amber-500",
}

export function ActivityFeedItem({ entry }: ActivityFeedItemProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (entry.deepLink) {
      navigate({ to: entry.deepLink })
    }
  }

  const colorClasses = CATEGORY_COLORS[entry.category] ?? "bg-muted text-muted-foreground"

  return (
    <Card
      className={`${entry.deepLink ? "cursor-pointer hover:bg-muted/50" : ""}`}
      onClick={entry.deepLink ? handleClick : undefined}
      data-testid={`activity-item-${entry.id}`}
    >
      <CardContent className="flex items-start gap-3 p-3">
        <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${colorClasses}`}>
          {entry.category}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{entry.title}</p>
          {entry.body && (
            <p className="mt-0.5 text-xs text-muted-foreground">{entry.body}</p>
          )}
        </div>
        {entry.deepLink && (
          <span
            className="shrink-0 text-xs text-muted-foreground"
            data-testid={`activity-item-link-${entry.id}`}
          >
            &rarr;
          </span>
        )}
      </CardContent>
    </Card>
  )
}
