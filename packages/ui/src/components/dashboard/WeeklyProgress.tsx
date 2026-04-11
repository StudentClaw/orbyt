import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  computeStreak,
  computeCompletionRatio,
  computeWeekOverWeek,
  type ProgressSession,
} from "./progress-model"

interface WeeklyProgressProps {
  readonly sessions: ReadonlyArray<ProgressSession>
  readonly weekStart: string
  readonly lastWeekStart: string
  readonly now?: Date
}

function trendIndicator(direction: "up" | "same" | "down", delta: number): string {
  switch (direction) {
    case "up":
      return `↑ ${Math.abs(delta)}% from last week`
    case "down":
      return `↓ ${Math.abs(delta)}% from last week`
    case "same":
      return "Same as last week"
  }
}

function trendColor(direction: "up" | "same" | "down"): string {
  switch (direction) {
    case "up":
      return "text-green-500"
    case "down":
      return "text-red-500"
    case "same":
      return "text-muted-foreground"
  }
}

export function WeeklyProgress({
  sessions,
  weekStart,
  lastWeekStart,
  now = new Date(),
}: WeeklyProgressProps) {
  const thisWeek = computeCompletionRatio(sessions, weekStart)
  const lastWeek = computeCompletionRatio(sessions, lastWeekStart)
  const wow = computeWeekOverWeek(thisWeek, lastWeek)
  const streak = computeStreak(sessions, now)

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Weekly Progress</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span data-testid="completion-count">
                  {thisWeek.completed}/{thisWeek.total} sessions
                </span>
                <span className="font-medium" data-testid="completion-pct">
                  {thisWeek.percentage}%
                </span>
              </div>
              <Progress value={thisWeek.percentage} className="h-2" />
              <p
                className={`text-xs ${trendColor(wow.direction)}`}
                data-testid="week-over-week"
              >
                {trendIndicator(wow.direction, wow.delta)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Streak</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold" data-testid="streak-count">
              {streak}
            </p>
            <p className="text-xs text-muted-foreground">
              {streak === 1 ? "day" : "days"} in a row
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
