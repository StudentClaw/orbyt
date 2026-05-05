import type {
  CanvasStudentCourseGradeSummary,
  CanvasStudentPeerReviewTodo,
  CanvasStudentTodoItem,
  Course,
  CourseWorkItem,
  PlannedSession,
} from "@orbyt/contracts"
import {
  useCanvasCourseGrades,
  useCanvasCourses,
  useCanvasSyncProgress,
  useCanvasLastSync,
  useCanvasLastSyncError,
  useCanvasSubmissionStatus,
  useCanvasTodoItems,
  useCanvasPeerReviewTodo,
  useCanvasUpcomingAssignments,
  type CanvasLastSyncError,
  type CanvasSyncProgress,
  type CanvasSubmissionStatusBuckets,
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
  readonly upcomingAssignments: ReadonlyArray<CourseWorkItem>
  readonly submissionStatus: CanvasSubmissionStatusBuckets
  readonly courseGrades: ReadonlyArray<CanvasStudentCourseGradeSummary>
  readonly todoItems: ReadonlyArray<CanvasStudentTodoItem>
  readonly peerReviewTodo: ReadonlyArray<CanvasStudentPeerReviewTodo>
  readonly syncProgress: CanvasSyncProgress | null
  readonly lastSync: string | null
  readonly lastSyncError: CanvasLastSyncError | null
  readonly sections: DashboardSectionsMap
  readonly plannedSessions: ReadonlyArray<PlannedSession>
  readonly pendingCheckIns: ReadonlyArray<PendingCheckIn>
  readonly plannerStreaming: PlannerStreamState | null
  readonly calendarViewWeek: string
}

export function useDashboard(): DashboardData {
  return {
    courses: useCanvasCourses(),
    upcomingAssignments: useCanvasUpcomingAssignments(),
    submissionStatus: useCanvasSubmissionStatus(),
    courseGrades: useCanvasCourseGrades(),
    todoItems: useCanvasTodoItems(),
    peerReviewTodo: useCanvasPeerReviewTodo(),
    syncProgress: useCanvasSyncProgress(),
    lastSync: useCanvasLastSync(),
    lastSyncError: useCanvasLastSyncError(),
    sections: useDashboardSections(),
    plannedSessions: usePlannedSessions(),
    pendingCheckIns: usePendingCheckIns(),
    plannerStreaming: usePlannerStreaming(),
    calendarViewWeek: useCalendarViewWeek(),
  }
}
