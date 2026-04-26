import type {
  OnboardingStepName,
  OnboardingStepStatus,
  OnboardingAnswers,
  StudentDna,
  CardWeight,
} from "@orbyt/contracts"
import { appAtomRegistry, createAtom, useAtomValue } from "./atomRegistry"
import type { WsRpcClient } from "./wsRpcClient"

export interface OnboardingStepDefinition {
  readonly id: OnboardingStepName
  readonly label: string
  readonly required: boolean
}

export const ONBOARDING_STEPS: ReadonlyArray<OnboardingStepDefinition> = [
  { id: "dna-discovery", label: "Study DNA", required: true },
  { id: "active-hours", label: "Active Hours", required: false },
  { id: "busy-grid", label: "Weekly Rhythm", required: false },
  { id: "ai-connect", label: "AI Connect", required: false },
  { id: "canvas-sync", label: "Canvas", required: false },
  { id: "launch", label: "Launch", required: false },
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
  readonly answers: Partial<OnboardingAnswers>
  readonly dna: StudentDna | null
  readonly classifying: boolean
}

const STORAGE_KEY = "orbyt:onboarding"

function createInitialSteps(): ReadonlyArray<OnboardingStepState> {
  return ONBOARDING_STEPS.map(() => ({ status: "pending" as const, completedAt: null }))
}

function createInitialState(): OnboardingWizardState {
  return {
    currentStep: 0,
    steps: createInitialSteps(),
    overallStatus: "in_progress",
    aiAuthStatus: "pending",
    answers: {},
    dna: null,
    classifying: false,
  }
}

const onboardingWizardAtom = createAtom<OnboardingWizardState>(
  "onboarding-wizard",
  createInitialState(),
)

export const cardWeightsAtom = createAtom<ReadonlyArray<CardWeight>>(
  "onboarding-card-weights",
  [],
)

export const serverHydrationCompleteAtom = createAtom<boolean>(
  "onboarding-server-hydration-complete",
  false,
)

export function getOnboardingState(): OnboardingWizardState {
  return appAtomRegistry.get(onboardingWizardAtom)
}

export function isOnboardingComplete(): boolean {
  return appAtomRegistry.get(onboardingWizardAtom).overallStatus === "completed"
}

export function setAnswers(answers: Partial<OnboardingAnswers>): void {
  const state = appAtomRegistry.get(onboardingWizardAtom)
  appAtomRegistry.set(onboardingWizardAtom, { ...state, answers })
  if (_primaryClient && Object.keys(answers).length === 11) {
    void _primaryClient.onboarding.setAnswers({ answers: answers as OnboardingAnswers }).catch(() => undefined)
  }
}

export function setDna(dna: StudentDna | null): void {
  const state = appAtomRegistry.get(onboardingWizardAtom)
  appAtomRegistry.set(onboardingWizardAtom, { ...state, dna })
}

export function setClassifying(classifying: boolean): void {
  const state = appAtomRegistry.get(onboardingWizardAtom)
  appAtomRegistry.set(onboardingWizardAtom, { ...state, classifying })
}

export function setCardWeights(weights: ReadonlyArray<CardWeight>): void {
  appAtomRegistry.set(cardWeightsAtom, weights)
}

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
  syncStepToServer(stepName, "completed")
}

export function skipOnboardingStep(): void {
  const state = appAtomRegistry.get(onboardingWizardAtom)
  const stepDef = ONBOARDING_STEPS[state.currentStep]
  if (stepDef.required) return
  const maxStep = ONBOARDING_STEPS.length - 1
  const updatedSteps = state.steps.map((step, i) =>
    i === state.currentStep ? { status: "skipped" as const, completedAt: null } : step,
  )
  appAtomRegistry.set(onboardingWizardAtom, {
    ...state,
    currentStep: Math.min(state.currentStep + 1, maxStep),
    steps: updatedSteps,
  })
  syncStepToServer(stepDef.id, "skipped")
}

export function goToOnboardingStep(index: number): void {
  const state = appAtomRegistry.get(onboardingWizardAtom)
  const clamped = Math.max(0, Math.min(index, ONBOARDING_STEPS.length - 1))
  appAtomRegistry.set(onboardingWizardAtom, { ...state, currentStep: clamped })
}

export function setAiAuthStatus(status: AiAuthStatus): void {
  const state = appAtomRegistry.get(onboardingWizardAtom)
  appAtomRegistry.set(onboardingWizardAtom, { ...state, aiAuthStatus: status })
}

export function setCanvasTokenValidated(_validated: boolean): void {
  // back-compat no-op
}

export function completeOnboarding(): void {
  const state = appAtomRegistry.get(onboardingWizardAtom)
  appAtomRegistry.set(onboardingWizardAtom, {
    ...state,
    overallStatus: "completed" as const,
  })
  void syncOverallStatusToServer("completed")
}

export function persistOnboardingState(): void {
  const state = appAtomRegistry.get(onboardingWizardAtom)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
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
    return {
      ...parsed,
      answers: parsed.answers ?? {},
      dna: parsed.dna ?? null,
      classifying: false,
    }
  } catch {
    return null
  }
}

export function hydrateOnboardingState(): void {
  const persisted = readPersistedOnboardingState()
  if (persisted) appAtomRegistry.set(onboardingWizardAtom, persisted)
}

let _primaryClient: WsRpcClient | null = null

export function setOnboardingRpcClient(client: WsRpcClient): void {
  _primaryClient = client
}

function syncStepToServer(stepName: OnboardingStepName, status: OnboardingStepStatus): void {
  if (!_primaryClient) return
  void _primaryClient.onboarding.setStepStatus({ stepName, status }).catch(() => undefined)
}

function syncOverallStatusToServer(status: "in_progress" | "completed"): Promise<void> {
  if (!_primaryClient) return Promise.resolve()
  return _primaryClient.onboarding
    .setOverallStatus({ status })
    .then(() => undefined)
    .catch(() => undefined)
}

export async function classifyDnaThroughServer(answers: OnboardingAnswers): Promise<StudentDna | null> {
  if (!_primaryClient) return null
  setClassifying(true)
  try {
    const result = await _primaryClient.onboarding.classifyDna({ answers })
    setDna(result.dna)
    setCardWeights(result.cardWeights)
    persistOnboardingState()
    return result.dna
  } catch {
    return null
  } finally {
    setClassifying(false)
  }
}

export async function hydrateOnboardingStateFromServer(client: WsRpcClient): Promise<void> {
  try {
    const persisted = readPersistedOnboardingState()
    const [snapshot, aiAuth, dnaSnapshot] = await Promise.all([
      client.onboarding.getSnapshot(),
      client.onboarding.getAiAuth(),
      client.onboarding.getDna().catch(() => ({ answers: null, dna: null, cardWeights: [] })),
    ])
    const steps: ReadonlyArray<OnboardingStepState> = ONBOARDING_STEPS.map((def) => {
      const record = snapshot.steps.find((s) => s.stepName === def.id)
      if (!record) return { status: "pending" as const, completedAt: null }
      return { status: record.status, completedAt: record.completedAt }
    })
    const persistedCompleted = persisted?.overallStatus === "completed"
    const derivedOverallStatus: OnboardingWizardState["overallStatus"] =
      snapshot.overallStatus === "completed" || persistedCompleted ? "completed" : "in_progress"
    const derivedAiAuthStatus: AiAuthStatus =
      aiAuth.status === "connected" ? "connected"
        : aiAuth.status === "skipped" ? "skipped" : "pending"
    if (derivedOverallStatus === "completed" && snapshot.overallStatus !== "completed") {
      void client.onboarding.setOverallStatus({ status: "completed" }).catch(() => undefined)
    }
    const firstPending = steps.findIndex((s) => s.status !== "completed")
    const currentStep = derivedOverallStatus === "completed"
      ? ONBOARDING_STEPS.length - 1
      : firstPending === -1 ? ONBOARDING_STEPS.length - 1 : firstPending
    appAtomRegistry.set(onboardingWizardAtom, {
      currentStep,
      steps,
      overallStatus: derivedOverallStatus,
      aiAuthStatus: derivedAiAuthStatus,
      answers: dnaSnapshot.answers ?? persisted?.answers ?? {},
      dna: dnaSnapshot.dna ?? persisted?.dna ?? null,
      classifying: false,
    })
    appAtomRegistry.set(cardWeightsAtom, dnaSnapshot.cardWeights ?? [])
  } catch {
    hydrateOnboardingState()
  } finally {
    appAtomRegistry.set(serverHydrationCompleteAtom, true)
  }
}

export async function resetOnboardingWizardState(client: WsRpcClient): Promise<void> {
  await client.dev.resetSoft().catch(() => undefined)
  appAtomRegistry.set(onboardingWizardAtom, createInitialState())
  appAtomRegistry.set(serverHydrationCompleteAtom, false)
  appAtomRegistry.set(cardWeightsAtom, [])
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

export async function resetAllOnboardingState(client: WsRpcClient): Promise<void> {
  await client.dev.resetHard().catch(() => undefined)
  appAtomRegistry.set(onboardingWizardAtom, createInitialState())
  appAtomRegistry.set(serverHydrationCompleteAtom, false)
  appAtomRegistry.set(cardWeightsAtom, [])
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

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

export function useOnboardingAnswers(): Partial<OnboardingAnswers> {
  return useAtomValue(onboardingWizardAtom, (s) => s.answers)
}

export function useDna(): StudentDna | null {
  return useAtomValue(onboardingWizardAtom, (s) => s.dna)
}

export function useCardWeights(): ReadonlyArray<CardWeight> {
  return useAtomValue(cardWeightsAtom)
}

export function resetOnboardingStateForTests(): void {
  appAtomRegistry.set(onboardingWizardAtom, createInitialState())
  appAtomRegistry.set(serverHydrationCompleteAtom, false)
  appAtomRegistry.set(cardWeightsAtom, [])
  _primaryClient = null
}
