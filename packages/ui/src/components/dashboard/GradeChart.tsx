import type { CanvasStudentCourseGradeSummary, Course } from "@student-claw/contracts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"

interface GradeChartProps {
  readonly courses: ReadonlyArray<Course>
  readonly grades: ReadonlyArray<CanvasStudentCourseGradeSummary>
}

// Use CSS variable colors from the theme (oklch via Tailwind)
const COURSE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
]

interface ChartDataPoint {
  readonly label: string
  readonly [courseCode: string]: number | string
}

function buildChartData(
  courses: ReadonlyArray<Course>,
  grades: ReadonlyArray<CanvasStudentCourseGradeSummary>,
): ReadonlyArray<ChartDataPoint> {
  const dataPoints: Array<Record<string, number | string>> = [
    { label: "Current" },
    { label: "Final" },
  ]
  const courseMap = new Map<string, Course>(courses.map((course) => [course.id, course]))

  for (const summary of grades) {
    const course = courseMap.get(summary.course.id)
    if (!course) continue

    const current = summary.currentScore ?? summary.finalScore
    const final = summary.finalScore ?? summary.currentScore
    if (current !== undefined) {
      dataPoints[0][course.code] = current
    }
    if (final !== undefined) {
      dataPoints[1][course.code] = final
    }
  }

  return dataPoints as unknown as ReadonlyArray<ChartDataPoint>
}

export function GradeChart({ courses, grades }: GradeChartProps) {
  if (grades.length === 0) return null

  const data = buildChartData(courses, grades)
  const coursesWithGrades = courses.filter((c) =>
    grades.some((g) => g.course.id === c.id),
  )

  const chartConfig: ChartConfig = Object.fromEntries(
    coursesWithGrades.map((course, i) => [
      course.code,
      {
        label: course.code,
        color: COURSE_COLORS[i % COURSE_COLORS.length],
      },
    ]),
  )

  return (
    <div data-testid="grade-chart">
      <ChartContainer config={chartConfig} className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={Array.from(data)}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            {coursesWithGrades.map((course, i) => (
              <Line
                key={course.id}
                type="monotone"
                dataKey={course.code}
                stroke={COURSE_COLORS[i % COURSE_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  )
}
