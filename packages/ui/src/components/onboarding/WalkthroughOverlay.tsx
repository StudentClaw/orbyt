import type { WalkthroughStep } from "./walkthrough-steps"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface WalkthroughOverlayProps {
  readonly steps: ReadonlyArray<WalkthroughStep>
  readonly currentStep: number
  readonly onNext: () => void
  readonly onDismiss: () => void
}

export function WalkthroughOverlay({
  steps,
  currentStep,
  onNext,
  onDismiss,
}: WalkthroughOverlayProps) {
  const step = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="walkthrough-overlay"
    >
      <Card className="mx-4 max-w-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{step.title}</CardTitle>
            <span className="text-xs text-muted-foreground">
              {currentStep + 1} / {steps.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {step.description}
          </p>
          <div className="flex justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              data-testid="walkthrough-dismiss"
            >
              Skip tour
            </Button>
            <Button
              size="sm"
              onClick={onNext}
              data-testid="walkthrough-next"
            >
              {isLastStep ? "Got it" : "Next"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
