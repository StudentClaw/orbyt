import type { WsRpcClient } from "./wsRpcClient"
import { appAtomRegistry, createAtom, useAtomValue } from "./atomRegistry"

export interface DashboardSectionState {
  readonly lastUpdatedAt: string | null
  readonly loading: boolean
  readonly error: string | null
}

const INITIAL_SECTION_STATE: DashboardSectionState = {
  lastUpdatedAt: null,
  loading: false,
  error: null,
}

export type DashboardSection =
  | "priorityQueue"
  | "insights"
  | "deadlines"
  | "calendar"
  | "grades"
  | "progress"
  | "announcements"
  | "quickActions"

export type DashboardSectionsMap = Readonly<Record<DashboardSection, DashboardSectionState>>

const INITIAL_SECTIONS: DashboardSectionsMap = {
  priorityQueue: INITIAL_SECTION_STATE,
  insights: INITIAL_SECTION_STATE,
  deadlines: INITIAL_SECTION_STATE,
  calendar: INITIAL_SECTION_STATE,
  grades: INITIAL_SECTION_STATE,
  progress: INITIAL_SECTION_STATE,
  announcements: INITIAL_SECTION_STATE,
  quickActions: INITIAL_SECTION_STATE,
}

const dashboardSectionsAtom = createAtom<DashboardSectionsMap>(
  "dashboard-sections",
  INITIAL_SECTIONS,
)

// --- Imperative getters/setters ---

export function getDashboardSections(): DashboardSectionsMap {
  return appAtomRegistry.get(dashboardSectionsAtom)
}

export function updateDashboardSection(
  section: DashboardSection,
  update: Partial<DashboardSectionState>,
): void {
  const current = appAtomRegistry.get(dashboardSectionsAtom)
  appAtomRegistry.set(dashboardSectionsAtom, {
    ...current,
    [section]: { ...current[section], ...update },
  })
}

// --- Event application ---

export function applyDashboardUpdateEvent(data: {
  readonly section: string
}): void {
  const section = data.section as DashboardSection
  const current = appAtomRegistry.get(dashboardSectionsAtom)
  if (!(section in current)) return

  appAtomRegistry.set(dashboardSectionsAtom, {
    ...current,
    [section]: {
      ...current[section],
      lastUpdatedAt: new Date().toISOString(),
      loading: false,
      error: null,
    },
  })
}

// --- Sync starter ---

export function startDashboardStateSync(client: WsRpcClient): () => void {
  let disposed = false

  const cleanups = [
    client.dashboard.onUpdate(
      (event) => {
        if (!disposed) {
          applyDashboardUpdateEvent(event)
        }
      },
    ),
  ]

  return () => {
    disposed = true
    for (const cleanup of cleanups) {
      cleanup()
    }
  }
}

// --- React hooks ---

export function useDashboardSections(): DashboardSectionsMap {
  return useAtomValue(dashboardSectionsAtom)
}

export function useDashboardSection(section: DashboardSection): DashboardSectionState {
  return useAtomValue(dashboardSectionsAtom, (value) => value[section])
}

// --- Test reset ---

export function resetDashboardStateForTests(): void {
  appAtomRegistry.set(dashboardSectionsAtom, INITIAL_SECTIONS)
}
