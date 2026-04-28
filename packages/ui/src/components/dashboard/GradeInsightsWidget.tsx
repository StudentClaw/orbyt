import type { CanvasStudentCourseGradeSummary, Course } from "@orbyt/contracts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { computeCourseGradePercentage } from "./dashboard-model"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts"

interface GradeInsightsWidgetProps {
  readonly courses: ReadonlyArray<Course>
  readonly grades: ReadonlyArray<CanvasStudentCourseGradeSummary>
}


function shortenCode(code: string): string {
  const match = /^\d+_(.+)_\d+$/.exec(code)
  return match?.[1] ?? code
}

const BAR_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
] as const

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
      if (!/^\d+_.+_\d+$/.test(course.code)) return null
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

  const chartConfig: ChartConfig = Object.fromEntries(
    rows.map((r) => [r.code, { label: shortenCode(r.code), color: r.fill }]),
  )

  return (
    <div className="dashboard-side-widget pagelet p-5" data-testid="grade-insights-widget">
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight">Grade Insights</h2>
      </div>

      <ChartContainer config={chartConfig} className="mb-5 !aspect-auto h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
            <XAxis
              dataKey="code"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, textAnchor: "end" }}
              tickFormatter={shortenCode}
              angle={-40}
              interval={0}
            />
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
    </div>
  )
}
