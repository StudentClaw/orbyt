import type { Course, Grade } from "@student-claw/contracts"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  computeGradeTrend,
  computeCourseGradePercentage,
  type GradeTrend,
} from "./dashboard-model"

interface GradeOverviewProps {
  readonly courses: ReadonlyArray<Course>
  readonly grades: ReadonlyArray<Grade>
}

function trendArrow(trend: GradeTrend): string {
  switch (trend) {
    case "up":
      return "↑"
    case "down":
      return "↓"
    case "stable":
      return "→"
  }
}

function trendColor(trend: GradeTrend): string {
  switch (trend) {
    case "up":
      return "text-green-500"
    case "down":
      return "text-red-500"
    case "stable":
      return "text-muted-foreground"
  }
}

function trendLabel(trend: GradeTrend): string {
  switch (trend) {
    case "up":
      return "Improving"
    case "down":
      return "Declining"
    case "stable":
      return "Stable"
  }
}

export function GradeOverview({ courses, grades }: GradeOverviewProps) {
  if (grades.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Grade Overview</h2>
        <p className="text-sm text-muted-foreground" data-testid="no-grades">
          No grades yet
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Grade Overview</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="grade-cards">
        {courses.map((course) => {
          const percentage = computeCourseGradePercentage(grades, course.id)
          const trend = computeGradeTrend(grades, course.id)

          if (percentage === 0) return null

          return (
            <Card key={course.id} size="sm" data-testid={`grade-card-${course.id}`}>
              <CardHeader>
                <CardTitle className="text-sm font-medium">{course.code}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
                <Badge variant="outline" className={trendColor(trend)}>
                  <span className="mr-1">{trendArrow(trend)}</span>
                  {trendLabel(trend)}
                </Badge>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
