import { appAtomRegistry, createAtom, useAtomValue } from "./atomRegistry"

export type RuntimeStartupPhase =
  | "bootstrapping"
  | "connecting"
  | "hydrating"
  | "ready"
  | "error"

export interface RuntimeStartupState {
  readonly phase: RuntimeStartupPhase
  readonly label: string
  readonly detail: string
  readonly error: string | null
}

const INITIAL_RUNTIME_STARTUP_STATE: RuntimeStartupState = {
  phase: "bootstrapping",
  label: "Starting Student Claw",
  detail: "Connecting to Student Claw",
  error: null,
}

const runtimeStartupStateAtom = createAtom<RuntimeStartupState>(
  "runtime-startup-state",
  INITIAL_RUNTIME_STARTUP_STATE,
)

export function getRuntimeStartupState(): RuntimeStartupState {
  return appAtomRegistry.get(runtimeStartupStateAtom)
}

export function setRuntimeStartupState(nextState: RuntimeStartupState): void {
  appAtomRegistry.set(runtimeStartupStateAtom, nextState)
}

export function useRuntimeStartupState(): RuntimeStartupState {
  return useAtomValue(runtimeStartupStateAtom)
}

export function resetRuntimeStartupStateForTests(): void {
  appAtomRegistry.set(runtimeStartupStateAtom, INITIAL_RUNTIME_STARTUP_STATE)
}
