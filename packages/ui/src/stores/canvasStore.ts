import { create } from "zustand"

interface CanvasState {
  readonly courses: readonly unknown[]
  readonly syncStatus: "idle" | "syncing" | "error"
  readonly setCourses: (courses: unknown[]) => void
  readonly setSyncStatus: (status: "idle" | "syncing" | "error") => void
}

export const useCanvasStore = create<CanvasState>((set) => ({
  courses: [],
  syncStatus: "idle",
  setCourses: (courses) => set({ courses }),
  setSyncStatus: (status) => set({ syncStatus: status }),
}))
