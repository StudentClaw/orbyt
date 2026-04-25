import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { useDashboard } from "@/hooks/useDashboard"
import { useOrchestrationActions, useRuntimeOrchestrationSnapshot } from "@/hooks/useAppRuntime"
import { waitForPrimaryWsRpcClient } from "@/rpc/appRuntime"
import { computeStaleness, removeArchivedAssignmentFromCanvasState } from "@/rpc/canvasState"
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
import { removeAssignmentDetailEntry, seedAssignmentPreview } from "@/rpc/assignmentDetailState"
import { MOCK_INSIGHTS } from "@/__mocks__/dashboard-fixtures"

const TOAST_ID_STALE = "dashboard-canvas-stale"
const TOAST_ID_SYNC = "dashboard-canvas-sync"
const TOAST_ID_PLANNER = "dashboard-planner-stream"
const SUBMITTED_PAGE_SIZE = 12
const SCHEDULING_SESSION_SKILL_MENTION =
  "[$scheduling-session](/Users/paul/.codex/skills/scheduling-session/SKILL.md)"

function getCanvasSyncProgressCopy(progress: number): { title: string; description: string } {
  const percent = Math.round(progress)

  if (percent < 15) {
    return {
      title: `Opening the Canvas backpack (${percent}%)`,
      description: "Checking the connection before courses, grades, and deadlines come along for the ride.",
    }
  }

  if (percent < 65) {
    return {
      title: `Gathering course intel (${percent}%)`,
      description: "Pulling assignments, due dates, submissions, and grade snapshots into one place.",
    }
  }

  if (percent < 95) {
    return {
      title: `Sorting the homework stack (${percent}%)`,
      description: "Saving the latest Canvas updates so priorities and plans can reshuffle cleanly.",
    }
  }

  return {
    title: `Almost fresh (${percent}%)`,
    description: "Finishing the dashboard refresh with your newest coursework details.",
  }
}

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

function getCurrentWeekBounds(now: Date): { start: Date; end: Date } {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const day = start.getDay()
  const daysSinceMonday = day === 0 ? 6 : day - 1
  start.setDate(start.getDate() - daysSinceMonday)

  const end = new Date(start)
  end.setDate(end.getDate() + 7)

  return { start, end }
}

function isDueInCurrentWeek(item: PrioritizedItem, now: Date): boolean {
  const due = new Date(item.effectiveDueAt)
  if (Number.isNaN(due.getTime())) return false
  const { start, end } = getCurrentWeekBounds(now)
  return due >= start && due < end
}

export function DashboardPage() {
  const navigate = useNavigate()
  const snapshot = useRuntimeOrchestrationSnapshot()
  const actions = useOrchestrationActions()
  const hasShownActiveSyncToast = useRef(false)
  const [filter, setFilter] = useState<FilterScope>("thisWeek")
  const [submittedPage, setSubmittedPage] = useState(0)
  const [archivingAssignmentIds, setArchivingAssignmentIds] = useState<ReadonlySet<string>>(() => new Set())

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

  const handleAssignmentArchive = useCallback(async (item: PrioritizedItem) => {
    if (archivingAssignmentIds.has(item.id)) return

    setArchivingAssignmentIds((current) => new Set(current).add(item.id))
    try {
      const client = await waitForPrimaryWsRpcClient()
      await client.canvas.archiveAssignment(item.id)
      removeArchivedAssignmentFromCanvasState(item.id)
      removeAssignmentDetailEntry(item.id)
      toast.success(`Archived "${item.title}"`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to archive assignment.")
    } finally {
      setArchivingAssignmentIds((current) => {
        const next = new Set(current)
        next.delete(item.id)
        return next
      })
    }
  }, [archivingAssignmentIds])

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
  const planWeekAction = useMemo<InsightAction>(() => {
    const currentWeekItems = priorityItems
      .filter((item) => isDueInCurrentWeek(item, now))
      .toSorted((a, b) => new Date(a.effectiveDueAt).getTime() - new Date(b.effectiveDueAt).getTime())
    const upcomingLines = currentWeekItems.map((item) => {
      const due = item.effectiveDueAt
        ? new Date(item.effectiveDueAt).toLocaleString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : "no due date"
      const points = item.pointsPossible != null ? `, ${item.pointsPossible}pts` : ""
      return `- ${item.courseCode}: ${item.title} (due ${due}${points})`
    })

    return {
      label: "Plan my week",
      prompt: [
        "Plan my week using my current calendar availability and the coursework due this week.",
        upcomingLines.length > 0
          ? `Assignments due this week (Monday-Sunday):\n${upcomingLines.join("\n")}`
          : "No dashboard assignments are due this week (Monday-Sunday).",
        "Read my calendars first, then propose a realistic weekly schedule. Ask only decision-critical questions.",
        SCHEDULING_SESSION_SKILL_MENTION,
      ].join("\n\n"),
    }
  }, [now, priorityItems])
  const handlePlanWeek = useCallback(() => {
    void handleInsightAction(planWeekAction)
  }, [handleInsightAction, planWeekAction])
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
        ? "Canvas might be a little stale"
        : "Showing your saved Canvas snapshot",
      {
        id: TOAST_ID_STALE,
        duration: Infinity,
        description:
          staleness === "stale"
            ? "Last sync was over 24 hours ago. Refresh to catch new grades, deadlines, and course changes."
            : "I could not confirm a fresh sync yet, so deadlines and grades may have changed.",
      },
    )
  }, [isSyncing, lastSync])

  useEffect(() => {
    if (!syncProgress) {
      toast.dismiss(TOAST_ID_SYNC)
      return
    }

    if (syncProgress.status === "syncing") {
      hasShownActiveSyncToast.current = true
      const copy = getCanvasSyncProgressCopy(syncProgress.progress)
      toast.loading(copy.title, {
        id: TOAST_ID_SYNC,
        duration: Infinity,
        description: copy.description,
      })
      return
    }

    if (!hasShownActiveSyncToast.current) {
      toast.dismiss(TOAST_ID_SYNC)
      return
    }

    hasShownActiveSyncToast.current = false
    if (syncProgress.status === "done") {
      toast.success("Canvas is fresh", {
        id: TOAST_ID_SYNC,
        duration: 4000,
        description: "Courses, grades, deadlines, todos, and peer reviews are up to date.",
      })
      return
    }

    toast.error("Canvas sync hit a snag", {
      id: TOAST_ID_SYNC,
      duration: 6000,
      description: "Your saved dashboard is still here. Try again from Connections when you are ready.",
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
                    onAssignmentArchive={handleAssignmentArchive}
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
