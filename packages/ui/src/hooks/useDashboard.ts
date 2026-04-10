import type { Course, CourseWorkItem, Grade, PlannedSession } from "@student-claw/contracts"
import {
  useCanvasCourses,
  useCanvasCoursework,
  useCanvasGrades,
  useCanvasSyncProgress,
  useCanvasLastSync,
  type CanvasSyncProgress,
} from "@/rpc/canvasState"
import {
  useDashboardSections,
  type DashboardSectionsMap,
} from "@/rpc/dashboardState"
import {
  usePlannedSessions,
  usePendingCheckIns,
  usePlannerStreaming,
  useCalendarViewWeek,
  type PlannerStreamState,
  type PendingCheckIn,
} from "@/rpc/plannerState"

export interface DashboardData {
  readonly courses: ReadonlyArray<Course>
  readonly coursework: ReadonlyArray<CourseWorkItem>
  readonly grades: ReadonlyArray<Grade>
  readonly syncProgress: CanvasSyncProgress | null
  readonly lastSync: string | null
  readonly sections: DashboardSectionsMap
  readonly plannedSessions: ReadonlyArray<PlannedSession>
  readonly pendingCheckIns: ReadonlyArray<PendingCheckIn>
  readonly plannerStreaming: PlannerStreamState | null
  readonly calendarViewWeek: string
}

export function useDashboard(): DashboardData {
  return {
    courses: useCanvasCourses(),
    coursework: useCanvasCoursework(),
    grades: useCanvasGrades(),
    syncProgress: useCanvasSyncProgress(),
    lastSync: useCanvasLastSync(),
    sections: useDashboardSections(),
    plannedSessions: usePlannedSessions(),
    pendingCheckIns: usePendingCheckIns(),
    plannerStreaming: usePlannerStreaming(),
    calendarViewWeek: useCalendarViewWeek(),
  }
}
