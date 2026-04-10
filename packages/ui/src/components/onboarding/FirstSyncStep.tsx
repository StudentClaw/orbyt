import { useEffect, useRef } from "react"
import type { OnboardingStepProps } from "./OnboardingWizard"
import { useRuntimeCanvasSyncProgress } from "@/hooks/useAppRuntime"
import { getPrimaryWsRpcClient } from "@/rpc/appRuntime"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

export function FirstSyncStep({ onNext: _onNext }: OnboardingStepProps) {
  const syncProgress = useRuntimeCanvasSyncProgress()
  const syncTriggered = useRef(false)

  useEffect(() => {
    if (syncTriggered.current) return
    syncTriggered.current = true

    const client = getPrimaryWsRpcClient()
    client.canvas.sync().catch(() => {
      // Sync failure handled by sync progress events
    })
  }, [])

  const isDone = syncProgress?.status === "done"
  const isError = syncProgress?.status === "error"
  const isSyncing = syncProgress?.status === "syncing"

  return (
    <Card data-testid="first-sync-step">
      <CardHeader className="text-center">
        <CardTitle className="text-lg">Importing Canvas Data</CardTitle>
        <CardDescription>
          {isDone
            ? "Import complete!"
            : isError
              ? "Something went wrong during sync."
              : "Pulling your courses, assignments, and grades..."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(isSyncing || !syncProgress) && (
          <div data-testid="sync-progress-bar">
            <Progress value={syncProgress?.progress ?? 0} />
            <p className="mt-1 text-center text-xs text-muted-foreground">
              {syncProgress
                ? `${Math.round(syncProgress.progress)}%`
                : "Starting sync..."}
            </p>
          </div>
        )}

        {isDone && (
          <div
            className="rounded-lg border bg-muted/30 p-4 text-center text-sm"
            data-testid="sync-summary"
          >
            <p className="font-medium text-green-500">
              Canvas data imported successfully
            </p>
            <p className="mt-1 text-muted-foreground">
              Your courses and assignments are ready.
            </p>
          </div>
        )}

        {isError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-sm">
            <p className="text-destructive">
              Sync failed. You can retry from the dashboard later.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
