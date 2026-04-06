import { create } from "zustand"

interface OnboardingState {
  readonly currentStep: number
  readonly completedSteps: readonly number[]
  readonly setCurrentStep: (step: number) => void
  readonly completeStep: (step: number) => void
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  currentStep: 0,
  completedSteps: [],
  setCurrentStep: (step) => set({ currentStep: step }),
  completeStep: (step) =>
    set((state) => ({
      completedSteps: state.completedSteps.includes(step)
        ? state.completedSteps
        : [...state.completedSteps, step],
    })),
}))
