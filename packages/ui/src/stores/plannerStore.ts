import { create } from "zustand"

interface PlannerState {
  readonly sessions: readonly unknown[]
  readonly tasks: readonly unknown[]
  readonly setSessions: (sessions: unknown[]) => void
  readonly setTasks: (tasks: unknown[]) => void
}

export const usePlannerStore = create<PlannerState>((set) => ({
  sessions: [],
  tasks: [],
  setSessions: (sessions) => set({ sessions }),
  setTasks: (tasks) => set({ tasks }),
}))
