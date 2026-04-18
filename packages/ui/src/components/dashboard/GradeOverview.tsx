import type { CanvasStudentCourseGradeSummary, Course } from "@student-claw/contracts"
import {
  computeGradeTrend,
  computeCourseGradePercentage,
  type GradeTrend,
} from "./dashboard-model"

interface GradeOverviewProps {
  readonly courses: ReadonlyArray<Course>
  readonly grades: ReadonlyArray<CanvasStudentCourseGradeSummary>
}

function percentageToLetter(pct: number): string {
  if (pct >= 93) return "A"
  if (pct >= 90) return "A−"
  if (pct >= 87) return "B+"
  if (pct >= 83) return "B"
  if (pct >= 80) return "B−"
  if (pct >= 77) return "C+"
  if (pct >= 73) return "C"
  if (pct >= 70) return "C−"
  if (pct >= 67) return "D+"
  if (pct >= 63) return "D"
  if (pct >= 60) return "D−"
  return "F"
}

function letterToGpa(letter: string): number {
  const map: Record<string, number> = {
    A: 4.0,
    "A−": 3.7,
    "B+": 3.3,
    B: 3.0,
    "B−": 2.7,
    "C+": 2.3,
    C: 2.0,
    "C−": 1.7,
    "D+": 1.3,
    D: 1.0,
    "D−": 0.7,
    F: 0.0,
  }
  return map[letter] ?? 0.0
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
      return "text-red-400"
    case "stable":
      return "text-muted-foreground"
  }
}

const COURSE_PILL_COLORS = [
  "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "bg-purple-500/15 text-purple-400 border-purple-500/20",
  "bg-green-500/15 text-green-400 border-green-500/20",
  "bg-orange-500/15 text-orange-400 border-orange-500/20",
  "bg-pink-500/15 text-pink-400 border-pink-500/20",
]

export function GradeOverview({ courses, grades }: GradeOverviewProps) {
  if (grades.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="no-grades">
        No grades yet
      </p>
    )
  }

  const courseData = courses
    .map((course, i) => {
      const pct = computeCourseGradePercentage(grades, course.id)
      if (pct === 0) return null
      const trend = computeGradeTrend(grades, course.id)
      const letter = percentageToLetter(pct)
      const pillColor = COURSE_PILL_COLORS[i % COURSE_PILL_COLORS.length]
      return { course, pct, trend, letter, pillColor }
    })
    .filter(Boolean)

  if (courseData.length === 0) return null

  const avgGpa =
    courseData.reduce((sum, d) => sum + letterToGpa(d!.letter), 0) /
    courseData.length

  return (
    <div className="space-y-3" data-testid="grade-cards">
      {/* Letter grade pills */}
      <div className="flex flex-wrap gap-2">
        {courseData.map((d) => (
          <div
            key={d!.course.id}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 ${d!.pillColor}`}
            data-testid={`grade-card-${d!.course.id}`}
          >
            <span className="text-xs font-medium opacity-70">{d!.course.code}</span>
            <span className="text-sm font-bold">{d!.letter}</span>
            <span className={`text-xs font-semibold ${trendColor(d!.trend)}`}>
              {trendArrow(d!.trend)}
            </span>
          </div>
        ))}
      </div>

      {/* GPA projection row */}
      <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
        <span className="text-xs text-muted-foreground">Projected GPA</span>
        <span className="text-sm font-semibold">{avgGpa.toFixed(2)}</span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">
          {courseData.length} course{courseData.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  )
}
