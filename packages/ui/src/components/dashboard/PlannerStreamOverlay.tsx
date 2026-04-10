import { Button } from "@/components/ui/button"
import type { PlannerStreamState } from "@/rpc/plannerState"

interface PlannerStreamOverlayProps {
  readonly streamState: PlannerStreamState | null
  readonly onCancel?: () => void
}

export function PlannerStreamOverlay({
  streamState,
  onCancel,
}: PlannerStreamOverlayProps) {
  if (!streamState) return null

  const isComplete = streamState.stage === "plan.complete"

  return (
    <div
      className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2"
      data-testid="planner-stream-overlay"
    >
      {!isComplete && (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      )}
      <span className="flex-1 text-sm" data-testid="stream-label">
        {streamState.label}
      </span>
      {!isComplete && (
        <Button
          variant="ghost"
          size="sm"
          data-testid="stream-cancel"
          onClick={onCancel}
        >
          Cancel
        </Button>
      )}
    </div>
  )
}
