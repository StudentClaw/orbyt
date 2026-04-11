import type { Course, Grade } from "@student-claw/contracts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"

interface GradeChartProps {
  readonly courses: ReadonlyArray<Course>
  readonly grades: ReadonlyArray<Grade>
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
  grades: ReadonlyArray<Grade>,
): ReadonlyArray<ChartDataPoint> {
  const gradesByCourse = new Map<string, Grade[]>()
  for (const grade of grades) {
    const existing = gradesByCourse.get(grade.courseId) ?? []
    gradesByCourse.set(grade.courseId, [...existing, grade])
  }

  for (const [courseId, courseGrades] of gradesByCourse) {
    gradesByCourse.set(
      courseId,
      courseGrades
        .filter((g) => g.postedAt)
        .sort(
          (a, b) =>
            new Date(a.postedAt!).getTime() - new Date(b.postedAt!).getTime(),
        ),
    )
  }

  const maxItems = Math.max(
    ...Array.from(gradesByCourse.values()).map((g) => g.length),
    0,
  )

  const courseMap = new Map<string, Course>(courses.map((c) => [c.id, c]))
  const dataPoints: ChartDataPoint[] = []

  for (let i = 0; i < maxItems; i++) {
    const point: Record<string, number | string> = { label: `#${i + 1}` }
    for (const [courseId, courseGrades] of gradesByCourse) {
      const course = courseMap.get(courseId)
      if (!course || i >= courseGrades.length) continue
      const g = courseGrades[i]
      point[course.code] = g.maxScore > 0 ? (g.score / g.maxScore) * 100 : 0
    }
    dataPoints.push(point as ChartDataPoint)
  }

  return dataPoints
}

export function GradeChart({ courses, grades }: GradeChartProps) {
  if (grades.length === 0) return null

  const data = buildChartData(courses, grades)
  const coursesWithGrades = courses.filter((c) =>
    grades.some((g) => g.courseId === c.id),
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
