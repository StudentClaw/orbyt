import type { OnboardingStepProps } from "./OnboardingWizard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function FirstSyncStep({ onNext }: OnboardingStepProps) {
  // TODO(canvas-mcp): replace with real sync progress once partner lands Canvas MCP.
  // When ready: call client.canvas.sync(), subscribe to canvas.syncProgress push events,
  // show Progress bar, and auto-advance on "done" status.
  return (
    <Card data-testid="first-sync-step">
      <CardHeader className="text-center">
        <CardTitle className="text-lg">Canvas Sync</CardTitle>
        <CardDescription>
          Canvas integration is being set up. You can finish this step once it&apos;s ready.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 py-4">
        <p className="text-center text-sm text-muted-foreground">
          Your courses and assignments will appear here after Canvas is connected.
        </p>
        <Button onClick={onNext} data-testid="sync-skip-btn">
          Continue
        </Button>
      </CardContent>
    </Card>
  )
}
