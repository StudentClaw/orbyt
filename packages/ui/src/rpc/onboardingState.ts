import type { OnboardingStepName, OnboardingStepStatus } from "@student-claw/contracts"
import { appAtomRegistry, createAtom, useAtomValue } from "./atomRegistry"
import type { WsRpcClient } from "./wsRpcClient"

export interface OnboardingStepDefinition {
  readonly id: string
  readonly label: string
  readonly required: boolean
}

export const ONBOARDING_STEPS: ReadonlyArray<OnboardingStepDefinition> = [
  { id: "welcome", label: "Welcome", required: false },
  { id: "ai-auth", label: "AI Connection", required: false },
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
    aiAuthStatus: "pending",
  }
}

const onboardingWizardAtom = createAtom<OnboardingWizardState>(
  "onboarding-wizard",
  createInitialState(),
)

// Tracks whether the server hydration round-trip has completed (success or failure).
// Used by the onboarding guard to avoid premature redirects.
export const serverHydrationCompleteAtom = createAtom<boolean>(
  "onboarding-server-hydration-complete",
  false,
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

  const stepName = ONBOARDING_STEPS[state.currentStep].id
  syncStepToServer(stepName as OnboardingStepName, "completed")
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

  const stepName = ONBOARDING_STEPS[state.currentStep].id
  syncStepToServer(stepName as OnboardingStepName, "skipped")
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

export function setAiAuthStatus(status: AiAuthStatus): void {
  const state = appAtomRegistry.get(onboardingWizardAtom)
  appAtomRegistry.set(onboardingWizardAtom, {
    ...state,
    aiAuthStatus: status,
  })
}

export function setCanvasTokenValidated(_validated: boolean): void {
  // Backward-compatible no-op for older onboarding step components/tests.
}

// --- Completion ---

export function completeOnboarding(): void {
  const state = appAtomRegistry.get(onboardingWizardAtom)
  appAtomRegistry.set(onboardingWizardAtom, {
    ...state,
    overallStatus: "completed" as const,
  })
  void syncOverallStatusToServer("completed")
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

function readPersistedOnboardingState(): OnboardingWizardState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as OnboardingWizardState
    if (
      typeof parsed.currentStep !== "number"
      || !Array.isArray(parsed.steps)
      || parsed.steps.length !== ONBOARDING_STEPS.length
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function hydrateOnboardingState(): void {
  const persisted = readPersistedOnboardingState()
  if (persisted) {
    appAtomRegistry.set(onboardingWizardAtom, persisted)
  }
}

// --- Server sync ---

let _primaryClient: WsRpcClient | null = null

/**
 * Called once by appRuntime to provide the RPC client for fire-and-forget syncs.
 */
export function setOnboardingRpcClient(client: WsRpcClient): void {
  _primaryClient = client
}

function syncStepToServer(stepName: OnboardingStepName, status: OnboardingStepStatus): void {
  if (!_primaryClient) return
  void _primaryClient.onboarding
    .setStepStatus({ stepName, status })
    .catch(() => {
      // Server sync failure is non-fatal — localStorage is the fallback
    })
}

function syncOverallStatusToServer(status: "in_progress" | "completed"): Promise<void> {
  if (!_primaryClient) return Promise.resolve()
  return _primaryClient.onboarding
    .setOverallStatus({ status })
    .then(() => undefined)
    .catch(() => undefined)
}

/**
 * Hydrates onboarding state from the server after the WebSocket connects.
 * Falls back to localStorage on any failure.
 */
export async function hydrateOnboardingStateFromServer(client: WsRpcClient): Promise<void> {
  try {
    const persisted = readPersistedOnboardingState()
    const [snapshot, aiAuth] = await Promise.all([
      client.onboarding.getSnapshot(),
      client.onboarding.getAiAuth(),
    ])

    // Map server steps to wizard step states, aligned to ONBOARDING_STEPS order
    const steps: ReadonlyArray<OnboardingStepState> = ONBOARDING_STEPS.map((def) => {
      const record = snapshot.steps.find((s) => s.stepName === def.id)
      if (!record) return { status: "pending" as const, completedAt: null }
      return {
        status: record.status,
        completedAt: record.completedAt,
      }
    })

    const persistedCompleted = persisted?.overallStatus === "completed"
    const persistedAiConnected = persisted?.aiAuthStatus === "connected"
    const derivedOverallStatus: OnboardingWizardState["overallStatus"] =
      snapshot.overallStatus === "completed" || persistedCompleted || aiAuth.status === "connected"
        ? "completed"
        : "in_progress"

    const derivedAiAuthStatus: AiAuthStatus =
      aiAuth.status === "connected" || persistedAiConnected ? "connected"
        : aiAuth.status === "skipped" ? "skipped"
          : "pending"

    if (derivedOverallStatus === "completed" && snapshot.overallStatus !== "completed") {
      void client.onboarding.setOverallStatus({ status: "completed" }).catch(() => undefined)
    }

    if (derivedAiAuthStatus === "connected" && aiAuth.status !== "connected") {
      void client.onboarding.setAiAuth({ status: "connected", provider: "codex" }).catch(() => undefined)
    }

    // Derive currentStep as index of first non-completed step.
    const firstPending = steps.findIndex((s) => s.status !== "completed")
    const currentStep =
      derivedOverallStatus === "completed"
        ? ONBOARDING_STEPS.length - 1
        : firstPending === -1 ? ONBOARDING_STEPS.length - 1 : firstPending

    appAtomRegistry.set(onboardingWizardAtom, {
      currentStep,
      steps,
      overallStatus: derivedOverallStatus,
      aiAuthStatus: derivedAiAuthStatus,
    })
  } catch {
    // Server unreachable or method not yet implemented — fall back to localStorage
    hydrateOnboardingState()
  } finally {
    appAtomRegistry.set(serverHydrationCompleteAtom, true)
  }
}

// --- Dev reset ---

/**
 * Soft reset: clears wizard step state, keeps Canvas token + AI auth.
 */
export async function resetOnboardingWizardState(client: WsRpcClient): Promise<void> {
  await client.dev.resetSoft().catch(() => undefined)
  appAtomRegistry.set(onboardingWizardAtom, createInitialState())
  appAtomRegistry.set(serverHydrationCompleteAtom, false)
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Hard reset: clears everything including Canvas token and AI auth.
 */
export async function resetAllOnboardingState(client: WsRpcClient): Promise<void> {
  await client.dev.resetHard().catch(() => undefined)
  appAtomRegistry.set(onboardingWizardAtom, createInitialState())
  appAtomRegistry.set(serverHydrationCompleteAtom, false)
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
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

export function useIsHydrationComplete(): boolean {
  return useAtomValue(serverHydrationCompleteAtom)
}

// --- Test reset ---

export function resetOnboardingStateForTests(): void {
  appAtomRegistry.set(onboardingWizardAtom, createInitialState())
  appAtomRegistry.set(serverHydrationCompleteAtom, false)
  _primaryClient = null
}
