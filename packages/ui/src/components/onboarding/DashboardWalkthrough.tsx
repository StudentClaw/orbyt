import { useState } from "react"
import type { OnboardingStepProps } from "./OnboardingWizard"
import { completeOnboarding, persistOnboardingState } from "@/rpc/onboardingState"
import { WalkthroughOverlay } from "./WalkthroughOverlay"
import { DASHBOARD_WALKTHROUGH_STEPS } from "./walkthrough-steps"

export function DashboardWalkthrough({ onNext }: OnboardingStepProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const handleNext = () => {
    if (currentStep >= DASHBOARD_WALKTHROUGH_STEPS.length - 1) {
      completeOnboarding()
      persistOnboardingState()
      onNext()
    } else {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleDismiss = () => {
    completeOnboarding()
    persistOnboardingState()
    onNext()
  }

  return (
    <div data-testid="dashboard-walkthrough-step">
      <WalkthroughOverlay
        steps={DASHBOARD_WALKTHROUGH_STEPS}
        currentStep={currentStep}
        onNext={handleNext}
        onDismiss={handleDismiss}
      />
    </div>
  )
}
