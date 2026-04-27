import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { WalkthroughOverlay } from "@/components/onboarding/WalkthroughOverlay"
import { DASHBOARD_WALKTHROUGH_STEPS } from "@/components/onboarding/walkthrough-steps"
import { useCardWeights } from "@/rpc/onboardingState"
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
import { seedAssignmentPreview } from "@/rpc/assignmentDetailState"

const TOAST_ID_STALE = "dashboard-canvas-stale"
const TOAST_ID_SYNC = "dashboard-canvas-sync"
const TOAST_ID_PLANNER = "dashboard-planner-stream"
const SUBMITTED_PAGE_SIZE = 12

function derivePriorityItems(
  courses: ReadonlyArray<{ id: string; code: string; name: string; color?: string }>,
  upcomingAssignments: ReadonlyArray<{
    id: string
    courseId: string
    title: string
    effectiveDueAt?: string
    sourceId: string
    htmlUrl?: string
    pointsPossible?: number
    submissionStatus?: string
    grade?: string
  }>,
  submissionStatus: {
    pending: ReadonlyArray<{
      id: string
      courseId: string
      title: string
      effectiveDueAt?: string
      sourceId: string
      htmlUrl?: string
      pointsPossible?: number
      submissionStatus?: string
      grade?: string
    }>
    overdue: ReadonlyArray<{
      id: string
      courseId: string
      title: string
      effectiveDueAt?: string
      sourceId: string
      htmlUrl?: string
      pointsPossible?: number
      submissionStatus?: string
      grade?: string
    }>
  },
): ReadonlyArray<PrioritizedItem> {
  const coursePriority = new Map(courses.map((course, index) => [course.id, courses.length - index]))
  const courseCode = new Map(courses.map((course) => [course.id, course.code]))
  const courseName = new Map(courses.map((course) => [course.id, course.name]))
  const courseColor = new Map(courses.map((course) => [course.id, course.color]))
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
      courseName: courseName.get(item.courseId),
      courseColor: courseColor.get(item.courseId),
      effectiveDueAt: item.effectiveDueAt,
      estimatedMinutes: 60,
      impactScore,
      coursePriority: coursePriority.get(item.courseId) ?? 1,
      pointsPossible: item.pointsPossible,
      submissionStatus: item.submissionStatus,
      grade: item.grade,
      htmlUrl: item.htmlUrl,
      sourceId: item.sourceId,
    }]
  })
}

function deriveSubmittedItems(
  courses: ReadonlyArray<{ id: string; code: string; name: string; color?: string }>,
  submittedAssignments: ReadonlyArray<{
    id: string
    courseId: string
    title: string
    effectiveDueAt?: string
    sourceId: string
    htmlUrl?: string
    pointsPossible?: number
    submissionStatus?: string
    grade?: string
  }>,
): ReadonlyArray<PrioritizedItem> {
  const coursePriority = new Map(courses.map((course, index) => [course.id, courses.length - index]))
  const courseCode = new Map(courses.map((course) => [course.id, course.code]))
  const courseName = new Map(courses.map((course) => [course.id, course.name]))
  const courseColor = new Map(courses.map((course) => [course.id, course.color]))

  return submittedAssignments
    .flatMap((item) => {
      if (!item.effectiveDueAt) return []
      return [{
        id: item.id,
        title: item.title,
        courseId: item.courseId,
        courseCode: courseCode.get(item.courseId) ?? "Canvas",
        courseName: courseName.get(item.courseId),
        courseColor: courseColor.get(item.courseId),
        effectiveDueAt: item.effectiveDueAt,
        estimatedMinutes: 60,
        impactScore: 0.2,
        coursePriority: coursePriority.get(item.courseId) ?? 1,
        pointsPossible: item.pointsPossible,
        submissionStatus: item.submissionStatus,
        grade: item.grade,
        htmlUrl: item.htmlUrl,
        sourceId: item.sourceId,
      }]
    })
    .toSorted((a, b) => new Date(b.effectiveDueAt).getTime() - new Date(a.effectiveDueAt).getTime())
}

export function DashboardPage() {
  const navigate = useNavigate()
  const snapshot = useRuntimeOrchestrationSnapshot()
  const actions = useOrchestrationActions()
  const [filter, setFilter] = useState<FilterScope>("thisWeek")
  const [submittedPage, setSubmittedPage] = useState(0)
  const cardWeights = useCardWeights()
  const weightOf = useCallback((id: string): number => {
    const found = cardWeights.find((w) => w.cardId === id)
    return found?.weight ?? 0.5
  }, [cardWeights])

  const [tourActive, setTourActive] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    try {
      if (sessionStorage.getItem("orbyt:pending-tour") === "1") return true
    } catch { /* ignore */ }
    return new URLSearchParams(window.location.search).get("tour") === "1"
  })
  const [tourStep, setTourStep] = useState(0)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!tourActive) return
    try { sessionStorage.removeItem("orbyt:pending-tour") } catch { /* ignore */ }
    const url = new URL(window.location.href)
    if (url.searchParams.get("tour")) {
      url.searchParams.delete("tour")
      window.history.replaceState(null, "", url.pathname + (url.search ? `?${url.searchParams}` : ""))
    }
  }, [tourActive])

  const tourSteps = DASHBOARD_WALKTHROUGH_STEPS

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

  const handlePlanWeek = useCallback(() => {
    // No-op until backend wires a real "plan my week" insight action.
  }, [])

  const handleAssignmentSelect = useCallback(
    async (item: PrioritizedItem) => {
      seedAssignmentPreview({
        assignmentId: item.id,
        title: item.title,
        courseId: item.courseId,
        courseCode: item.courseCode,
        courseName: item.courseName,
        effectiveDueAt: item.effectiveDueAt,
        pointsPossible: item.pointsPossible,
        submissionStatus: item.submissionStatus,
        grade: item.grade,
        courseColor: item.courseColor,
        htmlUrl: item.htmlUrl,
        sourceId: item.sourceId,
      })

      await navigate({
        to: "/assignments/$assignmentId",
        params: { assignmentId: item.id },
      })
    },
    [navigate],
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
  const submittedItems = useMemo(
    () => deriveSubmittedItems(courses, submissionStatus.submitted),
    [courses, submissionStatus],
  )
  const submittedPageCount = Math.max(1, Math.ceil(submittedItems.length / SUBMITTED_PAGE_SIZE))
  const currentSubmittedPage = Math.min(submittedPage, submittedPageCount - 1)
  const pagedSubmittedItems = useMemo(() => {
    const start = currentSubmittedPage * SUBMITTED_PAGE_SIZE
    return submittedItems.slice(start, start + SUBMITTED_PAGE_SIZE)
  }, [currentSubmittedPage, submittedItems])
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  const weekStart = calendarViewWeek || todayLocal

  useEffect(() => {
    setSubmittedPage(0)
  }, [filter])

  useEffect(() => {
    if (submittedPage > submittedPageCount - 1) {
      setSubmittedPage(Math.max(submittedPageCount - 1, 0))
    }
  }, [submittedPage, submittedPageCount])

  const grouped = useMemo(
    () =>
      filter === "submitted"
        ? groupAssignmentsByCourse(courses, pagedSubmittedItems, filter, now)
        : groupAssignmentsByCourse(courses, priorityItems, filter, now),
    [courses, pagedSubmittedItems, priorityItems, filter, now],
  )

  const { dateLabel, dueThisWeek } = useMemo(() => {
    const datePart = now.toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric",
    })
    return { dateLabel: datePart, dueThisWeek: countDueThisWeek(priorityItems, now) }
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
    <>
    <DashboardShell
      left={
        <div className="min-w-0">
          <DashboardHeader
            title="Dashboard"
            dateLabel={dateLabel}
            dueThisWeek={dueThisWeek}
            onPlanWeek={handlePlanWeek}
            planDisabled={!workspace}
          />
          <DashboardFilterTabs value={filter} onChange={setFilter} />
          <div className="mt-10" data-testid="dashboard-assignments">
            {grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="dashboard-no-matches">
                No assignments match this filter.
              </p>
            ) : (
              <>
                {grouped.map(({ course, items }) => (
                  <SubjectBlock
                    key={course.id}
                    course={course}
                    items={items}
                    now={now}
                    onAssignmentSelect={handleAssignmentSelect}
                  />
                ))}
                {filter === "submitted" && submittedItems.length > SUBMITTED_PAGE_SIZE ? (
                  <div
                    className="mt-8 flex items-center justify-between gap-3 border-t border-border/50 pt-4"
                    data-testid="submitted-pagination"
                  >
                    <p className="text-sm text-muted-foreground">
                      Page {currentSubmittedPage + 1} of {submittedPageCount}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        data-testid="submitted-page-prev"
                        disabled={currentSubmittedPage === 0}
                        onClick={() => setSubmittedPage((page) => Math.max(page - 1, 0))}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        data-testid="submitted-page-next"
                        disabled={currentSubmittedPage >= submittedPageCount - 1}
                        onClick={() => setSubmittedPage((page) => Math.min(page + 1, submittedPageCount - 1))}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      }
      right={(() => {
        const widgets: Array<{ id: string; weight: number; node: React.ReactNode }> = [
          {
            id: "grade-insights",
            weight: weightOf("grade-insights"),
            node: <GradeInsightsWidget key="grade-insights" courses={courses} grades={courseGrades} />,
          },
          {
            id: "weekly-outlook",
            weight: weightOf("weekly-outlook"),
            node: (
              <WeeklyOutlookWidget
                key="weekly-outlook"
                weekStart={weekStart}
                sessions={calendarSessions}
                deadlines={priorityItems}
                now={now}
              />
            ),
          },
          {
            id: "ai-insight",
            weight: weightOf("ai-insight"),
            node: <AiInsightCard key="ai-insight" insight={undefined} onAction={handleInsightAction} />,
          },
        ]
        widgets.sort((a, b) => b.weight - a.weight)
        return <>{widgets.map((w) => w.node)}</>
      })()}
    />
    {tourActive && (
      <WalkthroughOverlay
        steps={tourSteps}
        currentStep={tourStep}
        onNext={() => {
          if (tourStep >= tourSteps.length - 1) setTourActive(false)
          else setTourStep((s) => s + 1)
        }}
        onDismiss={() => setTourActive(false)}
      />
    )}
    </>
  )
}
