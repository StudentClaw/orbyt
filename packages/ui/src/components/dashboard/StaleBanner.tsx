import { computeStaleness, type StalenessStatus } from "@/rpc/canvasState"

interface StaleBannerProps {
  readonly lastSyncAt: string | null
  readonly syncInProgress?: boolean
}

export function StaleBanner({ lastSyncAt, syncInProgress }: StaleBannerProps) {
  if (syncInProgress) return null

  const staleness: StalenessStatus = computeStaleness(lastSyncAt)

  if (staleness === "fresh") return null

  return (
    <div
      className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400"
      data-testid="stale-banner"
      role="alert"
    >
      {staleness === "stale"
        ? "Data may be outdated — last synced more than 24 hours ago"
        : "Offline — showing cached data"}
    </div>
  )
}
