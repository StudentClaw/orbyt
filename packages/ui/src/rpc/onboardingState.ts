import { appAtomRegistry, createAtom, useAtomValue } from "./atomRegistry"

export interface OnboardingStepDefinition {
  readonly id: string
  readonly label: string
  readonly required: boolean
}

export const ONBOARDING_STEPS: ReadonlyArray<OnboardingStepDefinition> = [
  { id: "welcome", label: "Welcome", required: false },
  { id: "canvas-credential", label: "Canvas Setup", required: true },
  { id: "ai-auth", label: "AI Connection", required: true },
  { id: "preferences", label: "Preferences", required: false },
  { id: "routines", label: "Routines", required: false },
  { id: "first-sync", label: "First Sync", required: false },
  { id: "dashboard-walkthrough", label: "Dashboard Tour", required: false },
]

export interface OnboardingStepState {
  readonly status: "pending" | "completed" | "skipped"
  readonly completedAt: string | null
}

export type AiAuthStatus = "pending" | "connected" | "skipped"

export interface OnboardingWizardState {
  readonly currentStep: number
  readonly steps: ReadonlyArray<OnboardingStepState>
  readonly overallStatus: "in_progress" | "completed"
  readonly canvasTokenValidated: boolean
  readonly aiAuthStatus: AiAuthStatus
}

const STORAGE_KEY = "student-claw:onboarding"

function createInitialSteps(): ReadonlyArray<OnboardingStepState> {
  return ONBOARDING_STEPS.map(() => ({
    status: "pending" as const,
    completedAt: null,
  }))
}

function createInitialState(): OnboardingWizardState {
  return {
    currentStep: 0,
    steps: createInitialSteps(),
    overallStatus: "in_progress",
    canvasTokenValidated: false,
    aiAuthStatus: "pending",
  }
}

const onboardingWizardAtom = createAtom<OnboardingWizardState>(
  "onboarding-wizard",
  createInitialState(),
)

// --- Imperative getters ---

export function getOnboardingState(): OnboardingWizardState {
  return appAtomRegistry.get(onboardingWizardAtom)
}

export function isOnboardingComplete(): boolean {
  const state = appAtomRegistry.get(onboardingWizardAtom)
  return state.overallStatus === "completed"
}

// --- Step progression ---

export function advanceOnboardingStep(): void {
  const state = appAtomRegistry.get(onboardingWizardAtom)
  const maxStep = ONBOARDING_STEPS.length - 1
  if (state.currentStep >= maxStep) return

  const updatedSteps = state.steps.map((step, i) =>
    i === state.currentStep
      ? { status: "completed" as const, completedAt: new Date().toISOString() }
      : step,
  )

  appAtomRegistry.set(onboardingWizardAtom, {
    ...state,
    currentStep: Math.min(state.currentStep + 1, maxStep),
    steps: updatedSteps,
  })
}

export function skipOnboardingStep(): void {
  const state = appAtomRegistry.get(onboardingWizardAtom)
  const stepDef = ONBOARDING_STEPS[state.currentStep]
  if (stepDef.required) return

  const maxStep = ONBOARDING_STEPS.length - 1
  const updatedSteps = state.steps.map((step, i) =>
    i === state.currentStep
      ? { status: "skipped" as const, completedAt: null }
      : step,
  )

  appAtomRegistry.set(onboardingWizardAtom, {
    ...state,
    currentStep: Math.min(state.currentStep + 1, maxStep),
    steps: updatedSteps,
  })
}

export function goToOnboardingStep(index: number): void {
  const state = appAtomRegistry.get(onboardingWizardAtom)
  const clamped = Math.max(0, Math.min(index, ONBOARDING_STEPS.length - 1))

  appAtomRegistry.set(onboardingWizardAtom, {
    ...state,
    currentStep: clamped,
  })
}

// --- Validation flags ---

export function setCanvasTokenValidated(valid: boolean): void {
  const state = appAtomRegistry.get(onboardingWizardAtom)
  appAtomRegistry.set(onboardingWizardAtom, {
    ...state,
    canvasTokenValidated: valid,
  })
}

export function setAiAuthStatus(status: AiAuthStatus): void {
  const state = appAtomRegistry.get(onboardingWizardAtom)
  appAtomRegistry.set(onboardingWizardAtom, {
    ...state,
    aiAuthStatus: status,
  })
}

// --- Completion ---

export function completeOnboarding(): void {
  const state = appAtomRegistry.get(onboardingWizardAtom)
  appAtomRegistry.set(onboardingWizardAtom, {
    ...state,
    overallStatus: "completed" as const,
  })
}

// --- localStorage persistence ---

export function persistOnboardingState(): void {
  const state = appAtomRegistry.get(onboardingWizardAtom)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

export function hydrateOnboardingState(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return

    const parsed = JSON.parse(raw) as OnboardingWizardState
    if (
      typeof parsed.currentStep !== "number" ||
      !Array.isArray(parsed.steps) ||
      parsed.steps.length !== ONBOARDING_STEPS.length
    ) {
      return
    }

    appAtomRegistry.set(onboardingWizardAtom, parsed)
  } catch {
    // Corrupted data — leave state as initial
  }
}

// --- React hooks ---

export function useOnboardingState(): OnboardingWizardState {
  return useAtomValue(onboardingWizardAtom)
}

export function useOnboardingStep(): number {
  return useAtomValue(onboardingWizardAtom, (s) => s.currentStep)
}

export function useIsOnboardingComplete(): boolean {
  return useAtomValue(onboardingWizardAtom, (s) => s.overallStatus === "completed")
}

// --- Test reset ---

export function resetOnboardingStateForTests(): void {
  appAtomRegistry.set(onboardingWizardAtom, createInitialState())
}
