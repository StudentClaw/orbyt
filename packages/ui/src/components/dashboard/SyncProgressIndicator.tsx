import type { CanvasSyncProgress } from "@/rpc/canvasState"
import { Progress } from "@/components/ui/progress"

interface SyncProgressIndicatorProps {
  readonly syncProgress: CanvasSyncProgress | null
}

export function SyncProgressIndicator({ syncProgress }: SyncProgressIndicatorProps) {
  if (!syncProgress || syncProgress.status !== "syncing") return null

  return (
    <div
      className="flex items-center gap-3 rounded-lg border px-4 py-2"
      data-testid="sync-progress"
    >
      <span className="text-sm text-muted-foreground">Syncing Canvas data…</span>
      <Progress value={syncProgress.progress} className="h-2 flex-1" />
      <span className="text-xs text-muted-foreground">
        {Math.round(syncProgress.progress)}%
      </span>
    </div>
  )
}
