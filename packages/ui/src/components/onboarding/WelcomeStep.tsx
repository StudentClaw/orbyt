import type { OnboardingStepProps } from "./OnboardingWizard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function WelcomeStep({ onNext }: OnboardingStepProps) {
  return (
    <Card data-testid="welcome-step">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome to Orbyt</CardTitle>
        <CardDescription>
          Your AI-powered study companion that keeps you on track.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-center">
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Orbyt connects to your Canvas LMS, understands your assignments,
            deadlines, and course progress, and helps you plan your study sessions intelligently.
          </p>
          <p>
            Your data stays on your machine. We never share your academic information
            with third parties.
          </p>
        </div>
        <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground">
          ~5 min to set up
        </div>
        <div>
          <Button
            size="lg"
            onClick={onNext}
            data-testid="welcome-get-started"
          >
            Get Started
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
