import * as React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { IpcChannel, type PluginAuthStatus } from "@orbyt/contracts"
import { useCardWeights } from "@/rpc/onboardingState"
import { toast } from "sonner"
import { useDashboard } from "@/hooks/useDashboard"
import { useOrchestrationActions, useRuntimeOrchestrationSnapshot } from "@/hooks/useAppRuntime"
import { waitForPrimaryWsRpcClient } from "@/rpc/appRuntime"
import {
  captureAssignmentSnapshot,
  computeStaleness,
  removeArchivedAssignmentFromCanvasState,
  restoreAssignmentSnapshot,
} from "@/rpc/canvasState"
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
  filterItemsByScope,
  groupAssignmentsByCourse,
  type FilterScope,
} from "@/components/dashboard/subject-grouping"
import { getPlanFilterCopy } from "@/components/dashboard/plan-filter-copy"
import { removeAssignmentDetailEntry, seedAssignmentPreview } from "@/rpc/assignmentDetailState"

const TOAST_ID_STALE = "dashboard-canvas-stale"
const TOAST_ID_SYNC = "dashboard-canvas-sync"
const TOAST_ID_PLANNER = "dashboard-planner-stream"
const TOAST_ID_NOT_CONFIGURED = "dashboard-canvas-not-configured"
const CANVAS_PLUGIN_ID = "canvas-mcp"
const SUBMITTED_PAGE_SIZE = 12
const SCHEDULING_SESSION_SKILL_ID = "scheduling-session"

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

type SyncStatus = "syncing" | "done" | "error" | null

const SYNC_STAGE_CAPS = [14, 64, 94, 99, 100] as const
const SYNC_TWEEN_STEP = 1
const SYNC_DONE_STEP = 4
const SYNC_MIN_HOLD_MS = 400
const SYNC_TICK_MS = 40

function useSmoothedSyncPercent(realProgress: number, status: SyncStatus): number {
  const [displayed, setDisplayed] = useState(() => (status === "done" ? 100 : 0))
  const stageRef = useRef(0)
  const holdStartedRef = useRef<number | null>(null)
  const realRef = useRef(realProgress)
  const statusRef = useRef<SyncStatus>(status)
  const prevStatusRef = useRef<SyncStatus>(status)

  realRef.current = realProgress
  statusRef.current = status

  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status
    if (status === "syncing" && prev !== "syncing") {
      stageRef.current = 0
      holdStartedRef.current = null
      setDisplayed(0)
    }
  }, [status])

  useEffect(() => {
    const id = window.setInterval(() => {
      const currentStatus = statusRef.current
      if (currentStatus !== "syncing" && currentStatus !== "done") return
      const real = realRef.current

      setDisplayed((prev) => {
        if (currentStatus === "done") {
          return prev >= 100 ? 100 : Math.min(prev + SYNC_DONE_STEP, 100)
        }

        const stage = stageRef.current
        const cap = SYNC_STAGE_CAPS[stage]
        const target = Math.min(real, cap)

        if (prev < target) {
          holdStartedRef.current = null
          return Math.min(prev + SYNC_TWEEN_STEP, target)
        }

        if (prev >= cap && real > cap && stage < SYNC_STAGE_CAPS.length - 1) {
          const now = Date.now()
          if (holdStartedRef.current === null) {
            holdStartedRef.current = now
          } else if (now - holdStartedRef.current >= SYNC_MIN_HOLD_MS) {
            stageRef.current = stage + 1
            holdStartedRef.current = null
          }
        }
        return prev
      })
    }, SYNC_TICK_MS)

    return () => window.clearInterval(id)
  }, [])

  return displayed
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

export function DashboardPage() {
  const navigate = useNavigate()
  const snapshot = useRuntimeOrchestrationSnapshot()
  const actions = useOrchestrationActions()
  const hasShownActiveSyncToast = useRef(false)
  const [filter, setFilter] = useState<FilterScope>("thisWeek")
  const [submittedPage, setSubmittedPage] = useState(0)
  const [archivingAssignmentIds, setArchivingAssignmentIds] = useState<ReadonlySet<string>>(() => new Set())
  const cardWeights = useCardWeights()
  const weightOf = useCallback((id: string): number => {
    const found = cardWeights.find((w) => w.cardId === id)
    return found?.weight ?? 0.5
  }, [cardWeights])

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

    const snapshot = captureAssignmentSnapshot(item.id)

    setArchivingAssignmentIds((current) => new Set(current).add(item.id))
    try {
      const client = await waitForPrimaryWsRpcClient()
      await client.canvas.archiveAssignment(item.id)
      removeArchivedAssignmentFromCanvasState(item.id)
      removeAssignmentDetailEntry(item.id)
      toast.success(`Archived "${item.title}"`, {
        action: {
          label: "Undo",
          onClick: () => {
            void (async () => {
              try {
                const undoClient = await waitForPrimaryWsRpcClient()
                await undoClient.canvas.unarchiveAssignment(item.id)
                restoreAssignmentSnapshot(snapshot)
                toast.success(`Restored "${item.title}"`)
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to restore assignment.")
              }
            })()
          },
        },
      })
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
    lastSyncError,
    plannerStreaming,
    calendarViewWeek,
    plannedSessions,
  } = useDashboard()

  const [canvasAuthStatus, setCanvasAuthStatus] = useState<PluginAuthStatus["status"] | null>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI?.invoke) return
    let cancelled = false

    const refresh = async (): Promise<void> => {
      try {
        const result = await window.electronAPI!.invoke(IpcChannel.PLUGIN_GET_AUTH_STATUS, {
          pluginId: CANVAS_PLUGIN_ID,
        })
        if (cancelled) return
        setCanvasAuthStatus(result?.status ?? null)
      } catch {
        if (!cancelled) setCanvasAuthStatus(null)
      }
    }

    void refresh()
    const off = window.electronAPI.on?.(IpcChannel.PLUGIN_LIFECYCLE, (payload) => {
      if (payload.pluginId === CANVAS_PLUGIN_ID) void refresh()
    })

    return () => {
      cancelled = true
      off?.()
    }
  }, [])

  const isCanvasNotConfigured = canvasAuthStatus === "not_configured"

  const now = useMemo(() => new Date(), [])
  const isSyncing = syncProgress?.status === "syncing"
  const priorityItems = derivePriorityItems(courses, upcomingAssignments, submissionStatus)
  const submittedItems = useMemo(
    () => deriveSubmittedItems(courses, submissionStatus.submitted),
    [courses, submissionStatus],
  )
  const planFilterCopy = getPlanFilterCopy(filter)
  const planWeekAction = useMemo<InsightAction>(() => {
    const sourceItems = filter === "submitted" ? submittedItems : priorityItems
    const filteredItems = filterItemsByScope(sourceItems, filter, now)
      .toSorted((a, b) => new Date(a.effectiveDueAt).getTime() - new Date(b.effectiveDueAt).getTime())
    const assignmentLines = filteredItems.map((item) => {
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
      label: planFilterCopy.planLabel,
      prompt: [
        planFilterCopy.promptIntro,
        assignmentLines.length > 0
          ? `${planFilterCopy.assignmentsHeading}\n${assignmentLines.join("\n")}`
          : planFilterCopy.emptyAssignments,
        "Read my calendars first, then propose a realistic schedule for this dashboard filter. Ask only decision-critical questions.",
      ].join("\n\n"),
      skillId: SCHEDULING_SESSION_SKILL_ID,
    }
  }, [filter, now, planFilterCopy, priorityItems, submittedItems])
  const handlePlanWeek = useCallback(() => {
    void handleInsightAction(planWeekAction)
  }, [handleInsightAction, planWeekAction])
  const handleFilterChange = useCallback((scope: FilterScope) => {
    setFilter(scope)
    setSubmittedPage(0)
  }, [])
  const handleCanvasRefresh = useCallback(() => {
    if (isCanvasNotConfigured) {
      toast.warning("Canvas isn't connected", {
        description: "Add your Canvas URL and access token to sync your dashboard.",
      })
      return
    }
    void (async () => {
      try {
        const client = await waitForPrimaryWsRpcClient()
        await client.canvas.sync()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to start Canvas sync.")
      }
    })()
  }, [isCanvasNotConfigured])
  const submittedPageCount = Math.max(1, Math.ceil(submittedItems.length / SUBMITTED_PAGE_SIZE))
  const currentSubmittedPage = Math.min(submittedPage, submittedPageCount - 1)
  const pagedSubmittedItems = useMemo(() => {
    const start = currentSubmittedPage * SUBMITTED_PAGE_SIZE
    return submittedItems.slice(start, start + SUBMITTED_PAGE_SIZE)
  }, [currentSubmittedPage, submittedItems])
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  const weekStart = calendarViewWeek || todayLocal

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
    if (isCanvasNotConfigured) {
      toast.dismiss(TOAST_ID_STALE)
      return
    }
    if (isSyncing) {
      toast.dismiss(TOAST_ID_STALE)
      return
    }
    const staleness = computeStaleness(lastSync)
    if (staleness === "fresh") {
      toast.dismiss(TOAST_ID_STALE)
      return
    }
    // If a sync ran more recently than the last success and failed, surface
    // the actual error message instead of the generic "snapshot" copy — the
    // user needs to know *why* sync isn't working (token expired, network,
    // etc.) so they can fix it.
    if (lastSyncError) {
      toast.warning("Canvas sync is failing", {
        id: TOAST_ID_STALE,
        duration: Infinity,
        description: lastSyncError.message,
      })
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
  }, [isSyncing, lastSync, lastSyncError, isCanvasNotConfigured])

  useEffect(() => {
    if (!isCanvasNotConfigured) {
      toast.dismiss(TOAST_ID_NOT_CONFIGURED)
      return
    }
    toast.warning("Canvas isn't connected", {
      id: TOAST_ID_NOT_CONFIGURED,
      duration: Infinity,
      description: "Add your Canvas URL and access token to see deadlines, grades, and todos.",
      action: {
        label: "Connect Canvas",
        onClick: () => {
          void navigate({ to: "/plugins/$pluginId", params: { pluginId: CANVAS_PLUGIN_ID } })
        },
      },
    })
  }, [isCanvasNotConfigured, navigate])

  // Auto-trigger a sync the first time the dashboard sees a configured Canvas
  // with no synced data. Covers the case where the onboarding-triggered sync
  // failed silently (or never ran) and the next cron tick is far away — without
  // this the user just stares at the "Showing your saved Canvas snapshot"
  // warning until the cron fires.
  const initialSyncFiredRef = useRef(false)
  useEffect(() => {
    if (initialSyncFiredRef.current) return
    if (canvasAuthStatus !== "configured") return
    if (lastSync !== null) return
    if (isSyncing) return
    initialSyncFiredRef.current = true
    void (async () => {
      try {
        const client = await waitForPrimaryWsRpcClient()
        await client.canvas.sync()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to start Canvas sync.")
      }
    })()
  }, [canvasAuthStatus, lastSync, isSyncing])

  const displayedSyncPercent = useSmoothedSyncPercent(
    syncProgress?.progress ?? 0,
    syncProgress?.status ?? null,
  )

  useEffect(() => {
    if (!syncProgress) {
      toast.dismiss(TOAST_ID_SYNC)
      return
    }

    const isFillingToDone = syncProgress.status === "done" && displayedSyncPercent < 100

    if (syncProgress.status === "syncing" || isFillingToDone) {
      hasShownActiveSyncToast.current = true
      const copy = getCanvasSyncProgressCopy(displayedSyncPercent)
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
  }, [syncProgress, displayedSyncPercent])

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
            planLabel={planFilterCopy.planLabel}
            onPlanWeek={handlePlanWeek}
            planDisabled={!workspace}
          />
          <section aria-label="Coursework filters">
            <DashboardFilterTabs
              value={filter}
              onChange={handleFilterChange}
              onRefresh={handleCanvasRefresh}
              isRefreshing={isSyncing}
              refreshDisabled={isCanvasNotConfigured}
            />
          </section>
          <div className="mt-7" data-testid="dashboard-assignments">
            {grouped.length === 0 ? (
              <p
                className="dashboard-filter-stage rounded-lg border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground"
                data-testid="dashboard-no-matches"
              >
                No assignments match this filter.
              </p>
            ) : (
              <div key={filter} className="dashboard-filter-stage">
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
                        onClick={() => setSubmittedPage(Math.max(currentSubmittedPage - 1, 0))}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        data-testid="submitted-page-next"
                        disabled={currentSubmittedPage >= submittedPageCount - 1}
                        onClick={() => setSubmittedPage(Math.min(currentSubmittedPage + 1, submittedPageCount - 1))}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      }
      right={(() => {
        const gradeInsights = (
          <GradeInsightsWidget key="grade-insights" courses={courses} grades={courseGrades} />
        )
        const remaining: Array<{ id: string; weight: number; node: React.ReactNode }> = [
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
        remaining.sort((a, b) => b.weight - a.weight)
        return <>{gradeInsights}{remaining.map((w) => w.node)}</>
      })()}
    />
    </>
  )
}
