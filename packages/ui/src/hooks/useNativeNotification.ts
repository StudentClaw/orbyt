import { useEffect, useRef } from "react"
import { useActivityEntries } from "@/rpc/activityState"

const HIGH_PRIORITY_THRESHOLD = 3

export function useNativeNotification(): void {
  const entries = useActivityEntries()
  const previousCountRef = useRef(entries.length)

  useEffect(() => {
    if (entries.length <= previousCountRef.current) {
      previousCountRef.current = entries.length
      return
    }

    const newCount = entries.length - previousCountRef.current
    const newEntries = entries.slice(0, newCount)

    for (const entry of newEntries) {
      if (entry.priority !== undefined && entry.priority >= HIGH_PRIORITY_THRESHOLD) {
        window.electronAPI?.invoke("notification:show", {
          title: entry.title,
          body: entry.body ?? "",
        })
      }
    }

    previousCountRef.current = entries.length
  }, [entries])
}
