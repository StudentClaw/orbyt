import { useDashboard } from "@/hooks/useDashboard"
import { setCalendarViewWeek } from "@/rpc/plannerState"
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
import { MOCK_PRIORITY_ITEMS, MOCK_INSIGHTS } from "@/__mocks__/dashboard-fixtures"

export function DashboardPage() {
  const {
    courses,
    grades,
    syncProgress,
    lastSync,
    plannerStreaming,
    calendarViewWeek,
    plannedSessions,
  } = useDashboard()

  const now = new Date()
  const isSyncing = syncProgress?.status === "syncing"
  // Use local date (not UTC) so sessions on today always fall in the current week
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  const weekStart = calendarViewWeek || todayLocal

  const sections: ReadonlyArray<DashboardSectionSlot> = DASHBOARD_SECTION_ORDER.map(
    (id) => {
      switch (id) {
        case "priorityQueue":
          return {
            id,
            label: "Coursework",
            content: <PriorityQueue items={MOCK_PRIORITY_ITEMS} now={now} />,
          }
        case "insights":
          return {
            id,
            label: "Insights",
            content: <InsightStrip insights={MOCK_INSIGHTS} />,
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
                deadlines={MOCK_PRIORITY_ITEMS}
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
                  <GradeChart courses={courses} grades={grades} />
                  <GradeOverview courses={courses} grades={grades} />
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
