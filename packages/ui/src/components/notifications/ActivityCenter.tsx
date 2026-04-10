import {
  useActivityEntries,
  useActivityFilter,
  useActivityUnreadCount,
  setActivityFilter,
  markAllActivityRead,
  filterActivityEntries,
  type ActivityFilterCategory,
} from "@/rpc/activityState"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { ActivityFeedItem } from "./ActivityFeedItem"

const FILTER_TABS: ReadonlyArray<{ id: ActivityFilterCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "canvas", label: "Canvas" },
  { id: "planner", label: "Planner" },
  { id: "workflow", label: "Agent" },
  { id: "insight", label: "Insights" },
]

export function ActivityCenter() {
  const entries = useActivityEntries()
  const filter = useActivityFilter()
  const unreadCount = useActivityUnreadCount()
  const filteredEntries = filterActivityEntries(entries, filter)

  return (
    <div className="flex h-full flex-col" data-testid="activity-center">
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-lg font-semibold">Activity</h2>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllActivityRead()}
            data-testid="activity-mark-read"
          >
            Mark all read
          </Button>
        )}
        {unreadCount === 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllActivityRead()}
            data-testid="activity-mark-read"
          >
            Mark all read
          </Button>
        )}
      </div>

      <div className="flex gap-1 border-b px-4 py-2" data-testid="activity-tabs">
        {FILTER_TABS.map((tab) => {
          const tabCount = tab.id === "all"
            ? entries.length
            : entries.filter((e) => e.category === tab.id).length

          return (
            <button
              key={tab.id}
              type="button"
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                filter === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => setActivityFilter(tab.id)}
              data-testid={`activity-tab-${tab.id}`}
            >
              {tab.label}
              {tabCount > 0 && (
                <span
                  className="ml-1.5 text-xs opacity-70"
                  data-testid={`activity-tab-badge-${tab.id}`}
                >
                  {tabCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 p-4" data-testid="activity-feed-list">
          {filteredEntries.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No activity yet
            </p>
          )}
          {filteredEntries.map((entry) => (
            <ActivityFeedItem key={entry.id} entry={entry} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
