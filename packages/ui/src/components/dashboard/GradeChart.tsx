import type { Course, Grade } from "@student-claw/contracts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface GradeChartProps {
  readonly courses: ReadonlyArray<Course>
  readonly grades: ReadonlyArray<Grade>
}

const COURSE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
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

  // Sort each course's grades by postedAt
  for (const [courseId, courseGrades] of gradesByCourse) {
    gradesByCourse.set(
      courseId,
      courseGrades
        .filter((g) => g.postedAt)
        .sort((a, b) => new Date(a.postedAt!).getTime() - new Date(b.postedAt!).getTime()),
    )
  }

  // Find the max number of graded items across courses
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
    <Card data-testid="grade-chart">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Grade Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <LineChart data={Array.from(data)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis domain={[0, 100]} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {coursesWithGrades.map((course, i) => (
              <Line
                key={course.id}
                type="monotone"
                dataKey={course.code}
                stroke={COURSE_COLORS[i % COURSE_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
