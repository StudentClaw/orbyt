import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import { GradeOverview } from "../components/dashboard/GradeOverview"
import type { CanvasStudentCourseGradeSummary, Course } from "@student-claw/contracts"

function makeCourse(id: string, code: string, name: string): Course {
  return { id: id as any, name, code }
}

function makeGradeSummary(
  course: Course,
  currentScore?: number,
  finalScore?: number,
): CanvasStudentCourseGradeSummary {
  return {
    course,
    currentScore,
    finalScore,
    currentGrade: undefined,
    finalGrade: undefined,
  }
}

describe("GradeOverview", () => {
  const courses = [
    makeCourse("c1", "CS 101", "Intro to CS"),
    makeCourse("c2", "MATH 240", "Linear Algebra"),
  ]

  test("renders a pill for each course with grades", () => {
    const grades = [
      makeGradeSummary(courses[0], 90),
      makeGradeSummary(courses[1], 80),
    ]

    render(<GradeOverview courses={courses} grades={grades} />)

    expect(screen.getByTestId("grade-card-c1")).toBeDefined()
    expect(screen.getByTestId("grade-card-c2")).toBeDefined()
    expect(screen.getByText("CS 101")).toBeDefined()
    expect(screen.getByText("MATH 240")).toBeDefined()
  })

  test("shows letter grade for course (90% → A−)", () => {
    const grades = [makeGradeSummary(courses[0], 90)]

    render(<GradeOverview courses={courses} grades={grades} />)

    // 90% maps to A− in the letter grade scale
    expect(screen.getByText("A−")).toBeDefined()
  })

  test("shows up trend arrow for improving grades", () => {
    const grades = [
      makeGradeSummary(courses[0], 70, 90),
    ]

    render(<GradeOverview courses={courses} grades={grades} />)

    // Trend arrow for improving grades is "↑"
    expect(screen.getByText("↑")).toBeDefined()
  })

  test("shows 'No grades yet' when empty", () => {
    render(<GradeOverview courses={courses} grades={[]} />)

    expect(screen.getByTestId("no-grades")).toBeDefined()
    expect(screen.getByText("No grades yet")).toBeDefined()
  })

  test("does not render a pill for courses with no grades", () => {
    const grades = [makeGradeSummary(courses[0], 90)]

    render(<GradeOverview courses={courses} grades={grades} />)

    expect(screen.getByTestId("grade-card-c1")).toBeDefined()
    expect(screen.queryByTestId("grade-card-c2")).toBeNull()
  })

  test("shows GPA projection row", () => {
    const grades = [makeGradeSummary(courses[0], 90)]

    render(<GradeOverview courses={courses} grades={grades} />)

    expect(screen.getByText("Projected GPA")).toBeDefined()
  })
})
