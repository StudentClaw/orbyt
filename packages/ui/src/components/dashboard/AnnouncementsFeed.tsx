import type { AnnouncementData } from "@/__mocks__/dashboard-fixtures"
import { AnnouncementCard } from "./AnnouncementCard"

interface AnnouncementsFeedProps {
  readonly announcements: ReadonlyArray<AnnouncementData>
}

export function AnnouncementsFeed({ announcements }: AnnouncementsFeedProps) {
  if (announcements.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Announcements</h2>
        <p className="text-sm text-muted-foreground" data-testid="no-announcements">
          No announcements
        </p>
      </div>
    )
  }

  const sorted = announcements.toSorted(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
  )

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Announcements</h2>
      <div className="flex flex-col gap-3" data-testid="announcements-feed">
        {sorted.map((ann) => (
          <AnnouncementCard key={ann.id} announcement={ann} />
        ))}
      </div>
    </div>
  )
}
