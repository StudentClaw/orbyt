import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { AnnouncementData } from "@/__mocks__/dashboard-fixtures"

interface AnnouncementCardProps {
  readonly announcement: AnnouncementData
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return "Just now"
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? "1 day ago" : `${days} days ago`
}

export function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  const [expanded, setExpanded] = useState(false)

  const truncatedBody =
    announcement.body.length > 120
      ? announcement.body.slice(0, 120) + "..."
      : announcement.body

  return (
    <Card
      size="sm"
      className={announcement.read ? "opacity-70" : ""}
      data-testid={`announcement-${announcement.id}`}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {announcement.title}
          </CardTitle>
          {!announcement.read && (
            <Badge variant="default" className="ml-2 text-[10px]" data-testid="unread-badge">
              New
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {announcement.courseName} · {announcement.professor} · {formatRelativeTime(announcement.postedAt)}
        </p>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {expanded ? announcement.body : truncatedBody}
        </p>
        {announcement.body.length > 120 && (
          <button
            className="mt-1 text-xs text-primary hover:underline"
            onClick={() => setExpanded((prev) => !prev)}
            data-testid={`toggle-${announcement.id}`}
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </CardContent>
    </Card>
  )
}
