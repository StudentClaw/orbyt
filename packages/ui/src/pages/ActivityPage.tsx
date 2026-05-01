import { useEffect } from "react"
import { ActivityCenter } from "@/components/notifications/ActivityCenter"
import { markAllActivityRead } from "@/rpc/activityState"

export function ActivityPage() {
  useEffect(() => {
    markAllActivityRead()
  }, [])

  return (
    <div className="flex h-full flex-col bg-background">
      <ActivityCenter />
    </div>
  )
}
