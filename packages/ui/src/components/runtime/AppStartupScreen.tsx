import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReadinessProgressBar } from "./ReadinessProgressBar"
import type { RuntimeStartupState } from "@/rpc/runtimeStartupState"

interface AppStartupScreenProps {
  readonly state: RuntimeStartupState
  readonly onRetry: () => void
}

function resolveActiveStage(state: RuntimeStartupState): 0 | 1 | 2 {
  switch (state.phase) {
    case "bootstrapping":
    case "connecting":
      return 0
    case "hydrating":
      return 1
    case "ready":
    case "error":
      return 2
  }
}

export function AppStartupScreen({ state, onRetry }: AppStartupScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <Card className="w-full max-w-lg border-border/70 shadow-lg" data-testid="app-startup-screen">
        <CardHeader className="space-y-3">
          <div className="inline-flex w-fit items-center rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            Orbyt
          </div>
          <div className="space-y-2">
            <CardTitle className="font-heading text-2xl">{state.label}</CardTitle>
            <CardDescription className="text-sm">
              {state.phase === "error" ? state.error ?? state.detail : state.detail}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <ReadinessProgressBar activeStage={resolveActiveStage(state)} testId="app-startup-progress" />
          {state.phase === "error" ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                The local runtime did not finish booting. Retry without closing the app.
              </p>
              <Button onClick={onRetry} data-testid="app-startup-retry">
                Retry
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Orbyt is connecting to the local runtime before opening the app.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
