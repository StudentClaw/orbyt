import { create } from "zustand"

interface SettingsState {
  readonly theme: "dark" | "light" | "system"
  readonly setTheme: (theme: "dark" | "light" | "system") => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: "dark",
  setTheme: (theme) => set({ theme }),
}))
