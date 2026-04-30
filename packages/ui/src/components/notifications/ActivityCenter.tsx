import {
  useActivityEntries,
  useActivityFilter,
  useActivityUnreadCount,
  setActivityFilter,
  filterActivityEntries,
  type ActivityFilterCategory,
  type ActivityFeedEntryWithMeta,
} from "@/rpc/activityState"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ActivityFeedItem } from "./ActivityFeedItem"

const FILTER_TABS: ReadonlyArray<{ id: ActivityFilterCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "canvas", label: "Canvas" },
  { id: "planner", label: "Planner" },
  { id: "workflow", label: "Agent" },
  { id: "insight", label: "Insights" },
]

interface DateGroup {
  readonly label: string
  readonly entries: ReadonlyArray<ActivityFeedEntryWithMeta>
}

function groupEntriesByDate(entries: ReadonlyArray<ActivityFeedEntryWithMeta>): ReadonlyArray<DateGroup> {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)

  const today: ActivityFeedEntryWithMeta[] = []
  const yesterday: ActivityFeedEntryWithMeta[] = []
  const earlier: ActivityFeedEntryWithMeta[] = []

  for (const entry of entries) {
    const d = new Date(entry.receivedAt)
    if (d >= todayStart) {
      today.push(entry)
    } else if (d >= yesterdayStart) {
      yesterday.push(entry)
    } else {
      earlier.push(entry)
    }
  }

  const groups: DateGroup[] = []
  if (today.length > 0) groups.push({ label: "Today", entries: today })
  if (yesterday.length > 0) groups.push({ label: "Yesterday", entries: yesterday })
  if (earlier.length > 0) groups.push({ label: "Earlier", entries: earlier })
  return groups
}

function BellIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

export function ActivityCenter() {
  const entries = useActivityEntries()
  const filter = useActivityFilter()
  const unreadCount = useActivityUnreadCount()
  const filteredEntries = filterActivityEntries(entries, filter)
  const groups = groupEntriesByDate(filteredEntries)

  return (
    <div className="flex h-full flex-col" data-testid="activity-center">
      {/* Glass header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-card/60 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Activity</h2>
          {unreadCount > 0 && (
            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
              {unreadCount} new
            </span>
          )}
        </div>
      </div>

      {/* Glass filter tabs */}
      <div className="flex gap-1.5 border-b border-white/10 bg-card/40 px-5 py-3 backdrop-blur-md" data-testid="activity-tabs">
        {FILTER_TABS.map((tab) => {
          const tabCount = tab.id === "all"
            ? entries.length
            : entries.filter((e) => e.category === tab.id).length
          const isActive = filter === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              className={`
                rounded-full px-4 py-1.5 text-sm transition-all duration-150
                ${isActive
                  ? "border border-white/20 bg-white/15 text-foreground backdrop-blur-sm shadow-sm"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent"
                }
              `}
              onClick={() => setActivityFilter(tab.id)}
              data-testid={`activity-tab-${tab.id}`}
            >
              {tab.label}
              {tabCount > 0 && (
                <span
                  className="ml-1.5 text-xs opacity-60"
                  data-testid={`activity-tab-badge-${tab.id}`}
                >
                  {tabCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Feed */}
      <ScrollArea className="flex-1">
        <div className="px-5 pb-6 pt-3" data-testid="activity-feed-list">
          {filteredEntries.length === 0 && (
            <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 py-16 text-center backdrop-blur-md">
              <span className="mb-3 text-muted-foreground opacity-30">
                <BellIcon />
              </span>
              <p className="text-sm font-medium text-muted-foreground">No notifications yet</p>
              <p className="mt-1 text-xs text-muted-foreground opacity-60">
                Canvas updates and AI insights will appear here
              </p>
            </div>
          )}

          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 mt-5 px-1 text-xs font-medium uppercase tracking-widest text-muted-foreground first:mt-2">
                {group.label}
              </p>
              <div className="space-y-1.5">
                {group.entries.map((entry, i) => (
                  <ActivityFeedItem key={entry.id} entry={entry} index={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
