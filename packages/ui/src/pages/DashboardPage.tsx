import { useDashboard } from "@/hooks/useDashboard"
import {
  DashboardLayout,
  DASHBOARD_SECTION_ORDER,
  type DashboardSectionSlot,
} from "@/components/dashboard/DashboardLayout"
import { GradeOverview } from "@/components/dashboard/GradeOverview"
import { GradeChart } from "@/components/dashboard/GradeChart"
import { DeadlineTimeline } from "@/components/dashboard/DeadlineTimeline"
import { AnnouncementsFeed } from "@/components/dashboard/AnnouncementsFeed"
import { StaleBanner } from "@/components/dashboard/StaleBanner"
import { SyncProgressIndicator } from "@/components/dashboard/SyncProgressIndicator"
import { PriorityQueue } from "@/components/dashboard/PriorityQueue"
import { InsightCards } from "@/components/dashboard/InsightCards"
import { QuickActions } from "@/components/dashboard/QuickActions"
import { WeeklyProgress } from "@/components/dashboard/WeeklyProgress"
import { WeeklyCalendar } from "@/components/dashboard/WeeklyCalendar"
import { PlannerStreamOverlay } from "@/components/dashboard/PlannerStreamOverlay"

export function DashboardPage() {
  const {
    courses,
    coursework,
    grades,
    syncProgress,
    lastSync,
    plannerStreaming,
    calendarViewWeek,
  } = useDashboard()

  const now = new Date()
  const isSyncing = syncProgress?.status === "syncing"

  const sections: ReadonlyArray<DashboardSectionSlot> = DASHBOARD_SECTION_ORDER.map(
    (id) => {
      switch (id) {
        case "priorityQueue":
          return {
            id,
            label: "Priority Queue",
            content: <PriorityQueue items={[]} now={now} />,
          }
        case "insights":
          return {
            id,
            label: "Insights",
            content: <InsightCards insights={[]} />,
          }
        case "deadlines":
          return {
            id,
            label: "Upcoming Deadlines",
            content: <DeadlineTimeline items={coursework} now={now} />,
          }
        case "calendar":
          return {
            id,
            label: "Weekly Calendar",
            content: (
              <WeeklyCalendar
                sessions={[]}
                weekStart={calendarViewWeek || now.toISOString().split("T")[0]}
              />
            ),
          }
        case "grades":
          return {
            id,
            label: "Grade Overview",
            content: (
              <>
                <GradeOverview courses={courses} grades={grades} />
                <GradeChart courses={courses} grades={grades} />
              </>
            ),
          }
        case "progress":
          return {
            id,
            label: "Weekly Progress",
            content: (
              <WeeklyProgress
                sessions={[]}
                weekStart={now.toISOString().split("T")[0]}
                lastWeekStart={new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                now={now}
              />
            ),
          }
        case "announcements":
          return {
            id,
            label: "Announcements",
            content: <AnnouncementsFeed announcements={[]} />,
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
