import type { CanvasStudentCourseGradeSummary, Course } from "@orbyt/contracts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { computeCourseGradePercentage, computeGradeTrend, type GradeTrend } from "./dashboard-model"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts"

interface GradeInsightsWidgetProps {
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

function aggregateGrowthLabel(
  courses: ReadonlyArray<Course>,
  grades: ReadonlyArray<CanvasStudentCourseGradeSummary>,
): string {
  let up = 0
  let down = 0
  let stable = 0
  for (const c of courses) {
    const pct = computeCourseGradePercentage(grades, c.id)
    if (pct === 0) continue
    const t: GradeTrend = computeGradeTrend(grades, c.id)
    if (t === "up") up += 1
    else if (t === "down") down += 1
    else stable += 1
  }
  const total = up + down + stable
  if (total === 0) return "—"
  if (down >= 2 && down > up) return "Mixed — focus weak courses"
  if (up > down) return `Improving · ${up} up`
  if (down > up) return `Declining · ${down} down`
  return "Steady"
}

const BAR_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
] as const

function gpaToneClass(gpa: number): string {
  if (gpa >= 3.7) return "text-success"
  if (gpa >= 3.0) return "text-foreground"
  if (gpa >= 2.0) return "text-warning"
  return "text-destructive"
}

function growthMeta(growth: string): { readonly tone: string; readonly arrow: string } {
  if (growth.startsWith("Improving")) return { tone: "text-success", arrow: "↑" }
  if (growth.startsWith("Declining")) return { tone: "text-destructive", arrow: "↓" }
  if (growth.startsWith("Mixed")) return { tone: "text-warning", arrow: "→" }
  if (growth === "Steady") return { tone: "text-info", arrow: "→" }
  return { tone: "text-muted-foreground", arrow: "·" }
}

export function GradeInsightsWidget({ courses, grades }: GradeInsightsWidgetProps) {
  if (grades.length === 0) {
    return (
      <div className="dashboard-side-widget pagelet p-5" data-testid="grade-insights-widget">
        <p className="text-sm text-muted-foreground" data-testid="no-grades">
          No grades yet
        </p>
      </div>
    )
  }

  const rows = courses
    .map((course, i) => {
      const pct = computeCourseGradePercentage(grades, course.id)
      if (pct === 0) return null
      return {
        code: course.code,
        pct,
        fill: BAR_COLORS[i % BAR_COLORS.length],
      }
    })
    .filter(Boolean) as Array<{ code: string; pct: number; fill: string }>

  if (rows.length === 0) {
    return (
      <div className="dashboard-side-widget pagelet p-5" data-testid="grade-insights-widget">
        <p className="text-sm text-muted-foreground" data-testid="no-grades">
          No grades yet
        </p>
      </div>
    )
  }

  const courseData = courses
    .map((course) => {
      const pct = computeCourseGradePercentage(grades, course.id)
      if (pct === 0) return null
      const letter = percentageToLetter(pct)
      const gradeSummary = grades.find((g) => g.course.id === course.id)
      const units = gradeSummary?.units ?? null
      return { course, pct, letter, units }
    })
    .filter(Boolean) as Array<{ course: Course; pct: number; letter: string; units: number | null }>

  const totalWeightedPoints = courseData.reduce((sum, d) => sum + letterToGpa(d.letter) * (d.units ?? 1), 0)
  const totalUnits = courseData.reduce((sum, d) => sum + (d.units ?? 1), 0)
  const avgGpa = totalUnits > 0 ? totalWeightedPoints / totalUnits : 0

  const chartConfig: ChartConfig = Object.fromEntries(
    rows.map((r) => [r.code, { label: r.code, color: r.fill }]),
  )

  const growth = aggregateGrowthLabel(courses, grades)
  const growthTone = growthMeta(growth)
  const gpaTone = gpaToneClass(avgGpa)

  return (
    <div className="dashboard-side-widget pagelet p-5" data-testid="grade-insights-widget">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">Grade Insights</h2>
        <a
          href="/settings"
          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          data-testid="grade-insights-view-all"
        >
          View all
        </a>
      </div>

      <ChartContainer config={chartConfig} className="mb-5 !aspect-auto h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
            <XAxis dataKey="code" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} width={28} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={36}>
              {rows.map((entry) => (
                <Cell key={entry.code} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>

      <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-4">
        <div data-testid="grade-metric-gpa">
          <p className="text-xs text-muted-foreground">Current GPA</p>
          <p
            className={`text-lg font-semibold tabular-nums ${gpaTone}`}
            data-testid="grade-gpa-value"
          >
            {avgGpa.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">
            {courseData.length} course{courseData.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div data-testid="grade-metric-growth">
          <p className="text-xs text-muted-foreground">Growth</p>
          <p
            className={`flex items-center gap-1.5 text-sm font-medium leading-snug ${growthTone.tone}`}
            data-testid="grade-growth-value"
          >
            <span aria-hidden className="text-base leading-none">
              {growthTone.arrow}
            </span>
            <span>{growth}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
