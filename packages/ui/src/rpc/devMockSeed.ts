import { setCourses, setCourseGrades, setLastSync, setSubmissionStatus, setUpcomingAssignments } from "./canvasState"
import { setPlannedSessions } from "./plannerState"
import { setActivityEntries } from "./activityState"
import {
  MOCK_COURSES,
  MOCK_COURSEWORK_ITEMS,
  MOCK_GRADES,
  MOCK_PLANNED_SESSIONS,
  MOCK_CANVAS_ACTIVITY_FEED,
} from "../__mocks__/dashboard-fixtures"
import type { CanvasStudentCourseGradeSummary } from "@orbyt/contracts"

function buildMockCourseGradeSummaries(): ReadonlyArray<CanvasStudentCourseGradeSummary> {
  return MOCK_COURSES.map((course) => {
    const courseGrades = MOCK_GRADES.filter((grade) => grade.courseId === course.id)
    const totalScore = courseGrades.reduce((sum, grade) => sum + grade.score, 0)
    const totalMax = courseGrades.reduce((sum, grade) => sum + grade.maxScore, 0)
    const currentScore = totalMax > 0 ? (totalScore / totalMax) * 100 : undefined
    return {
      course,
      currentScore,
      currentGrade: undefined,
      finalScore: undefined,
      finalGrade: undefined,
    }
  }).filter((summary) => summary.currentScore !== undefined)
}

/**
 * Seeds all UI state atoms with realistic mock Canvas data.
 * Only called in DEV mode when no backend bootstrap is available.
 */
export function seedDevMockData(): void {
  setCourses(MOCK_COURSES)
  setUpcomingAssignments(MOCK_COURSEWORK_ITEMS)
  setSubmissionStatus({
    submitted: [],
    pending: MOCK_COURSEWORK_ITEMS,
    overdue: [],
  })
  setCourseGrades(buildMockCourseGradeSummaries())
  setLastSync(new Date().toISOString())
  setPlannedSessions(MOCK_PLANNED_SESSIONS)
  setActivityEntries(MOCK_CANVAS_ACTIVITY_FEED)
}
