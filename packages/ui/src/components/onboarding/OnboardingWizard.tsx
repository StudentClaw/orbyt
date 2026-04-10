import { useNavigate } from "@tanstack/react-router"
import {
  ONBOARDING_STEPS,
  useOnboardingState,
  advanceOnboardingStep,
  skipOnboardingStep,
  goToOnboardingStep,
  completeOnboarding,
  persistOnboardingState,
} from "@/rpc/onboardingState"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { WelcomeStep } from "./WelcomeStep"
import { CanvasCredentialStep } from "./CanvasCredentialStep"
import { AiAuthStep } from "./AiAuthStep"
import { PreferencesStep } from "./PreferencesStep"
import { RoutinesStep } from "./RoutinesStep"
import { FirstSyncStep } from "./FirstSyncStep"
import { DashboardWalkthrough } from "./DashboardWalkthrough"

interface OnboardingStepProps {
  readonly onNext: () => void
  readonly onBack: () => void
  readonly onSkip: () => void
}

const STEP_COMPONENTS: ReadonlyArray<(props: OnboardingStepProps) => React.ReactNode> = [
  WelcomeStep,
  CanvasCredentialStep,
  AiAuthStep,
  PreferencesStep,
  RoutinesStep,
  FirstSyncStep,
  DashboardWalkthrough,
]

export type { OnboardingStepProps }

export function OnboardingWizard() {
  const state = useOnboardingState()
  const { currentStep } = state
  const stepDef = ONBOARDING_STEPS[currentStep]
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1
  const isFirstStep = currentStep === 0
  const progressPercent = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100
  const navigate = useNavigate()

  const handleNext = () => {
    if (isLastStep) {
      completeOnboarding()
      persistOnboardingState()
      navigate({ to: "/" })
    } else {
      advanceOnboardingStep()
      persistOnboardingState()
    }
  }

  const handleBack = () => {
    goToOnboardingStep(currentStep - 1)
  }

  const handleSkip = () => {
    skipOnboardingStep()
    persistOnboardingState()
  }

  const StepComponent = STEP_COMPONENTS[currentStep]

  return (
    <div
      className="mx-auto flex max-w-2xl flex-col gap-6 p-6"
      data-testid="onboarding-wizard"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Step {currentStep + 1} of {ONBOARDING_STEPS.length}</span>
          <span>{stepDef.label}</span>
        </div>
        <Progress
          value={progressPercent}
          data-testid="onboarding-progress"
        />
      </div>

      <div className="min-h-[300px]">
        <StepComponent
          onNext={handleNext}
          onBack={handleBack}
          onSkip={handleSkip}
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          {!isFirstStep && (
            <Button
              variant="ghost"
              onClick={handleBack}
              data-testid="onboarding-back"
            >
              Back
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {!stepDef.required && !isLastStep && (
            <Button
              variant="outline"
              onClick={handleSkip}
              data-testid="onboarding-skip"
            >
              Skip
            </Button>
          )}
          <Button
            onClick={handleNext}
            data-testid="onboarding-next"
          >
            {isLastStep ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  )
}
