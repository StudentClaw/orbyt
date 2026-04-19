import { useCallback } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useDashboard } from "@/hooks/useDashboard"
import { useOrchestrationActions, useRuntimeOrchestrationSnapshot } from "@/hooks/useAppRuntime"
import { setCalendarViewWeek } from "@/rpc/plannerState"
import type { InsightAction } from "@/components/dashboard/InsightStrip"
import {
  DashboardLayout,
  DASHBOARD_SECTION_ORDER,
  type DashboardSectionSlot,
} from "@/components/dashboard/DashboardLayout"
import { GradeOverview } from "@/components/dashboard/GradeOverview"
import { GradeChart } from "@/components/dashboard/GradeChart"
import { StaleBanner } from "@/components/dashboard/StaleBanner"
import { SyncProgressIndicator } from "@/components/dashboard/SyncProgressIndicator"
import { PriorityQueue } from "@/components/dashboard/PriorityQueue"
import { InsightStrip } from "@/components/dashboard/InsightStrip"
import { QuickActions } from "@/components/dashboard/QuickActions"
import { WeeklyCalendar } from "@/components/dashboard/WeeklyCalendar"
import { PlannerStreamOverlay } from "@/components/dashboard/PlannerStreamOverlay"
import { type PrioritizedItem } from "@/components/dashboard/priority-model"
import { MOCK_INSIGHTS } from "@/__mocks__/dashboard-fixtures"

function derivePriorityItems(
  courses: ReadonlyArray<{ id: string; code: string }>,
  upcomingAssignments: ReadonlyArray<{
    id: string
    courseId: string
    title: string
    effectiveDueAt?: string
  }>,
  submissionStatus: {
    pending: ReadonlyArray<{
      id: string
      courseId: string
      title: string
      effectiveDueAt?: string
    }>
    overdue: ReadonlyArray<{
      id: string
      courseId: string
      title: string
      effectiveDueAt?: string
    }>
  },
): ReadonlyArray<PrioritizedItem> {
  const coursePriority = new Map(courses.map((course, index) => [course.id, courses.length - index]))
  const courseCode = new Map(courses.map((course) => [course.id, course.code]))
  const buckets = [
    ...submissionStatus.overdue.map((item) => ({ item, impactScore: 1.0 })),
    ...submissionStatus.pending.map((item) => ({ item, impactScore: 0.8 })),
    ...upcomingAssignments.map((item) => ({ item, impactScore: 0.6 })),
  ]
  const seen = new Set<string>()

  return buckets.flatMap(({ item, impactScore }) => {
    if (!item.effectiveDueAt || seen.has(item.id)) return []
    seen.add(item.id)
    return [{
      id: item.id,
      title: item.title,
      courseCode: courseCode.get(item.courseId) ?? "Canvas",
      effectiveDueAt: item.effectiveDueAt,
      estimatedMinutes: 60,
      impactScore,
      coursePriority: coursePriority.get(item.courseId) ?? 1,
    }]
  })
}

export function DashboardPage() {
  const navigate = useNavigate()
  const snapshot = useRuntimeOrchestrationSnapshot()
  const actions = useOrchestrationActions()

  const handleInsightAction = useCallback(
    async (action: InsightAction) => {
      const workspace = snapshot?.workspaces[0]
      if (!workspace) return
      const threadId = await actions.createThread(workspace.id, action.label)
      await actions.sendTurn(threadId, action.prompt, [], null, action.skillId ?? null)
      await navigate({
        to: "/chat/$workspaceId/$threadId",
        params: { workspaceId: workspace.id, threadId },
      })
    },
    [actions, navigate, snapshot],
  )

  const {
    courses,
    courseGrades,
    upcomingAssignments,
    submissionStatus,
    syncProgress,
    lastSync,
    plannerStreaming,
    calendarViewWeek,
    plannedSessions,
  } = useDashboard()

  const now = new Date()
  const isSyncing = syncProgress?.status === "syncing"
  const priorityItems = derivePriorityItems(courses, upcomingAssignments, submissionStatus)
  // Use local date (not UTC) so sessions on today always fall in the current week
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  const weekStart = calendarViewWeek || todayLocal

  const sections: ReadonlyArray<DashboardSectionSlot> = DASHBOARD_SECTION_ORDER.map(
    (id) => {
      switch (id) {
        case "priorityQueue":
          return {
            id,
            label: "Assignments",
            content: <PriorityQueue items={priorityItems} now={now} />,
          }
        case "insights":
          return {
            id,
            label: "Insights",
            content: <InsightStrip insights={MOCK_INSIGHTS} onAction={handleInsightAction} />,
          }
        case "calendar":
          return {
            id,
            label: "Calendar",
            content: (
              <WeeklyCalendar
                sessions={plannedSessions.map((s) => ({
                  ...s,
                  title: s.assignmentTitle ?? "Study session",
                }))}
                weekStart={weekStart}
                deadlines={priorityItems}
                onWeekChange={setCalendarViewWeek}
              />
            ),
          }
        case "grades":
          return {
            id,
            label: "Grades",
            content: (
              <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-card/60 shadow-sm backdrop-blur-xl">
                <div className="px-5 py-4">
                  <h2 className="text-base font-semibold">Grades</h2>
                </div>
                <div className="flex flex-col gap-4 px-5 pb-5">
                  <GradeChart courses={courses} grades={courseGrades} />
                  <GradeOverview courses={courses} grades={courseGrades} />
                </div>
              </div>
            ),
          }
        case "quickActions":
          return {
            id,
            label: "Quick Actions",
            content: <QuickActions />,
          }
        default:
          return { id, label: id, content: null }
      }
    },
  )

  return (
    <div className="space-y-4">
      <StaleBanner lastSyncAt={lastSync} syncInProgress={isSyncing} />
      <SyncProgressIndicator syncProgress={syncProgress} />
      <PlannerStreamOverlay streamState={plannerStreaming} />
      <DashboardLayout sections={sections} />
    </div>
  )
}
