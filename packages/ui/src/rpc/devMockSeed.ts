import { setCourses, setCoursework, setGrades, setLastSync } from "./canvasState"
import { setPlannedSessions } from "./plannerState"
import { setActivityEntries } from "./activityState"
import {
  MOCK_COURSES,
  MOCK_COURSEWORK_ITEMS,
  MOCK_GRADES,
  MOCK_PLANNED_SESSIONS,
  MOCK_CANVAS_ACTIVITY_FEED,
} from "../__mocks__/dashboard-fixtures"

/**
 * Seeds all UI state atoms with realistic mock Canvas data.
 * Only called in DEV mode when no backend bootstrap is available.
 */
export function seedDevMockData(): void {
  setCourses(MOCK_COURSES)
  setCoursework(MOCK_COURSEWORK_ITEMS)
  setGrades(MOCK_GRADES)
  setLastSync(new Date().toISOString())
  setPlannedSessions(MOCK_PLANNED_SESSIONS)
  setActivityEntries(MOCK_CANVAS_ACTIVITY_FEED)
}
