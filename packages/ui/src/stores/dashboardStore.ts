import { create } from "zustand"

interface DashboardState {
  readonly lastRefresh: number | null
  readonly setLastRefresh: (time: number) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  lastRefresh: null,
  setLastRefresh: (time) => set({ lastRefresh: time }),
}))
