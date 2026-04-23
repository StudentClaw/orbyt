import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import { GradeInsightsWidget } from "../components/dashboard/GradeInsightsWidget"
import type { CanvasStudentCourseGradeSummary, Course } from "@orbyt/contracts"

function makeCourse(id: string, code: string, name: string): Course {
  return { id: id as Course["id"], name, code }
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

describe("GradeInsightsWidget", () => {
  const courses = [
    makeCourse("c1", "CS 101", "Intro to CS"),
    makeCourse("c2", "MATH 240", "Linear Algebra"),
  ]

  test("shows no grades when empty", () => {
    render(<GradeInsightsWidget courses={courses} grades={[]} />)
    expect(screen.getByTestId("no-grades")).toBeDefined()
    expect(screen.getByText("No grades yet")).toBeDefined()
  })

  test("renders GPA and growth when grades exist", () => {
    const grades = [
      makeGradeSummary(courses[0], 90),
      makeGradeSummary(courses[1], 80, 75),
    ]
    render(<GradeInsightsWidget courses={courses} grades={grades} />)
    expect(screen.getByTestId("grade-insights-widget")).toBeDefined()
    expect(screen.getByTestId("grade-gpa-value")).toBeDefined()
    expect(screen.getByTestId("grade-growth-value")).toBeDefined()
    expect(screen.getByTestId("grade-insights-view-all")).toBeDefined()
  })

  test("shows improving growth when course trends up", () => {
    const grades = [makeGradeSummary(courses[0], 70, 90)]
    render(<GradeInsightsWidget courses={courses} grades={grades} />)
    expect(screen.getByTestId("grade-growth-value").textContent).toContain("Improving")
  })
})
