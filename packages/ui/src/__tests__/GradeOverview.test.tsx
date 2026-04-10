import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import { GradeOverview } from "../components/dashboard/GradeOverview"
import type { Course, Grade } from "@student-claw/contracts"

function makeCourse(id: string, code: string, name: string): Course {
  return { id: id as any, name, code }
}

function makeGrade(
  courseId: string,
  assignmentId: string,
  score: number,
  maxScore: number,
  postedAt?: string,
): Grade {
  return { courseId: courseId as any, assignmentId, score, maxScore, postedAt }
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

describe("GradeOverview", () => {
  const courses = [
    makeCourse("c1", "CS 101", "Intro to CS"),
    makeCourse("c2", "MATH 240", "Linear Algebra"),
  ]

  test("renders a card for each course with grades", () => {
    const grades = [
      makeGrade("c1", "a1", 90, 100),
      makeGrade("c2", "a1", 80, 100),
    ]

    render(<GradeOverview courses={courses} grades={grades} />)

    expect(screen.getByTestId("grade-card-c1")).toBeDefined()
    expect(screen.getByTestId("grade-card-c2")).toBeDefined()
    expect(screen.getByText("CS 101")).toBeDefined()
    expect(screen.getByText("MATH 240")).toBeDefined()
  })

  test("shows grade percentage", () => {
    const grades = [makeGrade("c1", "a1", 90, 100)]

    render(<GradeOverview courses={courses} grades={grades} />)

    expect(screen.getByText("90.0%")).toBeDefined()
  })

  test("shows trend arrow for improving grades", () => {
    const grades = [
      makeGrade("c1", "a1", 70, 100, daysAgo(14)),
      makeGrade("c1", "a2", 90, 100, daysAgo(7)),
    ]

    render(<GradeOverview courses={courses} grades={grades} />)

    expect(screen.getByText("Improving")).toBeDefined()
  })

  test("shows 'No grades yet' when empty", () => {
    render(<GradeOverview courses={courses} grades={[]} />)

    expect(screen.getByTestId("no-grades")).toBeDefined()
    expect(screen.getByText("No grades yet")).toBeDefined()
  })

  test("does not render a card for courses with no grades", () => {
    const grades = [makeGrade("c1", "a1", 90, 100)]

    render(<GradeOverview courses={courses} grades={grades} />)

    expect(screen.getByTestId("grade-card-c1")).toBeDefined()
    expect(screen.queryByTestId("grade-card-c2")).toBeNull()
  })
})
