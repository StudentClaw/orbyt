import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { useDashboard } from "@/hooks/useDashboard"
import { useOrchestrationActions, useRuntimeOrchestrationSnapshot } from "@/hooks/useAppRuntime"
import { computeStaleness } from "@/rpc/canvasState"
import type { InsightAction } from "@/components/dashboard/insight-types"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { DashboardHeader } from "@/components/dashboard/DashboardHeader"
import { DashboardFilterTabs } from "@/components/dashboard/DashboardFilterTabs"
import { SubjectBlock } from "@/components/dashboard/SubjectBlock"
import { GradeInsightsWidget } from "@/components/dashboard/GradeInsightsWidget"
import { WeeklyOutlookWidget } from "@/components/dashboard/WeeklyOutlookWidget"
import { AiInsightCard } from "@/components/dashboard/AiInsightCard"
import { type PrioritizedItem } from "@/components/dashboard/priority-model"
import {
  countDueThisWeek,
  groupAssignmentsByCourse,
  type FilterScope,
} from "@/components/dashboard/subject-grouping"
import { MOCK_INSIGHTS } from "@/__mocks__/dashboard-fixtures"

const TOAST_ID_STALE = "dashboard-canvas-stale"
const TOAST_ID_SYNC = "dashboard-canvas-sync"
const TOAST_ID_PLANNER = "dashboard-planner-stream"

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
      courseId: item.courseId,
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
  const [filter, setFilter] = useState<FilterScope>("thisWeek")

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

  const planWeekAction = MOCK_INSIGHTS[0]?.action

  const handlePlanWeek = useCallback(() => {
    if (planWeekAction) void handleInsightAction(planWeekAction)
  }, [handleInsightAction, planWeekAction])

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
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  const weekStart = calendarViewWeek || todayLocal

  const grouped = useMemo(
    () => groupAssignmentsByCourse(courses, priorityItems, filter, now),
    [courses, priorityItems, filter, now],
  )

  const subtitle = useMemo(() => {
    const datePart = now.toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric",
    })
    const n = countDueThisWeek(priorityItems, now)
    return `${datePart} — ${n} due this week`
  }, [now, priorityItems])

  useEffect(() => {
    if (isSyncing) {
      toast.dismiss(TOAST_ID_STALE)
      return
    }
    const staleness = computeStaleness(lastSync)
    if (staleness === "fresh") {
      toast.dismiss(TOAST_ID_STALE)
      return
    }
    toast.warning(
      staleness === "stale"
        ? "Data may be outdated — last synced more than 24 hours ago"
        : "Offline — showing cached data",
      { id: TOAST_ID_STALE, duration: Infinity },
    )
  }, [isSyncing, lastSync])

  useEffect(() => {
    if (!syncProgress || syncProgress.status !== "syncing") {
      toast.dismiss(TOAST_ID_SYNC)
      return
    }
    toast.loading(`Syncing Canvas… ${Math.round(syncProgress.progress)}%`, {
      id: TOAST_ID_SYNC,
      duration: Infinity,
    })
  }, [syncProgress])

  useEffect(() => {
    if (!plannerStreaming) {
      toast.dismiss(TOAST_ID_PLANNER)
      return
    }
    if (plannerStreaming.stage === "plan.complete") {
      toast.success(plannerStreaming.label, { id: TOAST_ID_PLANNER, duration: 3000 })
      return
    }
    toast.loading(plannerStreaming.label, {
      id: TOAST_ID_PLANNER,
      duration: Infinity,
    })
  }, [plannerStreaming])

  const workspace = snapshot?.workspaces[0]
  const calendarSessions = plannedSessions.map((s) => ({
    id: s.id,
    courseId: s.courseId,
    courseName: s.courseName,
    title: s.assignmentTitle ?? "Study session",
    startTime: s.startTime,
    endTime: s.endTime,
  }))

  return (
    <DashboardShell
      left={
        <div className="min-w-0">
          <DashboardHeader
            title="Dashboard"
            subtitle={subtitle}
            onPlanWeek={handlePlanWeek}
            planDisabled={!workspace || !planWeekAction}
          />
          <DashboardFilterTabs value={filter} onChange={setFilter} />
          <div className="mt-10" data-testid="dashboard-assignments">
            {grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="dashboard-no-matches">
                No assignments match this filter.
              </p>
            ) : (
              grouped.map(({ course, items }) => (
                <SubjectBlock key={course.id} course={course} items={items} now={now} />
              ))
            )}
          </div>
        </div>
      }
      right={
        <>
          <GradeInsightsWidget courses={courses} grades={courseGrades} />
          <WeeklyOutlookWidget
            weekStart={weekStart}
            sessions={calendarSessions}
            deadlines={priorityItems}
            now={now}
          />
          <AiInsightCard insight={MOCK_INSIGHTS[0]} onAction={handleInsightAction} />
        </>
      }
    />
  )
}
